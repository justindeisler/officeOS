/**
 * Public REST API v1 — Invoice Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import {
  createTestDb,
  resetIdCounter,
  insertTestInvoice,
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

// Mock pdfService to avoid Puppeteer
vi.mock('../../../services/pdfService.js', () => ({
  generateInvoicePdf: vi.fn(async () => '/tmp/test.pdf'),
  generateInvoicePdfBuffer: vi.fn(async () => Buffer.from('fake-pdf')),
  getInvoicePdfPath: vi.fn((p: string) => p),
  invoicePdfExists: vi.fn(() => false),
  deleteInvoicePdf: vi.fn(async () => {}),
  getDefaultSeller: vi.fn(() => ({ name: 'Test Seller' })),
}));

import { createTestApp } from '../../../test/app.js';
import invoicesRouter from '../invoices.js';

const app = createTestApp(invoicesRouter, '/api/v1/invoices');

describe('V1 Invoices API', () => {
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

  describe('GET /api/v1/invoices', () => {
    it('returns paginated response with success envelope', async () => {
      const res = await request(app).get('/api/v1/invoices?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('total', 0);
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('returns invoices with items', async () => {
      insertTestInvoice(testDb, { status: 'draft' });
      insertTestInvoice(testDb, { status: 'sent' });

      const res = await request(app).get('/api/v1/invoices');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('items');
      expect(res.body.meta.total).toBe(2);
    });

    it('filters by status', async () => {
      insertTestInvoice(testDb, { status: 'draft' });
      insertTestInvoice(testDb, { status: 'sent' });
      insertTestInvoice(testDb, { status: 'paid' });

      const res = await request(app).get('/api/v1/invoices?status=draft');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('draft');
    });

    it('paginates correctly', async () => {
      // Insert 5 invoices
      for (let i = 0; i < 5; i++) {
        insertTestInvoice(testDb, { invoice_number: `RE-2024-${String(i + 1).padStart(3, '0')}` });
      }

      const res = await request(app).get('/api/v1/invoices?page=2&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.totalPages).toBe(3);
    });

    it('defaults to page 1 limit 20', async () => {
      const res = await request(app).get('/api/v1/invoices');
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(20);
    });
  });

  // ========== GET BY ID ==========

  describe('GET /api/v1/invoices/:id', () => {
    it('returns invoice with items', async () => {
      const id = insertTestInvoice(testDb, { status: 'draft' });

      const res = await request(app).get(`/api/v1/invoices/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await request(app).get('/api/v1/invoices/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ========== CREATE ==========

  describe('POST /api/v1/invoices', () => {
    it('creates invoice with items', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          invoice_date: '2024-06-01',
          due_date: '2024-06-15',
          vat_rate: 19,
          items: [
            { description: 'Web Dev', quantity: 10, unit_price: 100 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('invoice_number');
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.subtotal).toBe(1000);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('rejects creation without items', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({ invoice_date: '2024-06-01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ========== UPDATE ==========

  describe('PATCH /api/v1/invoices/:id', () => {
    it('updates draft invoice', async () => {
      const id = insertTestInvoice(testDb, { status: 'draft', notes: 'old' });

      const res = await request(app)
        .patch(`/api/v1/invoices/${id}`)
        .send({ notes: 'updated notes' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe('updated notes');
    });

    it('rejects update of non-draft invoice', async () => {
      const id = insertTestInvoice(testDb, { status: 'sent' });

      const res = await request(app)
        .patch(`/api/v1/invoices/${id}`)
        .send({ notes: 'try update' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/invoices/nonexistent')
        .send({ notes: 'nope' });
      expect(res.status).toBe(404);
    });
  });

  // ========== DELETE ==========

  describe('DELETE /api/v1/invoices/:id', () => {
    it('deletes invoice', async () => {
      const id = insertTestInvoice(testDb);

      const res = await request(app).delete(`/api/v1/invoices/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ id, deleted: true });

      // Verify it's gone
      const check = await request(app).get(`/api/v1/invoices/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/v1/invoices/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
