/**
 * Assets API Route Tests — Comprehensive Suite
 *
 * Tests asset CRUD operations and depreciation schedule generation.
 * Covers:
 * - Asset listing and filtering
 * - Asset creation with automatic depreciation schedule
 * - Asset updates with recalculation
 * - Asset deletion (cascade to depreciation_schedule)
 * - Depreciation schedule generation (linear and declining)
 * - Book value calculations
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestAsset,
  insertTestDepreciation,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup — use the setupDbMock pattern from setup.ts
// ============================================================================

let testDb: Database.Database;

// vi.mock in setup.ts (setupDbMock) is hoisted automatically for '../database.js'
// which resolves to src/database.ts. We use the __setTestDb helper it provides.

import { createTestApp } from '../../test/app.js';
import assetsRouter from '../assets.js';
import request from 'supertest';

const app = createTestApp(assetsRouter, '/api/assets');

// ============================================================================
// Tests
// ============================================================================

describe('Assets API', () => {
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
  // GET /api/assets (List)
  // ==========================================================================

  describe('GET /api/assets', () => {
    it('returns empty array when no assets exist', async () => {
      const res = await request(app).get('/api/assets');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all assets', async () => {
      insertTestAsset(testDb, { name: 'MacBook Pro' });
      insertTestAsset(testDb, { name: 'Desk' });

      const res = await request(app).get('/api/assets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      insertTestAsset(testDb, { name: 'Active Asset', status: 'active' });
      insertTestAsset(testDb, { name: 'Disposed Asset', status: 'disposed' });

      const res = await request(app).get('/api/assets?status=active');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active Asset');
    });

    it('filters by category', async () => {
      insertTestAsset(testDb, { name: 'Laptop', category: 'electronics' });
      insertTestAsset(testDb, { name: 'Desk', category: 'furniture' });
      insertTestAsset(testDb, { name: 'Phone', category: 'electronics' });

      const res = await request(app).get('/api/assets?category=electronics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by both status and category', async () => {
      insertTestAsset(testDb, { name: 'Active Laptop', status: 'active', category: 'electronics' });
      insertTestAsset(testDb, { name: 'Disposed Laptop', status: 'disposed', category: 'electronics' });
      insertTestAsset(testDb, { name: 'Active Desk', status: 'active', category: 'furniture' });

      const res = await request(app).get('/api/assets?status=active&category=electronics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active Laptop');
    });

    it('returns assets ordered by purchase_date DESC', async () => {
      insertTestAsset(testDb, { name: 'Old Asset', purchase_date: '2020-01-01' });
      insertTestAsset(testDb, { name: 'New Asset', purchase_date: '2024-06-15' });
      insertTestAsset(testDb, { name: 'Mid Asset', purchase_date: '2022-03-10' });

      const res = await request(app).get('/api/assets');

      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('New Asset');
      expect(res.body[2].name).toBe('Old Asset');
    });

    it('includes current_value for assets with depreciation', async () => {
      const assetId = insertTestAsset(testDb, {
        name: 'Laptop',
        purchase_price: 3000,
      });
      // Add depreciation for a past year
      insertTestDepreciation(testDb, {
        asset_id: assetId,
        year: 2024,
        depreciation_amount: 1000,
        accumulated_depreciation: 1000,
        book_value: 2000,
      });

      const res = await request(app).get('/api/assets');

      expect(res.status).toBe(200);
      expect(res.body[0].current_value).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/assets/:id (Detail)
  // ==========================================================================

  describe('GET /api/assets/:id', () => {
    it('returns asset with depreciation schedule', async () => {
      const assetId = insertTestAsset(testDb, {
        name: 'MacBook Pro',
        purchase_price: 3000,
      });
      insertTestDepreciation(testDb, {
        asset_id: assetId,
        year: 2024,
        depreciation_amount: 1000,
        accumulated_depreciation: 1000,
        book_value: 2000,
      });
      insertTestDepreciation(testDb, {
        asset_id: assetId,
        year: 2025,
        depreciation_amount: 1000,
        accumulated_depreciation: 2000,
        book_value: 1000,
      });

      const res = await request(app).get(`/api/assets/${assetId}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('MacBook Pro');
      expect(res.body.depreciation_schedule).toHaveLength(2);
      expect(res.body.depreciation_schedule[0].year).toBe(2024);
      expect(res.body.depreciation_schedule[1].year).toBe(2025);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).get('/api/assets/nonexistent');
      expect(res.status).toBe(404);
    });

    it('orders depreciation schedule by year', async () => {
      const assetId = insertTestAsset(testDb, { purchase_price: 3000 });
      insertTestDepreciation(testDb, { asset_id: assetId, year: 2026, depreciation_amount: 1000, book_value: 0 });
      insertTestDepreciation(testDb, { asset_id: assetId, year: 2024, depreciation_amount: 1000, book_value: 2000 });
      insertTestDepreciation(testDb, { asset_id: assetId, year: 2025, depreciation_amount: 1000, book_value: 1000 });

      const res = await request(app).get(`/api/assets/${assetId}`);

      expect(res.body.depreciation_schedule[0].year).toBe(2024);
      expect(res.body.depreciation_schedule[1].year).toBe(2025);
      expect(res.body.depreciation_schedule[2].year).toBe(2026);
    });
  });

  // ==========================================================================
  // GET /api/assets/:id/schedule (Schedule only)
  // ==========================================================================

  describe('GET /api/assets/:id/schedule', () => {
    it('returns only the depreciation schedule', async () => {
      const assetId = insertTestAsset(testDb, { purchase_price: 3000 });
      insertTestDepreciation(testDb, {
        asset_id: assetId,
        year: 2024,
        depreciation_amount: 1000,
        book_value: 2000,
      });

      const res = await request(app).get(`/api/assets/${assetId}/schedule`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].year).toBe(2024);
      // Should NOT have top-level asset fields
      expect(res.body[0]).not.toHaveProperty('name');
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).get('/api/assets/nonexistent/schedule');
      expect(res.status).toBe(404);
    });

    it('returns empty array when no schedule exists', async () => {
      const assetId = insertTestAsset(testDb);

      const res = await request(app).get(`/api/assets/${assetId}/schedule`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ==========================================================================
  // POST /api/assets (Create)
  // ==========================================================================

  describe('POST /api/assets', () => {
    it('creates an asset with linear depreciation schedule', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'MacBook Pro',
        category: 'electronics',
        purchase_date: '2024-01-15',
        purchase_price: 3000,
        useful_life_years: 3,
        depreciation_method: 'linear',
        salvage_value: 0,
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('MacBook Pro');
      expect(res.body.purchase_price).toBe(3000);
      expect(res.body.depreciation_schedule).toHaveLength(3);

      // Check linear depreciation: 3000 / 3 = 1000 per year
      const schedule = res.body.depreciation_schedule;
      expect(schedule[0].year).toBe(2024);
      expect(schedule[0].depreciation_amount).toBeCloseTo(1000, 2);
      expect(schedule[0].book_value).toBeCloseTo(2000, 2);

      expect(schedule[1].year).toBe(2025);
      expect(schedule[1].depreciation_amount).toBeCloseTo(1000, 2);
      expect(schedule[1].book_value).toBeCloseTo(1000, 2);

      expect(schedule[2].year).toBe(2026);
      expect(schedule[2].depreciation_amount).toBeCloseTo(1000, 2);
      expect(schedule[2].book_value).toBeCloseTo(0, 2);
    });

    it('creates asset with salvage value', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Server',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 5000,
        useful_life_years: 5,
        depreciation_method: 'linear',
        salvage_value: 500,
      });

      expect(res.status).toBe(201);
      // Depreciable amount = 5000 - 500 = 4500
      // Annual = 4500 / 5 = 900
      const schedule = res.body.depreciation_schedule;
      expect(schedule).toHaveLength(5);
      expect(schedule[0].depreciation_amount).toBeCloseTo(900, 2);
      // Final book value should be salvage value
      expect(schedule[4].book_value).toBeCloseTo(500, 2);
    });

    it('creates asset with declining balance depreciation', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Machine',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 10000,
        useful_life_years: 5,
        depreciation_method: 'declining',
        salvage_value: 0,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      expect(schedule).toHaveLength(5);

      // Declining balance: rate = 2/5 = 0.4
      // Year 1: 10000 * 0.4 = 4000, book = 6000
      expect(schedule[0].depreciation_amount).toBeCloseTo(4000, 2);
      expect(schedule[0].book_value).toBeCloseTo(6000, 2);

      // Year 2: 6000 * 0.4 = 2400, book = 3600
      expect(schedule[1].depreciation_amount).toBeCloseTo(2400, 2);

      // Total depreciation should equal purchase price (no salvage)
      const totalDep = schedule.reduce((s: number, r: any) => s + r.depreciation_amount, 0);
      expect(totalDep).toBeCloseTo(10000, 0);
    });

    it('defaults to linear depreciation when method not specified', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Monitor',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 600,
        useful_life_years: 3,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      // All amounts should be equal for linear
      const amounts = schedule.map((r: any) => r.depreciation_amount);
      expect(amounts[0]).toBeCloseTo(amounts[1], 2);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Incomplete',
        // Missing category, purchase_date, purchase_price, useful_life_years
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/assets').send({
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 1000,
        useful_life_years: 3,
      });

      expect(res.status).toBe(400);
    });

    it('creates asset with optional description', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Keyboard',
        description: 'Mechanical keyboard for development',
        category: 'electronics',
        purchase_date: '2024-06-01',
        purchase_price: 200,
        useful_life_years: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('Mechanical keyboard for development');
    });

    it('sets status to active by default', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Chair',
        category: 'furniture',
        purchase_date: '2024-01-01',
        purchase_price: 800,
        useful_life_years: 5,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
    });

    it('handles single-year depreciation (full write-off)', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Cheap Cable',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 100,
        useful_life_years: 1,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      expect(schedule).toHaveLength(1);
      expect(schedule[0].depreciation_amount).toBeCloseTo(100, 2);
      expect(schedule[0].book_value).toBeCloseTo(0, 2);
    });
  });

  // ==========================================================================
  // PATCH /api/assets/:id (Update)
  // ==========================================================================

  describe('PATCH /api/assets/:id', () => {
    it('updates basic fields without recalculating depreciation', async () => {
      const assetId = insertTestAsset(testDb, { name: 'Old Name' });

      const res = await request(app).patch(`/api/assets/${assetId}`).send({
        name: 'New Name',
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('updates description', async () => {
      const assetId = insertTestAsset(testDb, { description: 'Old desc' });

      const res = await request(app).patch(`/api/assets/${assetId}`).send({
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('updates status', async () => {
      const assetId = insertTestAsset(testDb, { status: 'active' });

      const res = await request(app).patch(`/api/assets/${assetId}`).send({
        status: 'disposed',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('disposed');
    });

    it('recalculates depreciation when purchase_price changes', async () => {
      // Create asset via API to generate depreciation schedule
      const createRes = await request(app).post('/api/assets').send({
        name: 'Laptop',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 3000,
        useful_life_years: 3,
      });
      const assetId = createRes.body.id;

      // Update purchase price
      const res = await request(app).patch(`/api/assets/${assetId}`).send({
        purchase_price: 6000,
      });

      expect(res.status).toBe(200);
      // New annual depreciation: 6000 / 3 = 2000
      expect(res.body.depreciation_schedule[0].depreciation_amount).toBeCloseTo(2000, 2);
    });

    it('recalculates depreciation when useful_life_years changes', async () => {
      const createRes = await request(app).post('/api/assets').send({
        name: 'Laptop',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 3000,
        useful_life_years: 3,
      });
      const assetId = createRes.body.id;

      const res = await request(app).patch(`/api/assets/${assetId}`).send({
        useful_life_years: 5,
      });

      expect(res.status).toBe(200);
      expect(res.body.depreciation_schedule).toHaveLength(5);
      // 3000 / 5 = 600 per year
      expect(res.body.depreciation_schedule[0].depreciation_amount).toBeCloseTo(600, 2);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).patch('/api/assets/nonexistent').send({
        name: 'Doesn\'t matter',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/assets/:id
  // ==========================================================================

  describe('DELETE /api/assets/:id', () => {
    it('deletes an asset and its depreciation schedule', async () => {
      const assetId = insertTestAsset(testDb, { name: 'To Delete' });
      insertTestDepreciation(testDb, {
        asset_id: assetId,
        year: 2024,
        depreciation_amount: 1000,
      });

      const res = await request(app).delete(`/api/assets/${assetId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('To Delete');

      // Verify asset is gone
      const asset = testDb.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      expect(asset).toBeUndefined();

      // Verify depreciation schedule is also gone
      const deps = testDb.prepare('SELECT * FROM depreciation_schedule WHERE asset_id = ?').all(assetId);
      expect(deps).toHaveLength(0);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).delete('/api/assets/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/assets/:id/depreciate
  // ==========================================================================

  describe('POST /api/assets/:id/depreciate', () => {
    it('applies depreciation for the specified year', async () => {
      const createRes = await request(app).post('/api/assets').send({
        name: 'Server',
        category: 'electronics',
        purchase_date: '2024-01-01',
        purchase_price: 3000,
        useful_life_years: 3,
      });
      const assetId = createRes.body.id;

      const res = await request(app)
        .post(`/api/assets/${assetId}/depreciate`)
        .send({ year: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.year).toBe(2024);
      expect(res.body.depreciation_amount).toBeCloseTo(1000, 2);
      expect(res.body.new_book_value).toBeCloseTo(2000, 2);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app)
        .post('/api/assets/nonexistent/depreciate')
        .send({ year: 2024 });
      expect(res.status).toBe(404);
    });

    it('returns 404 when depreciation entry for year does not exist', async () => {
      const assetId = insertTestAsset(testDb);
      // No depreciation schedule exists

      const res = await request(app)
        .post(`/api/assets/${assetId}/depreciate`)
        .send({ year: 2050 });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Depreciation Schedule Calculations
  // ==========================================================================

  describe('Depreciation Schedule Calculations', () => {
    it('linear depreciation totals equal depreciable amount', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Test Linear',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 4567,
        useful_life_years: 7,
        depreciation_method: 'linear',
        salvage_value: 0,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      const totalDep = schedule.reduce((s: number, r: any) => s + r.depreciation_amount, 0);
      expect(totalDep).toBeCloseTo(4567, 0);
    });

    it('linear depreciation with salvage value totals depreciable amount', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Test With Salvage',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 5000,
        useful_life_years: 5,
        depreciation_method: 'linear',
        salvage_value: 800,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      const totalDep = schedule.reduce((s: number, r: any) => s + r.depreciation_amount, 0);
      expect(totalDep).toBeCloseTo(4200, 0); // 5000 - 800
      expect(schedule[4].book_value).toBeCloseTo(800, 2);
    });

    it('declining balance depreciation totals equal purchase price (no salvage)', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Test Declining',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 8000,
        useful_life_years: 4,
        depreciation_method: 'declining',
        salvage_value: 0,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      const totalDep = schedule.reduce((s: number, r: any) => s + r.depreciation_amount, 0);
      expect(totalDep).toBeCloseTo(8000, 0);
    });

    it('accumulated depreciation increases monotonically', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Monotonic Check',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 6000,
        useful_life_years: 6,
        depreciation_method: 'linear',
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;

      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].accumulated_depreciation).toBeGreaterThan(
          schedule[i - 1].accumulated_depreciation
        );
      }
    });

    it('book value decreases monotonically', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Book Value Check',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 6000,
        useful_life_years: 6,
        depreciation_method: 'linear',
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;

      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].book_value).toBeLessThan(schedule[i - 1].book_value);
      }
    });

    it('book value never goes below salvage value', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Salvage Floor Check',
        category: 'equipment',
        purchase_date: '2024-01-01',
        purchase_price: 5000,
        useful_life_years: 5,
        depreciation_method: 'declining',
        salvage_value: 1000,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;

      for (const entry of schedule) {
        expect(entry.book_value).toBeGreaterThanOrEqual(999); // Allow small rounding
      }
    });

    it('first year starts at correct year from purchase date', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Year Check',
        category: 'equipment',
        purchase_date: '2023-06-15',
        purchase_price: 3000,
        useful_life_years: 3,
      });

      expect(res.status).toBe(201);
      expect(res.body.depreciation_schedule[0].year).toBe(2023);
      expect(res.body.depreciation_schedule[2].year).toBe(2025);
    });

    it('handles expensive multi-year asset (10 years)', async () => {
      const res = await request(app).post('/api/assets').send({
        name: 'Building Improvement',
        category: 'infrastructure',
        purchase_date: '2024-01-01',
        purchase_price: 100000,
        useful_life_years: 10,
        depreciation_method: 'linear',
        salvage_value: 0,
      });

      expect(res.status).toBe(201);
      const schedule = res.body.depreciation_schedule;
      expect(schedule).toHaveLength(10);
      expect(schedule[0].depreciation_amount).toBeCloseTo(10000, 2);
      expect(schedule[9].book_value).toBeCloseTo(0, 2);
    });
  });
});
