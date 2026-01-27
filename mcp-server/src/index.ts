/**
 * MCP Server for Personal Assistant Database Access
 *
 * This server exposes tools for managing tasks, projects, time entries,
 * and querying the database through the Model Context Protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { closeDb, executeReadOnlyQuery } from "./database.js";
import {
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  listTasks,
  getTask,
  getOverdueTasks,
} from "./tools/tasks.js";
import {
  createProject,
  updateProject,
  listProjects,
  getProject,
  deleteProject,
} from "./tools/projects.js";
import {
  logTime,
  startTimer,
  stopTimer,
  getRunningTimer,
  getTodayTimeEntries,
  getTimeSummary,
} from "./tools/time.js";

// Import types for tool handlers
import type {
  CreateTaskParams,
  UpdateTaskParams,
  ListTasksParams,
} from "./tools/tasks.js";
import type {
  CreateProjectParams,
  UpdateProjectParams,
  ListProjectsParams,
} from "./tools/projects.js";
import type {
  LogTimeParams,
  StartTimerParams,
} from "./tools/time.js";

// Tool definitions
const TOOLS: Tool[] = [
  // Task tools
  {
    name: "create_task",
    description:
      "Create a new task in the personal assistant system. Use this when the user wants to add a new task or todo item.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        area: {
          type: "string",
          enum: ["wellfy", "freelance", "personal"],
          description: "Area the task belongs to",
        },
        priority: {
          type: "number",
          description: "Priority level (1=low, 2=medium, 3=high, 4=urgent)",
        },
        status: {
          type: "string",
          enum: ["backlog", "queue", "in_progress", "done"],
          description: "Task status",
        },
        description: { type: "string", description: "Task description" },
        project_id: {
          type: "string",
          description: "ID of the project this task belongs to",
        },
        due_date: {
          type: "string",
          description: "Due date in ISO format (YYYY-MM-DD)",
        },
        estimated_minutes: {
          type: "number",
          description: "Estimated time in minutes",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task. Provide the task ID and fields to update.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID to update" },
        title: { type: "string" },
        area: { type: "string", enum: ["wellfy", "freelance", "personal"] },
        priority: { type: "number" },
        status: {
          type: "string",
          enum: ["backlog", "queue", "in_progress", "done"],
        },
        description: { type: "string" },
        project_id: { type: "string" },
        due_date: { type: "string" },
        estimated_minutes: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task by ID. Use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "move_task",
    description:
      "Move a task to a different status column (backlog, queue, in_progress, done).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID to move" },
        status: {
          type: "string",
          enum: ["backlog", "queue", "in_progress", "done"],
          description: "New status for the task",
        },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks with optional filters for area, status, or project.",
    inputSchema: {
      type: "object",
      properties: {
        area: { type: "string", enum: ["wellfy", "freelance", "personal"] },
        status: {
          type: "string",
          enum: ["backlog", "queue", "in_progress", "done"],
        },
        project_id: { type: "string" },
        limit: { type: "number", description: "Maximum number of tasks to return" },
      },
    },
  },
  {
    name: "get_task",
    description: "Get detailed information about a specific task by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_overdue_tasks",
    description: "Get all tasks that are past their due date and not completed.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Project tools
  {
    name: "create_project",
    description: "Create a new project.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        area: {
          type: "string",
          enum: ["wellfy", "freelance", "personal"],
        },
        client_id: { type: "string" },
        description: { type: "string" },
        budget_amount: { type: "number" },
        budget_currency: { type: "string", default: "EUR" },
        start_date: { type: "string" },
        target_end_date: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_project",
    description: "Update an existing project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project ID to update" },
        name: { type: "string" },
        area: { type: "string", enum: ["wellfy", "freelance", "personal"] },
        client_id: { type: "string" },
        description: { type: "string" },
        status: {
          type: "string",
          enum: ["active", "completed", "on_hold", "archived"],
        },
        budget_amount: { type: "number" },
        budget_currency: { type: "string" },
        start_date: { type: "string" },
        target_end_date: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_projects",
    description: "List projects with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        area: { type: "string", enum: ["wellfy", "freelance", "personal"] },
        status: {
          type: "string",
          enum: ["active", "completed", "on_hold", "archived"],
        },
        client_id: { type: "string" },
      },
    },
  },
  {
    name: "get_project",
    description: "Get detailed information about a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project. Will fail if it has associated tasks.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project ID to delete" },
      },
      required: ["id"],
    },
  },

  // Time tracking tools
  {
    name: "log_time",
    description: "Log time spent on a task or project (for past work).",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category of work" },
        duration_minutes: { type: "number", description: "Duration in minutes" },
        task_id: { type: "string" },
        project_id: { type: "string" },
        client_id: { type: "string" },
        description: { type: "string" },
        start_time: { type: "string", description: "When the work started (ISO format)" },
      },
      required: ["category", "duration_minutes"],
    },
  },
  {
    name: "start_timer",
    description: "Start a timer for tracking current work.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category of work" },
        task_id: { type: "string" },
        project_id: { type: "string" },
        client_id: { type: "string" },
        description: { type: "string" },
      },
      required: ["category"],
    },
  },
  {
    name: "stop_timer",
    description: "Stop the currently running timer.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_running_timer",
    description: "Check if there is a currently running timer.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_today_time_entries",
    description: "Get all time entries logged today.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_time_summary",
    description: "Get a summary of time tracked by category for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
      required: ["start_date", "end_date"],
    },
  },

  // Query tool
  {
    name: "query_database",
    description:
      "Execute a read-only SQL query against the database. Only SELECT queries are allowed. Use this for complex queries that aren't covered by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description:
            "SQL SELECT query to execute. Tables: tasks, projects, clients, time_entries, invoices, captures, settings, weekly_reviews",
        },
      },
      required: ["sql"],
    },
  },
];

// Create server
const server = new Server(
  {
    name: "personal-assistant-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // Task tools
      case "create_task":
        result = createTask(args as unknown as CreateTaskParams);
        break;
      case "update_task":
        result = updateTask(args as unknown as UpdateTaskParams);
        break;
      case "delete_task":
        result = deleteTask((args as unknown as { id: string }).id);
        break;
      case "move_task": {
        const moveArgs = args as unknown as { id: string; status: string };
        result = moveTask(
          moveArgs.id,
          moveArgs.status as "backlog" | "queue" | "in_progress" | "done"
        );
        break;
      }
      case "list_tasks":
        result = listTasks(args as unknown as ListTasksParams);
        break;
      case "get_task":
        result = getTask((args as unknown as { id: string }).id);
        break;
      case "get_overdue_tasks":
        result = getOverdueTasks();
        break;

      // Project tools
      case "create_project":
        result = createProject(args as unknown as CreateProjectParams);
        break;
      case "update_project":
        result = updateProject(args as unknown as UpdateProjectParams);
        break;
      case "list_projects":
        result = listProjects(args as unknown as ListProjectsParams);
        break;
      case "get_project":
        result = getProject((args as unknown as { id: string }).id);
        break;
      case "delete_project":
        result = deleteProject((args as unknown as { id: string }).id);
        break;

      // Time tracking tools
      case "log_time":
        result = logTime(args as unknown as LogTimeParams);
        break;
      case "start_timer":
        result = startTimer(args as unknown as StartTimerParams);
        break;
      case "stop_timer":
        result = stopTimer();
        break;
      case "get_running_timer":
        result = getRunningTimer();
        break;
      case "get_today_time_entries":
        result = getTodayTimeEntries();
        break;
      case "get_time_summary": {
        const timeArgs = args as unknown as { start_date: string; end_date: string };
        result = getTimeSummary(timeArgs.start_date, timeArgs.end_date);
        break;
      }

      // Query tool
      case "query_database":
        result = executeReadOnlyQuery((args as unknown as { sql: string }).sql);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] Personal Assistant MCP server started");
}

main().catch((error) => {
  console.error("[MCP] Server failed to start:", error);
  process.exit(1);
});
