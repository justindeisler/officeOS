/**
 * Subtasks API Route Tests
 *
 * Tests subtask CRUD, auto-completion of parent tasks,
 * reordering, and bulk count operations.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestTask,
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
import subtasksRouter from '../subtasks.js';
import request from 'supertest';

// Subtasks router uses /tasks/:taskId/subtasks and /subtasks/:id patterns
const app = createTestApp(subtasksRouter, '/api');

// Helper
function insertTestSubtask(
  db: Database.Database,
  taskId: string,
  overrides: {
    id?: string;
    title?: string;
    completed?: number;
    sort_order?: number;
  } = {}
): string {
  const id = overrides.id ?? testId('subtask');
  db.prepare(
    `INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    taskId,
    overrides.title ?? 'Test Subtask',
    overrides.completed ?? 0,
    overrides.sort_order ?? 0
  );
  return id;
}

function insertTestPrd(db: Database.Database, overrides: { id?: string; status?: string } = {}): string {
  const id = overrides.id ?? testId('prd');
  db.prepare(
    `INSERT INTO prds (id, feature_name, status, created_at, updated_at)
     VALUES (?, 'Test PRD', ?, datetime('now'), datetime('now'))`
  ).run(id, overrides.status ?? 'draft');
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('Subtasks API', () => {
  beforeEach(() => {
    testDb = createTestDb();
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/tasks/:taskId/subtasks
  // ==========================================================================

  describe('GET /api/tasks/:taskId/subtasks', () => {
    it('returns empty array for task with no subtasks', async () => {
      const taskId = insertTestTask(testDb);

      const res = await request(app).get(`/api/tasks/${taskId}/subtasks`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns subtasks ordered by sort_order', async () => {
      const taskId = insertTestTask(testDb);
      insertTestSubtask(testDb, taskId, { title: 'Third', sort_order: 2 });
      insertTestSubtask(testDb, taskId, { title: 'First', sort_order: 0 });
      insertTestSubtask(testDb, taskId, { title: 'Second', sort_order: 1 });

      const res = await request(app).get(`/api/tasks/${taskId}/subtasks`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].title).toBe('First');
      expect(res.body[1].title).toBe('Second');
      expect(res.body[2].title).toBe('Third');
    });
  });

  // ==========================================================================
  // POST /api/tasks/:taskId/subtasks
  // ==========================================================================

  describe('POST /api/tasks/:taskId/subtasks', () => {
    it('creates a subtask with auto-incremented sort_order', async () => {
      const taskId = insertTestTask(testDb);

      const res1 = await request(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .send({ title: 'First subtask' });

      expect(res1.status).toBe(201);
      expect(res1.body.title).toBe('First subtask');
      expect(res1.body.completed).toBe(0);
      expect(res1.body.sort_order).toBe(0);

      const res2 = await request(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .send({ title: 'Second subtask' });

      expect(res2.status).toBe(201);
      expect(res2.body.sort_order).toBe(1);
    });

    it('rejects subtask without title', async () => {
      const taskId = insertTestTask(testDb);

      const res = await request(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent parent task', async () => {
      const res = await request(app)
        .post('/api/tasks/nonexistent/subtasks')
        .send({ title: 'Orphan subtask' });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // PATCH /api/subtasks/:id
  // ==========================================================================

  describe('PATCH /api/subtasks/:id', () => {
    it('updates subtask title', async () => {
      const taskId = insertTestTask(testDb);
      const subtaskId = insertTestSubtask(testDb, taskId, { title: 'Original' });

      const res = await request(app)
        .patch(`/api/subtasks/${subtaskId}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('marks subtask as completed', async () => {
      const taskId = insertTestTask(testDb);
      const subtaskId = insertTestSubtask(testDb, taskId, { completed: 0 });

      const res = await request(app)
        .patch(`/api/subtasks/${subtaskId}`)
        .send({ completed: 1 });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(1);
    });

    it('auto-completes parent task when all subtasks are done', async () => {
      const taskId = insertTestTask(testDb, { status: 'in_progress' });
      const sub1 = insertTestSubtask(testDb, taskId, { completed: 1 });
      const sub2 = insertTestSubtask(testDb, taskId, { completed: 0 });

      // Complete the last subtask
      await request(app)
        .patch(`/api/subtasks/${sub2}`)
        .send({ completed: 1 });

      // Parent task should now be 'done'
      const task = testDb.prepare('SELECT status, completed_at FROM tasks WHERE id = ?').get(taskId) as {
        status: string;
        completed_at: string | null;
      };
      expect(task.status).toBe('done');
      expect(task.completed_at).toBeDefined();
    });

    it('does not auto-complete parent if some subtasks are still pending', async () => {
      const taskId = insertTestTask(testDb, { status: 'in_progress' });
      const sub1 = insertTestSubtask(testDb, taskId, { completed: 0 });
      insertTestSubtask(testDb, taskId, { completed: 0 });

      // Complete only one subtask
      await request(app)
        .patch(`/api/subtasks/${sub1}`)
        .send({ completed: 1 });

      // Parent task should still be in_progress
      const task = testDb.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string };
      expect(task.status).toBe('in_progress');
    });

    it('auto-completes parent task AND updates linked PRD', async () => {
      const prdId = insertTestPrd(testDb, { status: 'draft' });
      const taskId = insertTestTask(testDb, { status: 'in_progress', prd_id: prdId });
      const sub1 = insertTestSubtask(testDb, taskId, { completed: 1 });
      const sub2 = insertTestSubtask(testDb, taskId, { completed: 0 });

      // Complete the last subtask
      await request(app)
        .patch(`/api/subtasks/${sub2}`)
        .send({ completed: 1 });

      // PRD should be marked as implemented
      const prd = testDb.prepare('SELECT status FROM prds WHERE id = ?').get(prdId) as { status: string };
      expect(prd.status).toBe('implemented');
    });

    it('returns 404 for non-existent subtask', async () => {
      const res = await request(app)
        .patch('/api/subtasks/nonexistent')
        .send({ completed: 1 });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/subtasks/:id
  // ==========================================================================

  describe('DELETE /api/subtasks/:id', () => {
    it('deletes a subtask', async () => {
      const taskId = insertTestTask(testDb);
      const subtaskId = insertTestSubtask(testDb, taskId);

      const res = await request(app).delete(`/api/subtasks/${subtaskId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const check = testDb.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId);
      expect(check).toBeUndefined();
    });

    it('returns 404 for non-existent subtask', async () => {
      const res = await request(app).delete('/api/subtasks/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/tasks/:taskId/subtasks/reorder
  // ==========================================================================

  describe('POST /api/tasks/:taskId/subtasks/reorder', () => {
    it('reorders subtasks', async () => {
      const taskId = insertTestTask(testDb);
      const sub1 = insertTestSubtask(testDb, taskId, { title: 'A', sort_order: 0 });
      const sub2 = insertTestSubtask(testDb, taskId, { title: 'B', sort_order: 1 });
      const sub3 = insertTestSubtask(testDb, taskId, { title: 'C', sort_order: 2 });

      const res = await request(app)
        .post(`/api/tasks/${taskId}/subtasks/reorder`)
        .send({ subtaskIds: [sub3, sub1, sub2] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].title).toBe('C');
      expect(res.body[0].sort_order).toBe(0);
      expect(res.body[1].title).toBe('A');
      expect(res.body[1].sort_order).toBe(1);
      expect(res.body[2].title).toBe('B');
      expect(res.body[2].sort_order).toBe(2);
    });

    it('returns 404 for non-existent parent task', async () => {
      const res = await request(app)
        .post('/api/tasks/nonexistent/subtasks/reorder')
        .send({ subtaskIds: ['a', 'b'] });
      expect(res.status).toBe(404);
    });

    it('rejects non-array subtaskIds', async () => {
      const taskId = insertTestTask(testDb);

      const res = await request(app)
        .post(`/api/tasks/${taskId}/subtasks/reorder`)
        .send({ subtaskIds: 'not-an-array' });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/subtasks/counts
  // ==========================================================================

  describe('POST /api/subtasks/counts', () => {
    it('returns subtask counts for multiple tasks', async () => {
      const task1 = insertTestTask(testDb);
      const task2 = insertTestTask(testDb);
      const task3 = insertTestTask(testDb); // No subtasks

      // Task 1: 3 subtasks, 2 completed
      insertTestSubtask(testDb, task1, { completed: 1 });
      insertTestSubtask(testDb, task1, { completed: 1 });
      insertTestSubtask(testDb, task1, { completed: 0 });

      // Task 2: 2 subtasks, 0 completed
      insertTestSubtask(testDb, task2, { completed: 0 });
      insertTestSubtask(testDb, task2, { completed: 0 });

      const res = await request(app)
        .post('/api/subtasks/counts')
        .send({ taskIds: [task1, task2, task3] });

      expect(res.status).toBe(200);
      expect(res.body[task1]).toEqual({ total: 3, completed: 2 });
      expect(res.body[task2]).toEqual({ total: 2, completed: 0 });
      // Task 3 has no subtasks, so it won't appear in the result
      expect(res.body[task3]).toBeUndefined();
    });

    it('returns empty object for empty taskIds', async () => {
      const res = await request(app)
        .post('/api/subtasks/counts')
        .send({ taskIds: [] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });
  });
});
