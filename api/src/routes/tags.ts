/**
 * Tags API routes
 *
 * Endpoints:
 *   GET    /api/tags              - List all tags
 *   POST   /api/tags              - Create tag
 *   PUT    /api/tags/:id          - Update tag
 *   DELETE /api/tags/:id          - Delete tag (cascades from task_tags)
 *   GET    /api/tags/tasks/:taskId    - Get tags for a task
 *   POST   /api/tags/tasks/:taskId/:tagId  - Add tag to task
 *   DELETE /api/tags/tasks/:taskId/:tagId  - Remove tag from task
 *   POST   /api/tags/tasks/:taskId/sync   - Sync (replace all) tags for a task
 */

import { Router } from "express";
import { getDb, generateId } from "../database.js";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ConflictError } from "../errors.js";

const router = Router();
const log = createLogger("tags");

// ─── Tag CRUD ─────────────────────────────────────────────────────────

// List all tags
router.get("/", asyncHandler(async (_req, res) => {
  const db = getDb();
  const tags = db.prepare("SELECT * FROM tags ORDER BY name ASC").all();
  res.json(tags);
}));

// Create tag
router.post("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, color } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ValidationError("Tag name is required");
  }

  const trimmedName = name.trim();

  // Check uniqueness
  const existing = db.prepare("SELECT id FROM tags WHERE LOWER(name) = LOWER(?)").get(trimmedName);
  if (existing) {
    throw new ConflictError(`Tag "${trimmedName}" already exists`);
  }

  const id = generateId();
  db.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)").run(
    id,
    trimmedName,
    color || null,
  );

  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
  log.info({ tagId: id, name: trimmedName }, "Tag created");
  res.status(201).json(tag);
}));

// Update tag
router.put("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, color } = req.body;

  const existing = db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Tag", id);
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      throw new ValidationError("Tag name cannot be empty");
    }
    const trimmedName = name.trim();
    // Check uniqueness (exclude self)
    const duplicate = db
      .prepare("SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?")
      .get(trimmedName, id);
    if (duplicate) {
      throw new ConflictError(`Tag "${trimmedName}" already exists`);
    }
    updates.push("name = ?");
    params.push(trimmedName);
  }

  if (color !== undefined) {
    updates.push("color = ?");
    params.push(color || null);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE tags SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
  log.info({ tagId: id }, "Tag updated");
  res.json(tag);
}));

// Delete tag (task_tags cascade via ON DELETE CASCADE)
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Tag", id);
  }

  db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  log.info({ tagId: id, name: existing.name }, "Tag deleted");
  res.json({ success: true, message: `Tag "${existing.name}" deleted` });
}));

// ─── Task-Tag associations ────────────────────────────────────────────

// Bulk get tags for multiple tasks (efficient for Kanban board)
// NOTE: Must be before /tasks/:taskId to avoid route conflict
router.post("/tasks/bulk", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.json({});
  }

  const placeholders = taskIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT tt.task_id, t.id, t.name, t.color
       FROM task_tags tt
       INNER JOIN tags t ON t.id = tt.tag_id
       WHERE tt.task_id IN (${placeholders})
       ORDER BY t.name ASC`
    )
    .all(...taskIds) as Array<{ task_id: string; id: string; name: string; color: string | null }>;

  // Group by task_id
  const result: Record<string, Array<{ id: string; name: string; color: string | null }>> = {};
  for (const row of rows) {
    if (!result[row.task_id]) {
      result[row.task_id] = [];
    }
    result[row.task_id].push({ id: row.id, name: row.name, color: row.color });
  }

  res.json(result);
}));

// Sync tags for a task (replace all tags with given set)
// NOTE: Must be before /tasks/:taskId/:tagId to avoid route conflict
router.post("/tasks/:taskId/sync", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId } = req.params;
  const { tagIds } = req.body;

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  if (!Array.isArray(tagIds)) {
    throw new ValidationError("tagIds must be an array");
  }

  // Perform sync in a transaction
  const syncTransaction = db.transaction(() => {
    // Remove all existing tags
    db.prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);

    // Add new tags
    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)"
    );
    for (const tagId of tagIds) {
      insertStmt.run(taskId, tagId);
    }
  });

  syncTransaction();

  // Return the current tags for the task
  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       INNER JOIN task_tags tt ON tt.tag_id = t.id
       WHERE tt.task_id = ?
       ORDER BY t.name ASC`
    )
    .all(taskId);

  log.info({ taskId, tagCount: tagIds.length }, "Task tags synced");
  res.json(tags);
}));

// Get tags for a task
router.get("/tasks/:taskId", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId } = req.params;

  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       INNER JOIN task_tags tt ON tt.tag_id = t.id
       WHERE tt.task_id = ?
       ORDER BY t.name ASC`
    )
    .all(taskId);

  res.json(tags);
}));

// Add tag to task
router.post("/tasks/:taskId/:tagId", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId, tagId } = req.params;

  // Verify task exists
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    throw new NotFoundError("Task", taskId);
  }

  // Verify tag exists
  const tag = db.prepare("SELECT id FROM tags WHERE id = ?").get(tagId);
  if (!tag) {
    throw new NotFoundError("Tag", tagId);
  }

  // Insert (ignore if already exists)
  db.prepare(
    "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)"
  ).run(taskId, tagId);

  log.info({ taskId, tagId }, "Tag added to task");
  res.json({ success: true });
}));

// Remove tag from task
router.delete("/tasks/:taskId/:tagId", asyncHandler(async (req, res) => {
  const db = getDb();
  const { taskId, tagId } = req.params;

  db.prepare("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?").run(taskId, tagId);

  log.info({ taskId, tagId }, "Tag removed from task");
  res.json({ success: true });
}));

export default router;
