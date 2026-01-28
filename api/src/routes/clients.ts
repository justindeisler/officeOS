/**
 * Clients API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List clients
router.get("/", (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let sql = "SELECT * FROM clients WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY name ASC";

  const clients = db.prepare(sql).all(...params);
  res.json(clients);
});

// Get single client
router.get("/:id", (req, res) => {
  const db = getDb();
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: "Client not found" });
  }
  res.json(client);
});

// Create client
router.post("/", (req, res) => {
  const db = getDb();
  const { name, email, company, contact_info, notes, status = "active" } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO clients (id, name, email, company, contact_info, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email || null, company || null, contact_info || null, notes || null, status, now, now);

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  res.status(201).json(client);
});

// Update client
router.patch("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Client not found" });
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
  res.json(client);
});

// Delete client
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Client not found" });
  }

  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  res.json({ success: true, message: `Client "${existing.name}" deleted` });
});

export default router;
