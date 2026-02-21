/**
 * Public REST API v1 — Assets Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestAsset,
  insertTestDepreciation,
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
import assetsRouter from '../assets.js';

const app = createTestApp(assetsRouter, '/api/v1/assets');

describe('V1 Assets API', () => {
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

  describe('GET /api/v1/assets', () => {
    it('returns paginated response', async () => {
      const res = await request(app).get('/api/v1/assets?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('total', 0);
    });

    it('returns assets with current_value', async () => {
      const id = insertTestAsset(testDb, { name: 'Laptop', purchase_price: 3000 });
      insertTestDepreciation(testDb, { asset_id: id, year: 2024, depreciation_amount: 1000, accumulated_depreciation: 1000, book_value: 2000 });

      const res = await request(app).get('/api/v1/assets');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Laptop');
      expect(res.body.data[0].current_value).toBe(2000);
    });

    it('filters by status', async () => {
      insertTestAsset(testDb, { status: 'active' });
      insertTestAsset(testDb, { status: 'disposed' });

      const res = await request(app).get('/api/v1/assets?status=active');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('active');
    });
  });

  // ========== GET BY ID ==========

  describe('GET /api/v1/assets/:id', () => {
    it('returns asset with depreciation schedule', async () => {
      const id = insertTestAsset(testDb, { name: 'Camera' });
      insertTestDepreciation(testDb, { asset_id: id, year: 2024, depreciation_amount: 1000, book_value: 2000 });

      const res = await request(app).get(`/api/v1/assets/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.depreciation_schedule).toBeInstanceOf(Array);
      expect(res.body.data.depreciation_schedule).toHaveLength(1);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).get('/api/v1/assets/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ========== CREATE ==========

  describe('POST /api/v1/assets', () => {
    it('creates asset with depreciation schedule', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .send({
          name: 'New Laptop',
          category: 'equipment',
          purchase_date: '2024-01-01',
          purchase_price: 3000,
          useful_life_years: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Laptop');
      expect(res.body.data.depreciation_schedule).toBeInstanceOf(Array);
      expect(res.body.data.depreciation_schedule.length).toBeGreaterThan(0);
    });

    it('rejects without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .send({ name: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ========== UPDATE ==========

  describe('PATCH /api/v1/assets/:id', () => {
    it('updates asset', async () => {
      const id = insertTestAsset(testDb, { name: 'Old Name' });

      const res = await request(app)
        .patch(`/api/v1/assets/${id}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/assets/nonexistent')
        .send({ name: 'nope' });
      expect(res.status).toBe(404);
    });
  });

  // ========== DELETE ==========

  describe('DELETE /api/v1/assets/:id', () => {
    it('deletes asset and schedule', async () => {
      const id = insertTestAsset(testDb);
      insertTestDepreciation(testDb, { asset_id: id, year: 2024, depreciation_amount: 1000, book_value: 2000 });

      const res = await request(app).delete(`/api/v1/assets/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id, deleted: true });

      // Verify it's gone
      const check = await request(app).get(`/api/v1/assets/${id}`);
      expect(check.status).toBe(404);
    });
  });

  // ========== DEPRECIATION ==========

  describe('GET /api/v1/assets/:id/depreciation', () => {
    it('returns depreciation schedule', async () => {
      const id = insertTestAsset(testDb);
      insertTestDepreciation(testDb, { asset_id: id, year: 2024, depreciation_amount: 1000, book_value: 2000 });
      insertTestDepreciation(testDb, { asset_id: id, year: 2025, depreciation_amount: 1000, accumulated_depreciation: 2000, book_value: 1000 });

      const res = await request(app).get(`/api/v1/assets/${id}/depreciation`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].year).toBeLessThan(res.body.data[1].year);
    });

    it('returns 404 for non-existent asset', async () => {
      const res = await request(app).get('/api/v1/assets/nonexistent/depreciation');
      expect(res.status).toBe(404);
    });
  });
});
