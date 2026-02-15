/**
 * GitHub API routes
 *
 * Provides endpoints for:
 * - Listing repos (existing)
 * - Fetching commits, PRs, issues from GitHub
 * - Syncing GitHub activity into the database
 * - Activity summaries and stored activity queries
 */

import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createLogger } from "../logger.js";
import { getDb } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  fetchCommits,
  fetchPullRequests,
  fetchIssues,
  syncRepository,
  syncAllLinkedRepos,
  getActivitySummary,
  getSyncLogs,
} from "../services/githubSync.js";

const router = Router();
const log = createLogger("github");
const execFileAsync = promisify(execFile);

const GH_USERNAME = process.env.GH_USERNAME || "justindeisler";

interface GitHubRepo {
  name: string;
  description: string | null;
  url: string;
  updatedAt: string;
}

// ============================================================================
// List repos (existing endpoint)
// ============================================================================

/**
 * GET /api/github/repos
 * List GitHub repositories using the gh CLI.
 */
router.get("/repos", async (_req, res) => {
  try {
    const { stdout } = await execFileAsync("gh", [
      "repo", "list", GH_USERNAME,
      "--json", "name,description,url,updatedAt",
      "--limit", "50",
      "--no-archived",
    ], {
      timeout: 15000,
      env: {
        ...process.env,
        HOME: "/home/jd-server-admin",
        PATH: process.env.PATH,
      },
    });

    let repos: GitHubRepo[] = [];
    try {
      repos = JSON.parse(stdout);
    } catch {
      log.warn("Failed to parse gh repo list output");
      return res.json({ repos: [], message: "Failed to parse GitHub response" });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const activeRepos = repos
      .filter((r: GitHubRepo) => new Date(r.updatedAt) > sixMonthsAgo)
      .sort((a: GitHubRepo, b: GitHubRepo) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((r: GitHubRepo) => ({
        name: r.name,
        fullName: `${GH_USERNAME}/${r.name}`,
        description: r.description || "",
        url: r.url,
        updatedAt: r.updatedAt,
      }));

    log.info({ count: activeRepos.length }, "Fetched GitHub repos");
    res.json({ repos: activeRepos });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes("not logged in") || errMsg.includes("auth login")) {
      log.warn("GitHub CLI not authenticated");
      return res.json({
        repos: [],
        message: "GitHub CLI not authenticated. Run `gh auth login` to enable.",
        authenticated: false,
      });
    }

    log.error({ err: error }, "Failed to fetch GitHub repos");
    res.json({
      repos: [],
      message: `Failed to fetch repos: ${errMsg}`,
    });
  }
});

// ============================================================================
// Live GitHub data (fetched on-demand, not stored)
// ============================================================================

/**
 * GET /api/github/commits?repo=owner/repo&since=YYYY-MM-DD
 * Fetch commits from GitHub for a given repo.
 */
router.get("/commits", asyncHandler(async (req, res) => {
  const { repo, since } = req.query;

  if (!repo || typeof repo !== "string") {
    return res.status(400).json({ error: "repo query parameter is required (e.g., owner/repo)" });
  }

  const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;
  const commits = await fetchCommits(fullRepo, since as string | undefined);

  res.json({
    repo: fullRepo,
    commits,
    count: commits.length,
  });
}));

/**
 * GET /api/github/pulls?repo=owner/repo&state=all
 * Fetch pull requests from GitHub for a given repo.
 */
router.get("/pulls", asyncHandler(async (req, res) => {
  const { repo, state = "all" } = req.query;

  if (!repo || typeof repo !== "string") {
    return res.status(400).json({ error: "repo query parameter is required" });
  }

  const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;
  const prs = await fetchPullRequests(fullRepo, state as "open" | "closed" | "all");

  res.json({
    repo: fullRepo,
    pulls: prs,
    count: prs.length,
  });
}));

/**
 * GET /api/github/issues?repo=owner/repo&state=all
 * Fetch issues from GitHub for a given repo.
 */
router.get("/issues", asyncHandler(async (req, res) => {
  const { repo, state = "all" } = req.query;

  if (!repo || typeof repo !== "string") {
    return res.status(400).json({ error: "repo query parameter is required" });
  }

  const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;
  const issues = await fetchIssues(fullRepo, state as "open" | "closed" | "all");

  res.json({
    repo: fullRepo,
    issues,
    count: issues.length,
  });
}));

// ============================================================================
// Sync endpoints (import into database)
// ============================================================================

/**
 * POST /api/github/sync
 * Sync a single repository's activity into the database.
 * Body: { repo: "owner/repo", days?: 7 }
 */
router.post("/sync", asyncHandler(async (req, res) => {
  const { repo, days = 7 } = req.body;

  if (!repo || typeof repo !== "string") {
    return res.status(400).json({ error: "repo is required in request body" });
  }

  const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;
  const result = await syncRepository(fullRepo, { sinceDays: days, syncType: "manual" });

  res.json({
    success: result.errors.length === 0 || (result.commitsImported + result.prsImported + result.issuesImported) > 0,
    result,
  });
}));

/**
 * POST /api/github/sync-all
 * Sync all repositories linked to projects.
 * Body: { days?: 7 }
 */
router.post("/sync-all", asyncHandler(async (req, res) => {
  const { days = 7 } = req.body || {};

  const results = await syncAllLinkedRepos({ sinceDays: days, syncType: "manual" });

  const totalImported = results.reduce(
    (sum, r) => sum + r.commitsImported + r.prsImported + r.issuesImported,
    0
  );

  res.json({
    success: true,
    totalRepos: results.length,
    totalImported,
    results,
  });
}));

// ============================================================================
// Stored activity queries
// ============================================================================

/**
 * GET /api/github/activity?repo=owner/repo&days=7
 * Get activity summary from stored data.
 */
router.get("/activity", asyncHandler(async (req, res) => {
  const { repo, days = "7", project_id } = req.query;

  if (repo && typeof repo === "string") {
    const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;
    const summary = getActivitySummary(fullRepo, parseInt(days as string, 10));
    return res.json({ repo: fullRepo, days: parseInt(days as string, 10), ...summary });
  }

  if (project_id && typeof project_id === "string") {
    // Get activity for a specific project
    const db = getDb();
    const daysNum = parseInt(days as string, 10);
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const activities = db.prepare(`
      SELECT * FROM github_activity
      WHERE project_id = ? AND created_at >= ?
      ORDER BY created_at DESC
    `).all(project_id, since.toISOString());

    return res.json({ project_id, days: daysNum, activities, count: activities.length });
  }

  // Return all recent activity
  const db = getDb();
  const daysNum = parseInt(days as string, 10);
  const since = new Date();
  since.setDate(since.getDate() - daysNum);

  const activities = db.prepare(`
    SELECT * FROM github_activity
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(since.toISOString());

  res.json({ days: daysNum, activities, count: activities.length });
}));

/**
 * GET /api/github/activity/project/:projectId
 * Get all GitHub activity for a specific project.
 */
router.get("/activity/project/:projectId", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { type, limit = "100" } = req.query;

  const db = getDb();
  let sql = "SELECT * FROM github_activity WHERE project_id = ?";
  const params: unknown[] = [projectId];

  if (type && typeof type === "string") {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(parseInt(limit as string, 10));

  const activities = db.prepare(sql).all(...params);

  // Also get summary stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN type = 'commit' THEN 1 ELSE 0 END) as commits,
      SUM(CASE WHEN type = 'pr' THEN 1 ELSE 0 END) as prs,
      SUM(CASE WHEN type = 'issue' THEN 1 ELSE 0 END) as issues,
      SUM(COALESCE(additions, 0)) as total_additions,
      SUM(COALESCE(deletions, 0)) as total_deletions,
      SUM(COALESCE(estimated_minutes, 0)) as estimated_minutes
    FROM github_activity
    WHERE project_id = ?
  `).get(projectId);

  res.json({ projectId, activities, stats, count: activities.length });
}));

// ============================================================================
// Sync logs
// ============================================================================

/**
 * GET /api/github/sync-logs
 * Get recent sync operation logs.
 */
router.get("/sync-logs", asyncHandler(async (req, res) => {
  const { limit = "20" } = req.query;
  const logs = getSyncLogs(parseInt(limit as string, 10));
  res.json({ logs, count: logs.length });
}));

// ============================================================================
// Link repo to project
// ============================================================================

/**
 * POST /api/github/link
 * Link a GitHub repo to a project.
 * Body: { projectId: string, repo: string }
 */
router.post("/link", asyncHandler(async (req, res) => {
  const { projectId, repo } = req.body;

  if (!projectId || !repo) {
    return res.status(400).json({ error: "projectId and repo are required" });
  }

  const db = getDb();
  const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(projectId) as { id: string; name: string } | undefined;

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const fullRepo = repo.includes("/") ? repo : `${GH_USERNAME}/${repo}`;

  db.prepare("UPDATE projects SET github_repo = ?, updated_at = datetime('now') WHERE id = ?")
    .run(fullRepo, projectId);

  // Also update any existing activity records that match this repo but have no project_id
  db.prepare("UPDATE github_activity SET project_id = ? WHERE repo_name = ? AND project_id IS NULL")
    .run(projectId, fullRepo);

  log.info({ projectId, repo: fullRepo }, "Linked GitHub repo to project");

  res.json({
    success: true,
    message: `Linked ${fullRepo} to project "${project.name}"`,
    projectId,
    repo: fullRepo,
  });
}));

/**
 * DELETE /api/github/link/:projectId
 * Unlink a GitHub repo from a project.
 */
router.delete("/link/:projectId", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const db = getDb();

  db.prepare("UPDATE projects SET github_repo = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(projectId);

  res.json({ success: true, message: "GitHub repo unlinked from project" });
}));

export default router;
