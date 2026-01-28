/**
 * Captures (inbox) API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List captures
router.get("/", (req, res) => {
  const db = getDb();
  const { processed, type, limit = 100 } = req.query;

  let sql = "SELECT * FROM captures WHERE 1=1";
  const params: unknown[] = [];

  if (processed !== undefined) {
    sql += " AND processed = ?";
    params.push(processed === "true" || processed === "1" ? 1 : 0);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));

  const captures = db.prepare(sql).all(...params);
  res.json(captures);
});

// Get single capture
router.get("/:id", (req, res) => {
  const db = getDb();
  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(req.params.id);
  if (!capture) {
    return res.status(404).json({ error: "Capture not found" });
  }
  res.json(capture);
});

// Create capture
router.post("/", (req, res) => {
  const db = getDb();
  const { content, type = "note" } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO captures (id, content, type, processed, created_at)
     VALUES (?, ?, ?, 0, ?)`
  ).run(id, content, type, now);

  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  res.status(201).json(capture);
});

// Mark capture as processed
router.post("/:id/process", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { processed_to } = req.body;

  const existing = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Capture not found" });
  }

  db.prepare("UPDATE captures SET processed = 1, processed_to = ? WHERE id = ?").run(processed_to || null, id);

  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  res.json(capture);
});

// Delete capture
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Capture not found" });
  }

  db.prepare("DELETE FROM captures WHERE id = ?").run(id);
  res.json({ success: true, message: "Capture deleted" });
});

export default router;
