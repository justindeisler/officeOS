/**
 * GitHub API Route Tests
 *
 * Tests GitHub CRUD, sync endpoints, activity queries, repo linking,
 * caching behavior, and rate limit handling.
 * Mocks the gh CLI and githubSync service since we can't call GitHub API in tests.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestProject,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

// Mock execFile (gh CLI calls)
const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => {
    return (...args: unknown[]) => {
      // Return a promise that resolves with mock data
      return mockExecFile(...args);
    };
  },
}));

// Mock the githubSync service to avoid gh CLI calls
vi.mock('../../services/githubSync.js', () => ({
  fetchCommits: vi.fn().mockResolvedValue([]),
  fetchPullRequests: vi.fn().mockResolvedValue([]),
  fetchIssues: vi.fn().mockResolvedValue([]),
  syncRepository: vi.fn().mockResolvedValue({
    repo: 'test/repo',
    commitsImported: 5,
    prsImported: 2,
    issuesImported: 1,
    commitsSkipped: 0,
    prsSkipped: 0,
    issuesSkipped: 0,
    errors: [],
    duration: 1000,
  }),
  syncAllLinkedRepos: vi.fn().mockResolvedValue([]),
  getActivitySummary: vi.fn().mockReturnValue({
    totalCommits: 10,
    totalPRs: 3,
    totalIssues: 2,
    totalAdditions: 500,
    totalDeletions: 200,
    estimatedMinutes: 120,
    topAuthors: [{ author: 'testuser', count: 10 }],
    activityByDay: [],
  }),
  getSyncLogs: vi.fn().mockReturnValue([]),
}));

// Mock githubRateLimit module
vi.mock('../../services/githubRateLimit.js', async () => {
  const { GitHubRateLimitError } = await vi.importActual<any>('../../services/githubRateLimit.js');
  return {
    cachedGhExec: vi.fn().mockResolvedValue({
      data: [
        {
          name: 'test-repo',
          description: 'A test repo',
          url: 'https://github.com/testuser/test-repo',
          updatedAt: new Date().toISOString(),
        },
      ],
      cached: false,
    }),
    GitHubRateLimitError,
    buildRateLimitMeta: vi.fn().mockReturnValue({ cached: false }),
    fetchRateLimitInfo: vi.fn().mockResolvedValue({
      limit: 5000,
      remaining: 4950,
      resetAt: Math.floor(Date.now() / 1000) + 3600,
      resetInSeconds: 3600,
      resetInHuman: '1h',
      isLimited: false,
      isLow: false,
      fetchedAt: new Date().toISOString(),
    }),
  };
});

import { createTestApp } from '../../test/app.js';
import githubRouter from '../github.js';
import request from 'supertest';
import { cache } from '../../cache.js';

const app = createTestApp(githubRouter, '/api/github');

// ============================================================================
// Helpers
// ============================================================================

function insertGithubActivity(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    project_id: string;
    type: string;
    repo_name: string;
    sha: string;
    number: number;
    title: string;
    author: string;
    created_at: string;
    additions: number;
    deletions: number;
    estimated_minutes: number;
  }> = {}
): string {
  const id = overrides.id ?? testId('gh-activity');
  db.prepare(`
    INSERT INTO github_activity (id, project_id, type, repo_name, sha, number, title, author, created_at, additions, deletions, estimated_minutes, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    overrides.project_id ?? null,
    overrides.type ?? 'commit',
    overrides.repo_name ?? 'testuser/testrepo',
    overrides.sha ?? `sha-${id}`,
    overrides.number ?? null,
    overrides.title ?? 'Test activity',
    overrides.author ?? 'testuser',
    overrides.created_at ?? new Date().toISOString(),
    overrides.additions ?? 10,
    overrides.deletions ?? 5,
    overrides.estimated_minutes ?? 15,
  );
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('GitHub API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
    vi.clearAllMocks();
    cache.clear();

    // Reset mocks to defaults
    const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
    rateLimitModule.cachedGhExec.mockResolvedValue({
      data: [
        {
          name: 'test-repo',
          description: 'A test repo',
          url: 'https://github.com/testuser/test-repo',
          updatedAt: new Date().toISOString(),
        },
      ],
      cached: false,
    });
    rateLimitModule.buildRateLimitMeta.mockReturnValue({ cached: false });
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/github/rate-limit
  // ==========================================================================

  describe('GET /api/github/rate-limit', () => {
    it('returns rate limit info', async () => {
      const res = await request(app).get('/api/github/rate-limit');
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(5000);
      expect(res.body.remaining).toBe(4950);
      expect(res.body.isLimited).toBe(false);
      expect(res.body.resetInHuman).toBeDefined();
    });

    it('handles fetchRateLimitInfo failure', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      rateLimitModule.fetchRateLimitInfo.mockRejectedValue(new Error('Failed'));

      const res = await request(app).get('/api/github/rate-limit');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to fetch rate limit info');
    });
  });

  // ==========================================================================
  // GET /api/github/repos
  // ==========================================================================

  describe('GET /api/github/repos', () => {
    it('returns repo list from gh CLI', async () => {
      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toBeDefined();
      expect(Array.isArray(res.body.repos)).toBe(true);
    });

    it('includes cache metadata in response', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      rateLimitModule.buildRateLimitMeta.mockReturnValue({ cached: false });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cached');
    });

    it('returns cached: true on second call', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;

      // First call: not cached
      rateLimitModule.buildRateLimitMeta.mockReturnValue({ cached: false });
      rateLimitModule.cachedGhExec.mockResolvedValue({
        data: [{ name: 'test-repo', description: 'A test repo', url: 'https://github.com/testuser/test-repo', updatedAt: new Date().toISOString() }],
        cached: false,
      });
      await request(app).get('/api/github/repos');

      // Second call: cached
      rateLimitModule.buildRateLimitMeta.mockReturnValue({ cached: true });
      rateLimitModule.cachedGhExec.mockResolvedValue({
        data: [{ name: 'test-repo', description: 'A test repo', url: 'https://github.com/testuser/test-repo', updatedAt: new Date().toISOString() }],
        cached: true,
      });

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
    });

    it('handles gh CLI not authenticated', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      rateLimitModule.cachedGhExec.mockRejectedValue(new Error('not logged in'));

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
      expect(res.body.authenticated).toBe(false);
    });

    it('handles gh CLI errors gracefully', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      rateLimitModule.cachedGhExec.mockRejectedValue(new Error('some error'));

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(200);
      expect(res.body.repos).toEqual([]);
      expect(res.body.message).toContain('Failed to fetch repos');
    });

    it('returns 429 when rate limited', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      rateLimitModule.cachedGhExec.mockRejectedValue(
        new GitHubRateLimitError('GitHub API rate limit exceeded. Resets in 45m.', {
          limit: 5000,
          remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 2700,
          resetInSeconds: 2700,
          resetInHuman: '45m',
          isLimited: true,
          isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app).get('/api/github/repos');
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limit_exceeded');
      expect(res.body.rateLimit).toBeDefined();
      expect(res.body.rateLimit.remaining).toBe(0);
      expect(res.body.rateLimit.resetInHuman).toBe('45m');
    });
  });

  // ==========================================================================
  // GET /api/github/commits
  // ==========================================================================

  describe('GET /api/github/commits', () => {
    it('requires repo parameter', async () => {
      const res = await request(app).get('/api/github/commits');
      expect(res.status).toBe(400);
    });

    it('returns commits for a repo', async () => {
      const { fetchCommits } = await import('../../services/githubSync.js');
      (fetchCommits as any).mockResolvedValue([
        { sha: 'abc123', message: 'test commit', author: { login: 'testuser', name: 'Test' }, additions: 10, deletions: 5, url: 'http://test', committedDate: new Date().toISOString() },
      ]);

      const res = await request(app).get('/api/github/commits?repo=testuser/test-repo');
      expect(res.status).toBe(200);
      expect(res.body.commits).toBeDefined();
      expect(res.body.repo).toBe('testuser/test-repo');
    });

    it('includes cache metadata in response', async () => {
      const { fetchCommits } = await import('../../services/githubSync.js');
      (fetchCommits as any).mockResolvedValue([]);

      const res = await request(app).get('/api/github/commits?repo=testuser/test-repo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cached');
    });

    it('returns 429 when rate limited on commits', async () => {
      const { fetchCommits } = await import('../../services/githubSync.js');
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      (fetchCommits as any).mockRejectedValue(
        new GitHubRateLimitError('Rate limit exceeded', {
          limit: 5000, remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 1800,
          resetInSeconds: 1800, resetInHuman: '30m',
          isLimited: true, isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app).get('/api/github/commits?repo=testuser/test-repo');
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limit_exceeded');
    });
  });

  // ==========================================================================
  // GET /api/github/pulls
  // ==========================================================================

  describe('GET /api/github/pulls', () => {
    it('requires repo parameter', async () => {
      const res = await request(app).get('/api/github/pulls');
      expect(res.status).toBe(400);
    });

    it('returns PRs for a repo', async () => {
      const { fetchPullRequests } = await import('../../services/githubSync.js');
      (fetchPullRequests as any).mockResolvedValue([
        { number: 1, title: 'Test PR', author: { login: 'testuser' }, state: 'open', url: 'http://test', additions: 10, deletions: 5, createdAt: new Date().toISOString(), closedAt: null, mergedAt: null },
      ]);

      const res = await request(app).get('/api/github/pulls?repo=testuser/test-repo');
      expect(res.status).toBe(200);
      expect(res.body.pulls).toBeDefined();
      expect(res.body.count).toBe(1);
    });

    it('returns 429 when rate limited on pulls', async () => {
      const { fetchPullRequests } = await import('../../services/githubSync.js');
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      (fetchPullRequests as any).mockRejectedValue(
        new GitHubRateLimitError('Rate limit exceeded', {
          limit: 5000, remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 1800,
          resetInSeconds: 1800, resetInHuman: '30m',
          isLimited: true, isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app).get('/api/github/pulls?repo=testuser/test-repo');
      expect(res.status).toBe(429);
    });
  });

  // ==========================================================================
  // GET /api/github/issues
  // ==========================================================================

  describe('GET /api/github/issues', () => {
    it('requires repo parameter', async () => {
      const res = await request(app).get('/api/github/issues');
      expect(res.status).toBe(400);
    });

    it('returns issues for a repo', async () => {
      const { fetchIssues } = await import('../../services/githubSync.js');
      (fetchIssues as any).mockResolvedValue([
        { number: 1, title: 'Test Issue', author: { login: 'testuser' }, state: 'open', url: 'http://test', createdAt: new Date().toISOString(), closedAt: null },
      ]);

      const res = await request(app).get('/api/github/issues?repo=testuser/test-repo');
      expect(res.status).toBe(200);
      expect(res.body.issues).toBeDefined();
      expect(res.body.count).toBe(1);
    });

    it('returns 429 when rate limited on issues', async () => {
      const { fetchIssues } = await import('../../services/githubSync.js');
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      (fetchIssues as any).mockRejectedValue(
        new GitHubRateLimitError('Rate limit exceeded', {
          limit: 5000, remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 1800,
          resetInSeconds: 1800, resetInHuman: '30m',
          isLimited: true, isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app).get('/api/github/issues?repo=testuser/test-repo');
      expect(res.status).toBe(429);
    });
  });

  // ==========================================================================
  // POST /api/github/sync
  // ==========================================================================

  describe('POST /api/github/sync', () => {
    it('syncs a repository', async () => {
      const res = await request(app)
        .post('/api/github/sync')
        .send({ repo: 'testuser/test-repo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.commitsImported).toBe(5);
    });

    it('requires repo in body', async () => {
      const res = await request(app)
        .post('/api/github/sync')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 429 when sync hits rate limit', async () => {
      const { syncRepository } = await import('../../services/githubSync.js');
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      (syncRepository as any).mockRejectedValue(
        new GitHubRateLimitError('Rate limit exceeded during sync', {
          limit: 5000, remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 1800,
          resetInSeconds: 1800, resetInHuman: '30m',
          isLimited: true, isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app)
        .post('/api/github/sync')
        .send({ repo: 'testuser/test-repo' });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limit_exceeded');
      expect(res.body.rateLimit.resetInHuman).toBe('30m');
    });
  });

  // ==========================================================================
  // POST /api/github/sync-all
  // ==========================================================================

  describe('POST /api/github/sync-all', () => {
    it('syncs all linked repos', async () => {
      const res = await request(app)
        .post('/api/github/sync-all')
        .send({ days: 7 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 429 when sync-all hits rate limit', async () => {
      const { syncAllLinkedRepos } = await import('../../services/githubSync.js');
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      const { GitHubRateLimitError } = rateLimitModule;

      (syncAllLinkedRepos as any).mockRejectedValue(
        new GitHubRateLimitError('Rate limit exceeded during sync-all', {
          limit: 5000, remaining: 0,
          resetAt: Math.floor(Date.now() / 1000) + 3600,
          resetInSeconds: 3600, resetInHuman: '1h',
          isLimited: true, isLow: true,
          fetchedAt: new Date().toISOString(),
        })
      );

      const res = await request(app)
        .post('/api/github/sync-all')
        .send({});

      expect(res.status).toBe(429);
      expect(res.body.rateLimit.resetInHuman).toBe('1h');
    });
  });

  // ==========================================================================
  // GET /api/github/activity
  // ==========================================================================

  describe('GET /api/github/activity', () => {
    it('returns activity for a repo', async () => {
      const res = await request(app).get('/api/github/activity?repo=testuser/test-repo&days=7');
      expect(res.status).toBe(200);
      expect(res.body.totalCommits).toBe(10);
    });

    it('returns all recent activity when no repo specified', async () => {
      insertGithubActivity(testDb, {
        type: 'commit',
        title: 'Recent commit',
        created_at: new Date().toISOString(),
      });

      const res = await request(app).get('/api/github/activity');
      expect(res.status).toBe(200);
      expect(res.body.activities).toBeDefined();
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('includes cache metadata for repo activity', async () => {
      const rateLimitModule = await import('../../services/githubRateLimit.js') as any;
      rateLimitModule.buildRateLimitMeta.mockReturnValue({ cached: false });

      const res = await request(app).get('/api/github/activity?repo=testuser/test-repo&days=7');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cached');
    });
  });

  // ==========================================================================
  // GET /api/github/activity/project/:projectId
  // ==========================================================================

  describe('GET /api/github/activity/project/:projectId', () => {
    it('returns activity for a project', async () => {
      const projectId = insertTestProject(testDb, { name: 'Test Project' });
      insertGithubActivity(testDb, {
        project_id: projectId,
        type: 'commit',
        title: 'Project commit',
      });
      insertGithubActivity(testDb, {
        project_id: projectId,
        type: 'pr',
        title: 'Project PR',
        sha: null as any,
        number: 1,
      });

      const res = await request(app).get(`/api/github/activity/project/${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(2);
      expect(res.body.stats).toBeDefined();
    });

    it('filters by type', async () => {
      const projectId = insertTestProject(testDb, { name: 'Test Project' });
      insertGithubActivity(testDb, { project_id: projectId, type: 'commit', title: 'Commit' });
      insertGithubActivity(testDb, { project_id: projectId, type: 'pr', title: 'PR', sha: null as any, number: 1 });

      const res = await request(app).get(`/api/github/activity/project/${projectId}?type=commit`);
      expect(res.status).toBe(200);
      expect(res.body.activities).toHaveLength(1);
    });
  });

  // ==========================================================================
  // POST /api/github/link
  // ==========================================================================

  describe('POST /api/github/link', () => {
    it('links a repo to a project', async () => {
      const projectId = insertTestProject(testDb, { name: 'Link Test' });

      const res = await request(app)
        .post('/api/github/link')
        .send({ projectId, repo: 'testuser/test-repo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify project was updated
      const project = testDb.prepare("SELECT github_repo FROM projects WHERE id = ?").get(projectId) as any;
      expect(project.github_repo).toBe('testuser/test-repo');
    });

    it('rejects missing projectId', async () => {
      const res = await request(app)
        .post('/api/github/link')
        .send({ repo: 'test/repo' });

      expect(res.status).toBe(400);
    });

    it('rejects missing repo', async () => {
      const projectId = insertTestProject(testDb, { name: 'Test' });
      const res = await request(app)
        .post('/api/github/link')
        .send({ projectId });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .post('/api/github/link')
        .send({ projectId: 'nonexistent', repo: 'test/repo' });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/github/link/:projectId
  // ==========================================================================

  describe('DELETE /api/github/link/:projectId', () => {
    it('unlinks a repo from a project', async () => {
      const projectId = insertTestProject(testDb, { name: 'Unlink Test' });
      testDb.prepare("UPDATE projects SET github_repo = ? WHERE id = ?").run('test/repo', projectId);

      const res = await request(app).delete(`/api/github/link/${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const project = testDb.prepare("SELECT github_repo FROM projects WHERE id = ?").get(projectId) as any;
      expect(project.github_repo).toBeNull();
    });
  });

  // ==========================================================================
  // GET /api/github/sync-logs
  // ==========================================================================

  describe('GET /api/github/sync-logs', () => {
    it('returns sync logs', async () => {
      const res = await request(app).get('/api/github/sync-logs');
      expect(res.status).toBe(200);
      expect(res.body.logs).toBeDefined();
    });
  });
});
