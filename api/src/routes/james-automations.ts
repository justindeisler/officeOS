/**
 * James Automations API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateAutomationSchema, UpdateAutomationSchema } from "../schemas/index.js";

const router = Router();

// List all automations
router.get("/", asyncHandler(async (_req, res) => {
  const db = getDb();
  const automations = db.prepare(
    "SELECT * FROM james_automations ORDER BY name ASC"
  ).all();
  res.json(automations);
}));

// Get single automation
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const automation = db.prepare(
    "SELECT * FROM james_automations WHERE id = ?"
  ).get(req.params.id);
  
  if (!automation) {
    throw new NotFoundError("Automation", req.params.id);
  }
  res.json(automation);
}));

// Create automation
router.post("/", validateBody(CreateAutomationSchema), asyncHandler(async (req, res) => {
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
    throw new ValidationError("Name and schedule are required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO james_automations (
      id, name, description, schedule, schedule_human, type, enabled, next_run, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, description || null, schedule, schedule_human || null,
    type, enabled ? 1 : 0, next_run || null, now, now
  );

  const automation = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  res.status(201).json(automation);
}));

// Update automation
router.patch("/:id", validateBody(UpdateAutomationSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Automation", id);
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
}));

// Delete automation
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM james_automations WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Automation", id);
  }

  db.prepare("DELETE FROM james_automations WHERE id = ?").run(id);
  res.json({ success: true });
}));

export default router;
