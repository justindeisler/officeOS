//! Claude CLI integration module
//!
//! This module provides integration with the Claude Code CLI,
//! using non-interactive print mode with streaming JSON output.

mod error;
mod manager;
mod pty;
mod sessions;

// Re-export only what's needed by lib.rs
pub use manager::{
    claude_check_status, claude_get_session_state, claude_list_conversations,
    claude_send_message, claude_start_session, claude_stop_session,
    ClaudeManagerState,
};
