/**
 * James Tasks API routes - Tasks for James to work on
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";

const router = Router();

// List james tasks with optional status filter
router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { status, source, limit = 100 } = req.query;

  let sql = "SELECT * FROM james_tasks WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (source) {
    sql += " AND source = ?";
    params.push(source);
  }

  sql += " ORDER BY priority ASC, created_at DESC LIMIT ?";
  params.push(Number(limit));

  const tasks = db.prepare(sql).all(...params);
  res.json(tasks);
}));

// Get single task
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const task = db.prepare("SELECT * FROM james_tasks WHERE id = ?").get(req.params.id);
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
    description,
    status = "backlog",
    priority = 2,
    source,
    source_id,
  } = req.body;

  if (!title) {
    throw new ValidationError("Title is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO james_tasks (id, title, description, status, priority, source, source_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || null, status, priority, source || null, source_id || null, now, now);

  const task = db.prepare("SELECT * FROM james_tasks WHERE id = ?").get(id);
  res.status(201).json(task);
}));

// Update task
router.patch("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const updates = req.body;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM james_tasks WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  // Build update query dynamically
  const allowedFields = ["title", "description", "status", "priority", "source", "source_id", "started_at", "completed_at"];
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const field of allowedFields) {
    if (field in updates) {
      sets.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  // Handle status-related timestamp updates
  if (updates.status === "in_progress" && !updates.started_at) {
    sets.push("started_at = ?");
    params.push(now);
  }
  if (updates.status === "done" && !updates.completed_at) {
    sets.push("completed_at = ?");
    params.push(now);
  }

  if (sets.length === 0) {
    return res.json(existing);
  }

  sets.push("updated_at = ?");
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE james_tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params);

  const task = db.prepare("SELECT * FROM james_tasks WHERE id = ?").get(id);
  res.json(task);
}));

// Delete task
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM james_tasks WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Task", id);
  }

  db.prepare("DELETE FROM james_tasks WHERE id = ?").run(id);
  res.json({ success: true });
}));

// Stats endpoint for dashboard
router.get("/stats/summary", asyncHandler(async (req, res) => {
  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'backlog' THEN 1 ELSE 0 END) as backlog,
      SUM(CASE WHEN status = 'queue' THEN 1 ELSE 0 END) as queue,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM james_tasks
  `).get();
  
  res.json(stats);
}));

export default router;
