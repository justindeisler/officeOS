/**
 * Public REST API v1 — Invoices
 *
 * Clean, versioned CRUD endpoints wrapping existing business logic.
 * No auth yet (Sprint 7).
 */

import { Router, type Request, type Response } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import { paginate } from '../../utils/pagination.js';
import { NotFoundError, ValidationError, AppError } from '../../errors.js';
import {
  generateInvoicePdf,
  getInvoicePdfPath,
  invoicePdfExists,
  deleteInvoicePdf,
  type InvoiceData,
  type ClientInfo,
  getDefaultSeller,
} from '../../services/pdfService.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  client_id: string | null;
  project_id: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  pdf_path: string | null;
  created_at: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  vat_rate: number | null;
  vat_amount: number | null;
  net_amount: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getInvoiceItems(db: ReturnType<typeof getDb>, invoiceId: string): InvoiceItemRow[] {
  return db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as InvoiceItemRow[];
}

function getNextInvoiceNumber(db: ReturnType<typeof getDb>): string {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;
  const result = db.prepare(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`
  ).get(`${prefix}%`) as { invoice_number: string } | undefined;
  if (!result) return `${prefix}001`;
  const lastSequence = parseInt(result.invoice_number.replace(prefix, ''), 10);
  return `${prefix}${String(lastSequence + 1).padStart(3, '0')}`;
}

async function generateAndSavePdf(db: ReturnType<typeof getDb>, invoiceId: string): Promise<string | null> {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined;
  if (!row) return null;
  const items = getInvoiceItems(db, invoiceId);
  const client = row.client_id
    ? db.prepare('SELECT * FROM clients WHERE id = ?').get(row.client_id) as any
    : undefined;

  try {
    const invoiceData: InvoiceData = {
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceDate: new Date(row.invoice_date),
      dueDate: new Date(row.due_date),
      status: row.status as InvoiceData['status'],
      client: {
        name: client?.name || 'Unknown Client',
        company: client?.company || undefined,
        email: client?.email || undefined,
      },
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        amount: item.amount,
      })),
      subtotal: row.subtotal,
      vatRate: row.vat_rate,
      vatAmount: row.vat_amount,
      total: row.total,
      notes: row.notes || undefined,
    };

    const pdfPath = await generateInvoicePdf(invoiceData);
    db.prepare('UPDATE invoices SET pdf_path = ? WHERE id = ?').run(pdfPath, invoiceId);
    return pdfPath;
  } catch {
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/invoices — List all invoices (paginated)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { page, limit, status, client_id } = req.query;

  let sql = 'SELECT * FROM invoices WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (client_id) {
    sql += ' AND client_id = ?';
    params.push(client_id);
  }

  sql += ' ORDER BY invoice_date DESC';

  const invoices = db.prepare(sql).all(...params) as InvoiceRow[];

  // Include items
  const withItems = invoices.map(inv => ({
    ...inv,
    items: getInvoiceItems(db, inv.id),
  }));

  const result = paginate(withItems, { page: page as string, limit: limit as string });
  sendSuccess(res, result.items, 200, result.meta);
}));

/**
 * GET /api/v1/invoices/:id — Get single invoice
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as InvoiceRow | undefined;

  if (!invoice) {
    return sendError(res, 'Invoice not found', 'NOT_FOUND', 404);
  }

  const items = getInvoiceItems(db, invoice.id);
  sendSuccess(res, { ...invoice, items });
}));

/**
 * POST /api/v1/invoices — Create invoice
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { client_id, project_id, invoice_date, due_date, vat_rate = 19, notes, items = [] } = req.body;

  if (!items || items.length === 0) {
    return sendError(res, 'At least one line item is required', 'VALIDATION_ERROR', 400);
  }

  const id = generateId();
  const invoiceNumber = getNextInvoiceNumber(db);
  const now = getCurrentTimestamp();

  // Calculate totals
  let subtotal = 0;
  let totalVatAmount = 0;
  for (const item of items) {
    if (!item.description || !item.quantity || !item.unit_price) {
      return sendError(res, 'Each item requires description, quantity, and unit_price', 'VALIDATION_ERROR', 400);
    }
    const itemAmount = Math.round(item.quantity * item.unit_price * 100) / 100;
    const itemVatRate = item.vat_rate ?? vat_rate;
    const itemVat = Math.round(itemAmount * (itemVatRate / 100) * 100) / 100;
    subtotal += itemAmount;
    totalVatAmount += itemVat;
  }
  const total = Math.round((subtotal + totalVatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO invoices (id, invoice_number, invoice_date, due_date, status, client_id, project_id,
     subtotal, vat_rate, vat_amount, total, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, invoiceNumber,
    invoice_date || new Date().toISOString().split('T')[0],
    due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    'draft', client_id || null, project_id || null,
    subtotal, vat_rate, totalVatAmount, total, notes || null, now
  );

  // Insert items
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount, vat_rate, vat_amount, net_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of items) {
    const itemAmount = Math.round(item.quantity * item.unit_price * 100) / 100;
    const itemVatRate = item.vat_rate ?? vat_rate;
    const itemVat = Math.round(itemAmount * (itemVatRate / 100) * 100) / 100;
    insertItem.run(generateId(), id, item.description, item.quantity, item.unit || 'hours', item.unit_price, itemAmount, itemVatRate, itemVat, itemAmount);
  }

  const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow;
  const createdItems = getInvoiceItems(db, id);
  sendSuccess(res, { ...created, items: createdItems }, 201);
}));

/**
 * PATCH /api/v1/invoices/:id — Update invoice
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
  if (!existing) {
    return sendError(res, 'Invoice not found', 'NOT_FOUND', 404);
  }
  if (existing.status !== 'draft') {
    return sendError(res, 'Can only update draft invoices', 'VALIDATION_ERROR', 400);
  }

  const fields = ['client_id', 'project_id', 'invoice_date', 'due_date', 'vat_rate', 'notes'];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (req.body.items && req.body.items.length > 0) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const vatRate = req.body.vat_rate ?? existing.vat_rate;
    let subtotal = 0;
    for (const item of req.body.items) {
      const itemAmount = Math.round(item.quantity * item.unit_price * 100) / 100;
      subtotal += itemAmount;
      insertItem.run(generateId(), id, item.description, item.quantity, item.unit || 'hours', item.unit_price, itemAmount);
    }
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;
    updates.push('subtotal = ?', 'vat_amount = ?', 'total = ?');
    params.push(subtotal, vatAmount, total);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow;
  const items = getInvoiceItems(db, id);
  sendSuccess(res, { ...updated, items });
}));

/**
 * DELETE /api/v1/invoices/:id — Delete invoice
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
  if (!existing) {
    return sendError(res, 'Invoice not found', 'NOT_FOUND', 404);
  }

  // Clean up items and linked records
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
  db.prepare('UPDATE income SET invoice_id = NULL WHERE invoice_id = ?').run(id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

  sendSuccess(res, { id, deleted: true });
}));

/**
 * GET /api/v1/invoices/:id/pdf — Download invoice PDF
 */
router.get('/:id/pdf', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
  if (!invoice) {
    return sendError(res, 'Invoice not found', 'NOT_FOUND', 404);
  }

  let pdfPath = invoice.pdf_path;
  if (!pdfPath || !invoicePdfExists(pdfPath)) {
    pdfPath = await generateAndSavePdf(db, id);
    if (!pdfPath) {
      return sendError(res, 'Failed to generate PDF', 'PDF_GENERATION_FAILED', 500);
    }
  }

  const fullPath = getInvoicePdfPath(pdfPath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
  res.sendFile(fullPath);
}));

export default router;
