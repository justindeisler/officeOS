/**
 * Captures API Route Tests
 *
 * Tests capture CRUD, filtering, and processing status.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

import { createTestApp } from '../../test/app.js';
import capturesRouter from '../captures.js';
import request from 'supertest';

const app = createTestApp(capturesRouter, '/api/captures');

// ============================================================================
// Helpers
// ============================================================================

function insertTestCapture(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    content: string;
    type: string;
    processed: number;
    processing_status: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('capture');
  db.prepare(
    `INSERT INTO captures (id, content, type, processed, processing_status, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.content ?? 'Test capture content',
    overrides.type ?? 'note',
    overrides.processed ?? 0,
    overrides.processing_status ?? 'pending',
  );
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe('Captures API', () => {
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
  // GET /api/captures
  // ==========================================================================

  describe('GET /api/captures', () => {
    it('returns empty array when no captures exist', async () => {
      const res = await request(app).get('/api/captures');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all captures', async () => {
      insertTestCapture(testDb, { content: 'Capture 1' });
      insertTestCapture(testDb, { content: 'Capture 2' });

      const res = await request(app).get('/api/captures');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by processed status', async () => {
      insertTestCapture(testDb, { content: 'Unprocessed', processed: 0 });
      insertTestCapture(testDb, { content: 'Processed', processed: 1 });

      const res = await request(app).get('/api/captures?processed=false');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe('Unprocessed');
    });

    it('filters by type', async () => {
      insertTestCapture(testDb, { content: 'A note', type: 'note' });
      insertTestCapture(testDb, { content: 'A task', type: 'task' });
      insertTestCapture(testDb, { content: 'An idea', type: 'idea' });

      const res = await request(app).get('/api/captures?type=task');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe('A task');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        insertTestCapture(testDb, { content: `Capture ${i}` });
      }

      const res = await request(app).get('/api/captures?limit=3');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });
  });

  // ==========================================================================
  // GET /api/captures/:id
  // ==========================================================================

  describe('GET /api/captures/:id', () => {
    it('returns a single capture', async () => {
      const id = insertTestCapture(testDb, { content: 'My capture' });

      const res = await request(app).get(`/api/captures/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toBe('My capture');
    });

    it('returns 404 for non-existent capture', async () => {
      const res = await request(app).get('/api/captures/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/captures
  // ==========================================================================

  describe('POST /api/captures', () => {
    it('creates a capture with content', async () => {
      const res = await request(app)
        .post('/api/captures')
        .send({ content: 'New capture' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('New capture');
      expect(res.body.type).toBe('note');
      expect(res.body.processed).toBe(0);
    });

    it('creates a capture with type', async () => {
      const res = await request(app)
        .post('/api/captures')
        .send({ content: 'Task capture', type: 'task' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('task');
    });

    it('rejects missing content', async () => {
      const res = await request(app)
        .post('/api/captures')
        .send({ type: 'note' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/captures/:id/process
  // ==========================================================================

  describe('POST /api/captures/:id/process', () => {
    it('marks a capture as processed', async () => {
      const id = insertTestCapture(testDb, { content: 'To process' });

      const res = await request(app)
        .post(`/api/captures/${id}/process`)
        .send({
          processed_to: 'task',
          processed_by: 'james',
          artifact_type: 'task',
          artifact_id: 'task-123',
        });

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);
      expect(res.body.processing_status).toBe('completed');
      expect(res.body.processed_by).toBe('james');
    });

    it('returns 404 for non-existent capture', async () => {
      const res = await request(app)
        .post('/api/captures/nonexistent/process')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // GET /api/captures/:id/processing-status
  // ==========================================================================

  describe('GET /api/captures/:id/processing-status', () => {
    it('returns processing status', async () => {
      const id = insertTestCapture(testDb, {
        content: 'Check status',
        processing_status: 'processing',
      });

      const res = await request(app).get(`/api/captures/${id}/processing-status`);
      expect(res.status).toBe(200);
      expect(res.body.captureId).toBe(id);
      expect(res.body.processingStatus).toBe('processing');
      expect(res.body.processed).toBe(false);
    });

    it('returns 404 for non-existent capture', async () => {
      const res = await request(app).get('/api/captures/nonexistent/processing-status');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/captures/:id
  // ==========================================================================

  describe('DELETE /api/captures/:id', () => {
    it('deletes a capture', async () => {
      const id = insertTestCapture(testDb, { content: 'To delete' });

      const res = await request(app).delete(`/api/captures/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted
      const check = await request(app).get(`/api/captures/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent capture', async () => {
      const res = await request(app).delete('/api/captures/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
