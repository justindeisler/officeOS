/**
 * Suggestions API routes - James's improvement suggestions
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List suggestions
router.get("/", (req, res) => {
  const db = getDb();
  const { status, project_id, type, limit = 50 } = req.query;

  let sql = "SELECT * FROM suggestions WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (project_id) {
    sql += " AND project_id = ?";
    params.push(project_id);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY priority ASC, created_at DESC LIMIT ?";
  params.push(Number(limit));

  const suggestions = db.prepare(sql).all(...params);
  res.json(suggestions);
});

// Get single suggestion
router.get("/:id", (req, res) => {
  const db = getDb();
  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(req.params.id);
  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }
  res.json(suggestion);
});

// Create suggestion (James creates these)
router.post("/", (req, res) => {
  const db = getDb();
  const {
    project_id,
    project_name,
    type,
    title,
    description,
    priority = 2,
  } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: "Title and type are required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO suggestions (id, project_id, project_name, type, title, description, priority, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, project_id || null, project_name || null, type, title, description || null, priority, now, now);

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  res.status(201).json(suggestion);
});

// Approve suggestion
router.post("/:id/approve", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("UPDATE suggestions SET status = 'approved', decided_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  res.json(suggestion);
});

// Reject suggestion
router.post("/:id/reject", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("UPDATE suggestions SET status = 'rejected', decided_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  res.json(suggestion);
});

// Mark as implemented (links PRD and task)
router.post("/:id/implement", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { prd_id, task_id } = req.body;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("UPDATE suggestions SET status = 'implemented', prd_id = ?, task_id = ?, updated_at = ? WHERE id = ?")
    .run(prd_id || null, task_id || null, now, id);

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  res.json(suggestion);
});

// Update suggestion (for restore, etc.)
router.patch("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  const updates: string[] = ["updated_at = ?"];
  const params: unknown[] = [now];

  if (status) {
    updates.push("status = ?");
    params.push(status);
    // Clear decided_at if restoring to pending
    if (status === "pending") {
      updates.push("decided_at = NULL");
    }
  }

  params.push(id);
  db.prepare(`UPDATE suggestions SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  res.json(suggestion);
});

// Delete suggestion
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("DELETE FROM suggestions WHERE id = ?").run(id);
  res.json({ success: true });
});

export default router;
