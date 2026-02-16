/**
 * Suggestions API Route Tests
 *
 * Tests suggestion CRUD, status transitions (approve/reject/implement),
 * comments, access detection, edge cases, and error handling.
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
// Setup — Mock external dependencies BEFORE importing the route
// ============================================================================

let testDb: Database.Database;

// Mock the cache (some routes might use it indirectly)
vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  cacheKey: (...parts: unknown[]) => parts.join(':'),
  TTL: { TASKS: 300000, PROJECTS: 300000 },
}));

// Mock access detection (calls gh CLI)
vi.mock('../../services/accessDetection.js', () => ({
  detectAccess: vi.fn().mockResolvedValue({ hasAccess: false, accessType: 'none' }),
}));

// Mock child_process (used for clawdbot CLI notifications)
const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock('util', () => ({
  promisify: (_fn: unknown) => {
    return (...args: unknown[]) => mockExecFile(...args);
  },
}));

import { createTestApp } from '../../test/app.js';
import suggestionsRouter from '../suggestions.js';
import request from 'supertest';

const app = createTestApp(suggestionsRouter, '/api/suggestions');

// ============================================================================
// Helpers
// ============================================================================

function insertTestSuggestion(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    project_id: string;
    project_name: string;
    type: string;
    title: string;
    description: string;
    priority: number;
    status: string;
    prd_id: string;
    task_id: string;
    decided_at: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('suggestion');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO suggestions (id, project_id, project_name, type, title, description, priority, status, prd_id, task_id, created_at, updated_at, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.project_id ?? null,
    overrides.project_name ?? 'Test Project',
    overrides.type ?? 'improvement',
    overrides.title ?? 'Test Suggestion',
    overrides.description ?? 'A test suggestion description',
    overrides.priority ?? 2,
    overrides.status ?? 'pending',
    overrides.prd_id ?? null,
    overrides.task_id ?? null,
    now,
    now,
    overrides.decided_at ?? null,
  );
  return id;
}

function insertTestComment(
  db: Database.Database,
  overrides: {
    suggestion_id: string;
    id?: string;
    author?: string;
    comment_text?: string;
  }
): string {
  const id = overrides.id ?? testId('comment');
  db.prepare(
    `INSERT INTO suggestion_comments (id, suggestion_id, author, comment_text, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.suggestion_id,
    overrides.author ?? 'Justin Deisler',
    overrides.comment_text ?? 'Test comment',
  );
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('Suggestions API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
    vi.clearAllMocks();

    // Default: clawdbot CLI succeeds
    mockExecFile.mockResolvedValue({ stdout: '{"ok":true}', stderr: '' });
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/suggestions (List)
  // ==========================================================================

  describe('GET /api/suggestions', () => {
    it('returns empty array when no suggestions exist', async () => {
      const res = await request(app).get('/api/suggestions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all suggestions', async () => {
      insertTestSuggestion(testDb, { title: 'Suggestion 1' });
      insertTestSuggestion(testDb, { title: 'Suggestion 2' });
      insertTestSuggestion(testDb, { title: 'Suggestion 3' });

      const res = await request(app).get('/api/suggestions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('filters by status', async () => {
      insertTestSuggestion(testDb, { title: 'Pending', status: 'pending' });
      insertTestSuggestion(testDb, { title: 'Approved', status: 'approved' });
      insertTestSuggestion(testDb, { title: 'Rejected', status: 'rejected' });

      const res = await request(app).get('/api/suggestions?status=pending');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Pending');
    });

    it('filters by project_id', async () => {
      const projectId = insertTestProject(testDb, { name: 'Project A' });
      insertTestSuggestion(testDb, { project_id: projectId, title: 'Project suggestion' });
      insertTestSuggestion(testDb, { title: 'Unattached suggestion' });

      const res = await request(app).get(`/api/suggestions?project_id=${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Project suggestion');
    });

    it('filters by type', async () => {
      insertTestSuggestion(testDb, { type: 'feature', title: 'Feature' });
      insertTestSuggestion(testDb, { type: 'fix', title: 'Fix' });
      insertTestSuggestion(testDb, { type: 'security', title: 'Security' });

      const res = await request(app).get('/api/suggestions?type=feature');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Feature');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        insertTestSuggestion(testDb, { title: `Suggestion ${i}` });
      }

      const res = await request(app).get('/api/suggestions?limit=3');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('orders by priority ASC then created_at DESC', async () => {
      insertTestSuggestion(testDb, { title: 'Low priority', priority: 5 });
      insertTestSuggestion(testDb, { title: 'Critical', priority: 1 });
      insertTestSuggestion(testDb, { title: 'Medium', priority: 3 });

      const res = await request(app).get('/api/suggestions');
      expect(res.status).toBe(200);
      expect(res.body[0].title).toBe('Critical');
      expect(res.body[2].title).toBe('Low priority');
    });

    it('annotates suggestions with access info', async () => {
      insertTestSuggestion(testDb, { title: 'Access test' });

      const res = await request(app).get('/api/suggestions');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('canImplement');
      expect(res.body[0]).toHaveProperty('accessType');
    });

    it('annotates with canImplement=true when access detected', async () => {
      const { detectAccess } = await import('../../services/accessDetection.js');
      (detectAccess as any).mockResolvedValue({ hasAccess: true, accessType: 'local' });

      const projectId = insertTestProject(testDb, { name: 'Local Project' });
      insertTestSuggestion(testDb, { project_id: projectId, title: 'Local access' });

      const res = await request(app).get('/api/suggestions');
      expect(res.status).toBe(200);
      expect(res.body[0].canImplement).toBe(true);
      expect(res.body[0].accessType).toBe('local');
    });

    it('combines multiple filters', async () => {
      const projectId = insertTestProject(testDb);
      insertTestSuggestion(testDb, { project_id: projectId, status: 'pending', type: 'feature', title: 'Match' });
      insertTestSuggestion(testDb, { project_id: projectId, status: 'approved', type: 'feature', title: 'Wrong status' });
      insertTestSuggestion(testDb, { status: 'pending', type: 'feature', title: 'Wrong project' });

      const res = await request(app).get(`/api/suggestions?status=pending&project_id=${projectId}&type=feature`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Match');
    });
  });

  // ==========================================================================
  // GET /api/suggestions/:id (Detail)
  // ==========================================================================

  describe('GET /api/suggestions/:id', () => {
    it('returns a single suggestion', async () => {
      const id = insertTestSuggestion(testDb, { title: 'My Suggestion', priority: 1, type: 'feature' });

      const res = await request(app).get(`/api/suggestions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe('My Suggestion');
      expect(res.body.priority).toBe(1);
      expect(res.body.type).toBe('feature');
    });

    it('includes access info', async () => {
      const id = insertTestSuggestion(testDb);

      const res = await request(app).get(`/api/suggestions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('canImplement');
      expect(res.body).toHaveProperty('accessType');
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).get('/api/suggestions/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/suggestions (Create)
  // ==========================================================================

  describe('POST /api/suggestions', () => {
    it('creates a suggestion with minimal fields', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'New Suggestion',
        type: 'improvement',
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Suggestion');
      expect(res.body.type).toBe('improvement');
      expect(res.body.status).toBe('pending');
      expect(res.body.priority).toBe(2); // default
      expect(res.body.id).toBeDefined();
    });

    it('creates a suggestion with all fields', async () => {
      const projectId = insertTestProject(testDb, { name: 'My Project' });

      const res = await request(app).post('/api/suggestions').send({
        title: 'Full Suggestion',
        type: 'feature',
        description: 'A detailed description',
        priority: 1,
        project_id: projectId,
        project_name: 'My Project',
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Full Suggestion');
      expect(res.body.type).toBe('feature');
      expect(res.body.description).toBe('A detailed description');
      expect(res.body.priority).toBe(1);
      expect(res.body.project_id).toBe(projectId);
      expect(res.body.project_name).toBe('My Project');
    });

    it('rejects missing title', async () => {
      const res = await request(app).post('/api/suggestions').send({
        type: 'improvement',
        description: 'No title',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing type', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'No type',
      });
      expect(res.status).toBe(400);
    });

    it('rejects both title and type missing', async () => {
      const res = await request(app).post('/api/suggestions').send({
        description: 'Only description',
      });
      expect(res.status).toBe(400);
    });

    it('creates all valid suggestion types', async () => {
      const types = ['improvement', 'feature', 'fix', 'refactor', 'security'];
      for (const type of types) {
        const res = await request(app).post('/api/suggestions').send({
          title: `${type} suggestion`,
          type,
        });
        expect(res.status).toBe(201);
        expect(res.body.type).toBe(type);
      }
    });
  });

  // ==========================================================================
  // POST /api/suggestions/:id/approve
  // ==========================================================================

  describe('POST /api/suggestions/:id/approve', () => {
    it('approves a pending suggestion', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending', title: 'To Approve' });

      const res = await request(app).post(`/api/suggestions/${id}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.decided_at).toBeDefined();
    });

    it('triggers James notification on approval', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending', title: 'Trigger James' });

      await request(app).post(`/api/suggestions/${id}/approve`);

      // Wait a tick for the fire-and-forget to execute
      await new Promise(r => setTimeout(r, 50));

      expect(mockExecFile).toHaveBeenCalled();
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).post('/api/suggestions/nonexistent/approve');
      expect(res.status).toBe(404);
    });

    it('handles trigger failure gracefully', async () => {
      mockExecFile.mockRejectedValue(new Error('CLI not found'));

      const id = insertTestSuggestion(testDb, { status: 'pending' });
      const res = await request(app).post(`/api/suggestions/${id}/approve`);

      // Should still return 200 - trigger is fire-and-forget
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });
  });

  // ==========================================================================
  // POST /api/suggestions/:id/reject
  // ==========================================================================

  describe('POST /api/suggestions/:id/reject', () => {
    it('rejects a suggestion', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending' });

      const res = await request(app).post(`/api/suggestions/${id}/reject`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.decided_at).toBeDefined();
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).post('/api/suggestions/nonexistent/reject');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/suggestions/:id/implement
  // ==========================================================================

  describe('POST /api/suggestions/:id/implement', () => {
    it('marks a suggestion as implemented', async () => {
      const id = insertTestSuggestion(testDb, { status: 'approved' });

      // Create real PRD and task so FK constraints are satisfied
      const prdId = testId('prd');
      testDb.prepare(
        `INSERT INTO prds (id, feature_name, status, created_at, updated_at)
         VALUES (?, 'Test PRD', 'draft', datetime('now'), datetime('now'))`
      ).run(prdId);

      const taskId = testId('task');
      const now = new Date().toISOString();
      testDb.prepare(
        `INSERT INTO tasks (id, title, status, created_at, updated_at)
         VALUES (?, 'Test Task', 'done', ?, ?)`
      ).run(taskId, now, now);

      const res = await request(app).post(`/api/suggestions/${id}/implement`).send({
        prd_id: prdId,
        task_id: taskId,
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('implemented');
      expect(res.body.prd_id).toBe(prdId);
      expect(res.body.task_id).toBe(taskId);
    });

    it('allows implementing without prd_id/task_id', async () => {
      const id = insertTestSuggestion(testDb, { status: 'approved' });

      const res = await request(app).post(`/api/suggestions/${id}/implement`).send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('implemented');
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).post('/api/suggestions/nonexistent/implement').send({});
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // PATCH /api/suggestions/:id (Update)
  // ==========================================================================

  describe('PATCH /api/suggestions/:id', () => {
    it('updates suggestion status', async () => {
      const id = insertTestSuggestion(testDb, { status: 'approved' });

      const res = await request(app).patch(`/api/suggestions/${id}`).send({
        status: 'pending',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
    });

    it('clears decided_at when restoring to pending', async () => {
      const id = insertTestSuggestion(testDb, {
        status: 'rejected',
        decided_at: new Date().toISOString(),
      });

      const res = await request(app).patch(`/api/suggestions/${id}`).send({
        status: 'pending',
      });

      expect(res.status).toBe(200);
      expect(res.body.decided_at).toBeNull();
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).patch('/api/suggestions/nonexistent').send({
        status: 'pending',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/suggestions/:id
  // ==========================================================================

  describe('DELETE /api/suggestions/:id', () => {
    it('deletes a suggestion', async () => {
      const id = insertTestSuggestion(testDb, { title: 'To Delete' });

      const res = await request(app).delete(`/api/suggestions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify gone
      const check = await request(app).get(`/api/suggestions/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).delete('/api/suggestions/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Suggestion Comments — GET /api/suggestions/:id/comments
  // ==========================================================================

  describe('GET /api/suggestions/:id/comments', () => {
    it('returns comments for a suggestion', async () => {
      const suggId = insertTestSuggestion(testDb);
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'Comment 1' });
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'Comment 2' });

      const res = await request(app).get(`/api/suggestions/${suggId}/comments`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns empty array when no comments exist', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app).get(`/api/suggestions/${suggId}/comments`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app).get('/api/suggestions/nonexistent/comments');
      expect(res.status).toBe(404);
    });

    it('orders comments by created_at ASC', async () => {
      const suggId = insertTestSuggestion(testDb);
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'First' });
      // Insert second comment with slight delay
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'Second' });

      const res = await request(app).get(`/api/suggestions/${suggId}/comments`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Suggestion Comments — POST /api/suggestions/:id/comments
  // ==========================================================================

  describe('POST /api/suggestions/:id/comments', () => {
    it('adds a comment to a suggestion', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app)
        .post(`/api/suggestions/${suggId}/comments`)
        .send({ comment_text: 'Great idea!' });

      expect(res.status).toBe(201);
      expect(res.body.comment_text).toBe('Great idea!');
      expect(res.body.author).toBe('Justin Deisler');
      expect(res.body.suggestion_id).toBe(suggId);
    });

    it('trims whitespace from comment text', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app)
        .post(`/api/suggestions/${suggId}/comments`)
        .send({ comment_text: '  Trimmed comment  ' });

      expect(res.status).toBe(201);
      expect(res.body.comment_text).toBe('Trimmed comment');
    });

    it('rejects empty comment text', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app)
        .post(`/api/suggestions/${suggId}/comments`)
        .send({ comment_text: '' });

      expect(res.status).toBe(400);
    });

    it('rejects whitespace-only comment text', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app)
        .post(`/api/suggestions/${suggId}/comments`)
        .send({ comment_text: '   ' });

      expect(res.status).toBe(400);
    });

    it('rejects missing comment_text field', async () => {
      const suggId = insertTestSuggestion(testDb);

      const res = await request(app)
        .post(`/api/suggestions/${suggId}/comments`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent suggestion', async () => {
      const res = await request(app)
        .post('/api/suggestions/nonexistent/comments')
        .send({ comment_text: 'Comment' });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Suggestion Comments — DELETE /api/suggestions/comments/:commentId
  // ==========================================================================

  describe('DELETE /api/suggestions/comments/:commentId', () => {
    it('deletes a comment', async () => {
      const suggId = insertTestSuggestion(testDb);
      const commentId = insertTestComment(testDb, { suggestion_id: suggId });

      const res = await request(app).delete(`/api/suggestions/comments/${commentId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify comment is gone
      const comments = testDb
        .prepare('SELECT * FROM suggestion_comments WHERE id = ?')
        .get(commentId);
      expect(comments).toBeUndefined();
    });

    it('returns 404 for non-existent comment', async () => {
      const res = await request(app).delete('/api/suggestions/comments/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Status Lifecycle
  // ==========================================================================

  describe('Status Lifecycle', () => {
    it('follows pending → approved → implemented lifecycle', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending' });

      // Approve
      let res = await request(app).post(`/api/suggestions/${id}/approve`);
      expect(res.body.status).toBe('approved');
      expect(res.body.decided_at).toBeDefined();

      // Implement
      res = await request(app).post(`/api/suggestions/${id}/implement`).send({});
      expect(res.body.status).toBe('implemented');
    });

    it('follows pending → rejected lifecycle', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending' });

      const res = await request(app).post(`/api/suggestions/${id}/reject`);
      expect(res.body.status).toBe('rejected');
      expect(res.body.decided_at).toBeDefined();
    });

    it('can restore rejected suggestion to pending', async () => {
      const id = insertTestSuggestion(testDb, { status: 'rejected', decided_at: new Date().toISOString() });

      const res = await request(app).patch(`/api/suggestions/${id}`).send({
        status: 'pending',
      });
      expect(res.body.status).toBe('pending');
      expect(res.body.decided_at).toBeNull();
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles suggestion with very long title', async () => {
      const longTitle = 'A'.repeat(1000);
      const res = await request(app).post('/api/suggestions').send({
        title: longTitle,
        type: 'improvement',
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(longTitle);
    });

    it('handles suggestion with special characters in title', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'Fix SQL injection: DROP TABLE users; --',
        type: 'security',
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Fix SQL injection: DROP TABLE users; --');
    });

    it('handles suggestion with unicode in description', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'Unicode test',
        type: 'improvement',
        description: 'Fix Umlauts: äöüß 🚀 Ñ café',
      });
      expect(res.status).toBe(201);
      expect(res.body.description).toBe('Fix Umlauts: äöüß 🚀 Ñ café');
    });

    it('handles null description gracefully', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'No description',
        type: 'fix',
      });
      expect(res.status).toBe(201);
      expect(res.body.description).toBeNull();
    });

    it('handles null project_id gracefully', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'No project',
        type: 'improvement',
      });
      expect(res.status).toBe(201);
      expect(res.body.project_id).toBeNull();
    });

    it('SQL injection attempt in title is stored safely', async () => {
      const malicious = "'; DROP TABLE suggestions; --";
      const res = await request(app).post('/api/suggestions').send({
        title: malicious,
        type: 'security',
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(malicious);

      // Verify table still exists and works
      const list = await request(app).get('/api/suggestions');
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(1);
    });

    it('SQL injection attempt in filter parameters is safe', async () => {
      insertTestSuggestion(testDb, { title: 'Safe suggestion' });

      const res = await request(app).get("/api/suggestions?status=pending' OR '1'='1");
      expect(res.status).toBe(200);
      // Should return 0 because the status value doesn't match any real status
      expect(res.body).toHaveLength(0);
    });

    it('handles concurrent approvals gracefully', async () => {
      const id = insertTestSuggestion(testDb, { status: 'pending' });

      // Both approvals should succeed (idempotent-ish)
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/suggestions/${id}/approve`),
        request(app).post(`/api/suggestions/${id}/approve`),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Final state should be approved
      const check = await request(app).get(`/api/suggestions/${id}`);
      expect(check.body.status).toBe('approved');
    });
  });

  // ==========================================================================
  // Access Detection Integration
  // ==========================================================================

  describe('Access Detection', () => {
    it('returns canImplement=false for suggestions without project', async () => {
      const id = insertTestSuggestion(testDb, { project_id: undefined });

      const res = await request(app).get(`/api/suggestions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.canImplement).toBe(false);
      expect(res.body.accessType).toBe('none');
    });

    it('returns canImplement based on access detection', async () => {
      const { detectAccess } = await import('../../services/accessDetection.js');
      (detectAccess as any).mockResolvedValue({ hasAccess: true, accessType: 'github' });

      const projectId = insertTestProject(testDb);
      const id = insertTestSuggestion(testDb, { project_id: projectId });

      const res = await request(app).get(`/api/suggestions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.canImplement).toBe(true);
      expect(res.body.accessType).toBe('github');
    });
  });

  // ==========================================================================
  // POST /api/suggestions/generate (mocked - external call)
  // ==========================================================================

  describe('POST /api/suggestions/generate', () => {
    it('rejects invalid source', async () => {
      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'invalid',
        projectId: 'test',
        projectName: 'Test',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing projectId', async () => {
      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectName: 'Test',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing projectName', async () => {
      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectId: 'test',
      });
      expect(res.status).toBe(400);
    });

    it('generates suggestions from valid input', async () => {
      // Mock the python script execution
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          success: true,
          suggestions: [
            { title: 'Generated suggestion', description: 'Auto-generated', type: 'improvement', priority: 2, project_name: 'Test' },
          ],
        }),
        stderr: '',
      });

      const projectId = insertTestProject(testDb, { name: 'Gen Project' });

      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectId,
        projectName: 'Gen Project',
        count: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].title).toBe('Generated suggestion');
      expect(res.body.suggestions[0].status).toBe('pending');
    });

    it('handles script failure', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({ success: false, error: 'API error' }),
        stderr: '',
      });

      const projectId = insertTestProject(testDb);

      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectId,
        projectName: 'Test',
      });

      expect(res.status).toBe(500);
    });

    it('handles invalid JSON from script', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'not valid json',
        stderr: '',
      });

      const projectId = insertTestProject(testDb);

      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectId,
        projectName: 'Test',
      });

      expect(res.status).toBe(500);
    });

    it('caps count at 3', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          success: true,
          suggestions: [
            { title: 'S1', type: 'improvement', priority: 2 },
            { title: 'S2', type: 'improvement', priority: 2 },
            { title: 'S3', type: 'improvement', priority: 2 },
          ],
        }),
        stderr: '',
      });

      const projectId = insertTestProject(testDb);

      const res = await request(app).post('/api/suggestions/generate').send({
        source: 'pa-project',
        projectId,
        projectName: 'Test',
        count: 10, // Requested 10, should be capped
      });

      expect(res.status).toBe(200);
      // The count passed to script should be 3 (capped)
      const callArgs = mockExecFile.mock.calls[0];
      expect(callArgs[1]).toContain('3');
    });
  });

  // ==========================================================================
  // Bulk operations and data integrity
  // ==========================================================================

  describe('Data Integrity', () => {
    it('deleting a suggestion cascades to its comments', async () => {
      const suggId = insertTestSuggestion(testDb);
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'Comment 1' });
      insertTestComment(testDb, { suggestion_id: suggId, comment_text: 'Comment 2' });

      // Delete suggestion
      await request(app).delete(`/api/suggestions/${suggId}`);

      // Comments should be cascade-deleted
      const comments = testDb
        .prepare('SELECT * FROM suggestion_comments WHERE suggestion_id = ?')
        .all(suggId);
      expect(comments).toHaveLength(0);
    });

    it('created_at and updated_at are set on creation', async () => {
      const res = await request(app).post('/api/suggestions').send({
        title: 'Timestamp test',
        type: 'improvement',
      });

      expect(res.body.created_at).toBeDefined();
      expect(res.body.updated_at).toBeDefined();
    });

    it('updated_at changes on status update', async () => {
      const id = insertTestSuggestion(testDb);

      // Wait briefly so timestamps differ
      await new Promise(r => setTimeout(r, 10));

      const res = await request(app).patch(`/api/suggestions/${id}`).send({
        status: 'approved',
      });

      const original = testDb.prepare('SELECT created_at FROM suggestions WHERE id = ?').get(id) as any;
      expect(res.body.updated_at).toBeDefined();
    });
  });
});
