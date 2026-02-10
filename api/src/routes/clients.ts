/**
 * Clients API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { cache, cacheKey, TTL } from "../cache.js";

const router = Router();

// List clients
router.get("/", asyncHandler(async (req, res) => {
  const { status } = req.query;
  const key = cacheKey("clients", "list", status as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = "SELECT * FROM clients WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY name ASC";

  const clients = db.prepare(sql).all(...params);
  cache.set(key, clients, TTL.CLIENTS);
  res.json(clients);
}));

// Get single client
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
  if (!client) {
    throw new NotFoundError("Client", req.params.id);
  }
  res.json(client);
}));

// Create client
router.post("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, email, company, contact_info, notes, status = "active" } = req.body;

  if (!name) {
    throw new ValidationError("Name is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO clients (id, name, email, company, contact_info, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email || null, company || null, contact_info || null, notes || null, status, now, now);

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  cache.invalidate("clients:*");
  res.status(201).json(client);
}));

// Update client
router.patch("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Client", id);
  }

  const fields = ["name", "email", "company", "contact_info", "notes", "status"];
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

    db.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  cache.invalidate("clients:*");
  res.json(client);
}));

// Delete client
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Client", id);
  }

  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  cache.invalidate("clients:*");
  res.json({ success: true, message: `Client "${existing.name}" deleted` });
}));

export default router;
