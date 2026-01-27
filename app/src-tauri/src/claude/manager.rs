//! Claude CLI process manager (non-interactive mode)

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::error::{ClaudeError, Result};
use super::pty::{check_claude_cli, ClaudeProcess, ProcessConfig};
use super::sessions::{ConversationInfo, SessionManager};

/// Message sent from Claude CLI output
#[derive(Debug, Clone, Serialize)]
pub struct ClaudeOutput {
    pub content: String,
    pub is_complete: bool,
    pub session_id: String,
}

/// Status of the Claude session
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Inactive,
    Starting,
    Active,
    Processing,
    Stopping,
    Error,
}

/// Current session state
#[derive(Debug, Clone, Serialize)]
pub struct SessionState {
    pub status: SessionStatus,
    pub session_id: Option<String>,
    pub error: Option<String>,
}

/// Manager for Claude CLI integration
pub struct ClaudeManager {
    process: Mutex<Option<ClaudeProcess>>,
    session_manager: Mutex<SessionManager>,
    current_session_id: Mutex<Option<String>>,
    status: Mutex<SessionStatus>,
    working_dir: String,
    mcp_config_path: Option<String>,
    system_prompt: Option<String>,
}

impl ClaudeManager {
    /// Create a new Claude manager
    pub fn new(working_dir: String) -> Self {
        let mut session_manager = SessionManager::new();
        session_manager.set_project_dir(&working_dir);

        Self {
            process: Mutex::new(None),
            session_manager: Mutex::new(session_manager),
            current_session_id: Mutex::new(None),
            status: Mutex::new(SessionStatus::Inactive),
            working_dir,
            mcp_config_path: None,
            system_prompt: Some(
                "You are an assistant for the Personal Assistant app. \
                You have access to MCP tools to manage tasks, projects, and time entries. \
                Use list_tasks, create_task, list_projects, and other tools to help the user. \
                Be concise and helpful.".to_string()
            ),
        }
    }

    /// Set MCP config path
    #[allow(dead_code)]
    pub fn set_mcp_config(&mut self, path: String) {
        self.mcp_config_path = Some(path);
    }

    /// Set system prompt
    #[allow(dead_code)]
    pub fn set_system_prompt(&mut self, prompt: String) {
        self.system_prompt = Some(prompt);
    }

    /// Check if Claude CLI is available
    pub fn is_cli_available(&self) -> bool {
        check_claude_cli().unwrap_or(false)
    }

    /// Check if authenticated
    pub fn is_authenticated(&self) -> bool {
        self.session_manager.lock().is_authenticated()
    }

    /// Get current session state
    pub fn get_state(&self) -> SessionState {
        SessionState {
            status: self.status.lock().clone(),
            session_id: self.current_session_id.lock().clone(),
            error: None,
        }
    }

    /// Initialize a session (marks as active, but doesn't spawn a process yet)
    /// Process is spawned on first message
    pub fn start_session(
        &self,
        _app: AppHandle,
        resume_id: Option<String>,
    ) -> Result<String> {
        // Check if already active
        {
            let status = self.status.lock();
            if *status == SessionStatus::Active || *status == SessionStatus::Starting || *status == SessionStatus::Processing {
                return Err(ClaudeError::SessionAlreadyExists(
                    "A session is already active".to_string(),
                ));
            }
        }

        // Generate or use provided session ID
        let session_id = resume_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        *self.current_session_id.lock() = Some(session_id.clone());
        *self.status.lock() = SessionStatus::Active;

        Ok(session_id)
    }

    /// Send a message to Claude (spawns a new process for each message)
    pub fn send_message(&self, app: AppHandle, message: &str) -> Result<()> {
        // Check if session is active
        {
            let status = self.status.lock();
            if *status != SessionStatus::Active {
                return Err(ClaudeError::NoActiveSession);
            }
        }

        // Mark as processing
        *self.status.lock() = SessionStatus::Processing;

        // Get session ID for potential resume
        let resume_id = self.current_session_id.lock().clone();
        let session_id = resume_id.clone().unwrap_or_else(|| "unknown".to_string());

        // Create output channel
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        // Create process config
        let config = ProcessConfig {
            working_dir: self.working_dir.clone(),
            mcp_config_path: self.mcp_config_path.clone(),
            system_prompt: self.system_prompt.clone(),
        };

        // Create and store process
        let mut process = ClaudeProcess::new(config);

        // Clone message for the spawned task
        let message = message.to_string();
        let app_clone = app.clone();
        let session_id_clone = session_id.clone();

        // Spawn the process in a blocking task
        let process_handle = std::thread::spawn(move || {
            let result = process.send_message(
                &message,
                resume_id.as_deref(),
                tx,
            );
            (process, result)
        });

        // Store a reference (we'll update this when the process completes)
        // Note: In this non-interactive model, the process lives only for one message

        // Spawn task to forward output to frontend
        let status_clone = Arc::new(Mutex::new(SessionStatus::Processing));
        let status_for_task = status_clone.clone();

        tokio::spawn(async move {
            while let Some(content) = rx.recv().await {
                let output = ClaudeOutput {
                    content,
                    is_complete: false,
                    session_id: session_id_clone.clone(),
                };

                let _ = app_clone.emit("claude:output", output);
            }

            // Wait for process to complete
            if let Ok((_process, result)) = process_handle.join() {
                match result {
                    Ok(new_session_id) => {
                        // Update session ID if we got a new one
                        if let Some(_id) = new_session_id {
                            // Could update current_session_id here if needed
                        }
                    }
                    Err(e) => {
                        let _ = app_clone.emit("claude:error", e.to_string());
                    }
                }
            }

            // Mark message as complete
            let complete_output = ClaudeOutput {
                content: String::new(),
                is_complete: true,
                session_id: session_id_clone.clone(),
            };
            let _ = app_clone.emit("claude:output", complete_output);

            *status_for_task.lock() = SessionStatus::Active;
        });

        // Update our status back to active after spawning
        // The actual status update happens in the spawned task

        Ok(())
    }

    /// Stop the current session
    pub fn stop_session(&self) -> Result<()> {
        *self.status.lock() = SessionStatus::Stopping;

        // Kill any running process
        let mut process_lock = self.process.lock();
        if let Some(ref mut process) = *process_lock {
            let _ = process.kill();
        }
        *process_lock = None;

        *self.current_session_id.lock() = None;
        *self.status.lock() = SessionStatus::Inactive;

        Ok(())
    }

    /// List conversation history
    pub fn list_conversations(&self) -> Result<Vec<ConversationInfo>> {
        self.session_manager.lock().list_conversations()
    }

    /// Get a specific conversation
    #[allow(dead_code)]
    pub fn get_conversation(&self, id: &str) -> Result<Option<ConversationInfo>> {
        self.session_manager.lock().get_conversation(id)
    }

    /// Check if a session is active
    #[allow(dead_code)]
    pub fn is_active(&self) -> bool {
        let status = self.status.lock();
        *status == SessionStatus::Active || *status == SessionStatus::Processing
    }
}

/// State wrapper for Tauri
pub struct ClaudeManagerState(pub Arc<ClaudeManager>);

impl ClaudeManagerState {
    pub fn new(working_dir: String) -> Self {
        Self(Arc::new(ClaudeManager::new(working_dir)))
    }
}

// Tauri commands
// These will be registered in lib.rs

/// Check Claude CLI status
#[tauri::command]
pub async fn claude_check_status(
    state: tauri::State<'_, ClaudeManagerState>,
) -> std::result::Result<serde_json::Value, String> {
    let manager = &state.0;

    Ok(serde_json::json!({
        "cli_available": manager.is_cli_available(),
        "authenticated": manager.is_authenticated(),
        "session_state": manager.get_state(),
    }))
}

/// Start a new Claude session
#[tauri::command]
pub async fn claude_start_session(
    app: AppHandle,
    state: tauri::State<'_, ClaudeManagerState>,
    resume_id: Option<String>,
) -> std::result::Result<String, String> {
    let manager = &state.0;

    // Check CLI availability
    if !manager.is_cli_available() {
        return Err("Claude CLI not found. Please install Claude Code CLI.".to_string());
    }

    manager
        .start_session(app, resume_id)
        .map_err(|e| e.to_string())
}

/// Send a message to Claude
#[tauri::command]
pub async fn claude_send_message(
    app: AppHandle,
    state: tauri::State<'_, ClaudeManagerState>,
    message: String,
) -> std::result::Result<(), String> {
    let manager = &state.0;
    manager.send_message(app, &message).map_err(|e| e.to_string())
}

/// Stop the current Claude session
#[tauri::command]
pub async fn claude_stop_session(
    state: tauri::State<'_, ClaudeManagerState>,
) -> std::result::Result<(), String> {
    let manager = &state.0;
    manager.stop_session().map_err(|e| e.to_string())
}

/// List conversation history
#[tauri::command]
pub async fn claude_list_conversations(
    state: tauri::State<'_, ClaudeManagerState>,
) -> std::result::Result<Vec<ConversationInfo>, String> {
    let manager = &state.0;
    manager.list_conversations().map_err(|e| e.to_string())
}

/// Get session state
#[tauri::command]
pub async fn claude_get_session_state(
    state: tauri::State<'_, ClaudeManagerState>,
) -> std::result::Result<SessionState, String> {
    let manager = &state.0;
    Ok(manager.get_state())
}
