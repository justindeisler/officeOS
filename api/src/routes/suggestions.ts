/**
 * Suggestions API routes - James's improvement suggestions
 */

import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";

const router = Router();
const log = createLogger("suggestions");
const execFileAsync = promisify(execFile);

// Path to clawdbot CLI
const CLAWDBOT_CLI = process.env.CLAWDBOT_CLI || "/home/jd-server-admin/.npm-global/bin/clawdbot";

/**
 * Trigger James to implement a suggestion via Clawdbot system event.
 * Uses the CLI since the gateway exposes system events over WebSocket, not HTTP.
 */
async function triggerJamesImplementation(suggestion: {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: number;
  project_name: string | null;
}) {
  // Fetch all comments for this suggestion to include in the notification
  const db = getDb();
  const comments = db.prepare(
    "SELECT * FROM suggestion_comments WHERE suggestion_id = ? ORDER BY created_at ASC"
  ).all(suggestion.id) as Array<{ comment_text: string; created_at: string }>;

  const commentSection = comments.length > 0
    ? [
        '',
        'Implementation Notes:',
        ...comments.map(c => `- ${c.comment_text} (${c.created_at})`),
      ].join('\n')
    : '';

  const message = [
    `🔔 Approved Suggestion: "${suggestion.title}" (ID: ${suggestion.id})`,
    suggestion.project_name ? `Project: ${suggestion.project_name}` : null,
    `Type: ${suggestion.type} | Priority: ${suggestion.priority}`,
    suggestion.description ? `Description: ${suggestion.description}` : null,
    commentSection || null,
    '',
    'Please spawn a sub-agent to implement this suggestion.',
    `When complete, mark it as implemented via POST /api/suggestions/${suggestion.id}/implement.`,
  ].filter(Boolean).join('\n');
  
  try {
    const { stdout } = await execFileAsync(CLAWDBOT_CLI, [
      'system', 'event',
      '--text', message,
      '--mode', 'now',
      '--json',
      '--timeout', '10000',
    ], {
      timeout: 15000,
      env: { ...process.env, HOME: '/home/jd-server-admin' },
    });
    
    log.info({ suggestionId: suggestion.id, result: stdout.trim() }, "Triggered James via system event");
  } catch (error) {
    log.error({ err: error, suggestionId: suggestion.id }, "Failed to trigger James via CLI");
    
    // Fallback: write to notification file so James can pick it up on next heartbeat
    try {
      const { appendFile } = await import("fs/promises");
      const notification = JSON.stringify({
        type: 'suggestion-approved',
        timestamp: new Date().toISOString(),
        suggestion: {
          id: suggestion.id,
          title: suggestion.title,
          description: suggestion.description,
          type: suggestion.type,
          priority: suggestion.priority,
          project_name: suggestion.project_name,
        },
      });
      await appendFile('/tmp/james-notifications.jsonl', notification + '\n');
      log.info({ suggestionId: suggestion.id }, "Wrote fallback notification to /tmp/james-notifications.jsonl");
    } catch (fallbackError) {
      log.error({ err: fallbackError, suggestionId: suggestion.id }, "Fallback notification also failed");
    }
  }
}

// Path to generate_suggestions.py script
const GENERATE_SCRIPT = process.env.GENERATE_SCRIPT || "/home/jd-server-admin/clawd/scripts/generate_suggestions.py";

// ─── Generate Suggestions ─────────────────────────────────────────

/**
 * POST /api/suggestions/generate
 * Analyze a project and generate improvement suggestions using AI.
 */
router.post("/generate", async (req, res) => {
  const db = getDb();
  const { source, projectId, projectName, projectPath, deepMode = false, count = 3 } = req.body;

  // Validate input
  if (!source || !["pa-project", "github"].includes(source)) {
    return res.status(400).json({ error: "Invalid source. Must be 'pa-project' or 'github'" });
  }
  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }
  if (!projectName) {
    return res.status(400).json({ error: "projectName is required" });
  }

  const startTime = Date.now();
  log.info({ source, projectId, projectName, deepMode }, "Generating suggestions");

  try {
    // Build command args
    const args = [
      GENERATE_SCRIPT,
      "--source", source,
      "--project-id", projectId,
      "--project-name", projectName,
      "--count", String(Math.min(count, 3)),  // Cap at 3
    ];

    if (projectPath) {
      args.push("--project-path", projectPath);
    }
    if (deepMode) {
      args.push("--deep-mode");
    }

    // Execute the generation script
    const { stdout, stderr } = await execFileAsync("python3", args, {
      timeout: deepMode ? 120000 : 30000,  // 2min for deep, 30s for shallow
      env: {
        ...process.env,
        HOME: "/home/jd-server-admin",
        PATH: process.env.PATH,
      },
    });

    if (stderr) {
      log.info({ stderr: stderr.trim() }, "Generate script stderr");
    }

    // Parse result
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (parseErr) {
      log.error({ stdout: stdout.substring(0, 500) }, "Failed to parse generate script output");
      return res.status(500).json({ error: "Failed to parse generation result" });
    }

    if (!result.success) {
      log.error({ error: result.error }, "Generation script reported failure");
      return res.status(500).json({ error: result.error || "Generation failed" });
    }

    // Insert suggestions into database
    const now = getCurrentTimestamp();
    const insertStmt = db.prepare(`
      INSERT INTO suggestions (id, project_id, project_name, type, title, description, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    // For GitHub repos, project_id might not exist in our projects table (FK constraint).
    // Check if the projectId exists, otherwise use null for project_id.
    let resolvedProjectId: string | null = projectId;
    if (source === "github") {
      const existingProject = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
      if (!existingProject) {
        resolvedProjectId = null;
      }
    }

    const insertedSuggestions: unknown[] = [];
    const insertAll = db.transaction(() => {
      for (const suggestion of result.suggestions) {
        const id = generateId();
        insertStmt.run(
          id,
          resolvedProjectId,
          suggestion.project_name || projectName,
          suggestion.type,
          suggestion.title,
          suggestion.description,
          suggestion.priority,
          now,
          now
        );
        const inserted = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id);
        if (inserted) insertedSuggestions.push(inserted);
      }
    });
    insertAll();

    const duration = Date.now() - startTime;
    log.info(
      { count: insertedSuggestions.length, duration, projectName },
      "Suggestions generated and inserted"
    );

    res.json({
      success: true,
      suggestions: insertedSuggestions,
      message: `Generated ${insertedSuggestions.length} suggestions for ${projectName}`,
      duration,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: error, duration }, "Suggestion generation failed");

    if (errMsg.includes("TIMEOUT") || errMsg.includes("timed out")) {
      return res.status(504).json({
        error: "Generation took too long. Try without Deep Mode.",
        duration,
      });
    }

    res.status(500).json({
      error: `Generation failed: ${errMsg}`,
      duration,
    });
  }
});

// ─── Suggestion Comments ───────────────────────────────────────────

// List comments for a suggestion
router.get("/:id/comments", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  // Verify suggestion exists
  const suggestion = db.prepare("SELECT id FROM suggestions WHERE id = ?").get(id);
  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  const comments = db.prepare(
    "SELECT * FROM suggestion_comments WHERE suggestion_id = ? ORDER BY created_at ASC"
  ).all(id);

  res.json(comments);
});

// Add a comment to a suggestion
router.post("/:id/comments", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { comment_text } = req.body;

  if (!comment_text || !comment_text.trim()) {
    return res.status(400).json({ error: "Comment text is required" });
  }

  // Verify suggestion exists
  const suggestion = db.prepare("SELECT id FROM suggestions WHERE id = ?").get(id);
  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  const commentId = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    "INSERT INTO suggestion_comments (id, suggestion_id, author, comment_text, created_at) VALUES (?, ?, 'Justin Deisler', ?, ?)"
  ).run(commentId, id, comment_text.trim(), now);

  const comment = db.prepare("SELECT * FROM suggestion_comments WHERE id = ?").get(commentId);
  log.info({ commentId, suggestionId: id }, "Comment added to suggestion");
  res.status(201).json(comment);
});

// Delete a specific comment
router.delete("/comments/:commentId", (req, res) => {
  const db = getDb();
  const { commentId } = req.params;

  const existing = db.prepare("SELECT * FROM suggestion_comments WHERE id = ?").get(commentId);
  if (!existing) {
    return res.status(404).json({ error: "Comment not found" });
  }

  db.prepare("DELETE FROM suggestion_comments WHERE id = ?").run(commentId);
  log.info({ commentId }, "Suggestion comment deleted");
  res.json({ success: true });
});

// ─── Suggestions CRUD ─────────────────────────────────────────────

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

  const existing = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id) as {
    id: string; title: string; description: string | null;
    type: string; priority: number; project_name: string | null;
  } | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  db.prepare("UPDATE suggestions SET status = 'approved', decided_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);

  // Trigger James to implement the suggestion (fire-and-forget, don't block response)
  triggerJamesImplementation(existing).catch((err) => {
    log.error({ err, suggestionId: id }, "Background trigger failed");
  });
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
