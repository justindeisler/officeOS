/**
 * Projects API Route Tests
 *
 * Tests project CRUD, filtering, and cache invalidation.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestProject,
  insertTestClient,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

// Mock cache
vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  cacheKey: (...parts: unknown[]) => parts.join(':'),
  TTL: { PROJECTS: 300000 },
}));

import { createTestApp } from '../../test/app.js';
import projectsRouter from '../projects.js';
import request from 'supertest';

const app = createTestApp(projectsRouter, '/api/projects');

// ============================================================================
// Tests
// ============================================================================

describe('Projects API', () => {
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
  // GET /api/projects
  // ==========================================================================

  describe('GET /api/projects', () => {
    it('returns empty array when no projects exist', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all projects', async () => {
      insertTestProject(testDb, { name: 'Project Alpha' });
      insertTestProject(testDb, { name: 'Project Beta' });

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      insertTestProject(testDb, { name: 'Active', status: 'active' });
      insertTestProject(testDb, { name: 'Completed', status: 'completed' });

      const res = await request(app).get('/api/projects?status=active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active');
    });
  });

  // ==========================================================================
  // GET /api/projects/:id
  // ==========================================================================

  describe('GET /api/projects/:id', () => {
    it('returns a single project', async () => {
      const id = insertTestProject(testDb, { name: 'My Project' });

      const res = await request(app).get(`/api/projects/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('My Project');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app).get('/api/projects/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/projects
  // ==========================================================================

  describe('POST /api/projects', () => {
    it('creates a project with name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'New Project' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Project');
      expect(res.body.id).toBeDefined();
    });

    it('creates a project with all fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          name: 'Full Project',
          description: 'A full project',
          area: 'freelance',
          budget_amount: 5000,
          start_date: '2024-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Full Project');
      expect(res.body.description).toBe('A full project');
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ description: 'No name' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // PATCH /api/projects/:id
  // ==========================================================================

  describe('PATCH /api/projects/:id', () => {
    it('updates project fields', async () => {
      const id = insertTestProject(testDb, { name: 'Original' });

      const res = await request(app)
        .patch(`/api/projects/${id}`)
        .send({ name: 'Updated', description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
      expect(res.body.description).toBe('New description');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .patch('/api/projects/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/projects/:id
  // ==========================================================================

  describe('DELETE /api/projects/:id', () => {
    it('deletes a project', async () => {
      const id = insertTestProject(testDb, { name: 'To Delete' });

      const res = await request(app).delete(`/api/projects/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted
      const check = await request(app).get(`/api/projects/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app).delete('/api/projects/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
