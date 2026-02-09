/**
 * Invoices API Route Tests
 *
 * Tests invoice CRUD, status transitions, VAT calculations,
 * PDF generation, and auto-income creation on payment.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestClient,
  insertTestInvoice,
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup: Mock database + pdfService before importing route
// ============================================================================

let testDb: Database.Database;

vi.mock('../database.js', () => {
  return {
    getDb: () => {
      if (!testDb) throw new Error('Test DB not initialized');
      return testDb;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
  };
});

// Mock PDF service - we don't want to actually generate PDFs in tests
vi.mock('../services/pdfService.js', () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue('/mock/path/invoice.pdf'),
  generateInvoicePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  getInvoicePdfPath: vi.fn((path: string) => `/full${path}`),
  invoicePdfExists: vi.fn().mockReturnValue(true),
  deleteInvoicePdf: vi.fn().mockResolvedValue(undefined),
  getDefaultSeller: vi.fn().mockReturnValue({
    name: 'Justin Deisler',
    company: 'JD Freelance',
    address: { street: 'Test Street 1', zip: '12345', city: 'Berlin', country: 'Germany' },
    taxId: 'DE123456789',
    bankAccount: { name: 'Justin Deisler', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
  }),
}));

import { createTestApp } from '../../test/app.js';
import invoicesRouter from '../invoices.js';
import request from 'supertest';

const app = createTestApp(invoicesRouter, '/api/invoices');

// ============================================================================
// Tests
// ============================================================================

describe('Invoices API', () => {
  beforeEach(() => {
    testDb = createTestDb();
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/invoices
  // ==========================================================================

  describe('GET /api/invoices', () => {
    it('returns empty array when no invoices exist', async () => {
      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns invoices with their items', async () => {
      insertTestInvoice(testDb, {}, [
        { description: 'Web Development', quantity: 10, unit_price: 100 },
        { description: 'Design', quantity: 5, unit_price: 80 },
      ]);

      const res = await request(app).get('/api/invoices');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].items).toHaveLength(2);
    });

    it('filters by status', async () => {
      insertTestInvoice(testDb, { status: 'draft', invoice_number: 'RE-2024-001' });
      insertTestInvoice(testDb, { status: 'sent', invoice_number: 'RE-2024-002' });
      insertTestInvoice(testDb, { status: 'paid', invoice_number: 'RE-2024-003' });

      const res = await request(app).get('/api/invoices').query({ status: 'draft' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('draft');
    });

    it('filters by client_id', async () => {
      const clientId = insertTestClient(testDb, { name: 'ACME Corp' });
      insertTestInvoice(testDb, { client_id: clientId, invoice_number: 'RE-2024-001' });
      insertTestInvoice(testDb, { invoice_number: 'RE-2024-002' }); // No client

      const res = await request(app).get('/api/invoices').query({ client_id: clientId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].client_id).toBe(clientId);
    });
  });

  // ==========================================================================
  // GET /api/invoices/:id
  // ==========================================================================

  describe('GET /api/invoices/:id', () => {
    it('returns invoice with items', async () => {
      const id = insertTestInvoice(testDb, { notes: 'Test notes' }, [
        { description: 'Consulting', quantity: 8, unit_price: 120 },
      ]);

      const res = await request(app).get(`/api/invoices/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.notes).toBe('Test notes');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].description).toBe('Consulting');
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await request(app).get('/api/invoices/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/invoices - Invoice Creation & VAT Calculation
  // ==========================================================================

  describe('POST /api/invoices', () => {
    it('creates an invoice with correct totals at 19% VAT', async () => {
      const res = await request(app).post('/api/invoices').send({
        invoice_date: '2024-06-01',
        due_date: '2024-06-15',
        vat_rate: 19,
        items: [
          { description: 'Development', quantity: 40, unit_price: 100 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(4000); // 40 * 100
      expect(res.body.vat_rate).toBe(19);
      expect(res.body.vat_amount).toBe(760); // 4000 * 0.19
      expect(res.body.total).toBe(4760); // 4000 + 760
      expect(res.body.status).toBe('draft');
    });

    it('creates an invoice with multiple items', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [
          { description: 'Development', quantity: 20, unit_price: 100 },
          { description: 'Design', quantity: 10, unit_price: 80 },
          { description: 'Project Management', quantity: 5, unit_price: 90 },
        ],
      });

      expect(res.status).toBe(201);
      // 20*100 + 10*80 + 5*90 = 2000 + 800 + 450 = 3250
      expect(res.body.subtotal).toBe(3250);
      const expectedVat = Math.round(3250 * 0.19 * 100) / 100; // 617.50
      expect(res.body.vat_amount).toBeCloseTo(expectedVat, 2);
      expect(res.body.total).toBeCloseTo(3250 + expectedVat, 2);
      expect(res.body.items).toHaveLength(3);
    });

    it('generates an invoice number automatically', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [{ description: 'Test', quantity: 1, unit_price: 100 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.invoice_number).toMatch(/^RE-\d{4}-\d{3}$/);
    });

    it('increments invoice numbers correctly', async () => {
      // Create first invoice
      const res1 = await request(app).post('/api/invoices').send({
        items: [{ description: 'First', quantity: 1, unit_price: 100 }],
      });

      // Create second invoice
      const res2 = await request(app).post('/api/invoices').send({
        items: [{ description: 'Second', quantity: 1, unit_price: 200 }],
      });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Second invoice number should be higher
      const num1 = parseInt(res1.body.invoice_number.split('-').pop()!, 10);
      const num2 = parseInt(res2.body.invoice_number.split('-').pop()!, 10);
      expect(num2).toBe(num1 + 1);
    });

    it('associates invoice with a client', async () => {
      const clientId = insertTestClient(testDb, { name: 'Acme Corp' });

      const res = await request(app).post('/api/invoices').send({
        client_id: clientId,
        items: [{ description: 'Consulting', quantity: 5, unit_price: 150 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.client_id).toBe(clientId);
    });

    it('rejects invoice without items', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [],
      });
      expect(res.status).toBe(400);
    });

    it('handles fractional quantities and prices', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [
          { description: 'Partial hour', quantity: 0.5, unit_price: 100 },
          { description: 'Fractional price', quantity: 1, unit_price: 99.99 },
        ],
      });

      expect(res.status).toBe(201);
      // 0.5 * 100 + 1 * 99.99 = 50 + 99.99 = 149.99
      expect(res.body.subtotal).toBeCloseTo(149.99, 2);
    });

    it('uses default dates when not provided', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [{ description: 'Test', quantity: 1, unit_price: 100 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.invoice_date).toBeDefined();
      expect(res.body.due_date).toBeDefined();
    });
  });

  // ==========================================================================
  // PATCH /api/invoices/:id
  // ==========================================================================

  describe('PATCH /api/invoices/:id', () => {
    it('updates a draft invoice', async () => {
      const id = insertTestInvoice(testDb, { status: 'draft' });

      const res = await request(app).patch(`/api/invoices/${id}`).send({
        notes: 'Updated notes',
      });

      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Updated notes');
    });

    it('rejects updates to non-draft invoices', async () => {
      const id = insertTestInvoice(testDb, { status: 'sent' });

      const res = await request(app).patch(`/api/invoices/${id}`).send({
        notes: 'Trying to update',
      });

      expect(res.status).toBe(400);
    });

    it('recalculates totals when items are updated', async () => {
      const id = insertTestInvoice(testDb, { status: 'draft' }, [
        { description: 'Old Item', quantity: 10, unit_price: 100 },
      ]);

      const res = await request(app).patch(`/api/invoices/${id}`).send({
        items: [
          { description: 'New Item', quantity: 20, unit_price: 150 },
        ],
      });

      expect(res.status).toBe(200);
      // New subtotal: 20 * 150 = 3000
      expect(res.body.subtotal).toBe(3000);
      expect(res.body.vat_amount).toBeCloseTo(570, 2); // 3000 * 0.19
      expect(res.body.total).toBeCloseTo(3570, 2);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].description).toBe('New Item');
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await request(app).patch('/api/invoices/nonexistent').send({
        notes: 'test',
      });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/invoices/:id
  // ==========================================================================

  describe('DELETE /api/invoices/:id', () => {
    it('deletes an invoice and its items', async () => {
      const id = insertTestInvoice(testDb, {}, [
        { description: 'Item 1', quantity: 1, unit_price: 100 },
        { description: 'Item 2', quantity: 2, unit_price: 200 },
      ]);

      const res = await request(app).delete(`/api/invoices/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify invoice is gone
      const check = await request(app).get(`/api/invoices/${id}`);
      expect(check.status).toBe(404);

      // Verify items are also gone (check DB directly)
      const items = testDb.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
      expect(items).toHaveLength(0);
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await request(app).delete('/api/invoices/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Status Transitions
  // ==========================================================================

  describe('Status Transitions', () => {
    describe('POST /api/invoices/:id/send', () => {
      it('marks a draft invoice as sent', async () => {
        const id = insertTestInvoice(testDb, { status: 'draft' });

        const res = await request(app).post(`/api/invoices/${id}/send`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('sent');
      });

      it('rejects sending a non-draft invoice', async () => {
        const id = insertTestInvoice(testDb, { status: 'sent' });

        const res = await request(app).post(`/api/invoices/${id}/send`);
        expect(res.status).toBe(400);
      });

      it('returns 404 for non-existent invoice', async () => {
        const res = await request(app).post('/api/invoices/nonexistent/send');
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/invoices/:id/pay', () => {
      it('marks a sent invoice as paid and creates income record', async () => {
        const clientId = insertTestClient(testDb);
        const id = insertTestInvoice(testDb, {
          status: 'sent',
          client_id: clientId,
          subtotal: 1000,
          vat_rate: 19,
          vat_amount: 190,
          total: 1190,
        });

        const res = await request(app).post(`/api/invoices/${id}/pay`).send({
          payment_date: '2024-02-15',
          payment_method: 'bank_transfer',
        });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paid');
        expect(res.body.payment_date).toBe('2024-02-15');
        expect(res.body.payment_method).toBe('bank_transfer');

        // Verify income record was created
        const incomes = testDb.prepare('SELECT * FROM income WHERE invoice_id = ?').all(id) as Array<{
          net_amount: number;
          vat_rate: number;
          vat_amount: number;
          gross_amount: number;
          client_id: string | null;
          euer_line: number;
        }>;
        expect(incomes).toHaveLength(1);
        expect(incomes[0].net_amount).toBe(1000);
        expect(incomes[0].vat_amount).toBe(190);
        expect(incomes[0].gross_amount).toBe(1190);
        expect(incomes[0].client_id).toBe(clientId);
        expect(incomes[0].euer_line).toBe(14); // Default EÜR line for services
      });

      it('does not create duplicate income records', async () => {
        const id = insertTestInvoice(testDb, { status: 'sent' });

        // Pay the first time
        await request(app).post(`/api/invoices/${id}/pay`).send({});

        // Try to pay again (should fail because status is now 'paid')
        const res = await request(app).post(`/api/invoices/${id}/pay`).send({});
        expect(res.status).toBe(400); // Already paid

        // Only one income record should exist
        const incomes = testDb.prepare('SELECT * FROM income WHERE invoice_id = ?').all(id);
        expect(incomes).toHaveLength(1);
      });

      it('rejects paying a cancelled invoice', async () => {
        const id = insertTestInvoice(testDb, { status: 'cancelled' });

        const res = await request(app).post(`/api/invoices/${id}/pay`).send({});
        expect(res.status).toBe(400);
      });

      it('uses current date if payment_date not provided', async () => {
        const id = insertTestInvoice(testDb, { status: 'sent' });

        const res = await request(app).post(`/api/invoices/${id}/pay`).send({});
        expect(res.status).toBe(200);
        expect(res.body.payment_date).toBeDefined();
      });
    });

    describe('POST /api/invoices/:id/cancel', () => {
      it('cancels a draft invoice', async () => {
        const id = insertTestInvoice(testDb, { status: 'draft' });

        const res = await request(app).post(`/api/invoices/${id}/cancel`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('cancelled');
      });

      it('cancels a sent invoice', async () => {
        const id = insertTestInvoice(testDb, { status: 'sent' });

        const res = await request(app).post(`/api/invoices/${id}/cancel`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('cancelled');
      });

      it('rejects cancelling a paid invoice', async () => {
        const id = insertTestInvoice(testDb, { status: 'paid' });

        const res = await request(app).post(`/api/invoices/${id}/cancel`);
        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================================================
  // Invoice Total Calculations (Financial Accuracy)
  // ==========================================================================

  describe('Invoice Total Calculations', () => {
    it('correctly calculates for a single high-value item', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [{ description: 'Big project', quantity: 160, unit_price: 120 }],
        vat_rate: 19,
      });

      expect(res.status).toBe(201);
      // 160 * 120 = 19200
      expect(res.body.subtotal).toBe(19200);
      expect(res.body.vat_amount).toBe(3648); // 19200 * 0.19
      expect(res.body.total).toBe(22848); // 19200 + 3648
    });

    it('correctly handles 7% VAT rate', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [{ description: 'Design work', quantity: 10, unit_price: 80 }],
        vat_rate: 7,
      });

      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(800);
      expect(res.body.vat_amount).toBe(56); // 800 * 0.07
      expect(res.body.total).toBe(856);
    });

    it('correctly handles 0% VAT (Kleinunternehmer or intra-EU)', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [{ description: 'EU service', quantity: 20, unit_price: 100 }],
        vat_rate: 0,
      });

      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(2000);
      expect(res.body.vat_amount).toBe(0);
      expect(res.body.total).toBe(2000);
    });

    it('each item amount matches quantity * unit_price', async () => {
      const res = await request(app).post('/api/invoices').send({
        items: [
          { description: 'Item A', quantity: 3.5, unit_price: 99.99 },
          { description: 'Item B', quantity: 1, unit_price: 0.01 },
        ],
      });

      expect(res.status).toBe(201);
      const items = res.body.items;
      expect(items[0].amount).toBeCloseTo(3.5 * 99.99, 2);
      expect(items[1].amount).toBeCloseTo(0.01, 2);
    });
  });

  // ==========================================================================
  // GET /api/invoices/config/seller
  // ==========================================================================

  describe('GET /api/invoices/config/seller', () => {
    it('returns seller configuration', async () => {
      const res = await request(app).get('/api/invoices/config/seller');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('company');
      expect(res.body).toHaveProperty('taxId');
      expect(res.body).toHaveProperty('bankAccount');
    });
  });
});
