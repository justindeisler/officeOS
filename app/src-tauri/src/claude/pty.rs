//! Claude CLI process handling (non-interactive mode)
//!
//! Uses `claude -p --output-format stream-json` for clean, non-TUI output.

use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use tokio::sync::mpsc;

use super::error::{ClaudeError, Result};

/// Configuration for the Claude process
pub struct ProcessConfig {
    pub working_dir: String,
    pub mcp_config_path: Option<String>,
    pub system_prompt: Option<String>,
}

impl Default for ProcessConfig {
    fn default() -> Self {
        Self {
            working_dir: String::new(),
            mcp_config_path: None,
            system_prompt: None,
        }
    }
}

/// Streaming JSON event from Claude CLI
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[allow(dead_code)]
pub enum StreamEvent {
    #[serde(rename = "system")]
    System {
        subtype: String,
        session_id: String,
        #[serde(default)]
        tools: Vec<String>,
    },
    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
        session_id: String,
    },
    #[serde(rename = "result")]
    Result {
        subtype: String,
        result: String,
        session_id: String,
        #[serde(default)]
        is_error: bool,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AssistantMessage {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub content: Vec<ContentBlock>,
    #[serde(default)]
    pub stop_reason: Option<String>,
    // Allow any other fields to be ignored
    #[serde(flatten)]
    pub _extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(other)]
    Other,
}

/// Output from parsing a stream event
#[derive(Debug)]
pub enum ParsedOutput {
    SessionId(String),
    Text(String),
    Complete,
    Error(String),
}

/// Parse a JSON line from Claude CLI output
pub fn parse_stream_line(line: &str) -> Option<ParsedOutput> {
    // Try to parse as JSON
    let event: StreamEvent = match serde_json::from_str(line) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[Claude] JSON parse error: {} for line: {}", e, &line[..line.len().min(200)]);
            return None;
        }
    };

    match event {
        StreamEvent::System { session_id, .. } => {
            eprintln!("[Claude] Got session_id: {}", session_id);
            Some(ParsedOutput::SessionId(session_id))
        }
        StreamEvent::Assistant { message, .. } => {
            // Extract text from content blocks
            let mut text_parts = Vec::new();
            for block in message.content {
                if let ContentBlock::Text { text } = block {
                    text_parts.push(text);
                }
            }
            if !text_parts.is_empty() {
                let combined = text_parts.join("");
                eprintln!("[Claude] Got text: {} chars", combined.len());
                return Some(ParsedOutput::Text(combined));
            }
            None
        }
        StreamEvent::Result { result, is_error, .. } => {
            eprintln!("[Claude] Got result (is_error={})", is_error);
            if is_error {
                Some(ParsedOutput::Error(result))
            } else {
                Some(ParsedOutput::Complete)
            }
        }
        StreamEvent::Unknown => {
            eprintln!("[Claude] Unknown event type in line: {}", &line[..line.len().min(100)]);
            None
        }
    }
}

/// Wrapper around Claude CLI process (non-interactive)
pub struct ClaudeProcess {
    config: ProcessConfig,
    current_child: Option<Child>,
}

impl ClaudeProcess {
    pub fn new(config: ProcessConfig) -> Self {
        Self {
            config,
            current_child: None,
        }
    }

    /// Send a message to Claude and stream the response
    /// Returns the session_id for future resume operations
    pub fn send_message(
        &mut self,
        message: &str,
        resume_id: Option<&str>,
        output_tx: mpsc::UnboundedSender<String>,
    ) -> Result<Option<String>> {
        // Find claude CLI path
        let claude_path = find_claude_path()
            .ok_or_else(|| ClaudeError::SpawnFailed("Claude CLI not found".to_string()))?;

        // Build command
        let mut cmd = Command::new(&claude_path);
        cmd.arg("-p")  // Print mode (non-interactive)
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose");  // Required for stream-json

        // Set working directory
        if !self.config.working_dir.is_empty() {
            cmd.current_dir(&self.config.working_dir);
        }

        // Resume existing session
        if let Some(id) = resume_id {
            cmd.arg("--resume").arg(id);
        }

        // Add MCP config if available
        if let Some(ref mcp_path) = self.config.mcp_config_path {
            cmd.arg("--mcp-config").arg(mcp_path);
        }

        // Add system prompt if configured
        if let Some(ref prompt) = self.config.system_prompt {
            cmd.arg("--system-prompt").arg(prompt);
        }

        // Add the message
        cmd.arg(message);

        // Configure stdio - inherit stderr so it doesn't block, pipe stdout for JSON
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::inherit());  // Let stderr go to console for debugging

        eprintln!("[Claude] Spawning: {} -p --output-format stream-json --verbose", claude_path);
        eprintln!("[Claude] Message: {}", &message[..message.len().min(100)]);
        if !self.config.working_dir.is_empty() {
            eprintln!("[Claude] Working dir: {}", self.config.working_dir);
        }
        if let Some(id) = resume_id {
            eprintln!("[Claude] Resume ID: {}", id);
        }

        // Spawn process
        let mut child = cmd.spawn()
            .map_err(|e| {
                eprintln!("[Claude] Failed to spawn: {}", e);
                ClaudeError::SpawnFailed(e.to_string())
            })?;

        eprintln!("[Claude] Process spawned successfully");

        let stdout = child.stdout.take()
            .ok_or_else(|| ClaudeError::PtyError("Failed to capture stdout".to_string()))?;

        self.current_child = Some(child);

        // Read and parse output
        let reader = BufReader::new(stdout);
        let mut session_id: Option<String> = None;
        let mut line_count = 0;

        eprintln!("[Claude] Starting to read stdout lines...");

        for line in reader.lines() {
            line_count += 1;
            match line {
                Ok(json_line) => {
                    eprintln!("[Claude] Line {}: {} chars", line_count, json_line.len());
                    if let Some(output) = parse_stream_line(&json_line) {
                        match output {
                            ParsedOutput::SessionId(id) => {
                                eprintln!("[Claude] Captured session_id: {}", id);
                                session_id = Some(id);
                            }
                            ParsedOutput::Text(text) => {
                                eprintln!("[Claude] Sending text ({} chars) through channel", text.len());
                                if output_tx.send(text).is_err() {
                                    eprintln!("[Claude] Channel closed, stopping");
                                    break; // Channel closed
                                }
                            }
                            ParsedOutput::Complete => {
                                eprintln!("[Claude] Got completion signal");
                                // Final result received, we're done
                                break;
                            }
                            ParsedOutput::Error(err) => {
                                eprintln!("[Claude] Got error: {}", err);
                                let _ = output_tx.send(format!("Error: {}", err));
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Claude] Read error: {}", e);
                    let _ = output_tx.send(format!("Read error: {}", e));
                    break;
                }
            }
        }

        eprintln!("[Claude] Finished reading, got {} lines", line_count);

        // Wait for child to complete
        if let Some(ref mut child) = self.current_child {
            let _ = child.wait();
        }
        self.current_child = None;

        Ok(session_id)
    }

    /// Kill the current process if running
    pub fn kill(&mut self) -> Result<()> {
        if let Some(ref mut child) = self.current_child {
            child.kill().map_err(|e| ClaudeError::IoError(e))?;
        }
        self.current_child = None;
        Ok(())
    }

    /// Check if a process is currently running
    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        self.current_child.is_some()
    }
}

impl Drop for ClaudeProcess {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}

/// Find the full path to claude CLI
pub fn find_claude_path() -> Option<String> {
    // Common locations for claude CLI
    let possible_paths = [
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude",
        &format!("{}/.local/bin/claude", std::env::var("HOME").unwrap_or_default()),
        &format!("{}/.npm-global/bin/claude", std::env::var("HOME").unwrap_or_default()),
    ];

    // First check if it's in PATH
    if let Ok(output) = Command::new("which").arg("claude").output() {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let path = path.trim();
                if !path.is_empty() {
                    eprintln!("[Claude] Found claude at: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    // Check common locations
    for path in &possible_paths {
        if std::path::Path::new(path).exists() {
            eprintln!("[Claude] Found claude at: {}", path);
            return Some(path.to_string());
        }
    }

    eprintln!("[Claude] Could not find claude CLI");
    None
}

/// Check if Claude CLI is installed and accessible
pub fn check_claude_cli() -> Result<bool> {
    Ok(find_claude_path().is_some())
}
