/**
 * Income API Route Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
  insertTestClient,
} from '../../test/setup.js';
import { setCurrentTestDb, getCurrentTestDb, closeCurrentTestDb } from '../../test/db-mock.js';

vi.mock('../../database.js', () => ({
  getDb: () => {
    const { getCurrentTestDb } = require('../../test/db-mock.js');
    return getCurrentTestDb();
  },
  generateId: () => crypto.randomUUID(),
  getCurrentTimestamp: () => new Date().toISOString(),
}));

import incomeRouter from '../income.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/income', incomeRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: { code: err.code, message: err.message } });
  });
  return app;
}

describe('Income API', () => {
  let app: express.Express;

  beforeEach(() => {
    setCurrentTestDb(createTestDb());
    resetIdCounter();
    app = buildApp();
  });

  afterAll(() => { closeCurrentTestDb(); vi.restoreAllMocks(); });

  describe('GET /api/income', () => {
    it('returns empty array when no income exists', async () => {
      const res = await request(app).get('/api/income');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all income sorted by date descending', async () => {
      const db = getCurrentTestDb();
      insertTestIncome(db, { date: '2024-01-01', description: 'Jan' });
      insertTestIncome(db, { date: '2024-03-01', description: 'Mar' });
      insertTestIncome(db, { date: '2024-02-01', description: 'Feb' });

      const res = await request(app).get('/api/income');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].description).toBe('Mar');
      expect(res.body[2].description).toBe('Jan');
    });

    it('filters by date range', async () => {
      const db = getCurrentTestDb();
      insertTestIncome(db, { date: '2024-01-15' });
      insertTestIncome(db, { date: '2024-06-15' });
      insertTestIncome(db, { date: '2024-12-15' });

      const res = await request(app).get('/api/income').query({ start_date: '2024-04-01', end_date: '2024-08-31' });
      expect(res.body).toHaveLength(1);
      expect(res.body[0].date).toBe('2024-06-15');
    });

    it('filters by client_id', async () => {
      const db = getCurrentTestDb();
      const clientId = insertTestClient(db);
      insertTestIncome(db, { client_id: clientId });
      insertTestIncome(db, {});

      const res = await request(app).get('/api/income').query({ client_id: clientId });
      expect(res.body).toHaveLength(1);
      expect(res.body[0].client_id).toBe(clientId);
    });

    it('filters by ust_reported status', async () => {
      const db = getCurrentTestDb();
      insertTestIncome(db, { ust_reported: 0 });
      insertTestIncome(db, { ust_reported: 1 });

      const res = await request(app).get('/api/income').query({ ust_reported: '0' });
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/income', () => {
    it('creates income with correct 19% VAT', async () => {
      const res = await request(app).post('/api/income').send({
        date: '2024-06-15', description: 'Consulting', net_amount: 5000, vat_rate: 19,
      });
      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBe(950);
      expect(res.body.gross_amount).toBe(5950);
    });

    it('creates income with 7% VAT', async () => {
      const res = await request(app).post('/api/income').send({
        date: '2024-06-15', description: 'Reduced', net_amount: 1000, vat_rate: 7,
      });
      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBe(70);
      expect(res.body.gross_amount).toBe(1070);
    });

    it('creates income with 0% VAT', async () => {
      const res = await request(app).post('/api/income').send({
        date: '2024-06-15', description: 'Exempt', net_amount: 3000, vat_rate: 0,
      });
      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBe(0);
      expect(res.body.gross_amount).toBe(3000);
    });

    it('uses default values', async () => {
      const res = await request(app).post('/api/income').send({
        date: '2024-06-15', description: 'Basic', net_amount: 1000,
      });
      expect(res.status).toBe(201);
      expect(res.body.vat_rate).toBe(19);
      expect(res.body.euer_line).toBe(14);
      expect(res.body.euer_category).toBe('services');
    });

    it('handles decimal precision', async () => {
      const res = await request(app).post('/api/income').send({
        date: '2024-06-15', description: 'Decimal', net_amount: 1234.56, vat_rate: 19,
      });
      expect(res.status).toBe(201);
      expect(res.body.vat_amount).toBeCloseTo(234.57, 2);
      expect(res.body.gross_amount).toBeCloseTo(1469.13, 2);
    });

    it('rejects missing required fields', async () => {
      expect((await request(app).post('/api/income').send({ description: 'X', net_amount: 1 })).status).toBe(400);
      expect((await request(app).post('/api/income').send({ date: '2024-01-01', net_amount: 1 })).status).toBe(400);
      expect((await request(app).post('/api/income').send({ date: '2024-01-01', description: 'X' })).status).toBe(400);
    });
  });

  describe('PATCH /api/income/:id', () => {
    it('recalculates VAT when net_amount changes', async () => {
      const db = getCurrentTestDb();
      const id = insertTestIncome(db, { net_amount: 1000, vat_rate: 19, vat_amount: 190, gross_amount: 1190 });

      const res = await request(app).patch(`/api/income/${id}`).send({ net_amount: 2000 });
      expect(res.status).toBe(200);
      expect(res.body.vat_amount).toBe(380);
      expect(res.body.gross_amount).toBe(2380);
    });

    it('recalculates VAT when vat_rate changes', async () => {
      const db = getCurrentTestDb();
      const id = insertTestIncome(db, { net_amount: 1000, vat_rate: 19, vat_amount: 190, gross_amount: 1190 });

      const res = await request(app).patch(`/api/income/${id}`).send({ vat_rate: 7 });
      expect(res.body.vat_amount).toBe(70);
      expect(res.body.gross_amount).toBe(1070);
    });

    it('returns 404 for non-existent', async () => {
      expect((await request(app).patch('/api/income/x').send({ description: 'x' })).status).toBe(404);
    });
  });

  describe('DELETE /api/income/:id', () => {
    it('deletes an income record', async () => {
      const db = getCurrentTestDb();
      const id = insertTestIncome(db);
      const res = await request(app).delete(`/api/income/${id}`);
      expect(res.status).toBe(200);
      expect((await request(app).get(`/api/income/${id}`)).status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      expect((await request(app).delete('/api/income/x')).status).toBe(404);
    });
  });

  describe('POST /api/income/mark-reported', () => {
    it('marks multiple as USt reported', async () => {
      const db = getCurrentTestDb();
      const id1 = insertTestIncome(db);
      const id2 = insertTestIncome(db);

      const res = await request(app).post('/api/income/mark-reported').send({ ids: [id1, id2], ust_period: '2024-Q2' });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      const check = await request(app).get(`/api/income/${id1}`);
      expect(check.body.ust_reported).toBe(1);
      expect(check.body.ust_period).toBe('2024-Q2');
    });

    it('rejects empty ids', async () => {
      expect((await request(app).post('/api/income/mark-reported').send({ ids: [] })).status).toBe(400);
    });
  });
});
