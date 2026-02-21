/**
 * Public REST API v1 — Expenses Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestExpense,
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
import expensesRouter from '../expenses.js';

const app = createTestApp(expensesRouter, '/api/v1/expenses');

describe('V1 Expenses API', () => {
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

  describe('GET /api/v1/expenses', () => {
    it('returns paginated response', async () => {
      const res = await request(app).get('/api/v1/expenses?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('total', 0);
    });

    it('returns expenses and filters by category', async () => {
      insertTestExpense(testDb, { category: 'software', description: 'IDE' });
      insertTestExpense(testDb, { category: 'travel', description: 'Train' });

      const res = await request(app).get('/api/v1/expenses?category=software');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].description).toBe('IDE');
    });

    it('filters by vendor', async () => {
      insertTestExpense(testDb, { vendor: 'Adobe Inc' });
      insertTestExpense(testDb, { vendor: 'Microsoft' });

      const res = await request(app).get('/api/v1/expenses?vendor=Adobe');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].vendor).toContain('Adobe');
    });

    it('paginates correctly', async () => {
      for (let i = 0; i < 5; i++) {
        insertTestExpense(testDb, { description: `Expense ${i}` });
      }

      const res = await request(app).get('/api/v1/expenses?page=2&limit=2');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPages).toBe(3);
    });
  });

  // ========== GET BY ID ==========

  describe('GET /api/v1/expenses/:id', () => {
    it('returns single expense', async () => {
      const id = insertTestExpense(testDb, { description: 'Test Expense' });

      const res = await request(app).get(`/api/v1/expenses/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).get('/api/v1/expenses/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ========== CREATE ==========

  describe('POST /api/v1/expenses', () => {
    it('creates expense', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .send({
          date: '2024-06-01',
          description: 'New expense',
          category: 'software',
          net_amount: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.net_amount).toBe(100);
      expect(res.body.data.vat_amount).toBe(19);
      expect(res.body.data.gross_amount).toBe(119);
    });

    it('rejects without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .send({ description: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ========== UPDATE ==========

  describe('PATCH /api/v1/expenses/:id', () => {
    it('updates expense', async () => {
      const id = insertTestExpense(testDb, { description: 'Original' });

      const res = await request(app)
        .patch(`/api/v1/expenses/${id}`)
        .send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated');
    });

    it('recalculates VAT on amount change', async () => {
      const id = insertTestExpense(testDb, { net_amount: 100, vat_rate: 19 });

      const res = await request(app)
        .patch(`/api/v1/expenses/${id}`)
        .send({ net_amount: 200 });

      expect(res.body.data.net_amount).toBe(200);
      expect(res.body.data.vat_amount).toBe(38);
      expect(res.body.data.gross_amount).toBe(238);
    });
  });

  // ========== DELETE ==========

  describe('DELETE /api/v1/expenses/:id', () => {
    it('soft-deletes expense', async () => {
      const id = insertTestExpense(testDb);

      const res = await request(app).delete(`/api/v1/expenses/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id, deleted: true });

      // Verify it's "gone"
      const check = await request(app).get(`/api/v1/expenses/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/v1/expenses/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
