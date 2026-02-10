/**
 * Tasks API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { cache, cacheKey, TTL } from "../cache.js";

const router = Router();
const log = createLogger("tasks");

// List tasks
router.get("/", asyncHandler(async (req, res) => {
  const { area, status, project_id, limit } = req.query;
  const key = cacheKey("tasks", "list", area as string, status as string, project_id as string, limit as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: unknown[] = [];

  if (area) {
    sql += " AND area = ?";
    params.push(area);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (project_id) {
    sql += " AND project_id = ?";
    params.push(project_id);
  }

  sql += " ORDER BY sort_order ASC, priority DESC, created_at DESC";

  if (limit) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }

  const tasks = db.prepare(sql).all(...params);
  cache.set(key, tasks, TTL.TASKS);
  res.json(tasks);
}));

// Get overdue tasks
router.get("/overdue", asyncHandler(async (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const tasks = db
    .prepare(
      `SELECT * FROM tasks 
       WHERE due_date < ? AND status != 'done' 
       ORDER BY due_date ASC`
    )
    .all(today);
  res.json(tasks);
}));

// Get tasks assigned to a specific person
router.get("/assigned/:assignee", asyncHandler(async (req, res) => {
  const db = getDb();
  const { assignee } = req.params;
  const tasks = db
    .prepare(
      `SELECT * FROM tasks 
       WHERE assignee = ? AND status != 'done' 
       ORDER BY priority ASC, created_at DESC`
    )
    .all(assignee);
  res.json(tasks);
}));

// Get single task
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    throw new NotFoundError("Task", req.params.id);
  }
  res.json(task);
}));

// Create task
router.post("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    title,
    area = "freelance",
    priority = 2,
    status = "backlog",
    description,
    project_id,
    prd_id,
    due_date,
    estimated_minutes,
    assignee,
  } = req.body;

  if (!title) {
    throw new ValidationError("Title is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO tasks (id, title, area, priority, status, description, project_id, prd_id, due_date, estimated_minutes, assignee, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, area, priority, status, description || null, project_id || null, prd_id || null, due_date || null, estimated_minutes || null, assignee || null, now, now);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  cache.invalidate("tasks:*");
  res.status(201).json(task);
}));

// Update task
router.patch("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  const fields = ["title", "area", "priority", "status", "description", "project_id", "prd_id", "due_date", "estimated_minutes", "assignee"];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (req.body.status === "done" && (existing as Record<string, unknown>).status !== "done") {
    updates.push("completed_at = ?");
    params.push(getCurrentTimestamp());
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(getCurrentTimestamp());
    params.push(id);

    db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  // Auto-update PRD status to "implemented" when linked task is moved to done
  const existingTask = existing as Record<string, unknown>;
  if (req.body.status === "done" && existingTask.status !== "done" && existingTask.prd_id) {
    const now = getCurrentTimestamp();
    db.prepare("UPDATE prds SET status = 'implemented', updated_at = ? WHERE id = ?").run(now, existingTask.prd_id);
    log.info({ prdId: existingTask.prd_id, taskId: id }, "PRD marked as implemented (linked task completed)");
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  cache.invalidate("tasks:*");
  res.json(task);
}));

// Reorder tasks within a column (bulk update sort_order)
router.post("/reorder", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskIds, status } = req.body;

  // Validate input — accept either ordered list of IDs or single-task move
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw new ValidationError("taskIds array is required");
  }

  const validStatuses = ["backlog", "queue", "in_progress", "done"];
  if (status && !validStatuses.includes(status)) {
    throw new ValidationError("Invalid status");
  }

  // Verify all tasks exist
  const placeholders = taskIds.map(() => "?").join(",");
  const existingTasks = db
    .prepare(`SELECT id FROM tasks WHERE id IN (${placeholders})`)
    .all(...taskIds) as Array<{ id: string }>;

  const existingIds = new Set(existingTasks.map((t) => t.id));
  const missingIds = taskIds.filter((id: string) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new NotFoundError("Tasks", missingIds.join(", "));
  }

  // Update sort_order for each task in a transaction
  const now = getCurrentTimestamp();
  const updateStmt = db.prepare(
    "UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?"
  );

  const transaction = db.transaction(() => {
    taskIds.forEach((taskId: string, index: number) => {
      updateStmt.run(index, now, taskId);
    });
  });

  transaction();

  // Return updated tasks in the new order
  const updatedTasks = db
    .prepare(`SELECT * FROM tasks WHERE id IN (${placeholders}) ORDER BY sort_order ASC`)
    .all(...taskIds);

  cache.invalidate("tasks:*");
  res.json(updatedTasks);
}));

// Move task to a new column and position
router.post("/:id/move", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status, targetIndex } = req.body;

  const validStatuses = ["backlog", "queue", "in_progress", "done"];
  if (!validStatuses.includes(status)) {
    throw new ValidationError("Invalid status");
  }

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  const now = getCurrentTimestamp();
  const completedAt = status === "done" ? now : null;
  const existingTask = existing as Record<string, unknown>;

  // Update the task's status
  db.prepare("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(status, completedAt, now, id);

  // If targetIndex is provided, reorder the target column
  if (targetIndex !== undefined && targetIndex !== null) {
    // Get all tasks in the target column (excluding the moved task, then re-insert at position)
    const columnTasks = db
      .prepare(
        "SELECT id FROM tasks WHERE status = ? AND id != ? ORDER BY sort_order ASC"
      )
      .all(status, id) as Array<{ id: string }>;

    // Insert the moved task at the target index
    const orderedIds = columnTasks.map((t) => t.id);
    const clampedIndex = Math.max(0, Math.min(targetIndex, orderedIds.length));
    orderedIds.splice(clampedIndex, 0, id);

    // Update sort_order for entire column
    const updateStmt = db.prepare(
      "UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?"
    );
    const reorderTransaction = db.transaction(() => {
      orderedIds.forEach((taskId, index) => {
        updateStmt.run(index, now, taskId);
      });
    });
    reorderTransaction();
  }

  // Auto-update PRD status to "implemented" when linked task is moved to done
  if (status === "done" && existingTask.status !== "done" && existingTask.prd_id) {
    db.prepare("UPDATE prds SET status = 'implemented', updated_at = ? WHERE id = ?").run(now, existingTask.prd_id);
    log.info({ prdId: existingTask.prd_id, taskId: id }, "PRD marked as implemented (linked task moved to done)");
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  cache.invalidate("tasks:*");
  res.json(task);
}));

// Delete task
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  cache.invalidate("tasks:*");
  res.json({ success: true, message: `Task "${existing.title}" deleted` });
}));

export default router;
