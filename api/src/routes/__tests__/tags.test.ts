/**
 * Tags API Route Tests
 *
 * Tests tag CRUD, task-tag associations, and sync.
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

import { createTestApp } from '../../test/app.js';
import tagsRouter from '../tags.js';
import request from 'supertest';

const app = createTestApp(tagsRouter, '/api/tags');

// ============================================================================
// Helpers
// ============================================================================

function insertTestTag(db: Database.Database, overrides: { id?: string; name?: string; color?: string } = {}): string {
  const id = overrides.id ?? testId('tag');
  db.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)").run(
    id,
    overrides.name ?? 'Test Tag',
    overrides.color ?? null,
  );
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('Tags API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/tags
  // ==========================================================================

  describe('GET /api/tags', () => {
    it('returns empty array when no tags exist', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all tags sorted by name', async () => {
      insertTestTag(testDb, { name: 'Urgent' });
      insertTestTag(testDb, { name: 'Bug' });
      insertTestTag(testDb, { name: 'Feature' });

      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].name).toBe('Bug');
      expect(res.body[1].name).toBe('Feature');
      expect(res.body[2].name).toBe('Urgent');
    });
  });

  // ==========================================================================
  // POST /api/tags
  // ==========================================================================

  describe('POST /api/tags', () => {
    it('creates a tag with name', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ name: 'New Tag' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Tag');
      expect(res.body.id).toBeDefined();
    });

    it('creates a tag with color', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ name: 'Colored Tag', color: '#ff0000' });

      expect(res.status).toBe(201);
      expect(res.body.color).toBe('#ff0000');
    });

    it('trims whitespace from name', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ name: '  Spaced Tag  ' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Spaced Tag');
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ color: '#ff0000' });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate name (case-insensitive)', async () => {
      insertTestTag(testDb, { name: 'Unique' });

      const res = await request(app)
        .post('/api/tags')
        .send({ name: 'unique' });

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // PUT /api/tags/:id
  // ==========================================================================

  describe('PUT /api/tags/:id', () => {
    it('updates tag name', async () => {
      const id = insertTestTag(testDb, { name: 'Old Name' });

      const res = await request(app)
        .put(`/api/tags/${id}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('updates tag color', async () => {
      const id = insertTestTag(testDb, { name: 'Tag', color: '#000' });

      const res = await request(app)
        .put(`/api/tags/${id}`)
        .send({ color: '#fff' });

      expect(res.status).toBe(200);
      expect(res.body.color).toBe('#fff');
    });

    it('returns 404 for non-existent tag', async () => {
      const res = await request(app)
        .put('/api/tags/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('rejects duplicate name on update', async () => {
      insertTestTag(testDb, { name: 'Existing' });
      const id = insertTestTag(testDb, { name: 'Other' });

      const res = await request(app)
        .put(`/api/tags/${id}`)
        .send({ name: 'Existing' });

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // DELETE /api/tags/:id
  // ==========================================================================

  describe('DELETE /api/tags/:id', () => {
    it('deletes a tag', async () => {
      const id = insertTestTag(testDb, { name: 'To Delete' });

      const res = await request(app).delete(`/api/tags/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent tag', async () => {
      const res = await request(app).delete('/api/tags/nonexistent');
      expect(res.status).toBe(404);
    });

    it('cascades deletion to task_tags', async () => {
      const tagId = insertTestTag(testDb, { name: 'Tag to Remove' });
      const taskId = insertTestTask(testDb, { title: 'Tagged Task' });
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tagId);

      await request(app).delete(`/api/tags/${tagId}`);

      const taskTags = testDb.prepare("SELECT * FROM task_tags WHERE tag_id = ?").all(tagId);
      expect(taskTags).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Task-Tag Associations
  // ==========================================================================

  describe('Task-Tag Associations', () => {
    it('GET /api/tags/tasks/:taskId returns tags for a task', async () => {
      const taskId = insertTestTask(testDb, { title: 'Task' });
      const tag1 = insertTestTag(testDb, { name: 'Tag A' });
      const tag2 = insertTestTag(testDb, { name: 'Tag B' });
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tag1);
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tag2);

      const res = await request(app).get(`/api/tags/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('POST /api/tags/tasks/:taskId/:tagId adds tag to task', async () => {
      const taskId = insertTestTask(testDb, { title: 'Task' });
      const tagId = insertTestTag(testDb, { name: 'Tag' });

      const res = await request(app).post(`/api/tags/tasks/${taskId}/${tagId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify association
      const tags = testDb.prepare(
        "SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?"
      ).all(taskId, tagId);
      expect(tags).toHaveLength(1);
    });

    it('POST /api/tags/tasks/:taskId/:tagId is idempotent', async () => {
      const taskId = insertTestTask(testDb, { title: 'Task' });
      const tagId = insertTestTag(testDb, { name: 'Tag' });

      await request(app).post(`/api/tags/tasks/${taskId}/${tagId}`);
      const res = await request(app).post(`/api/tags/tasks/${taskId}/${tagId}`);
      expect(res.status).toBe(200);

      // Only one association
      const tags = testDb.prepare(
        "SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?"
      ).all(taskId, tagId);
      expect(tags).toHaveLength(1);
    });

    it('DELETE /api/tags/tasks/:taskId/:tagId removes tag from task', async () => {
      const taskId = insertTestTask(testDb, { title: 'Task' });
      const tagId = insertTestTag(testDb, { name: 'Tag' });
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tagId);

      const res = await request(app).delete(`/api/tags/tasks/${taskId}/${tagId}`);
      expect(res.status).toBe(200);

      const tags = testDb.prepare(
        "SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?"
      ).all(taskId, tagId);
      expect(tags).toHaveLength(0);
    });

    it('POST /api/tags/tasks/:taskId/sync replaces all tags', async () => {
      const taskId = insertTestTask(testDb, { title: 'Task' });
      const tag1 = insertTestTag(testDb, { name: 'Old Tag' });
      const tag2 = insertTestTag(testDb, { name: 'New Tag 1' });
      const tag3 = insertTestTag(testDb, { name: 'New Tag 2' });
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(taskId, tag1);

      const res = await request(app)
        .post(`/api/tags/tasks/${taskId}/sync`)
        .send({ tagIds: [tag2, tag3] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((t: any) => t.name).sort()).toEqual(['New Tag 1', 'New Tag 2']);
    });

    it('POST /api/tags/tasks/bulk returns tags for multiple tasks', async () => {
      const task1 = insertTestTask(testDb, { title: 'Task 1' });
      const task2 = insertTestTask(testDb, { title: 'Task 2' });
      const tag1 = insertTestTag(testDb, { name: 'Tag A' });
      const tag2 = insertTestTag(testDb, { name: 'Tag B' });
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(task1, tag1);
      testDb.prepare("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)").run(task2, tag2);

      const res = await request(app)
        .post('/api/tags/tasks/bulk')
        .send({ taskIds: [task1, task2] });

      expect(res.status).toBe(200);
      expect(res.body[task1]).toHaveLength(1);
      expect(res.body[task2]).toHaveLength(1);
    });
  });
});
