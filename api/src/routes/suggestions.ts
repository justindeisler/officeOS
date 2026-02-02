/**
 * Suggestions API routes - James's improvement suggestions
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";

const router = Router();
const log = createLogger("suggestions");

// Clawdbot Gateway config
const CLAWDBOT_GATEWAY_URL = process.env.CLAWDBOT_GATEWAY_URL || "http://localhost:18789";
const CLAWDBOT_GATEWAY_TOKEN = process.env.CLAWDBOT_GATEWAY_TOKEN || "bbcf416eb09a9808d8f09e80eebbfe6e83dae0c5aa5f6e15";

/**
 * Trigger James to implement a suggestion via Clawdbot wake event
 */
async function triggerJamesImplementation(suggestion: { id: string; title: string; description: string | null; project_name: string | null }) {
  const message = `Implement approved suggestion: "${suggestion.title}" (ID: ${suggestion.id})${suggestion.project_name ? ` for project ${suggestion.project_name}` : ''}. Description: ${suggestion.description || 'No description'}. Use the coding-agent skill if needed. Mark as implemented when done.`;
  
  try {
    // Use Clawdbot Gateway HTTP API to send wake event
    const response = await fetch(`${CLAWDBOT_GATEWAY_URL}/api/cron/wake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLAWDBOT_GATEWAY_TOKEN}`
      },
      body: JSON.stringify({ text: message })
    });
    
    if (response.ok) {
      log.info({ suggestionId: suggestion.id }, "Triggered James to implement suggestion");
    } else {
      const error = await response.text();
      log.error({ suggestionId: suggestion.id, status: response.status, error }, "Failed to trigger James");
    }
  } catch (error) {
    log.error({ err: error, suggestionId: suggestion.id }, "Failed to trigger James");
  }
}

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

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id) as { id: string; title: string; description: string | null; project_name: string | null } | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("UPDATE suggestions SET status = 'approved', decided_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);

  // Trigger James to implement the suggestion
  triggerJamesImplementation(existing);
  log.info({ suggestionId: id, title: existing.title }, "Suggestion approved, James notified");

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
