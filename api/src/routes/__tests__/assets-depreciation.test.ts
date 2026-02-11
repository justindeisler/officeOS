/**
 * Assets & Depreciation API Tests
 *
 * Comprehensive tests for:
 * 1. Asset CRUD operations (GET/POST/PATCH/DELETE on /api/assets)
 * 2. Depreciation schedule generation and accuracy
 * 3. Depreciation application (/api/assets/:id/depreciate)
 * 4. Edge cases: GWG, mid-year purchases, fully depreciated assets, etc.
 * 5. Report integration: depreciation totals in EÜR via /api/reports
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
} from '../../test/setup.js';

// ============================================================================
// Database mock — inject in-memory SQLite for each test
// ============================================================================

let testDb: Database.Database;

vi.mock('../../database.js', () => {
  let _db: Database.Database | null = null;
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not initialized');
      return _db;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
    closeDb: () => {},
    __setTestDb: (db: Database.Database) => {
      _db = db;
    },
  };
});

import { createTestApp } from '../../test/app.js';
import assetsRouter from '../assets.js';
import reportsRouter from '../reports.js';
import express from 'express';
import request from 'supertest';

// Build app with both routes mounted
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/assets', assetsRouter);
  app.use('/api/reports', reportsRouter);
  app.use(
    (
      err: { statusCode?: number; status?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({
        error: {
          code: err.code ?? 'INTERNAL_ERROR',
          message: err.message ?? 'Internal Server Error',
        },
      });
    }
  );
  return app;
}

const app = buildApp();

// ============================================================================
// Fixtures
// ============================================================================

const FIXTURES = {
  laptop: {
    name: 'MacBook Pro 16"',
    description: 'Development laptop',
    category: 'hardware',
    purchase_date: '2024-01-15',
    purchase_price: 3000,
    useful_life_years: 3,
    depreciation_method: 'linear',
    salvage_value: 0,
  },
  monitor: {
    name: 'Dell U2723QE Monitor',
    description: '4K Monitor',
    category: 'hardware',
    purchase_date: '2024-03-01',
    purchase_price: 600,
    useful_life_years: 5,
    depreciation_method: 'linear',
    salvage_value: 0,
  },
  desk: {
    name: 'Standing Desk',
    description: 'Adjustable standing desk',
    category: 'furniture',
    purchase_date: '2023-06-15',
    purchase_price: 1200,
    useful_life_years: 10,
    depreciation_method: 'linear',
    salvage_value: 0,
  },
  /** GWG candidate — 1-year useful life */
  keyboard: {
    name: 'Mechanical Keyboard',
    description: 'Ergonomic keyboard',
    category: 'hardware',
    purchase_date: '2024-02-01',
    purchase_price: 250,
    useful_life_years: 1,
    depreciation_method: 'linear',
    salvage_value: 0,
  },
  /** Asset with salvage value */
  car: {
    name: 'Company Vehicle',
    description: 'Business vehicle',
    category: 'vehicle',
    purchase_date: '2024-01-01',
    purchase_price: 30000,
    useful_life_years: 6,
    depreciation_method: 'linear',
    salvage_value: 5000,
  },
  /** Old fully depreciated asset */
  oldPrinter: {
    name: 'Office Printer',
    description: 'Old printer fully depreciated',
    category: 'hardware',
    purchase_date: '2020-01-01',
    purchase_price: 900,
    useful_life_years: 3,
    depreciation_method: 'linear',
    salvage_value: 0,
  },
} as const;

/** Helper to create an asset and return the response body */
async function createAsset(data: Record<string, unknown>) {
  const res = await request(app).post('/api/assets').send(data);
  expect(res.status).toBe(201);
  return res.body;
}

// ============================================================================
// Tests
// ============================================================================

describe('Assets & Depreciation API', () => {
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
  // GET /api/assets — Asset Register
  // ==========================================================================

  describe('GET /api/assets (Asset Register)', () => {
    it('returns empty array when no assets exist', async () => {
      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all assets', async () => {
      await createAsset(FIXTURES.laptop);
      await createAsset(FIXTURES.monitor);

      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns assets sorted by purchase_date descending', async () => {
      await createAsset({ ...FIXTURES.desk, purchase_date: '2023-06-15' });
      await createAsset({ ...FIXTURES.laptop, purchase_date: '2024-01-15' });
      await createAsset({ ...FIXTURES.monitor, purchase_date: '2024-03-01' });

      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].name).toBe('Dell U2723QE Monitor');
      expect(res.body[1].name).toBe('MacBook Pro 16"');
      expect(res.body[2].name).toBe('Standing Desk');
    });

    it('filters by status', async () => {
      const asset1 = await createAsset(FIXTURES.laptop);
      await createAsset(FIXTURES.monitor);

      // Mark one as disposed
      await request(app).patch(`/api/assets/${asset1.id}`).send({ status: 'disposed' });

      const activeRes = await request(app).get('/api/assets').query({ status: 'active' });
      expect(activeRes.status).toBe(200);
      expect(activeRes.body).toHaveLength(1);
      expect(activeRes.body[0].name).toBe('Dell U2723QE Monitor');

      const disposedRes = await request(app).get('/api/assets').query({ status: 'disposed' });
      expect(disposedRes.status).toBe(200);
      expect(disposedRes.body).toHaveLength(1);
      expect(disposedRes.body[0].name).toBe('MacBook Pro 16"');
    });

    it('filters by category', async () => {
      await createAsset(FIXTURES.laptop);
      await createAsset(FIXTURES.desk);

      const res = await request(app).get('/api/assets').query({ category: 'furniture' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Standing Desk');
    });

    it('includes current_value based on depreciation schedule', async () => {
      await createAsset(FIXTURES.laptop);

      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty('current_value');
      expect(typeof res.body[0].current_value).toBe('number');
    });

    it('returns all expected asset properties', async () => {
      await createAsset(FIXTURES.laptop);

      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      const asset = res.body[0];

      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('name');
      expect(asset).toHaveProperty('description');
      expect(asset).toHaveProperty('category');
      expect(asset).toHaveProperty('purchase_date');
      expect(asset).toHaveProperty('purchase_price');
      expect(asset).toHaveProperty('useful_life_years');
      expect(asset).toHaveProperty('depreciation_method');
      expect(asset).toHaveProperty('salvage_value');
      expect(asset).toHaveProperty('current_value');
      expect(asset).toHaveProperty('status');
      expect(asset).toHaveProperty('created_at');
    });
  });

  // ==========================================================================
  // GET /api/assets/:id — Single Asset with Schedule
  // ==========================================================================

  describe('GET /api/assets/:id', () => {
    it('returns a single asset with depreciation schedule', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).get(`/api/assets/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.name).toBe('MacBook Pro 16"');
      expect(res.body).toHaveProperty('depreciation_schedule');
      expect(Array.isArray(res.body.depreciation_schedule)).toBe(true);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).get('/api/assets/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('includes current_value based on depreciation', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).get(`/api/assets/${created.id}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.current_value).toBe('number');
    });
  });

  // ==========================================================================
  // GET /api/assets/:id/schedule — Depreciation Schedule Only
  // ==========================================================================

  describe('GET /api/assets/:id/schedule', () => {
    it('returns the depreciation schedule for an asset', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).get(`/api/assets/${created.id}/schedule`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).get('/api/assets/nonexistent/schedule');
      expect(res.status).toBe(404);
    });

    it('schedule entries are sorted by year ascending', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).get(`/api/assets/${created.id}/schedule`);
      expect(res.status).toBe(200);
      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i].year).toBeGreaterThan(res.body[i - 1].year);
      }
    });

    it('each schedule entry has required fields', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).get(`/api/assets/${created.id}/schedule`);
      expect(res.status).toBe(200);
      for (const entry of res.body) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('asset_id');
        expect(entry).toHaveProperty('year');
        expect(entry).toHaveProperty('depreciation_amount');
        expect(entry).toHaveProperty('accumulated_depreciation');
        expect(entry).toHaveProperty('book_value');
      }
    });
  });

  // ==========================================================================
  // POST /api/assets — Create Asset
  // ==========================================================================

  describe('POST /api/assets', () => {
    it('creates an asset and returns it with depreciation schedule', async () => {
      const res = await request(app).post('/api/assets').send(FIXTURES.laptop);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('MacBook Pro 16"');
      expect(res.body.purchase_price).toBe(3000);
      expect(res.body.useful_life_years).toBe(3);
      expect(res.body.depreciation_method).toBe('linear');
      expect(res.body.status).toBe('active');
      expect(res.body).toHaveProperty('depreciation_schedule');
      expect(res.body.depreciation_schedule).toHaveLength(3);
    });

    it('generates a unique ID for each asset', async () => {
      const a1 = await createAsset(FIXTURES.laptop);
      const a2 = await createAsset(FIXTURES.monitor);
      expect(a1.id).not.toBe(a2.id);
    });

    it('defaults depreciation_method to linear', async () => {
      const { depreciation_method, ...withoutMethod } = FIXTURES.laptop;
      const res = await request(app).post('/api/assets').send(withoutMethod);
      expect(res.status).toBe(201);
      expect(res.body.depreciation_method).toBe('linear');
    });

    it('defaults salvage_value to 0', async () => {
      const { salvage_value, ...withoutSalvage } = FIXTURES.laptop;
      const res = await request(app).post('/api/assets').send(withoutSalvage);
      expect(res.status).toBe(201);
      expect(res.body.salvage_value).toBe(0);
    });

    it('rejects missing required fields', async () => {
      // Missing name
      let res = await request(app).post('/api/assets').send({
        category: 'hardware',
        purchase_date: '2024-01-01',
        purchase_price: 1000,
        useful_life_years: 3,
      });
      expect(res.status).toBe(400);

      // Missing category
      res = await request(app).post('/api/assets').send({
        name: 'Test',
        purchase_date: '2024-01-01',
        purchase_price: 1000,
        useful_life_years: 3,
      });
      expect(res.status).toBe(400);

      // Missing purchase_date
      res = await request(app).post('/api/assets').send({
        name: 'Test',
        category: 'hardware',
        purchase_price: 1000,
        useful_life_years: 3,
      });
      expect(res.status).toBe(400);

      // Missing purchase_price
      res = await request(app).post('/api/assets').send({
        name: 'Test',
        category: 'hardware',
        purchase_date: '2024-01-01',
        useful_life_years: 3,
      });
      expect(res.status).toBe(400);

      // Missing useful_life_years
      res = await request(app).post('/api/assets').send({
        name: 'Test',
        category: 'hardware',
        purchase_date: '2024-01-01',
        purchase_price: 1000,
      });
      expect(res.status).toBe(400);
    });

    it('stores optional description', async () => {
      const res = await request(app).post('/api/assets').send(FIXTURES.laptop);
      expect(res.status).toBe(201);
      expect(res.body.description).toBe('Development laptop');
    });

    it('handles null description', async () => {
      const { description, ...withoutDesc } = FIXTURES.laptop;
      const res = await request(app).post('/api/assets').send(withoutDesc);
      expect(res.status).toBe(201);
      expect(res.body.description).toBeNull();
    });
  });

  // ==========================================================================
  // PATCH /api/assets/:id — Update Asset
  // ==========================================================================

  describe('PATCH /api/assets/:id', () => {
    it('updates basic fields (name, description, category, status)', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).patch(`/api/assets/${created.id}`).send({
        name: 'MacBook Pro 14"',
        description: 'Smaller laptop',
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('MacBook Pro 14"');
      expect(res.body.description).toBe('Smaller laptop');
      expect(res.body.purchase_price).toBe(3000);
    });

    it('recalculates depreciation when financial fields change', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).patch(`/api/assets/${created.id}`).send({
        purchase_price: 6000,
      });

      expect(res.status).toBe(200);
      expect(res.body.purchase_price).toBe(6000);
      expect(res.body.depreciation_schedule).toHaveLength(3);
      expect(res.body.depreciation_schedule[0].depreciation_amount).toBe(2000);
    });

    it('recalculates depreciation when useful_life_years changes', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).patch(`/api/assets/${created.id}`).send({
        useful_life_years: 5,
      });

      expect(res.status).toBe(200);
      expect(res.body.depreciation_schedule).toHaveLength(5);
      expect(res.body.depreciation_schedule[0].depreciation_amount).toBe(600);
    });

    it('recalculates depreciation when salvage_value changes', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).patch(`/api/assets/${created.id}`).send({
        salvage_value: 300,
      });

      expect(res.status).toBe(200);
      expect(res.body.depreciation_schedule).toHaveLength(3);
      expect(res.body.depreciation_schedule[0].depreciation_amount).toBe(900);
      const lastEntry = res.body.depreciation_schedule[res.body.depreciation_schedule.length - 1];
      expect(lastEntry.book_value).toBeCloseTo(300, 2);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).patch('/api/assets/nonexistent').send({
        name: 'Updated',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/assets/:id
  // ==========================================================================

  describe('DELETE /api/assets/:id', () => {
    it('deletes an asset and its depreciation schedule', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app).delete(`/api/assets/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app).get(`/api/assets/${created.id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).delete('/api/assets/nonexistent');
      expect(res.status).toBe(404);
    });

    it('cleans up depreciation_schedule entries', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const beforeCount = testDb.prepare(
        'SELECT COUNT(*) as cnt FROM depreciation_schedule WHERE asset_id = ?'
      ).get(created.id) as { cnt: number };
      expect(beforeCount.cnt).toBeGreaterThan(0);

      await request(app).delete(`/api/assets/${created.id}`);

      const afterCount = testDb.prepare(
        'SELECT COUNT(*) as cnt FROM depreciation_schedule WHERE asset_id = ?'
      ).get(created.id) as { cnt: number };
      expect(afterCount.cnt).toBe(0);
    });
  });

  // ==========================================================================
  // POST /api/assets/:id/depreciate — Apply Depreciation
  // ==========================================================================

  describe('POST /api/assets/:id/depreciate', () => {
    it('applies depreciation for a specific year', async () => {
      const created = await createAsset(FIXTURES.laptop);

      const res = await request(app)
        .post(`/api/assets/${created.id}/depreciate`)
        .send({ year: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.year).toBe(2024);
      expect(res.body.depreciation_amount).toBe(1000);
      expect(res.body.new_book_value).toBe(2000);
    });

    it('updates the asset current_value in the database after depreciation', async () => {
      const created = await createAsset(FIXTURES.laptop);

      await request(app)
        .post(`/api/assets/${created.id}/depreciate`)
        .send({ year: 2024 });

      // Verify the depreciation was applied in the DB
      const dbAsset = testDb.prepare('SELECT current_value FROM assets WHERE id = ?')
        .get(created.id) as { current_value: number };
      expect(dbAsset.current_value).toBe(2000);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app)
        .post('/api/assets/nonexistent/depreciate')
        .send({ year: 2024 });
      expect(res.status).toBe(404);
    });

    it('returns 404 for a year not in the schedule', async () => {
      const created = await createAsset(FIXTURES.laptop);
      const res = await request(app)
        .post(`/api/assets/${created.id}/depreciate`)
        .send({ year: 2030 });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Depreciation Schedule — Linear Calculation Accuracy
  // ==========================================================================

  describe('Depreciation Schedule — Linear Calculations', () => {
    it('calculates equal annual amounts for standard linear depreciation', async () => {
      const asset = await createAsset(FIXTURES.laptop);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(3);
      for (const entry of schedule) {
        expect(entry.depreciation_amount).toBe(1000);
      }
    });

    it('tracks accumulated depreciation correctly', async () => {
      const asset = await createAsset(FIXTURES.laptop);
      const schedule = asset.depreciation_schedule;

      expect(schedule[0].accumulated_depreciation).toBe(1000);
      expect(schedule[1].accumulated_depreciation).toBe(2000);
      expect(schedule[2].accumulated_depreciation).toBe(3000);
    });

    it('tracks book value correctly (decreasing each year)', async () => {
      const asset = await createAsset(FIXTURES.laptop);
      const schedule = asset.depreciation_schedule;

      expect(schedule[0].book_value).toBe(2000);
      expect(schedule[1].book_value).toBe(1000);
      expect(schedule[2].book_value).toBe(0);
    });

    it('assigns correct years starting from purchase year', async () => {
      const asset = await createAsset(FIXTURES.laptop);
      const schedule = asset.depreciation_schedule;

      expect(schedule[0].year).toBe(2024);
      expect(schedule[1].year).toBe(2025);
      expect(schedule[2].year).toBe(2026);
    });

    it('handles 5-year useful life correctly', async () => {
      const asset = await createAsset(FIXTURES.monitor);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(5);
      expect(schedule[0].depreciation_amount).toBe(120);
      expect(schedule[4].book_value).toBe(0);
      expect(schedule[4].accumulated_depreciation).toBe(600);
    });

    it('handles 10-year useful life correctly', async () => {
      const asset = await createAsset(FIXTURES.desk);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(10);
      expect(schedule[0].depreciation_amount).toBe(120);
      expect(schedule[9].book_value).toBe(0);
    });

    it('handles salvage value — depreciable amount is (price - salvage)', async () => {
      const asset = await createAsset(FIXTURES.car);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(6);
      const expectedAnnual = Math.round(25000 / 6 * 100) / 100;
      expect(schedule[0].depreciation_amount).toBeCloseTo(expectedAnnual, 2);

      const lastEntry = schedule[schedule.length - 1];
      expect(lastEntry.book_value).toBeCloseTo(5000, 2);
    });

    it('final year absorbs rounding remainder', async () => {
      const asset = await createAsset(FIXTURES.car);
      const schedule = asset.depreciation_schedule;

      const totalDepr = schedule.reduce(
        (sum: number, e: { depreciation_amount: number }) => sum + e.depreciation_amount, 0
      );
      expect(totalDepr).toBeCloseTo(25000, 2);
    });

    it('handles 1-year useful life (GWG-like)', async () => {
      const asset = await createAsset(FIXTURES.keyboard);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(1);
      expect(schedule[0].depreciation_amount).toBe(250);
      expect(schedule[0].book_value).toBe(0);
      expect(schedule[0].accumulated_depreciation).toBe(250);
    });

    it('links schedule entries to the correct asset_id', async () => {
      const asset = await createAsset(FIXTURES.laptop);
      const schedule = asset.depreciation_schedule;

      for (const entry of schedule) {
        expect(entry.asset_id).toBe(asset.id);
      }
    });
  });

  // ==========================================================================
  // Depreciation Schedule — Declining Balance Method
  // ==========================================================================

  describe('Depreciation Schedule — Declining Balance', () => {
    it('applies declining balance method with higher early depreciation', async () => {
      const res = await request(app).post('/api/assets').send({
        ...FIXTURES.laptop,
        depreciation_method: 'declining',
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      expect(schedule).toHaveLength(3);

      // Declining: rate = 2/3 → Year 1: 3000 * 2/3 = 2000
      expect(schedule[0].depreciation_amount).toBe(2000);
      expect(schedule[1].depreciation_amount).toBeCloseTo(666.67, 2);

      const lastEntry = schedule[schedule.length - 1];
      expect(lastEntry.book_value).toBeCloseTo(0, 2);
    });

    it('declining balance with salvage value does not go below salvage', async () => {
      const res = await request(app).post('/api/assets').send({
        ...FIXTURES.car,
        depreciation_method: 'declining',
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;

      for (const entry of schedule) {
        expect(entry.book_value).toBeGreaterThanOrEqual(
          FIXTURES.car.salvage_value - 0.01
        );
      }

      const lastEntry = schedule[schedule.length - 1];
      expect(lastEntry.book_value).toBeCloseTo(5000, 2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles very expensive asset (large numbers)', async () => {
      const asset = await createAsset({
        name: 'Expensive Machine',
        category: 'machinery',
        purchase_date: '2024-01-01',
        purchase_price: 500000,
        useful_life_years: 10,
        salvage_value: 0,
      });

      const schedule = asset.depreciation_schedule;
      expect(schedule).toHaveLength(10);
      expect(schedule[0].depreciation_amount).toBe(50000);
      expect(schedule[9].book_value).toBe(0);
    });

    it('handles very cheap asset (small numbers)', async () => {
      const asset = await createAsset({
        name: 'USB Cable',
        category: 'hardware',
        purchase_date: '2024-01-01',
        purchase_price: 10,
        useful_life_years: 1,
        salvage_value: 0,
      });

      expect(asset.depreciation_schedule).toHaveLength(1);
      expect(asset.depreciation_schedule[0].depreciation_amount).toBe(10);
    });

    it('handles fractional annual depreciation (e.g. 1000/3 = 333.33...)', async () => {
      const asset = await createAsset({
        name: 'Fractional Test',
        category: 'hardware',
        purchase_date: '2024-01-01',
        purchase_price: 1000,
        useful_life_years: 3,
        salvage_value: 0,
      });

      const schedule = asset.depreciation_schedule;
      const total = schedule.reduce(
        (s: number, e: { depreciation_amount: number }) => s + e.depreciation_amount, 0
      );
      expect(total).toBeCloseTo(1000, 2);
      expect(schedule[2].book_value).toBeCloseTo(0, 2);
    });

    it('fully depreciated asset (old purchase date)', async () => {
      const asset = await createAsset(FIXTURES.oldPrinter);
      const schedule = asset.depreciation_schedule;

      expect(schedule).toHaveLength(3);
      expect(schedule[2].book_value).toBe(0);
      expect(schedule[2].year).toBe(2022);
    });

    it('multiple assets do not share depreciation schedules', async () => {
      const a1 = await createAsset(FIXTURES.laptop);
      const a2 = await createAsset(FIXTURES.monitor);

      const s1 = await request(app).get(`/api/assets/${a1.id}/schedule`);
      const s2 = await request(app).get(`/api/assets/${a2.id}/schedule`);

      expect(s1.body).toHaveLength(3);
      expect(s2.body).toHaveLength(5);

      for (const entry of s1.body) {
        expect(entry.asset_id).toBe(a1.id);
      }
      for (const entry of s2.body) {
        expect(entry.asset_id).toBe(a2.id);
      }
    });

    it('creating multiple assets does not corrupt depreciation data', async () => {
      await createAsset(FIXTURES.laptop);
      await createAsset(FIXTURES.monitor);
      await createAsset(FIXTURES.desk);
      await createAsset(FIXTURES.keyboard);
      await createAsset(FIXTURES.car);

      const totalScheduleEntries = testDb.prepare(
        'SELECT COUNT(*) as cnt FROM depreciation_schedule'
      ).get() as { cnt: number };

      // laptop(3) + monitor(5) + desk(10) + keyboard(1) + car(6) = 25
      expect(totalScheduleEntries.cnt).toBe(25);
    });
  });

  // ==========================================================================
  // EÜR Report Integration — Depreciation in Reports
  // ==========================================================================

  describe('EÜR Report — Depreciation Integration', () => {
    it('includes asset depreciation in EÜR expenses under AfA line (30)', async () => {
      await createAsset(FIXTURES.laptop);

      const res = await request(app).get('/api/reports/euer/2024');
      expect(res.status).toBe(200);

      expect(res.body.expenses[30]).toBeDefined();
      expect(res.body.expenses[30]).toBeGreaterThanOrEqual(1000);
    });

    it('sums depreciation from multiple assets in the same year', async () => {
      await createAsset(FIXTURES.laptop);  // 3000/3 = 1000/year from 2024
      await createAsset(FIXTURES.monitor); // 600/5 = 120/year from 2024

      const res = await request(app).get('/api/reports/euer/2024');
      expect(res.status).toBe(200);

      expect(res.body.expenses[30]).toBeGreaterThanOrEqual(1120);
    });

    it('returns valid report for a year with no assets', async () => {
      const res = await request(app).get('/api/reports/euer/2020');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('year', 2020);
    });

    it('only includes depreciation for the requested year', async () => {
      await createAsset(FIXTURES.laptop); // 2024-2026 at €1,000/year

      const res2024 = await request(app).get('/api/reports/euer/2024');
      const res2025 = await request(app).get('/api/reports/euer/2025');

      expect(res2024.body.expenses[30]).toBeGreaterThanOrEqual(1000);
      expect(res2025.body.expenses[30]).toBeGreaterThanOrEqual(1000);

      // 2027 should have no depreciation from this asset
      const res2027 = await request(app).get('/api/reports/euer/2027');
      const afa2027 = res2027.body.expenses[30] ?? 0;
      expect(afa2027).toBeLessThan(1);
    });
  });

  // ==========================================================================
  // Multi-Year Depreciation Tracking
  // ==========================================================================

  describe('Multi-Year Depreciation Tracking', () => {
    it('can depreciate an asset year by year', async () => {
      const asset = await createAsset(FIXTURES.laptop);

      const y1 = await request(app)
        .post(`/api/assets/${asset.id}/depreciate`)
        .send({ year: 2024 });
      expect(y1.body.new_book_value).toBe(2000);

      const y2 = await request(app)
        .post(`/api/assets/${asset.id}/depreciate`)
        .send({ year: 2025 });
      expect(y2.body.new_book_value).toBe(1000);

      const y3 = await request(app)
        .post(`/api/assets/${asset.id}/depreciate`)
        .send({ year: 2026 });
      expect(y3.body.new_book_value).toBe(0);
    });

    it('depreciation amounts are consistent with schedule', async () => {
      const asset = await createAsset(FIXTURES.car);
      const schedule = asset.depreciation_schedule;

      for (const entry of schedule) {
        const res = await request(app)
          .post(`/api/assets/${asset.id}/depreciate`)
          .send({ year: entry.year });

        expect(res.body.depreciation_amount).toBe(entry.depreciation_amount);
        expect(res.body.new_book_value).toBe(entry.book_value);
      }
    });
  });

  // ==========================================================================
  // Consistency & Invariant Tests
  // ==========================================================================

  describe('Depreciation Invariants', () => {
    it('accumulated_depreciation is monotonically increasing', async () => {
      const asset = await createAsset(FIXTURES.desk);
      const schedule = asset.depreciation_schedule;

      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].accumulated_depreciation)
          .toBeGreaterThan(schedule[i - 1].accumulated_depreciation);
      }
    });

    it('book_value is monotonically decreasing', async () => {
      const asset = await createAsset(FIXTURES.desk);
      const schedule = asset.depreciation_schedule;

      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].book_value).toBeLessThan(schedule[i - 1].book_value);
      }
    });

    it('book_value + accumulated_depreciation = purchase_price (always)', async () => {
      const asset = await createAsset(FIXTURES.monitor);
      const schedule = asset.depreciation_schedule;

      for (const entry of schedule) {
        const sum = entry.book_value + entry.accumulated_depreciation;
        expect(sum).toBeCloseTo(FIXTURES.monitor.purchase_price, 2);
      }
    });

    it('final accumulated_depreciation = depreciable amount', async () => {
      const asset = await createAsset(FIXTURES.car);
      const schedule = asset.depreciation_schedule;
      const lastEntry = schedule[schedule.length - 1];

      const depreciableAmount = FIXTURES.car.purchase_price - FIXTURES.car.salvage_value;
      expect(lastEntry.accumulated_depreciation).toBeCloseTo(depreciableAmount, 2);
    });

    it('all depreciation_amounts are positive', async () => {
      const asset = await createAsset(FIXTURES.desk);
      for (const entry of asset.depreciation_schedule) {
        expect(entry.depreciation_amount).toBeGreaterThan(0);
      }
    });

    it('book_value never goes below salvage_value', async () => {
      const asset = await createAsset(FIXTURES.car);
      for (const entry of asset.depreciation_schedule) {
        expect(entry.book_value).toBeGreaterThanOrEqual(
          FIXTURES.car.salvage_value - 0.01
        );
      }
    });
  });
});
