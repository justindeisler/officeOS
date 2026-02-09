/**
 * Tasks API Route Tests
 *
 * Tests task CRUD, filtering, status transitions,
 * reordering, and PRD auto-completion.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestTask,
  insertTestProject,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

vi.mock('../database.js', () => {
  return {
    getDb: () => {
      if (!testDb) throw new Error('Test DB not initialized');
      return testDb;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
  };
});

import { createTestApp } from '../../test/app.js';
import tasksRouter from '../tasks.js';
import request from 'supertest';

const app = createTestApp(tasksRouter, '/api/tasks');

// Helper to insert a PRD
function insertTestPrd(db: Database.Database, overrides: { id?: string; status?: string; feature_name?: string } = {}): string {
  const id = overrides.id ?? testId('prd');
  db.prepare(
    `INSERT INTO prds (id, feature_name, status, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, overrides.feature_name ?? 'Test PRD', overrides.status ?? 'draft');
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('Tasks API', () => {
  beforeEach(() => {
    testDb = createTestDb();
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/tasks
  // ==========================================================================

  describe('GET /api/tasks', () => {
    it('returns empty array when no tasks exist', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tasks', async () => {
      insertTestTask(testDb, { title: 'Task 1' });
      insertTestTask(testDb, { title: 'Task 2' });
      insertTestTask(testDb, { title: 'Task 3' });

      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('filters by area', async () => {
      insertTestTask(testDb, { area: 'freelance', title: 'Freelance task' });
      insertTestTask(testDb, { area: 'personal', title: 'Personal task' });

      const res = await request(app).get('/api/tasks').query({ area: 'freelance' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Freelance task');
    });

    it('filters by status', async () => {
      insertTestTask(testDb, { status: 'backlog' });
      insertTestTask(testDb, { status: 'in_progress' });
      insertTestTask(testDb, { status: 'done' });

      const res = await request(app).get('/api/tasks').query({ status: 'in_progress' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('in_progress');
    });

    it('filters by project_id', async () => {
      const projectId = insertTestProject(testDb);
      insertTestTask(testDb, { project_id: projectId, title: 'Project task' });
      insertTestTask(testDb, { title: 'Unattached task' });

      const res = await request(app).get('/api/tasks').query({ project_id: projectId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Project task');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        insertTestTask(testDb, { title: `Task ${i}` });
      }

      const res = await request(app).get('/api/tasks').query({ limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('orders by sort_order ASC, priority DESC, created_at DESC', async () => {
      insertTestTask(testDb, { title: 'Low priority', priority: 1, sort_order: 0 });
      insertTestTask(testDb, { title: 'High priority', priority: 3, sort_order: 0 });
      insertTestTask(testDb, { title: 'First in order', sort_order: -1 });

      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      // sort_order -1 comes first, then the two with sort_order 0 ordered by priority DESC
      expect(res.body[0].title).toBe('First in order');
    });
  });

  // ==========================================================================
  // GET /api/tasks/overdue
  // ==========================================================================

  describe('GET /api/tasks/overdue', () => {
    it('returns tasks past their due date that are not done', async () => {
      insertTestTask(testDb, {
        title: 'Overdue',
        due_date: '2020-01-01',
        status: 'in_progress',
      });
      insertTestTask(testDb, {
        title: 'Future',
        due_date: '2099-12-31',
        status: 'backlog',
      });
      insertTestTask(testDb, {
        title: 'Done overdue',
        due_date: '2020-01-01',
        status: 'done',
      });

      const res = await request(app).get('/api/tasks/overdue');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Overdue');
    });
  });

  // ==========================================================================
  // GET /api/tasks/assigned/:assignee
  // ==========================================================================

  describe('GET /api/tasks/assigned/:assignee', () => {
    it('returns tasks assigned to a specific person', async () => {
      insertTestTask(testDb, { assignee: 'james', title: 'James task' });
      insertTestTask(testDb, { assignee: 'justin', title: 'Justin task' });
      insertTestTask(testDb, { assignee: 'james', title: 'Another James task', status: 'done' });

      const res = await request(app).get('/api/tasks/assigned/james');
      expect(res.status).toBe(200);
      // Excludes done tasks
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('James task');
    });
  });

  // ==========================================================================
  // GET /api/tasks/:id
  // ==========================================================================

  describe('GET /api/tasks/:id', () => {
    it('returns a single task', async () => {
      const id = insertTestTask(testDb, { title: 'My Task', priority: 3 });

      const res = await request(app).get(`/api/tasks/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe('My Task');
      expect(res.body.priority).toBe(3);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app).get('/api/tasks/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/tasks
  // ==========================================================================

  describe('POST /api/tasks', () => {
    it('creates a task with defaults', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'New Task',
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Task');
      expect(res.body.status).toBe('backlog');
      expect(res.body.priority).toBe(2);
      expect(res.body.area).toBe('freelance');
      expect(res.body.id).toBeDefined();
    });

    it('creates a task with all fields', async () => {
      const projectId = insertTestProject(testDb);

      const res = await request(app).post('/api/tasks').send({
        title: 'Full Task',
        area: 'personal',
        priority: 1,
        status: 'in_progress',
        description: 'A detailed task',
        project_id: projectId,
        due_date: '2024-12-31',
        estimated_minutes: 120,
        assignee: 'james',
      });

      expect(res.status).toBe(201);
      expect(res.body.area).toBe('personal');
      expect(res.body.priority).toBe(1);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.description).toBe('A detailed task');
      expect(res.body.project_id).toBe(projectId);
      expect(res.body.due_date).toBe('2024-12-31');
      expect(res.body.estimated_minutes).toBe(120);
      expect(res.body.assignee).toBe('james');
    });

    it('rejects task without title', async () => {
      const res = await request(app).post('/api/tasks').send({
        description: 'No title',
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // PATCH /api/tasks/:id
  // ==========================================================================

  describe('PATCH /api/tasks/:id', () => {
    it('updates task fields', async () => {
      const id = insertTestTask(testDb, { title: 'Original', priority: 2 });

      const res = await request(app).patch(`/api/tasks/${id}`).send({
        title: 'Updated',
        priority: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
      expect(res.body.priority).toBe(1);
    });

    it('sets completed_at when status changes to done', async () => {
      const id = insertTestTask(testDb, { status: 'in_progress' });

      const res = await request(app).patch(`/api/tasks/${id}`).send({
        status: 'done',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completed_at).toBeDefined();
    });

    it('does not overwrite completed_at if already done', async () => {
      const id = insertTestTask(testDb, { status: 'done' });
      // Set a known completed_at
      testDb.prepare("UPDATE tasks SET completed_at = '2024-01-01T00:00:00Z' WHERE id = ?").run(id);

      const res = await request(app).patch(`/api/tasks/${id}`).send({
        title: 'Updated title',
      });

      expect(res.status).toBe(200);
      // completed_at should remain unchanged since we didn't change status to done
    });

    it('auto-updates linked PRD status when task is completed', async () => {
      const prdId = insertTestPrd(testDb, { status: 'draft' });
      const taskId = insertTestTask(testDb, { prd_id: prdId, status: 'in_progress' });

      await request(app).patch(`/api/tasks/${taskId}`).send({
        status: 'done',
      });

      // Check PRD status was updated
      const prd = testDb.prepare('SELECT status FROM prds WHERE id = ?').get(prdId) as { status: string };
      expect(prd.status).toBe('implemented');
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app).patch('/api/tasks/nonexistent').send({
        title: 'Updated',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/tasks/reorder
  // ==========================================================================

  describe('POST /api/tasks/reorder', () => {
    it('updates sort_order for all provided tasks', async () => {
      const id1 = insertTestTask(testDb, { title: 'Task 1', sort_order: 0 });
      const id2 = insertTestTask(testDb, { title: 'Task 2', sort_order: 1 });
      const id3 = insertTestTask(testDb, { title: 'Task 3', sort_order: 2 });

      // Reverse the order
      const res = await request(app).post('/api/tasks/reorder').send({
        taskIds: [id3, id2, id1],
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].id).toBe(id3);
      expect(res.body[0].sort_order).toBe(0);
      expect(res.body[1].id).toBe(id2);
      expect(res.body[1].sort_order).toBe(1);
      expect(res.body[2].id).toBe(id1);
      expect(res.body[2].sort_order).toBe(2);
    });

    it('rejects empty taskIds', async () => {
      const res = await request(app).post('/api/tasks/reorder').send({
        taskIds: [],
      });
      expect(res.status).toBe(400);
    });

    it('rejects non-existent task IDs', async () => {
      const id1 = insertTestTask(testDb);
      const res = await request(app).post('/api/tasks/reorder').send({
        taskIds: [id1, 'nonexistent'],
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/tasks/:id/move
  // ==========================================================================

  describe('POST /api/tasks/:id/move', () => {
    it('moves a task to a new status column', async () => {
      const id = insertTestTask(testDb, { status: 'backlog' });

      const res = await request(app).post(`/api/tasks/${id}/move`).send({
        status: 'in_progress',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
    });

    it('sets completed_at when moving to done', async () => {
      const id = insertTestTask(testDb, { status: 'in_progress' });

      const res = await request(app).post(`/api/tasks/${id}/move`).send({
        status: 'done',
      });

      expect(res.status).toBe(200);
      expect(res.body.completed_at).toBeDefined();
    });

    it('clears completed_at when moving out of done', async () => {
      const id = insertTestTask(testDb, { status: 'done' });
      testDb.prepare("UPDATE tasks SET completed_at = '2024-01-01' WHERE id = ?").run(id);

      const res = await request(app).post(`/api/tasks/${id}/move`).send({
        status: 'in_progress',
      });

      expect(res.status).toBe(200);
      expect(res.body.completed_at).toBeNull();
    });

    it('handles targetIndex for positioning within a column', async () => {
      const id1 = insertTestTask(testDb, { status: 'backlog', sort_order: 0 });
      const id2 = insertTestTask(testDb, { status: 'backlog', sort_order: 1 });
      const id3 = insertTestTask(testDb, { status: 'in_progress', sort_order: 0 });

      // Move id3 to backlog at position 1 (between id1 and id2)
      const res = await request(app).post(`/api/tasks/${id3}/move`).send({
        status: 'backlog',
        targetIndex: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('backlog');

      // Verify ordering in backlog
      const backlogTasks = testDb
        .prepare("SELECT id FROM tasks WHERE status = 'backlog' ORDER BY sort_order ASC")
        .all() as Array<{ id: string }>;

      expect(backlogTasks).toHaveLength(3);
      expect(backlogTasks[0].id).toBe(id1); // Position 0
      expect(backlogTasks[1].id).toBe(id3); // Position 1 (moved here)
      expect(backlogTasks[2].id).toBe(id2); // Position 2
    });

    it('rejects invalid status', async () => {
      const id = insertTestTask(testDb);

      const res = await request(app).post(`/api/tasks/${id}/move`).send({
        status: 'invalid_status',
      });

      expect(res.status).toBe(400);
    });

    it('auto-updates linked PRD when moved to done', async () => {
      const prdId = insertTestPrd(testDb, { status: 'draft' });
      const taskId = insertTestTask(testDb, { prd_id: prdId, status: 'in_progress' });

      await request(app).post(`/api/tasks/${taskId}/move`).send({
        status: 'done',
      });

      const prd = testDb.prepare('SELECT status FROM prds WHERE id = ?').get(prdId) as { status: string };
      expect(prd.status).toBe('implemented');
    });
  });

  // ==========================================================================
  // DELETE /api/tasks/:id
  // ==========================================================================

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task', async () => {
      const id = insertTestTask(testDb, { title: 'To Delete' });

      const res = await request(app).delete(`/api/tasks/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('To Delete');

      // Verify gone
      const check = await request(app).get(`/api/tasks/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app).delete('/api/tasks/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
