/**
 * Public REST API v1 — Income Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
  insertTestClient,
} from '../../../test/setup.js';

let testDb: Database.Database;

vi.mock('../../../database.js', () => {
  let _db: Database.Database | null = null;
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not initialized');
      return _db;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
    __setTestDb: (db: Database.Database) => { _db = db; },
  };
});

import { createTestApp } from '../../../test/app.js';
import incomeRouter from '../income.js';

const app = createTestApp(incomeRouter, '/api/v1/income');

describe('V1 Income API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ========== LIST ==========

  describe('GET /api/v1/income', () => {
    it('returns paginated response with success envelope', async () => {
      const res = await request(app).get('/api/v1/income?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('total', 0);
    });

    it('returns income records', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', description: 'Payment 1' });
      insertTestIncome(testDb, { date: '2024-02-15', description: 'Payment 2' });

      const res = await request(app).get('/api/v1/income');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('filters by date range', async () => {
      insertTestIncome(testDb, { date: '2024-01-15' });
      insertTestIncome(testDb, { date: '2024-06-15' });
      insertTestIncome(testDb, { date: '2024-12-15' });

      const res = await request(app).get('/api/v1/income?start_date=2024-06-01&end_date=2024-06-30');
      expect(res.body.data).toHaveLength(1);
    });

    it('paginates correctly', async () => {
      for (let i = 0; i < 5; i++) {
        insertTestIncome(testDb, { description: `Income ${i}` });
      }

      const res = await request(app).get('/api/v1/income?page=1&limit=2');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPages).toBe(3);
    });
  });

  // ========== GET BY ID ==========

  describe('GET /api/v1/income/:id', () => {
    it('returns single income record', async () => {
      const id = insertTestIncome(testDb, { description: 'Test Income' });

      const res = await request(app).get(`/api/v1/income/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.description).toBe('Test Income');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).get('/api/v1/income/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ========== CREATE ==========

  describe('POST /api/v1/income', () => {
    it('creates income record', async () => {
      const res = await request(app)
        .post('/api/v1/income')
        .send({
          date: '2024-06-01',
          description: 'New income',
          net_amount: 5000,
          vat_rate: 19,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.net_amount).toBe(5000);
      expect(res.body.data.vat_amount).toBe(950);
      expect(res.body.data.gross_amount).toBe(5950);
    });

    it('rejects without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/income')
        .send({ description: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ========== UPDATE ==========

  describe('PATCH /api/v1/income/:id', () => {
    it('updates income record', async () => {
      const id = insertTestIncome(testDb, { description: 'Original' });

      const res = await request(app)
        .patch(`/api/v1/income/${id}`)
        .send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated');
    });

    it('recalculates VAT on amount change', async () => {
      const id = insertTestIncome(testDb, { net_amount: 1000, vat_rate: 19 });

      const res = await request(app)
        .patch(`/api/v1/income/${id}`)
        .send({ net_amount: 2000 });

      expect(res.body.data.net_amount).toBe(2000);
      expect(res.body.data.vat_amount).toBe(380);
      expect(res.body.data.gross_amount).toBe(2380);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/income/nonexistent')
        .send({ description: 'nope' });
      expect(res.status).toBe(404);
    });
  });

  // ========== DELETE ==========

  describe('DELETE /api/v1/income/:id', () => {
    it('soft-deletes income record', async () => {
      const id = insertTestIncome(testDb);

      const res = await request(app).delete(`/api/v1/income/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ id, deleted: true });

      // Verify it's "gone" from list
      const check = await request(app).get(`/api/v1/income/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/v1/income/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
