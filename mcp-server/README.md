# Personal Assistant MCP Server

MCP (Model Context Protocol) server that provides Claude Code access to the Personal Assistant database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build:
```bash
npm run build
```

3. Add to Claude Code configuration (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "personal-assistant-db": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Desktop/Developing/Projects/Personal-Assistant/mcp-server/dist/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual username. This enables the Personal Assistant database tools when using Claude Code CLI, including when running from the embedded chat panel in the app.

## Available Tools

### Task Management
- `create_task` - Create a new task
- `update_task` - Update an existing task
- `delete_task` - Delete a task
- `move_task` - Move task to different status
- `list_tasks` - List tasks with filters
- `get_task` - Get task by ID
- `get_overdue_tasks` - Get overdue tasks

### Project Management
- `create_project` - Create a new project
- `update_project` - Update a project
- `list_projects` - List projects with filters
- `get_project` - Get project by ID
- `delete_project` - Delete a project

### Time Tracking
- `log_time` - Log time for past work
- `start_timer` - Start a timer
- `stop_timer` - Stop running timer
- `get_running_timer` - Check if timer is running
- `get_today_time_entries` - Get today's entries
- `get_time_summary` - Get time summary for date range

### Database
- `query_database` - Execute read-only SQL queries

## Database Location

The server connects to the same SQLite database used by the Tauri app:
- macOS: `~/Library/Application Support/com.personal-assistant.app/personal-assistant.db`
- Windows: `%APPDATA%/com.personal-assistant.app/personal-assistant.db`
- Linux: `~/.local/share/com.personal-assistant.app/personal-assistant.db`
