/**
 * Task management tools for MCP server
 */

import { getDb, generateId, getCurrentTimestamp } from "../database.js";

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: "backlog" | "queue" | "in_progress" | "done";
  priority: number;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  area: "wellfy" | "freelance" | "personal";
  markdown_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskParams {
  title: string;
  area?: "wellfy" | "freelance" | "personal";
  priority?: number;
  status?: "backlog" | "queue" | "in_progress" | "done";
  description?: string;
  project_id?: string;
  due_date?: string;
  estimated_minutes?: number;
}

export interface UpdateTaskParams {
  id: string;
  title?: string;
  area?: "wellfy" | "freelance" | "personal";
  priority?: number;
  status?: "backlog" | "queue" | "in_progress" | "done";
  description?: string;
  project_id?: string;
  due_date?: string;
  estimated_minutes?: number;
}

export interface ListTasksParams {
  area?: "wellfy" | "freelance" | "personal";
  status?: "backlog" | "queue" | "in_progress" | "done";
  project_id?: string;
  limit?: number;
}

/**
 * Create a new task
 */
export function createTask(params: CreateTaskParams): Task {
  const db = getDb();
  const now = getCurrentTimestamp();

  const task: Task = {
    id: generateId(),
    project_id: params.project_id || null,
    title: params.title,
    description: params.description || null,
    status: params.status || "backlog",
    priority: params.priority ?? 2,
    due_date: params.due_date || null,
    completed_at: null,
    estimated_minutes: params.estimated_minutes || null,
    area: params.area || "freelance",
    markdown_path: null,
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };

  // Get max sort_order for the status
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as max_order FROM tasks WHERE status = ?")
    .get(task.status) as { max_order: number | null };

  task.sort_order = (maxOrder?.max_order ?? -1) + 1;

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, project_id, title, description, status, priority,
      due_date, completed_at, estimated_minutes, area,
      markdown_path, sort_order, created_at, updated_at
    ) VALUES (
      @id, @project_id, @title, @description, @status, @priority,
      @due_date, @completed_at, @estimated_minutes, @area,
      @markdown_path, @sort_order, @created_at, @updated_at
    )
  `);

  stmt.run(task);

  return task;
}

/**
 * Update an existing task
 */
export function updateTask(params: UpdateTaskParams): Task {
  const db = getDb();
  const now = getCurrentTimestamp();

  // Get current task
  const current = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(params.id) as Task | undefined;

  if (!current) {
    throw new Error(`Task not found: ${params.id}`);
  }

  const updates: string[] = ["updated_at = @updated_at"];
  const values: Record<string, unknown> = {
    id: params.id,
    updated_at: now,
  };

  if (params.title !== undefined) {
    updates.push("title = @title");
    values.title = params.title;
  }

  if (params.area !== undefined) {
    updates.push("area = @area");
    values.area = params.area;
  }

  if (params.priority !== undefined) {
    updates.push("priority = @priority");
    values.priority = params.priority;
  }

  if (params.status !== undefined) {
    updates.push("status = @status");
    values.status = params.status;

    // Set completed_at if moving to done
    if (params.status === "done" && current.status !== "done") {
      updates.push("completed_at = @completed_at");
      values.completed_at = now;
    } else if (params.status !== "done" && current.status === "done") {
      updates.push("completed_at = NULL");
    }
  }

  if (params.description !== undefined) {
    updates.push("description = @description");
    values.description = params.description;
  }

  if (params.project_id !== undefined) {
    updates.push("project_id = @project_id");
    values.project_id = params.project_id || null;
  }

  if (params.due_date !== undefined) {
    updates.push("due_date = @due_date");
    values.due_date = params.due_date || null;
  }

  if (params.estimated_minutes !== undefined) {
    updates.push("estimated_minutes = @estimated_minutes");
    values.estimated_minutes = params.estimated_minutes || null;
  }

  const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = @id`;
  db.prepare(sql).run(values);

  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(params.id) as Task;
}

/**
 * Delete a task
 */
export function deleteTask(id: string): { success: boolean; message: string } {
  const db = getDb();

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;

  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  return { success: true, message: `Task "${task.title}" deleted successfully` };
}

/**
 * Move a task to a different status
 */
export function moveTask(
  id: string,
  status: "backlog" | "queue" | "in_progress" | "done"
): Task {
  return updateTask({ id, status });
}

/**
 * List tasks with optional filters
 */
export function listTasks(params: ListTasksParams = {}): Task[] {
  const db = getDb();

  const conditions: string[] = [];
  const values: Record<string, unknown> = {};

  if (params.area) {
    conditions.push("area = @area");
    values.area = params.area;
  }

  if (params.status) {
    conditions.push("status = @status");
    values.status = params.status;
  }

  if (params.project_id) {
    conditions.push("project_id = @project_id");
    values.project_id = params.project_id;
  }

  let sql = "SELECT * FROM tasks";

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += " ORDER BY sort_order ASC, created_at DESC";

  if (params.limit) {
    sql += ` LIMIT ${params.limit}`;
  }

  return db.prepare(sql).all(values) as Task[];
}

/**
 * Get a task by ID
 */
export function getTask(id: string): Task | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task) || null;
}

/**
 * Get overdue tasks
 */
export function getOverdueTasks(): Task[] {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  return db
    .prepare(
      `SELECT * FROM tasks
       WHERE due_date < @today
       AND status != 'done'
       ORDER BY due_date ASC`
    )
    .all({ today }) as Task[];
}
