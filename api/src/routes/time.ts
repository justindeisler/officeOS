/**
 * Time tracking API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ConflictError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { LogTimeSchema, StartTimerSchema } from "../schemas/index.js";

const router = Router();

// Get today's time entries
router.get("/today", asyncHandler(async (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  const entries = db
    .prepare(
      `SELECT * FROM time_entries 
       WHERE date(start_time) = date(?) 
       ORDER BY start_time DESC`
    )
    .all(today);

  res.json(entries);
}));

// Get running timer
router.get("/running", asyncHandler(async (_req, res) => {
  const db = getDb();
  const running = db.prepare("SELECT * FROM time_entries WHERE is_running = 1").get();
  res.json(running || null);
}));

// Get time summary for date range
router.get("/summary", asyncHandler(async (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new ValidationError("start_date and end_date are required");
  }

  const summary = db
    .prepare(
      `SELECT category, SUM(duration_minutes) as total_minutes, COUNT(*) as entry_count
       FROM time_entries
       WHERE date(start_time) >= date(?) AND date(start_time) <= date(?)
       GROUP BY category
       ORDER BY total_minutes DESC`
    )
    .all(start_date, end_date);

  res.json(summary);
}));

// List all time entries
router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { task_id, project_id, client_id, limit = 100 } = req.query;

  let sql = "SELECT * FROM time_entries WHERE 1=1";
  const params: unknown[] = [];

  if (task_id) {
    sql += " AND task_id = ?";
    params.push(task_id);
  }
  if (project_id) {
    sql += " AND project_id = ?";
    params.push(project_id);
  }
  if (client_id) {
    sql += " AND client_id = ?";
    params.push(client_id);
  }

  sql += " ORDER BY start_time DESC LIMIT ?";
  params.push(Number(limit));

  const entries = db.prepare(sql).all(...params);
  res.json(entries);
}));

// Log time (past work)
router.post("/log", validateBody(LogTimeSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { category, duration_minutes, task_id, project_id, client_id, description, start_time } = req.body;

  if (!category || !duration_minutes) {
    throw new ValidationError("category and duration_minutes are required");
  }

  const id = generateId();
  const actualStartTime = start_time || getCurrentTimestamp();
  const endTime = new Date(new Date(actualStartTime).getTime() + duration_minutes * 60000).toISOString();

  db.prepare(
    `INSERT INTO time_entries (id, category, duration_minutes, task_id, project_id, client_id, description, start_time, end_time, is_running, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, category, duration_minutes, task_id || null, project_id || null, client_id || null, description || null, actualStartTime, endTime, getCurrentTimestamp());

  const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id);
  res.status(201).json(entry);
}));

// Start timer
router.post("/start", validateBody(StartTimerSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { category, task_id, project_id, client_id, description } = req.body;

  if (!category) {
    throw new ValidationError("category is required");
  }

  // Check for existing running timer
  const running = db.prepare("SELECT * FROM time_entries WHERE is_running = 1").get();
  if (running) {
    throw new ConflictError("A timer is already running. Stop it first.");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO time_entries (id, category, task_id, project_id, client_id, description, start_time, is_running, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, category, task_id || null, project_id || null, client_id || null, description || null, now, now);

  const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id);
  res.status(201).json(entry);
}));

// Stop timer
router.post("/stop", asyncHandler(async (_req, res) => {
  const db = getDb();

  const running = db.prepare("SELECT * FROM time_entries WHERE is_running = 1").get() as Record<string, unknown> | undefined;
  if (!running) {
    throw new ValidationError("No timer is running");
  }

  const endTime = getCurrentTimestamp();
  const startTime = new Date(running.start_time as string);
  const durationMinutes = Math.round((new Date(endTime).getTime() - startTime.getTime()) / 60000);

  db.prepare("UPDATE time_entries SET end_time = ?, duration_minutes = ?, is_running = 0 WHERE id = ?").run(endTime, durationMinutes, running.id);

  const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(running.id);
  res.json(entry);
}));

// Delete time entry
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Time entry", id);
  }

  db.prepare("DELETE FROM time_entries WHERE id = ?").run(id);
  res.json({ success: true, message: "Time entry deleted" });
}));

export default router;
