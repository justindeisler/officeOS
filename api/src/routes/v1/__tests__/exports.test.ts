/**
 * Public REST API v1 — Exports Tests
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

// Mock datevExportService
vi.mock('../../../services/datevExportService.js', () => ({
  generateDatevExport: vi.fn(() => ({
    csv: 'header\nrow1\nrow2',
    filename: 'DATEV_2024.csv',
    recordCount: 2,
    records: [],
    errors: [],
    warnings: [],
  })),
}));

import { createTestApp } from '../../../test/app.js';
import exportsRouter from '../exports.js';

const app = createTestApp(exportsRouter, '/api/v1/exports');

describe('V1 Exports API', () => {
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

  // ========== DATEV ==========

  describe('POST /api/v1/exports/datev', () => {
    it('generates DATEV export', async () => {
      const res = await request(app)
        .post('/api/v1/exports/datev')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('csv');
      expect(res.body.data).toHaveProperty('filename');
      expect(res.body.data).toHaveProperty('recordCount');
    });

    it('rejects without required dates', async () => {
      const res = await request(app)
        .post('/api/v1/exports/datev')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid chart of accounts', async () => {
      const res = await request(app)
        .post('/api/v1/exports/datev')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          chart_of_accounts: 'SKR99',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ========== CSV ==========

  describe('POST /api/v1/exports/csv', () => {
    it('generates CSV export', async () => {
      insertTestIncome(testDb, { date: '2024-06-01', description: 'Payment', net_amount: 1000 });
      insertTestExpense(testDb, { date: '2024-06-15', description: 'Office supplies', net_amount: 50 });

      const res = await request(app)
        .post('/api/v1/exports/csv')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('csv');
      expect(res.body.data).toHaveProperty('filename');
      expect(res.body.data).toHaveProperty('rowCount');
      expect(res.body.data.csv).toContain('income');
      expect(res.body.data.csv).toContain('expense');
    });

    it('filters by type', async () => {
      insertTestIncome(testDb, { date: '2024-06-01', description: 'Payment', net_amount: 1000 });
      insertTestExpense(testDb, { date: '2024-06-15', description: 'Supplies', net_amount: 50 });

      const res = await request(app)
        .post('/api/v1/exports/csv')
        .send({
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          type: 'income',
        });

      expect(res.body.data.csv).toContain('income');
      expect(res.body.data.csv).not.toContain('expense');
    });

    it('rejects without required dates', async () => {
      const res = await request(app)
        .post('/api/v1/exports/csv')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
