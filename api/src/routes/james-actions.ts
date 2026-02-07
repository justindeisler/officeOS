/**
 * James Actions API - Audit trail of James's actions (James Brain)
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ValidationError } from "../errors.js";

const router = Router();

// List actions
router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { project_id, action_type, limit = 100 } = req.query;

  let sql = "SELECT * FROM james_actions WHERE 1=1";
  const params: unknown[] = [];

  if (project_id) {
    sql += " AND project_id = ?";
    params.push(project_id);
  }
  if (action_type) {
    sql += " AND action_type = ?";
    params.push(action_type);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));

  const actions = db.prepare(sql).all(...params);
  res.json(actions);
}));

// Log a new action
router.post("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    action_type,
    description,
    project_id,
    task_id,
    suggestion_id,
    prd_id,
    metadata,
  } = req.body;

  if (!action_type || !description) {
    throw new ValidationError("action_type and description are required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO james_actions (id, action_type, description, project_id, task_id, suggestion_id, prd_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, action_type, description,
    project_id || null, task_id || null, suggestion_id || null, prd_id || null,
    metadata ? JSON.stringify(metadata) : null, now
  );

  const action = db.prepare("SELECT * FROM james_actions WHERE id = ?").get(id);
  res.status(201).json(action);
}));

// Get action stats
router.get("/stats", asyncHandler(async (_req, res) => {
  const db = getDb();
  
  const total = db.prepare("SELECT COUNT(*) as count FROM james_actions").get() as { count: number };
  const byType = db.prepare(`
    SELECT action_type, COUNT(*) as count 
    FROM james_actions 
    GROUP BY action_type 
    ORDER BY count DESC
  `).all();
  const recent = db.prepare(`
    SELECT * FROM james_actions 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();

  res.json({ total: total.count, byType, recent });
}));

export default router;
