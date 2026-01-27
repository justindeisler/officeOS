mod claude;

use claude::{
    claude_check_status, claude_get_session_state, claude_list_conversations,
    claude_send_message, claude_start_session, claude_stop_session,
    ClaudeManagerState,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Get the working directory for Claude (project root)
            let working_dir = std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| String::from("."));

            // Initialize Claude manager
            let claude_state = ClaudeManagerState::new(working_dir);
            app.manage(claude_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            claude_check_status,
            claude_start_session,
            claude_send_message,
            claude_stop_session,
            claude_list_conversations,
            claude_get_session_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
