/**
 * Suggestions API routes - James's improvement suggestions
 */

import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";
import { detectAccess } from "../services/accessDetection.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateSuggestionSchema, UpdateSuggestionSchema, ImplementSuggestionSchema, GenerateSuggestionsSchema, AddCommentSchema } from "../schemas/index.js";

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
    `IMPORTANT: When the sub-agent completes the work, it MUST run:`,
    `  mark-suggestion-implemented ${suggestion.id} --summary "brief description of what was done"`,
    `This marks the suggestion as implemented in the PA app. Include this command in the sub-agent's task description.`,
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

/**
 * Look up a suggestion's project and determine implementation access.
 */
async function getAccessForSuggestion(projectId: string | null): Promise<{
  canImplement: boolean;
  accessType: string;
}> {
  if (!projectId) {
    return { canImplement: false, accessType: "none" };
  }

  const db = getDb();
  const project = db.prepare(
    "SELECT codebase_path, github_repo FROM projects WHERE id = ?"
  ).get(projectId) as { codebase_path: string | null; github_repo: string | null } | undefined;

  if (!project) {
    return { canImplement: false, accessType: "none" };
  }

  const result = await detectAccess(project.codebase_path, project.github_repo);
  return { canImplement: result.hasAccess, accessType: result.accessType };
}

// Path to generate_suggestions.py script
const GENERATE_SCRIPT = process.env.GENERATE_SCRIPT || "/home/jd-server-admin/clawd/scripts/generate_suggestions.py";

// ─── Generate Suggestions ─────────────────────────────────────────

/**
 * POST /api/suggestions/generate
 * Analyze a project and generate improvement suggestions using AI.
 */
router.post("/generate", validateBody(GenerateSuggestionsSchema), async (req, res) => {
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

// ─── Create PRD from Suggestion ────────────────────────────────────

/**
 * POST /api/suggestions/:id/create-prd
 * Generate a comprehensive PRD from a suggestion using LLM.
 */
router.post("/:id/create-prd", async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id) as {
    id: string;
    title: string;
    description: string | null;
    type: string;
    priority: number;
    project_id: string | null;
    project_name: string | null;
  } | undefined;

  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  // Check if a PRD already exists for this suggestion
  const existingPrd = db.prepare("SELECT id FROM prds WHERE suggestion_id = ?").get(id) as { id: string } | undefined;
  if (existingPrd) {
    return res.status(409).json({
      error: "A PRD already exists for this suggestion",
      prdId: existingPrd.id,
    });
  }

  // Get project info
  let projectName = suggestion.project_name || "Unknown Project";
  if (suggestion.project_id) {
    const project = db.prepare("SELECT name FROM projects WHERE id = ?").get(suggestion.project_id) as { name: string } | undefined;
    if (project) {
      projectName = project.name;
    }
  }

  // Fetch comments for additional context
  const comments = db.prepare(
    "SELECT comment_text FROM suggestion_comments WHERE suggestion_id = ? ORDER BY created_at ASC"
  ).all(id) as Array<{ comment_text: string }>;

  const commentContext = comments.length > 0
    ? `\n\nAdditional context from discussion:\n${comments.map(c => `- ${c.comment_text}`).join("\n")}`
    : "";

  const priorityLabels: Record<number, string> = {
    1: "Critical",
    2: "High",
    3: "Medium",
    4: "Low",
    5: "Minimal",
  };

  // Build the LLM prompt
  const prompt = `You are creating a comprehensive Product Requirements Document (PRD) for the following feature suggestion:

**Title:** ${suggestion.title}
**Description:** ${suggestion.description || "No description provided"}
**Type:** ${suggestion.type}
**Priority:** ${priorityLabels[suggestion.priority] || "Medium"}
**Project:** ${projectName}${commentContext}

Generate a detailed PRD. Return ONLY a valid JSON object (no markdown fencing, no extra text) with these fields:

{
  "problemStatement": "What problem does this solve? Why is it important? (2-3 paragraphs)",
  "goals": ["Goal 1", "Goal 2", "Goal 3"],
  "nonGoals": ["Non-goal 1", "Non-goal 2"],
  "targetUsers": "Who are the target users? (1-2 sentences)",
  "technicalApproach": "Specific technical implementation details, architecture decisions, tech stack (2-3 paragraphs)",
  "requirements": [
    {"type": "functional", "description": "Requirement 1", "priority": "high"},
    {"type": "functional", "description": "Requirement 2", "priority": "medium"}
  ],
  "successMetrics": ["Metric 1", "Metric 2"],
  "estimatedEffort": "Rough time estimate (e.g., '2-3 days' or '8-12 hours')",
  "risks": ["Risk 1", "Risk 2"],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "milestones": [
    {"title": "Phase 1: Setup", "description": "Initial setup and scaffolding"},
    {"title": "Phase 2: Implementation", "description": "Core feature development"}
  ]
}

Be specific, actionable, and comprehensive. Assume the reader is a developer who will implement this.`;

  log.info({ suggestionId: id, title: suggestion.title }, "Generating PRD from suggestion");

  try {
    // Get Groq API key from credential manager
    let groqApiKey: string;
    try {
      const { stdout: keyOut } = await execFileAsync("python3", [
        "/home/jd-server-admin/clawd/scripts/credential_manager.py",
        "get",
        "/home/jd-server-admin/.config/james/groq.conf",
        "GROQ_API_KEY",
      ], { timeout: 5000 });
      groqApiKey = keyOut.trim();
    } catch {
      log.error("Failed to retrieve Groq API key");
      return res.status(500).json({ error: "LLM API key not available" });
    }

    // Call Groq API directly for fast, high-quality PRD generation
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a senior product manager creating detailed PRDs. Always respond with valid JSON only - no markdown fencing, no extra text before or after the JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      log.error({ status: groqResponse.status, body: errText.substring(0, 500) }, "Groq API error");
      return res.status(502).json({ error: "LLM API returned an error" });
    }

    const groqResult = await groqResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const responseText = groqResult.choices?.[0]?.message?.content || "";

    // Parse the JSON from the LLM response
    let prdData;
    try {
      // Try to extract JSON from markdown code fences if present
      const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      prdData = JSON.parse(jsonStr.trim());
    } catch {
      log.error({ responseText: responseText.substring(0, 500) }, "Failed to parse PRD JSON from LLM");
      return res.status(500).json({ error: "LLM returned invalid PRD format" });
    }

    // Create the PRD in the database
    const prdId = generateId();
    const now = getCurrentTimestamp();

    // Map requirements to the PRD format (add IDs)
    const requirements = (prdData.requirements || []).map((r: { type?: string; description: string; priority?: string }, i: number) => ({
      id: `req-${i + 1}`,
      type: r.type || "functional",
      description: r.description,
      priority: r.priority || "medium",
    }));

    // Map milestones
    const milestones = (prdData.milestones || []).map((m: { title: string; description?: string }, i: number) => ({
      id: `ms-${i + 1}`,
      title: m.title,
      description: m.description || "",
    }));

    // Map user stories (generate from requirements if not provided)
    const userStories = (prdData.userStories || []).map((s: { persona?: string; action?: string; benefit?: string; acceptanceCriteria?: string[] }, i: number) => ({
      id: `us-${i + 1}`,
      persona: s.persona || "User",
      action: s.action || "",
      benefit: s.benefit || "",
      acceptanceCriteria: s.acceptanceCriteria || [],
    }));

    db.prepare(`
      INSERT INTO prds (
        id, project_id, suggestion_id, feature_name, version, author, assignee, area, status,
        problem_statement, goals, non_goals, target_users, user_stories, requirements,
        technical_approach, dependencies, risks, assumptions, constraints,
        success_metrics, milestones, estimated_effort,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prdId,
      suggestion.project_id || null,
      suggestion.id,
      suggestion.title,
      "1.0",
      "James (AI)",
      null,
      "personal",
      "draft",
      prdData.problemStatement || null,
      JSON.stringify(prdData.goals || []),
      JSON.stringify(prdData.nonGoals || []),
      prdData.targetUsers || null,
      JSON.stringify(userStories),
      JSON.stringify(requirements),
      prdData.technicalApproach || null,
      JSON.stringify(prdData.dependencies || []),
      JSON.stringify(prdData.risks || []),
      JSON.stringify(prdData.assumptions || []),
      JSON.stringify(prdData.constraints || []),
      JSON.stringify(prdData.successMetrics || []),
      JSON.stringify(milestones),
      prdData.estimatedEffort || null,
      now,
      now
    );

    // Link the PRD back to the suggestion
    db.prepare("UPDATE suggestions SET prd_id = ?, updated_at = ? WHERE id = ?")
      .run(prdId, now, suggestion.id);

    log.info({ prdId, suggestionId: id }, "PRD generated and saved");

    res.status(201).json({
      success: true,
      prdId,
      message: `PRD "${suggestion.title}" created successfully`,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ err: error, suggestionId: id }, "PRD generation failed");

    if (errMsg.includes("TIMEOUT") || errMsg.includes("timed out")) {
      return res.status(504).json({ error: "PRD generation timed out. Please try again." });
    }

    res.status(500).json({ error: `PRD generation failed: ${errMsg}` });
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
router.post("/:id/comments", validateBody(AddCommentSchema), (req, res) => {
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

// List suggestions (with access detection)
router.get("/", async (req, res) => {
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

  const suggestions = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  // Batch access detection by unique project IDs
  const projectIds = [...new Set(suggestions.map(s => s.project_id as string | null).filter(Boolean))];
  const accessCache = new Map<string, { canImplement: boolean; accessType: string }>();

  await Promise.all(
    projectIds.map(async (pid) => {
      if (pid) {
        const result = await getAccessForSuggestion(pid);
        accessCache.set(pid, result);
      }
    })
  );

  // Annotate suggestions with access info
  const annotated = suggestions.map(s => {
    const access = s.project_id
      ? accessCache.get(s.project_id as string) || { canImplement: false, accessType: "none" }
      : { canImplement: false, accessType: "none" };
    return { ...s, canImplement: access.canImplement, accessType: access.accessType };
  });

  res.json(annotated);
});

// Get single suggestion (with access detection)
router.get("/:id", async (req, res) => {
  const db = getDb();
  const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }

  // Detect implementation access for this suggestion's project
  const { canImplement, accessType } = await getAccessForSuggestion(
    suggestion.project_id as string | null
  );

  res.json({ ...suggestion, canImplement, accessType });
});

// Create suggestion (James creates these)
router.post("/", validateBody(CreateSuggestionSchema), (req, res) => {
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
router.post("/:id/implement", validateBody(ImplementSuggestionSchema), (req, res) => {
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
router.patch("/:id", validateBody(UpdateSuggestionSchema), (req, res) => {
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
