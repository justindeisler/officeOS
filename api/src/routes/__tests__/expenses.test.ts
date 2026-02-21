/**
 * Expenses API Route Tests
 *
 * Tests expense CRUD operations including:
 * - VAT calculation accuracy (critical for financial reporting)
 * - Category validation and EÜR line assignment
 * - Filtering by date, category, vendor, USt period
 * - Bulk USt reporting
 * - Edge cases: zero VAT, negative amounts, decimal precision
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestExpense,
} from '../../test/setup.js';

let testDb: Database.Database;

// Mock cache to avoid cross-test leakage
vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  cacheKey: (...parts: unknown[]) => parts.join(':'),
  TTL: { EXPENSES: 300000, INCOME: 300000 },
}));

// Mock database module to use test DB
vi.mock('../../database.js', () => {
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

import { createTestApp } from '../../test/app.js';
import expensesRouter from '../expenses.js';

const app = createTestApp(expensesRouter, '/api/expenses');

describe('Expenses API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/expenses
  // ==========================================================================

  describe('GET /api/expenses', () => {
    it('returns empty array when no expenses exist', async () => {
      const res = await request(app).get('/api/expenses');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all expenses sorted by date descending', async () => {
      const db = testDb;
      insertTestExpense(db, { date: '2024-01-01', description: 'First' });
      insertTestExpense(db, { date: '2024-03-15', description: 'Third' });
      insertTestExpense(db, { date: '2024-02-01', description: 'Second' });

      const res = await request(app).get('/api/expenses');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].description).toBe('Third');
      expect(res.body[1].description).toBe('Second');
      expect(res.body[2].description).toBe('First');
    });

    it('filters by date range', async () => {
      const db = testDb;
      insertTestExpense(db, { date: '2024-01-15' });
      insertTestExpense(db, { date: '2024-03-15' });
      insertTestExpense(db, { date: '2024-06-15' });

      const res = await request(app)
        .get('/api/expenses')
        .query({ start_date: '2024-02-01', end_date: '2024-04-30' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].date).toBe('2024-03-15');
    });

    it('filters by category', async () => {
      const db = testDb;
      insertTestExpense(db, { category: 'software' });
      insertTestExpense(db, { category: 'hardware' });
      insertTestExpense(db, { category: 'software' });

      const res = await request(app)
        .get('/api/expenses')
        .query({ category: 'software' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by vendor (partial match)', async () => {
      const db = testDb;
      insertTestExpense(db, { vendor: 'Amazon Web Services' });
      insertTestExpense(db, { vendor: 'Google Cloud' });
      insertTestExpense(db, { vendor: 'Amazon Prime' });

      const res = await request(app)
        .get('/api/expenses')
        .query({ vendor: 'Amazon' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by USt period', async () => {
      const db = testDb;
      insertTestExpense(db, { ust_period: '2024-Q1' });
      insertTestExpense(db, { ust_period: '2024-Q2' });
      insertTestExpense(db, { ust_period: '2024-Q1' });

      const res = await request(app)
        .get('/api/expenses')
        .query({ ust_period: '2024-Q1' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // ==========================================================================
  // GET /api/expenses/categories
  // ==========================================================================

  describe('GET /api/expenses/categories', () => {
    it('returns expense categories with EÜR lines', async () => {
      const res = await request(app).get('/api/expenses/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      for (const cat of res.body) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('euer_line');
      }

      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain('software');
      expect(ids).toContain('depreciation');
    });
  });

  // ==========================================================================
  // GET /api/expenses/:id
  // ==========================================================================

  describe('GET /api/expenses/:id', () => {
    it('returns a single expense', async () => {
      const db = testDb;
      const id = insertTestExpense(db, {
        description: 'Adobe CC',
        net_amount: 47.59,
        vendor: 'Adobe',
      });

      const res = await request(app).get(`/api/expenses/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.description).toBe('Adobe CC');
      expect(res.body.net_amount).toBeCloseTo(47.59, 2);
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app).get('/api/expenses/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/expenses - VAT Calculation (CRITICAL)
  // ==========================================================================

  describe('POST /api/expenses', () => {
    it('creates expense with correct 19% VAT', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', vendor: 'Hetzner', description: 'Server',
        category: 'software', net_amount: 100, vat_rate: 19,
      });

      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBe(19);
      expect(res.body.gross_amount).toBe(119);
    });

    it('creates expense with correct 7% VAT', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', vendor: 'Bookstore', description: 'Book',
        category: 'education', net_amount: 29.90, vat_rate: 7,
      });

      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBeCloseTo(2.09, 2);
      expect(res.body.gross_amount).toBeCloseTo(31.99, 2);
    });

    it('creates expense with 0% VAT', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', vendor: 'Insurance', description: 'Insurance',
        category: 'insurance', net_amount: 250, vat_rate: 0,
      });

      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBe(0);
      expect(res.body.gross_amount).toBe(250);
    });

    it('handles decimal precision for financial accuracy', async () => {
      // €123.45 at 19% → VAT = 23.4555 → rounds to 23.46
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', vendor: 'Test', description: 'Decimal test',
        category: 'software', net_amount: 123.45, vat_rate: 19,
      });

      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBeCloseTo(23.46, 2);
      expect(res.body.gross_amount).toBeCloseTo(146.91, 2);
    });

    it('auto-assigns EÜR line from category', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', description: 'Supplies',
        category: 'office_supplies', net_amount: 50,
      });

      expect(res.status).toBe(201);
      expect(res.body.euer_line).toBe(34);
    });

    it('normalizes legacy category IDs', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', description: 'Legacy Office',
        category: 'office', net_amount: 50,
      });

      expect(res.status).toBe(201);
      // 'office' → normalized to 'office_supplies'
      expect(res.body.category).toBe('office_supplies');
      expect(res.body.euer_line).toBe(34);
    });

    it('defaults VAT rate to 19%', async () => {
      const res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', description: 'Default VAT',
        category: 'software', net_amount: 100,
      });

      expect(res.status).toBe(201);
      expect(res.body.vat_rate).toBe(19);
    });

    it('rejects missing required fields', async () => {
      // Missing date
      let res = await request(app).post('/api/expenses').send({
        description: 'No date', category: 'software', net_amount: 100,
      });
      expect(res.status).toBe(400);

      // Missing description
      res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', category: 'software', net_amount: 100,
      });
      expect(res.status).toBe(400);

      // Missing category
      res = await request(app).post('/api/expenses').send({
        date: '2024-03-15', description: 'No cat', net_amount: 100,
      });
      expect(res.status).toBe(400);
    });

    it('maintains sum consistency: gross = net + vat', async () => {
      const amounts = [1.01, 33.33, 99.99, 123.45, 999.97];

      for (const netAmount of amounts) {
        const res = await request(app).post('/api/expenses').send({
          date: '2024-03-15', description: `Test ${netAmount}`,
          category: 'software', net_amount: netAmount, vat_rate: 19,
        });

        expect(res.status).toBe(201);
        const expected = Math.round((res.body.net_amount + res.body.vat_amount) * 100) / 100;
        expect(res.body.gross_amount).toBeCloseTo(expected, 2);
      }
    });
  });

  // ==========================================================================
  // PATCH /api/expenses/:id
  // ==========================================================================

  describe('PATCH /api/expenses/:id', () => {
    it('updates basic fields', async () => {
      const db = testDb;
      const id = insertTestExpense(db, { description: 'Original', vendor: 'Old' });

      const res = await request(app).patch(`/api/expenses/${id}`).send({
        description: 'Updated', vendor: 'New',
      });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated');
      expect(res.body.vendor).toBe('New');
    });

    it('recalculates VAT when net_amount changes', async () => {
      const db = testDb;
      const id = insertTestExpense(db, {
        net_amount: 100, vat_rate: 19, vat_amount: 19, gross_amount: 119,
      });

      const res = await request(app).patch(`/api/expenses/${id}`).send({ net_amount: 200 });

      expect(res.status).toBe(200);
      expect(res.body.vat_amount).toBe(38);
      expect(res.body.gross_amount).toBe(238);
    });

    it('recalculates VAT when vat_rate changes', async () => {
      const db = testDb;
      const id = insertTestExpense(db, {
        net_amount: 100, vat_rate: 19, vat_amount: 19, gross_amount: 119,
      });

      const res = await request(app).patch(`/api/expenses/${id}`).send({ vat_rate: 7 });

      expect(res.status).toBe(200);
      expect(res.body.vat_amount).toBe(7);
      expect(res.body.gross_amount).toBe(107);
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app).patch('/api/expenses/nonexistent').send({
        description: 'Updated',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/expenses/:id
  // ==========================================================================

  describe('DELETE /api/expenses/:id', () => {
    it('deletes an expense', async () => {
      const db = testDb;
      const id = insertTestExpense(db);

      const res = await request(app).delete(`/api/expenses/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app).get(`/api/expenses/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app).delete('/api/expenses/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/expenses/mark-reported
  // ==========================================================================

  describe('POST /api/expenses/mark-reported', () => {
    it('marks multiple expenses as USt reported', async () => {
      const db = testDb;
      const id1 = insertTestExpense(db);
      const id2 = insertTestExpense(db);
      const id3 = insertTestExpense(db);

      const res = await request(app).post('/api/expenses/mark-reported').send({
        ids: [id1, id2], ust_period: '2024-Q1',
      });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      const e1 = await request(app).get(`/api/expenses/${id1}`);
      expect(e1.body.ust_reported).toBe(1);
      expect(e1.body.ust_period).toBe('2024-Q1');

      const e3 = await request(app).get(`/api/expenses/${id3}`);
      expect(e3.body.ust_reported).toBe(0);
    });

    it('rejects empty ids array', async () => {
      const res = await request(app).post('/api/expenses/mark-reported').send({ ids: [] });
      expect(res.status).toBe(400);
    });
  });
});
