/**
 * GitHub Activity Sync Service
 *
 * Fetches commits, PRs, and issues from GitHub repositories using the gh CLI,
 * deduplicates against existing records, estimates time from commit sizes,
 * and stores activity in the github_activity table.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";

const execFileAsync = promisify(execFile);
const log = createLogger("github-sync");

const GH_USERNAME = process.env.GH_USERNAME || "justindeisler";
const GH_EXEC_OPTS = {
  timeout: 30000,
  maxBuffer: 10 * 1024 * 1024, // 10MB
  env: {
    ...process.env,
    HOME: "/home/jd-server-admin",
    PATH: process.env.PATH,
  },
};

// ============================================================================
// Types
// ============================================================================

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { login: string; name: string };
  additions: number;
  deletions: number;
  url: string;
  committedDate: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  state: string;
  url: string;
  additions: number;
  deletions: number;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  state: string;
  url: string;
  createdAt: string;
  closedAt: string | null;
}

export interface SyncResult {
  repo: string;
  commitsImported: number;
  prsImported: number;
  issuesImported: number;
  commitsSkipped: number;
  prsSkipped: number;
  issuesSkipped: number;
  errors: string[];
  duration: number;
}

export interface ActivitySummary {
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
  totalAdditions: number;
  totalDeletions: number;
  estimatedMinutes: number;
  topAuthors: Array<{ author: string; count: number }>;
  activityByDay: Array<{ date: string; commits: number; prs: number; issues: number }>;
}

// ============================================================================
// Time Estimation
// ============================================================================

/**
 * Estimate working time from code change size (additions + deletions)
 */
export function estimateMinutes(additions: number, deletions: number): number {
  const totalLines = (additions || 0) + (deletions || 0);
  if (totalLines < 50) return 15;      // Small change
  if (totalLines < 200) return 30;     // Medium change
  if (totalLines < 500) return 60;     // Large change
  return 120;                          // XL change
}

// ============================================================================
// GitHub API (via gh CLI)
// ============================================================================

/**
 * Fetch commits for a repository
 */
export async function fetchCommits(
  repo: string,
  since?: string,
  limit: number = 100
): Promise<GitHubCommit[]> {
  // Build the API URL with query params directly
  let apiUrl = `repos/${repo}/commits?per_page=100`;
  if (since) {
    apiUrl += `&since=${since}`;
  }

  const jqExpr = `.[:${limit}][] | {sha: .sha, message: .commit.message, author: {login: (.author.login // .commit.author.name // "unknown"), name: (.commit.author.name // "unknown")}, additions: 0, deletions: 0, url: .html_url, committedDate: .commit.committer.date}`;

  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["api", apiUrl, "--paginate", "--jq", jqExpr],
      GH_EXEC_OPTS
    );
    if (!stdout.trim()) return [];

    // gh with jq outputs one JSON object per line
    const commits: GitHubCommit[] = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean) as GitHubCommit[];

    // Fetch stats for each commit (additions/deletions) - batch up to 30
    const withStats = await Promise.all(
      commits.slice(0, 30).map(async (commit) => {
        try {
          const { stdout: statsOut } = await execFileAsync(
            "gh",
            [
              "api",
              `repos/${repo}/commits/${commit.sha}`,
              "--jq",
              `{additions: .stats.additions, deletions: .stats.deletions}`,
            ],
            { ...GH_EXEC_OPTS, timeout: 10000 }
          );
          const stats = JSON.parse(statsOut.trim());
          return { ...commit, additions: stats.additions || 0, deletions: stats.deletions || 0 };
        } catch {
          return commit;
        }
      })
    );

    // Add remaining commits without stats
    return [...withStats, ...commits.slice(30)];
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error({ repo, error: msg }, "Failed to fetch commits");
    throw new Error(`Failed to fetch commits for ${repo}: ${msg}`);
  }
}

/**
 * Fetch pull requests for a repository
 */
export async function fetchPullRequests(
  repo: string,
  state: "open" | "closed" | "all" = "all",
  limit: number = 50
): Promise<GitHubPR[]> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "pr", "list",
        "--repo", repo,
        "--state", state,
        "--json", "number,title,body,author,state,url,additions,deletions,createdAt,closedAt,mergedAt",
        "--limit", String(limit),
      ],
      GH_EXEC_OPTS
    );

    if (!stdout.trim()) return [];
    return JSON.parse(stdout);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error({ repo, error: msg }, "Failed to fetch PRs");
    throw new Error(`Failed to fetch PRs for ${repo}: ${msg}`);
  }
}

/**
 * Fetch issues for a repository
 */
export async function fetchIssues(
  repo: string,
  state: "open" | "closed" | "all" = "all",
  limit: number = 50
): Promise<GitHubIssue[]> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "issue", "list",
        "--repo", repo,
        "--state", state,
        "--json", "number,title,body,author,state,url,createdAt,closedAt",
        "--limit", String(limit),
      ],
      GH_EXEC_OPTS
    );

    if (!stdout.trim()) return [];
    return JSON.parse(stdout);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error({ repo, error: msg }, "Failed to fetch issues");
    throw new Error(`Failed to fetch issues for ${repo}: ${msg}`);
  }
}

// ============================================================================
// Sync Logic
// ============================================================================

/**
 * Find project_id linked to a GitHub repo
 */
function findProjectByRepo(repoName: string): string | null {
  const db = getDb();
  // Try exact match on github_repo field
  const project = db.prepare(
    "SELECT id FROM projects WHERE github_repo = ? OR github_repo = ?"
  ).get(repoName, repoName.split("/").pop()) as { id: string } | undefined;
  return project?.id || null;
}

/**
 * Sync commits from a repository into the database
 */
async function syncCommits(
  repo: string,
  projectId: string | null,
  since?: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  let commits: GitHubCommit[];
  try {
    commits = await fetchCommits(repo, since);
  } catch (e) {
    return { imported: 0, skipped: 0, errors: [(e as Error).message] };
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO github_activity
      (id, project_id, type, repo_name, sha, title, description, author, url, created_at, additions, deletions, estimated_minutes, imported_at)
    VALUES (?, ?, 'commit', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkStmt = db.prepare(
    "SELECT 1 FROM github_activity WHERE sha = ? AND repo_name = ?"
  );

  for (const commit of commits) {
    try {
      // Deduplicate by SHA
      const exists = checkStmt.get(commit.sha, repo);
      if (exists) {
        skipped++;
        continue;
      }

      const est = estimateMinutes(commit.additions, commit.deletions);
      const title = commit.message.split("\n")[0].substring(0, 255);
      const description = commit.message.length > 255 ? commit.message : null;

      insertStmt.run(
        generateId(),
        projectId,
        repo,
        commit.sha,
        title,
        description,
        commit.author?.login || commit.author?.name || "unknown",
        commit.url,
        commit.committedDate,
        commit.additions || 0,
        commit.deletions || 0,
        est,
        getCurrentTimestamp()
      );
      imported++;
    } catch (e) {
      errors.push(`Commit ${commit.sha}: ${(e as Error).message}`);
    }
  }

  return { imported, skipped, errors };
}

/**
 * Sync PRs from a repository into the database
 */
async function syncPRs(
  repo: string,
  projectId: string | null,
  state: "open" | "closed" | "all" = "all"
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  let prs: GitHubPR[];
  try {
    prs = await fetchPullRequests(repo, state);
  } catch (e) {
    return { imported: 0, skipped: 0, errors: [(e as Error).message] };
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO github_activity
      (id, project_id, type, repo_name, number, title, description, author, url, created_at, closed_at, merged_at, additions, deletions, estimated_minutes, imported_at)
    VALUES (?, ?, 'pr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkStmt = db.prepare(
    "SELECT 1 FROM github_activity WHERE type = 'pr' AND number = ? AND repo_name = ?"
  );

  for (const pr of prs) {
    try {
      const exists = checkStmt.get(pr.number, repo);
      if (exists) {
        skipped++;
        continue;
      }

      const est = estimateMinutes(pr.additions || 0, pr.deletions || 0);

      insertStmt.run(
        generateId(),
        projectId,
        repo,
        pr.number,
        pr.title,
        pr.body?.substring(0, 2000) || null,
        pr.author?.login || "unknown",
        pr.url,
        pr.createdAt,
        pr.closedAt || null,
        pr.mergedAt || null,
        pr.additions || 0,
        pr.deletions || 0,
        est,
        getCurrentTimestamp()
      );
      imported++;
    } catch (e) {
      errors.push(`PR #${pr.number}: ${(e as Error).message}`);
    }
  }

  return { imported, skipped, errors };
}

/**
 * Sync issues from a repository into the database
 */
async function syncIssues(
  repo: string,
  projectId: string | null,
  state: "open" | "closed" | "all" = "all"
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const db = getDb();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  let issues: GitHubIssue[];
  try {
    issues = await fetchIssues(repo, state);
  } catch (e) {
    return { imported: 0, skipped: 0, errors: [(e as Error).message] };
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO github_activity
      (id, project_id, type, repo_name, number, title, description, author, url, created_at, closed_at, imported_at)
    VALUES (?, ?, 'issue', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkStmt = db.prepare(
    "SELECT 1 FROM github_activity WHERE type = 'issue' AND number = ? AND repo_name = ?"
  );

  for (const issue of issues) {
    try {
      const exists = checkStmt.get(issue.number, repo);
      if (exists) {
        skipped++;
        continue;
      }

      insertStmt.run(
        generateId(),
        projectId,
        repo,
        issue.number,
        issue.title,
        issue.body?.substring(0, 2000) || null,
        issue.author?.login || "unknown",
        issue.url,
        issue.createdAt,
        issue.closedAt || null,
        getCurrentTimestamp()
      );
      imported++;
    } catch (e) {
      errors.push(`Issue #${issue.number}: ${(e as Error).message}`);
    }
  }

  return { imported, skipped, errors };
}

/**
 * Full sync for a single repository
 */
export async function syncRepository(
  repo: string,
  options: {
    sinceDays?: number;
    syncType?: "manual" | "scheduled";
  } = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const { sinceDays = 7, syncType = "manual" } = options;
  const errors: string[] = [];

  // Calculate since date
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const sinceStr = since.toISOString();

  // Find linked project
  const projectId = findProjectByRepo(repo);

  // Create sync log entry
  const db = getDb();
  const syncLogId = generateId();
  db.prepare(
    "INSERT INTO github_sync_log (id, repo_name, sync_type) VALUES (?, ?, ?)"
  ).run(syncLogId, repo, syncType);

  log.info({ repo, since: sinceStr, projectId }, "Starting GitHub sync");

  // Sync commits
  const commitResult = await syncCommits(repo, projectId, sinceStr);
  errors.push(...commitResult.errors);

  // Sync PRs
  const prResult = await syncPRs(repo, projectId);
  errors.push(...prResult.errors);

  // Sync issues
  const issueResult = await syncIssues(repo, projectId);
  errors.push(...issueResult.errors);

  const duration = Date.now() - startTime;

  // Update sync log
  db.prepare(`
    UPDATE github_sync_log
    SET completed_at = ?, commits_imported = ?, prs_imported = ?, issues_imported = ?,
        errors = ?, status = ?
    WHERE id = ?
  `).run(
    getCurrentTimestamp(),
    commitResult.imported,
    prResult.imported,
    issueResult.imported,
    errors.length > 0 ? JSON.stringify(errors) : null,
    errors.length > 0 && (commitResult.imported + prResult.imported + issueResult.imported === 0)
      ? "failed"
      : "completed",
    syncLogId
  );

  const result: SyncResult = {
    repo,
    commitsImported: commitResult.imported,
    prsImported: prResult.imported,
    issuesImported: issueResult.imported,
    commitsSkipped: commitResult.skipped,
    prsSkipped: prResult.skipped,
    issuesSkipped: issueResult.skipped,
    errors,
    duration,
  };

  log.info(
    {
      repo,
      commits: commitResult.imported,
      prs: prResult.imported,
      issues: issueResult.imported,
      skipped: commitResult.skipped + prResult.skipped + issueResult.skipped,
      errors: errors.length,
      duration: `${duration}ms`,
    },
    "GitHub sync completed"
  );

  return result;
}

/**
 * Sync all repositories linked to projects
 */
export async function syncAllLinkedRepos(
  options: { sinceDays?: number; syncType?: "manual" | "scheduled" } = {}
): Promise<SyncResult[]> {
  const db = getDb();
  const projects = db.prepare(
    "SELECT github_repo FROM projects WHERE github_repo IS NOT NULL AND github_repo != ''"
  ).all() as Array<{ github_repo: string }>;

  const results: SyncResult[] = [];

  for (const { github_repo } of projects) {
    // Ensure repo is in owner/repo format
    const repo = github_repo.includes("/")
      ? github_repo
      : `${GH_USERNAME}/${github_repo}`;

    try {
      const result = await syncRepository(repo, options);
      results.push(result);
    } catch (e) {
      log.error({ repo, error: (e as Error).message }, "Failed to sync repo");
      results.push({
        repo,
        commitsImported: 0,
        prsImported: 0,
        issuesImported: 0,
        commitsSkipped: 0,
        prsSkipped: 0,
        issuesSkipped: 0,
        errors: [(e as Error).message],
        duration: 0,
      });
    }
  }

  return results;
}

/**
 * Get activity summary for a repository
 */
export function getActivitySummary(
  repo: string,
  days: number = 7
): ActivitySummary {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'commit' THEN 1 ELSE 0 END) as commits,
      SUM(CASE WHEN type = 'pr' THEN 1 ELSE 0 END) as prs,
      SUM(CASE WHEN type = 'issue' THEN 1 ELSE 0 END) as issues,
      SUM(COALESCE(additions, 0)) as total_additions,
      SUM(COALESCE(deletions, 0)) as total_deletions,
      SUM(COALESCE(estimated_minutes, 0)) as total_minutes
    FROM github_activity
    WHERE repo_name = ? AND created_at >= ?
  `).get(repo, sinceStr) as {
    commits: number;
    prs: number;
    issues: number;
    total_additions: number;
    total_deletions: number;
    total_minutes: number;
  };

  const topAuthors = db.prepare(`
    SELECT author, COUNT(*) as count
    FROM github_activity
    WHERE repo_name = ? AND created_at >= ?
    GROUP BY author
    ORDER BY count DESC
    LIMIT 5
  `).all(repo, sinceStr) as Array<{ author: string; count: number }>;

  const activityByDay = db.prepare(`
    SELECT
      DATE(created_at) as date,
      SUM(CASE WHEN type = 'commit' THEN 1 ELSE 0 END) as commits,
      SUM(CASE WHEN type = 'pr' THEN 1 ELSE 0 END) as prs,
      SUM(CASE WHEN type = 'issue' THEN 1 ELSE 0 END) as issues
    FROM github_activity
    WHERE repo_name = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(repo, sinceStr) as Array<{ date: string; commits: number; prs: number; issues: number }>;

  return {
    totalCommits: counts.commits || 0,
    totalPRs: counts.prs || 0,
    totalIssues: counts.issues || 0,
    totalAdditions: counts.total_additions || 0,
    totalDeletions: counts.total_deletions || 0,
    estimatedMinutes: counts.total_minutes || 0,
    topAuthors,
    activityByDay,
  };
}

/**
 * Get recent sync logs
 */
export function getSyncLogs(limit: number = 20) {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM github_sync_log ORDER BY started_at DESC LIMIT ?"
  ).all(limit);
}
