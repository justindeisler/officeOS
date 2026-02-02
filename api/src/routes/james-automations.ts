/**
 * James Automations API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List all automations
router.get("/", (_req, res) => {
  const db = getDb();
  const automations = db.prepare(
    "SELECT * FROM james_automations ORDER BY name ASC"
  ).all();
  res.json(automations);
});

// Get single automation
router.get("/:id", (req, res) => {
  const db = getDb();
  const automation = db.prepare(
    "SELECT * FROM james_automations WHERE id = ?"
  ).get(req.params.id);
  
  if (!automation) {
    return res.status(404).json({ error: "Automation not found" });
  }
  res.json(automation);
});

// Create automation
router.post("/", (req, res) => {
  const db = getDb();
  const {
    name,
    description,
    schedule,
    schedule_human,
    type = "cron",
    enabled = true,
    next_run,
  } = req.body;

  if (!name || !schedule) {
    return res.status(400).json({ error: "Name and schedule are required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO james_automations (
      id, name, description, schedule, schedule_human, type, enabled, next_run, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    description || null,
    schedule,
    schedule_human || null,
    type,
    enabled ? 1 : 0,
    next_run || null,
    now,
    now
  );

  const automation = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  res.status(201).json(automation);
});

// Update automation
router.patch("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Automation not found" });
  }

  const fields = ["name", "description", "schedule", "schedule_human", "type", "enabled", "last_run", "next_run"];
  const updates: string[] = ["updated_at = ?"];
  const params: unknown[] = [now];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(field === "enabled" ? (req.body[field] ? 1 : 0) : req.body[field]);
    }
  }

  params.push(id);
  db.prepare(`UPDATE james_automations SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const automation = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  res.json(automation);
});

// Delete automation
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Automation not found" });
  }

  db.prepare("DELETE FROM james_automations WHERE id = ?").run(id);
  res.json({ success: true });
});

export default router;
