/**
 * Subtasks API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateSubtaskSchema, UpdateSubtaskSchema, ReorderSubtasksSchema, SubtaskCountsSchema } from "../schemas/index.js";

const router = Router();
const log = createLogger("subtasks");

// List subtasks for a task
router.get("/tasks/:taskId/subtasks", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId } = req.params;

  const subtasks = db
    .prepare(
      `SELECT * FROM subtasks 
       WHERE task_id = ? 
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(taskId);

  res.json(subtasks);
}));

// Create subtask
router.post("/tasks/:taskId/subtasks", validateBody(CreateSubtaskSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId } = req.params;
  const { title } = req.body;

  if (!title) {
    throw new ValidationError("Title is required");
  }

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  // Get max sort_order for this task
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) as max FROM subtasks WHERE task_id = ?")
    .get(taskId) as { max: number | null };

  const id = generateId();
  const sortOrder = (maxOrder?.max ?? -1) + 1;
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at)
     VALUES (?, ?, ?, 0, ?, ?)`
  ).run(id, taskId, title, sortOrder, now);

  const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id);
  res.status(201).json(subtask);
}));

// Update subtask
router.patch("/subtasks/:id", validateBody(UpdateSubtaskSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Subtask", id);
  }

  const fields = ["title", "completed", "sort_order"];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id) as Record<string, unknown>;

  // Auto-complete logic: if this subtask was just completed, check if ALL subtasks are done
  if (req.body.completed === 1) {
    const taskId = subtask.task_id;
    
    const stats = db
      .prepare(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
         FROM subtasks WHERE task_id = ?`
      )
      .get(taskId) as { total: number; completed: number };

    // If all subtasks are completed and there are subtasks, auto-complete the parent task
    if (stats.total > 0 && stats.total === stats.completed) {
      const now = getCurrentTimestamp();
      const taskResult = db.prepare("SELECT status, prd_id FROM tasks WHERE id = ?").get(taskId) as { status: string; prd_id?: string } | undefined;
      
      if (taskResult && taskResult.status !== "done") {
        db.prepare(
          "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?"
        ).run(now, now, taskId);
        
        log.info({ taskId, subtaskCount: stats.total }, "Task auto-completed (all subtasks done)");

        // Also update PRD if linked
        if (taskResult.prd_id) {
          db.prepare("UPDATE prds SET status = 'implemented', updated_at = ? WHERE id = ?").run(now, taskResult.prd_id);
          log.info({ prdId: taskResult.prd_id, taskId }, "PRD marked as implemented (linked task auto-completed)");
        }
      }
    }
  }

  res.json(subtask);
}));

// Delete subtask
router.delete("/subtasks/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Subtask", id);
  }

  db.prepare("DELETE FROM subtasks WHERE id = ?").run(id);
  res.json({ success: true, message: "Subtask deleted" });
}));

// Reorder subtasks
router.post("/tasks/:taskId/subtasks/reorder", validateBody(ReorderSubtasksSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId } = req.params;
  const { subtaskIds } = req.body;

  if (!Array.isArray(subtaskIds)) {
    throw new ValidationError("subtaskIds array is required");
  }

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  // Update sort_order for each subtask
  const updateStmt = db.prepare("UPDATE subtasks SET sort_order = ? WHERE id = ? AND task_id = ?");

  const transaction = db.transaction(() => {
    subtaskIds.forEach((subtaskId: string, index: number) => {
      updateStmt.run(index, subtaskId, taskId);
    });
  });

  transaction();

  const subtasks = db
    .prepare(
      `SELECT * FROM subtasks 
       WHERE task_id = ? 
       ORDER BY sort_order ASC`
    )
    .all(taskId);

  res.json(subtasks);
}));

// Get subtask counts for multiple tasks (bulk endpoint for efficiency)
router.post("/subtasks/counts", validateBody(SubtaskCountsSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.json({});
  }

  const placeholders = taskIds.map(() => "?").join(",");
  const counts = db
    .prepare(
      `SELECT 
        task_id,
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
       FROM subtasks 
       WHERE task_id IN (${placeholders})
       GROUP BY task_id`
    )
    .all(...taskIds) as Array<{ task_id: string; total: number; completed: number }>;

  // Convert to object keyed by task_id
  const result: Record<string, { total: number; completed: number }> = {};
  for (const row of counts) {
    result[row.task_id] = { total: row.total, completed: row.completed };
  }

  res.json(result);
}));

export default router;
