//! Session and conversation history management

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::error::{ClaudeError, Result};

/// Represents a conversation session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationInfo {
    pub id: String,
    pub title: Option<String>,
    pub preview: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_count: usize,
}

/// Manages conversation history from Claude CLI
pub struct SessionManager {
    claude_dir: PathBuf,
    project_hash: Option<String>,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new() -> Self {
        let claude_dir = dirs::home_dir()
            .map(|h| h.join(".claude"))
            .unwrap_or_else(|| PathBuf::from(".claude"));

        Self {
            claude_dir,
            project_hash: None,
        }
    }

    /// Set the project directory to determine the project hash
    pub fn set_project_dir(&mut self, project_dir: &str) {
        // Claude Code uses a hash of the project path for storage
        // This is a simplified version - actual hash may differ
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        project_dir.hash(&mut hasher);
        self.project_hash = Some(format!("{:x}", hasher.finish()));
    }

    /// Get the path to the projects directory
    fn projects_dir(&self) -> PathBuf {
        self.claude_dir.join("projects")
    }

    /// Get the path for a specific project's conversations
    fn project_conversations_dir(&self) -> Option<PathBuf> {
        self.project_hash.as_ref().map(|hash| {
            self.projects_dir().join(hash)
        })
    }

    /// List all conversations for the current project
    pub fn list_conversations(&self) -> Result<Vec<ConversationInfo>> {
        let conv_dir = match self.project_conversations_dir() {
            Some(dir) => dir,
            None => return Ok(Vec::new()),
        };

        if !conv_dir.exists() {
            return Ok(Vec::new());
        }

        let mut conversations = Vec::new();

        // Read conversation directories
        let entries = fs::read_dir(&conv_dir)
            .map_err(|e| ClaudeError::HistoryParseError(e.to_string()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(conv) = self.parse_conversation_dir(&path) {
                    conversations.push(conv);
                }
            }
        }

        // Sort by updated_at descending
        conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(conversations)
    }

    /// Parse a conversation directory to extract metadata
    fn parse_conversation_dir(&self, path: &PathBuf) -> Option<ConversationInfo> {
        let id = path.file_name()?.to_str()?.to_string();

        // Try to read conversation metadata
        let _metadata_path = path.join("metadata.json");
        let messages_path = path.join("messages.json");

        let (title, preview, message_count) = if messages_path.exists() {
            self.parse_messages_file(&messages_path).unwrap_or((None, None, 0))
        } else {
            (None, None, 0)
        };

        // Get file timestamps
        let metadata = fs::metadata(path).ok()?;
        let created_at = metadata.created().ok()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(Utc::now);
        let updated_at = metadata.modified().ok()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(Utc::now);

        Some(ConversationInfo {
            id,
            title,
            preview,
            created_at,
            updated_at,
            message_count,
        })
    }

    /// Parse messages file to extract title and preview
    fn parse_messages_file(&self, path: &PathBuf) -> Result<(Option<String>, Option<String>, usize)> {
        let content = fs::read_to_string(path)
            .map_err(|e| ClaudeError::HistoryParseError(e.to_string()))?;

        // Try to parse as JSON array of messages
        let messages: Vec<serde_json::Value> = serde_json::from_str(&content)
            .map_err(|e| ClaudeError::HistoryParseError(e.to_string()))?;

        let message_count = messages.len();

        // Get first user message as title/preview
        let first_user_msg = messages.iter()
            .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string());

        let title = first_user_msg.clone().map(|s| {
            if s.len() > 50 {
                format!("{}...", &s[..47])
            } else {
                s
            }
        });

        let preview = first_user_msg.map(|s| {
            if s.len() > 100 {
                format!("{}...", &s[..97])
            } else {
                s
            }
        });

        Ok((title, preview, message_count))
    }

    /// Get a specific conversation by ID
    #[allow(dead_code)]
    pub fn get_conversation(&self, id: &str) -> Result<Option<ConversationInfo>> {
        let conv_dir = match self.project_conversations_dir() {
            Some(dir) => dir.join(id),
            None => return Ok(None),
        };

        if !conv_dir.exists() {
            return Ok(None);
        }

        Ok(self.parse_conversation_dir(&conv_dir))
    }

    /// Check if Claude CLI is authenticated
    /// Note: Claude Code uses OAuth tokens stored in the system keychain,
    /// so we check for indicators that the CLI has been configured and used.
    pub fn is_authenticated(&self) -> bool {
        // Check for files that indicate Claude CLI has been configured
        let settings_file = self.claude_dir.join("settings.json");
        let history_file = self.claude_dir.join("history.jsonl");
        let projects_dir = self.claude_dir.join("projects");

        // If settings exist and there's history, the user has likely authenticated
        if settings_file.exists() && (history_file.exists() || projects_dir.exists()) {
            return true;
        }

        // Fallback: Run a quick CLI check to verify authentication status
        // This is more reliable but has a small performance cost
        match std::process::Command::new("claude")
            .arg("--version")
            .env("NO_COLOR", "1")
            .output()
        {
            Ok(output) => {
                // If claude --version succeeds, the CLI is installed and configured
                // Note: Claude Code will fail with an auth error if not logged in
                output.status.success()
            }
            Err(_) => false,
        }
    }

    /// Get the Claude CLI config directory
    #[allow(dead_code)]
    pub fn get_claude_dir(&self) -> &PathBuf {
        &self.claude_dir
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_manager_creation() {
        let manager = SessionManager::new();
        assert!(manager.claude_dir.ends_with(".claude"));
    }

    #[test]
    fn test_project_hash() {
        let mut manager = SessionManager::new();
        manager.set_project_dir("/Users/test/project");
        assert!(manager.project_hash.is_some());
    }
}
