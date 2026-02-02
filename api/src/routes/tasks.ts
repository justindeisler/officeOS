/**
 * Tasks API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List tasks
router.get("/", (req, res) => {
  const db = getDb();
  const { area, status, project_id, limit } = req.query;

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
  res.json(tasks);
});

// Get overdue tasks
router.get("/overdue", (_req, res) => {
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
});

// Get tasks assigned to a specific person
router.get("/assigned/:assignee", (req, res) => {
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
});

// Get single task
router.get("/:id", (req, res) => {
  const db = getDb();
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.json(task);
});

// Create task
router.post("/", (req, res) => {
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
    return res.status(400).json({ error: "Title is required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO tasks (id, title, area, priority, status, description, project_id, prd_id, due_date, estimated_minutes, assignee, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, area, priority, status, description || null, project_id || null, prd_id || null, due_date || null, estimated_minutes || null, assignee || null, now, now);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.status(201).json(task);
});

// Update task
router.patch("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
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
    console.log(`[API] PRD ${existingTask.prd_id} marked as implemented (linked task ${id} completed)`);
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.json(task);
});

// Move task (change status)
router.post("/:id/move", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["backlog", "queue", "in_progress", "done"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
  }

  const now = getCurrentTimestamp();
  const completedAt = status === "done" ? now : null;
  const existingTask = existing as Record<string, unknown>;

  db.prepare("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(status, completedAt, now, id);

  // Auto-update PRD status to "implemented" when linked task is moved to done
  if (status === "done" && existingTask.status !== "done" && existingTask.prd_id) {
    db.prepare("UPDATE prds SET status = 'implemented', updated_at = ? WHERE id = ?").run(now, existingTask.prd_id);
    console.log(`[API] PRD ${existingTask.prd_id} marked as implemented (linked task ${id} moved to done)`);
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.json(task);
});

// Delete task
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Task not found" });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  res.json({ success: true, message: `Task "${existing.title}" deleted` });
});

export default router;
