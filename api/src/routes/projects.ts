/**
 * Projects API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";

const router = Router();

// List projects
router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { area, status, client_id } = req.query;

  let sql = "SELECT * FROM projects WHERE 1=1";
  const params: unknown[] = [];

  if (area) {
    sql += " AND area = ?";
    params.push(area);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (client_id) {
    sql += " AND client_id = ?";
    params.push(client_id);
  }

  sql += " ORDER BY created_at DESC";

  const projects = db.prepare(sql).all(...params);
  res.json(projects);
}));

// Get single project
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) {
    throw new NotFoundError("Project", req.params.id);
  }
  res.json(project);
}));

// Create project
router.post("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    name,
    area = "freelance",
    client_id,
    description,
    budget_amount,
    budget_currency = "EUR",
    start_date,
    target_end_date,
  } = req.body;

  if (!name) {
    throw new ValidationError("Name is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO projects (id, name, area, client_id, description, budget_amount, budget_currency, start_date, target_end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, area, client_id || null, description || null, budget_amount || null, budget_currency, start_date || null, target_end_date || null, now, now);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  res.status(201).json(project);
}));

// Update project
router.patch("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Project", id);
  }

  const fields = ["name", "area", "client_id", "description", "status", "budget_amount", "budget_currency", "start_date", "target_end_date", "actual_end_date", "codebase_path", "github_repo"];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(getCurrentTimestamp());
    params.push(id);

    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  res.json(project);
}));

// Delete project
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Project", id);
  }

  // Check for associated tasks
  const taskCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE project_id = ?").get(id) as { count: number };
  if (taskCount.count > 0) {
    throw new ValidationError(`Cannot delete project with ${taskCount.count} associated tasks`);
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.json({ success: true, message: `Project "${existing.name}" deleted` });
}));

export default router;
