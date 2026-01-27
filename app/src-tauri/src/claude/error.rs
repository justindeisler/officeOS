//! Error types for Claude CLI integration

use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)]
pub enum ClaudeError {
    #[error("Claude CLI not found. Please install Claude Code CLI.")]
    CliNotFound,

    #[error("Claude CLI not authenticated. Please run 'claude login' first.")]
    NotAuthenticated,

    #[error("Failed to spawn Claude process: {0}")]
    SpawnFailed(String),

    #[error("PTY error: {0}")]
    PtyError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("No active session")]
    NoActiveSession,

    #[error("Session already exists: {0}")]
    SessionAlreadyExists(String),

    #[error("Failed to send message: {0}")]
    SendFailed(String),

    #[error("Process terminated unexpectedly")]
    ProcessTerminated,

    #[error("Failed to parse conversation history: {0}")]
    HistoryParseError(String),
}

impl serde::Serialize for ClaudeError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, ClaudeError>;
