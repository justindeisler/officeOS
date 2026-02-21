/**
 * Public REST API v1 — Reports Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
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
import reportsRouter from '../reports.js';

const app = createTestApp(reportsRouter, '/api/v1/reports');

describe('V1 Reports API', () => {
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

  // ========== EÜR ==========

  describe('GET /api/v1/reports/euer', () => {
    it('returns EÜR report for a year', async () => {
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 5000 });
      insertTestExpense(testDb, { date: '2024-03-20', net_amount: 1000, euer_line: 27 });

      const res = await request(app).get('/api/v1/reports/euer?year=2024');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.year).toBe(2024);
      expect(res.body.data.totalIncome).toBe(5000);
      expect(res.body.data.totalExpenses).toBe(1000);
      expect(res.body.data.gewinn).toBe(4000);
    });

    it('returns error for invalid year', async () => {
      const res = await request(app).get('/api/v1/reports/euer');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns zeros when no data', async () => {
      const res = await request(app).get('/api/v1/reports/euer?year=2020');
      expect(res.body.data.totalIncome).toBe(0);
      expect(res.body.data.totalExpenses).toBe(0);
      expect(res.body.data.gewinn).toBe(0);
    });
  });

  // ========== USt-VA ==========

  describe('GET /api/v1/reports/ust-va', () => {
    it('returns USt-VA for a quarter', async () => {
      // Q1 2024
      insertTestIncome(testDb, { date: '2024-02-15', net_amount: 10000, vat_rate: 19, vat_amount: 1900, gross_amount: 11900 });
      insertTestExpense(testDb, { date: '2024-02-20', net_amount: 2000, vat_rate: 19, vat_amount: 380, gross_amount: 2380 });

      const res = await request(app).get('/api/v1/reports/ust-va?year=2024&quarter=1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBe('2024-Q1');
      expect(res.body.data.umsatzsteuer19).toBe(1900);
      expect(res.body.data.vorsteuer).toBe(380);
      expect(res.body.data.zahllast).toBe(1520);
    });

    it('returns error for missing parameters', async () => {
      const res = await request(app).get('/api/v1/reports/ust-va?year=2024');
      expect(res.status).toBe(400);
    });

    it('returns error for invalid quarter', async () => {
      const res = await request(app).get('/api/v1/reports/ust-va?year=2024&quarter=5');
      expect(res.status).toBe(400);
    });
  });

  // ========== BWA ==========

  describe('GET /api/v1/reports/bwa', () => {
    it('returns BWA for a year', async () => {
      insertTestIncome(testDb, { date: '2024-05-15', net_amount: 8000 });
      insertTestExpense(testDb, { date: '2024-05-20', net_amount: 3000 });

      const res = await request(app).get('/api/v1/reports/bwa?year=2024');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalIncome).toBe(8000);
      expect(res.body.data.totalExpenses).toBe(3000);
      expect(res.body.data.result).toBe(5000);
    });

    it('returns BWA for a specific month', async () => {
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 5000 });
      insertTestIncome(testDb, { date: '2024-04-15', net_amount: 3000 });
      insertTestExpense(testDb, { date: '2024-03-20', net_amount: 1000 });

      const res = await request(app).get('/api/v1/reports/bwa?year=2024&month=3');
      expect(res.body.data.month).toBe(3);
      expect(res.body.data.totalIncome).toBe(5000);
      expect(res.body.data.totalExpenses).toBe(1000);
    });

    it('includes expense breakdown by category', async () => {
      insertTestExpense(testDb, { date: '2024-03-20', net_amount: 500, category: 'software' });
      insertTestExpense(testDb, { date: '2024-03-21', net_amount: 300, category: 'travel' });

      const res = await request(app).get('/api/v1/reports/bwa?year=2024');
      expect(res.body.data.expensesByCategory).toHaveProperty('software', 500);
      expect(res.body.data.expensesByCategory).toHaveProperty('travel', 300);
    });

    it('returns error for invalid year', async () => {
      const res = await request(app).get('/api/v1/reports/bwa');
      expect(res.status).toBe(400);
    });
  });
});
