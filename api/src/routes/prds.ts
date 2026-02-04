/**
 * PRDs API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// List PRDs
router.get("/", (req, res) => {
  const db = getDb();
  const { status, area, projectId, limit = 100 } = req.query;

  let sql = "SELECT * FROM prds WHERE 1=1";
  const params: unknown[] = [];

  if (status && status !== "all") {
    sql += " AND status = ?";
    params.push(status);
  }
  if (area && area !== "all") {
    sql += " AND area = ?";
    params.push(area);
  }
  if (projectId && projectId !== "all") {
    sql += " AND project_id = ?";
    params.push(projectId);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));

  const prds = db.prepare(sql).all(...params) as Record<string, unknown>[];
  
  // Helper to safely parse JSON, returning original value or empty array if not valid JSON
  const safeJsonParse = (value: unknown): unknown[] => {
    if (!value) return [];
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If not valid JSON, wrap the text as a single-item array
      return value.trim() ? [value] : [];
    }
  };

  // Parse JSON fields
  const parsed = prds.map((prd) => ({
    ...prd,
    goals: safeJsonParse(prd.goals),
    nonGoals: safeJsonParse(prd.non_goals),
    userStories: safeJsonParse(prd.user_stories),
    requirements: safeJsonParse(prd.requirements),
    dependencies: safeJsonParse(prd.dependencies),
    risks: safeJsonParse(prd.risks),
    assumptions: safeJsonParse(prd.assumptions),
    constraints: safeJsonParse(prd.constraints),
    successMetrics: safeJsonParse(prd.success_metrics),
    milestones: safeJsonParse(prd.milestones),
    // Map snake_case to camelCase
    featureName: prd.feature_name,
    projectId: prd.project_id,
    problemStatement: prd.problem_statement,
    targetUsers: prd.target_users,
    technicalApproach: prd.technical_approach,
    estimatedEffort: prd.estimated_effort,
    markdownPath: prd.markdown_path,
    createdAt: prd.created_at,
    updatedAt: prd.updated_at,
  }));

  res.json(parsed);
});

// Get single PRD
router.get("/:id", (req, res) => {
  const db = getDb();
  const prd = db.prepare("SELECT * FROM prds WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
  
  if (!prd) {
    return res.status(404).json({ error: "PRD not found" });
  }

  // Parse JSON fields and map to camelCase
  const parsed = {
    ...prd,
    goals: prd.goals ? JSON.parse(prd.goals as string) : [],
    nonGoals: prd.non_goals ? JSON.parse(prd.non_goals as string) : [],
    userStories: prd.user_stories ? JSON.parse(prd.user_stories as string) : [],
    requirements: prd.requirements ? JSON.parse(prd.requirements as string) : [],
    dependencies: prd.dependencies ? JSON.parse(prd.dependencies as string) : [],
    risks: prd.risks ? JSON.parse(prd.risks as string) : [],
    assumptions: prd.assumptions ? JSON.parse(prd.assumptions as string) : [],
    constraints: prd.constraints ? JSON.parse(prd.constraints as string) : [],
    successMetrics: prd.success_metrics ? JSON.parse(prd.success_metrics as string) : [],
    milestones: prd.milestones ? JSON.parse(prd.milestones as string) : [],
    featureName: prd.feature_name,
    projectId: prd.project_id,
    problemStatement: prd.problem_statement,
    targetUsers: prd.target_users,
    technicalApproach: prd.technical_approach,
    estimatedEffort: prd.estimated_effort,
    markdownPath: prd.markdown_path,
    createdAt: prd.created_at,
    updatedAt: prd.updated_at,
  };

  res.json(parsed);
});

// Create PRD
router.post("/", (req, res) => {
  const db = getDb();
  const {
    projectId,
    featureName,
    version = "1.0",
    author = "Justin",
    assignee,
    area = "personal",
    status = "draft",
    problemStatement,
    goals = [],
    nonGoals = [],
    targetUsers,
    userStories = [],
    requirements = [],
    technicalApproach,
    dependencies = [],
    risks = [],
    assumptions = [],
    constraints = [],
    successMetrics = [],
    milestones = [],
    estimatedEffort,
    markdownPath,
  } = req.body;

  if (!featureName) {
    return res.status(400).json({ error: "Feature name is required" });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO prds (
      id, project_id, feature_name, version, author, assignee, area, status,
      problem_statement, goals, non_goals, target_users, user_stories, requirements,
      technical_approach, dependencies, risks, assumptions, constraints,
      success_metrics, milestones, estimated_effort, markdown_path,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId || null,
    featureName,
    version,
    author,
    assignee || null,
    area,
    status,
    problemStatement || null,
    JSON.stringify(goals),
    JSON.stringify(nonGoals),
    targetUsers || null,
    JSON.stringify(userStories),
    JSON.stringify(requirements),
    technicalApproach || null,
    JSON.stringify(dependencies),
    JSON.stringify(risks),
    JSON.stringify(assumptions),
    JSON.stringify(constraints),
    JSON.stringify(successMetrics),
    JSON.stringify(milestones),
    estimatedEffort || null,
    markdownPath || null,
    now,
    now
  );

  const prd = db.prepare("SELECT * FROM prds WHERE id = ?").get(id) as Record<string, unknown>;
  
  // Return with parsed JSON and camelCase
  res.status(201).json({
    ...prd,
    goals: JSON.parse(prd.goals as string),
    nonGoals: JSON.parse(prd.non_goals as string),
    userStories: JSON.parse(prd.user_stories as string),
    requirements: JSON.parse(prd.requirements as string),
    dependencies: JSON.parse(prd.dependencies as string),
    risks: JSON.parse(prd.risks as string),
    assumptions: JSON.parse(prd.assumptions as string),
    constraints: JSON.parse(prd.constraints as string),
    successMetrics: JSON.parse(prd.success_metrics as string),
    milestones: JSON.parse(prd.milestones as string),
    featureName: prd.feature_name,
    projectId: prd.project_id,
    problemStatement: prd.problem_statement,
    targetUsers: prd.target_users,
    technicalApproach: prd.technical_approach,
    estimatedEffort: prd.estimated_effort,
    markdownPath: prd.markdown_path,
    createdAt: prd.created_at,
    updatedAt: prd.updated_at,
  });
});

// Update PRD
router.put("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM prds WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "PRD not found" });
  }

  const {
    projectId,
    featureName,
    version,
    author,
    assignee,
    area,
    status,
    problemStatement,
    goals,
    nonGoals,
    targetUsers,
    userStories,
    requirements,
    technicalApproach,
    dependencies,
    risks,
    assumptions,
    constraints,
    successMetrics,
    milestones,
    estimatedEffort,
    markdownPath,
  } = req.body;

  const now = getCurrentTimestamp();

  db.prepare(
    `UPDATE prds SET
      project_id = COALESCE(?, project_id),
      feature_name = COALESCE(?, feature_name),
      version = COALESCE(?, version),
      author = COALESCE(?, author),
      assignee = COALESCE(?, assignee),
      area = COALESCE(?, area),
      status = COALESCE(?, status),
      problem_statement = COALESCE(?, problem_statement),
      goals = COALESCE(?, goals),
      non_goals = COALESCE(?, non_goals),
      target_users = COALESCE(?, target_users),
      user_stories = COALESCE(?, user_stories),
      requirements = COALESCE(?, requirements),
      technical_approach = COALESCE(?, technical_approach),
      dependencies = COALESCE(?, dependencies),
      risks = COALESCE(?, risks),
      assumptions = COALESCE(?, assumptions),
      constraints = COALESCE(?, constraints),
      success_metrics = COALESCE(?, success_metrics),
      milestones = COALESCE(?, milestones),
      estimated_effort = COALESCE(?, estimated_effort),
      markdown_path = COALESCE(?, markdown_path),
      updated_at = ?
    WHERE id = ?`
  ).run(
    projectId,
    featureName,
    version,
    author,
    assignee,
    area,
    status,
    problemStatement,
    goals ? JSON.stringify(goals) : null,
    nonGoals ? JSON.stringify(nonGoals) : null,
    targetUsers,
    userStories ? JSON.stringify(userStories) : null,
    requirements ? JSON.stringify(requirements) : null,
    technicalApproach,
    dependencies ? JSON.stringify(dependencies) : null,
    risks ? JSON.stringify(risks) : null,
    assumptions ? JSON.stringify(assumptions) : null,
    constraints ? JSON.stringify(constraints) : null,
    successMetrics ? JSON.stringify(successMetrics) : null,
    milestones ? JSON.stringify(milestones) : null,
    estimatedEffort,
    markdownPath,
    now,
    id
  );

  const prd = db.prepare("SELECT * FROM prds WHERE id = ?").get(id) as Record<string, unknown>;
  
  res.json({
    ...prd,
    goals: prd.goals ? JSON.parse(prd.goals as string) : [],
    nonGoals: prd.non_goals ? JSON.parse(prd.non_goals as string) : [],
    userStories: prd.user_stories ? JSON.parse(prd.user_stories as string) : [],
    requirements: prd.requirements ? JSON.parse(prd.requirements as string) : [],
    dependencies: prd.dependencies ? JSON.parse(prd.dependencies as string) : [],
    risks: prd.risks ? JSON.parse(prd.risks as string) : [],
    assumptions: prd.assumptions ? JSON.parse(prd.assumptions as string) : [],
    constraints: prd.constraints ? JSON.parse(prd.constraints as string) : [],
    successMetrics: prd.success_metrics ? JSON.parse(prd.success_metrics as string) : [],
    milestones: prd.milestones ? JSON.parse(prd.milestones as string) : [],
    featureName: prd.feature_name,
    projectId: prd.project_id,
    problemStatement: prd.problem_statement,
    targetUsers: prd.target_users,
    technicalApproach: prd.technical_approach,
    estimatedEffort: prd.estimated_effort,
    markdownPath: prd.markdown_path,
    createdAt: prd.created_at,
    updatedAt: prd.updated_at,
  });
});

// Delete PRD
router.delete("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM prds WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "PRD not found" });
  }

  db.prepare("DELETE FROM prds WHERE id = ?").run(id);
  res.json({ success: true, message: "PRD deleted" });
});

export default router;
