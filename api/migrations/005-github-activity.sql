-- Migration: GitHub Activity Import
-- Date: 2026-02-16
-- Description: Add github_activity table for tracking commits, PRs, and issues
--              imported from GitHub repositories linked to projects.

-- 1. Create github_activity table
CREATE TABLE IF NOT EXISTS github_activity (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  type TEXT CHECK(type IN ('commit', 'pr', 'issue')) NOT NULL,
  repo_name TEXT NOT NULL,
  sha TEXT,           -- for commits
  number INTEGER,     -- for PRs/issues
  title TEXT,
  description TEXT,
  author TEXT,
  url TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  merged_at TEXT,     -- for PRs
  additions INTEGER,  -- for commits/PRs
  deletions INTEGER,  -- for commits/PRs
  estimated_minutes INTEGER,  -- auto-calculated from commit size
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_github_activity_project ON github_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_github_activity_type ON github_activity(type);
CREATE INDEX IF NOT EXISTS idx_github_activity_repo ON github_activity(repo_name);
CREATE INDEX IF NOT EXISTS idx_github_activity_created ON github_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_github_activity_sha ON github_activity(sha);

-- 3. Create github_sync_log table for tracking sync operations
CREATE TABLE IF NOT EXISTS github_sync_log (
  id TEXT PRIMARY KEY,
  repo_name TEXT NOT NULL,
  sync_type TEXT CHECK(sync_type IN ('manual', 'scheduled')) NOT NULL DEFAULT 'manual',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  commits_imported INTEGER DEFAULT 0,
  prs_imported INTEGER DEFAULT 0,
  issues_imported INTEGER DEFAULT 0,
  errors TEXT,
  status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_github_sync_log_repo ON github_sync_log(repo_name);
