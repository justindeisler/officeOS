/**
 * Recurring Invoices API Routes
 *
 * CRUD for recurring invoice templates and generation logic.
 */

import { Router } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateRecurringInvoiceSchema, UpdateRecurringInvoiceSchema } from '../schemas/banking.js';
import { createLogger } from '../logger.js';

const router = Router();
const log = createLogger('recurring-invoices');

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the next invoice number (same logic as invoices route)
 */
function getNextInvoiceNumber(db: ReturnType<typeof getDb>): string {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;

  const result = db.prepare(
    `SELECT invoice_number FROM invoices
     WHERE invoice_number LIKE ?
     ORDER BY invoice_number DESC
     LIMIT 1`
  ).get(`${prefix}%`) as { invoice_number: string } | undefined;

  if (!result) return `${prefix}001`;

  const lastSequence = parseInt(result.invoice_number.replace(prefix, ''), 10);
  return `${prefix}${String(lastSequence + 1).padStart(3, '0')}`;
}

/**
 * Calculate the next date based on frequency.
 */
function calculateNextDate(currentDate: string, frequency: string): string {
  const [year, month, day] = currentDate.split('-').map(Number);
  let newYear = year;
  let newMonth = month;

  switch (frequency) {
    case 'monthly':
      newMonth += 1;
      break;
    case 'quarterly':
      newMonth += 3;
      break;
    case 'yearly':
      newYear += 1;
      break;
    default:
      newMonth += 1;
  }

  // Handle month overflow
  while (newMonth > 12) {
    newMonth -= 12;
    newYear += 1;
  }

  // Clamp day to max days in new month
  const maxDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(day, maxDay);

  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
}

/**
 * Generate an invoice from a recurring template.
 */
function generateInvoiceFromTemplate(
  db: ReturnType<typeof getDb>,
  template: {
    id: string;
    client_id: string | null;
    project_id: string | null;
    vat_rate: number;
    notes: string | null;
    payment_terms_days: number;
    items_json: string;
    auto_send: number;
    frequency: string;
    next_date: string;
  }
): string {
  const invoiceId = generateId();
  const now = getCurrentTimestamp();
  const invoiceNumber = getNextInvoiceNumber(db);
  const invoiceDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + template.payment_terms_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const items = JSON.parse(template.items_json) as Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    vat_rate?: number;
  }>;

  // Calculate totals (support multi-VAT)
  let subtotal = 0;
  let totalVat = 0;

  for (const item of items) {
    const itemAmount = Math.round(item.quantity * item.unit_price * 100) / 100;
    const itemVatRate = item.vat_rate ?? template.vat_rate;
    const itemVat = Math.round(itemAmount * (itemVatRate / 100) * 100) / 100;
    subtotal += itemAmount;
    totalVat += itemVat;
  }

  const total = Math.round((subtotal + totalVat) * 100) / 100;

  // Insert invoice
  db.prepare(
    `INSERT INTO invoices (
      id, invoice_number, invoice_date, due_date, status, client_id, project_id,
      subtotal, vat_rate, vat_amount, total, notes, recurring_invoice_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    invoiceId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    template.auto_send ? 'sent' : 'draft',
    template.client_id || null,
    template.project_id || null,
    subtotal,
    template.vat_rate,
    totalVat,
    total,
    template.notes || null,
    template.id,
    now
  );

  // Insert invoice items
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount, vat_rate, vat_amount, net_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const item of items) {
    const itemAmount = Math.round(item.quantity * item.unit_price * 100) / 100;
    const itemVatRate = item.vat_rate ?? template.vat_rate;
    const itemVat = Math.round(itemAmount * (itemVatRate / 100) * 100) / 100;
    insertItem.run(
      generateId(),
      invoiceId,
      item.description,
      item.quantity,
      item.unit || 'hours',
      item.unit_price,
      itemAmount,
      itemVatRate,
      itemVat,
      itemAmount
    );
  }

  // Update template: advance next_date, increment count
  const nextDate = calculateNextDate(template.next_date, template.frequency);
  db.prepare(
    `UPDATE recurring_invoices 
     SET next_date = ?, last_generated_at = datetime('now'), generated_count = generated_count + 1, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextDate, template.id);

  log.info({ templateId: template.id, invoiceId, invoiceNumber }, 'Generated recurring invoice');
  return invoiceId;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/invoices/recurring - List all recurring invoice templates
 */
router.get('/', asyncHandler(async (_req, res) => {
  const db = getDb();
  const templates = db.prepare(
    'SELECT * FROM recurring_invoices ORDER BY next_date ASC'
  ).all();
  res.json(templates);
}));

/**
 * GET /api/invoices/recurring/:id - Get a single template
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(req.params.id);
  if (!template) throw new NotFoundError('Recurring invoice template', req.params.id);
  res.json(template);
}));

/**
 * POST /api/invoices/recurring - Create a new recurring invoice template
 */
router.post('/', validateBody(CreateRecurringInvoiceSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const id = generateId();
  const now = getCurrentTimestamp();

  const itemsJson = JSON.stringify(req.body.items);

  db.prepare(
    `INSERT INTO recurring_invoices (
      id, name, client_id, project_id, frequency, next_date, end_date,
      vat_rate, notes, payment_terms_days, items_json,
      auto_send, auto_generate, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.body.name,
    req.body.client_id || null,
    req.body.project_id || null,
    req.body.frequency || 'monthly',
    req.body.next_date,
    req.body.end_date || null,
    req.body.vat_rate ?? 19,
    req.body.notes || null,
    req.body.payment_terms_days ?? 14,
    itemsJson,
    req.body.auto_send ?? 0,
    req.body.auto_generate ?? 1,
    now, now
  );

  const template = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(id);
  res.status(201).json(template);
}));

/**
 * PATCH /api/invoices/recurring/:id - Update a recurring invoice template
 */
router.patch('/:id', validateBody(UpdateRecurringInvoiceSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Recurring invoice template', id);

  const fields = [
    'name', 'client_id', 'project_id', 'frequency', 'next_date', 'end_date',
    'vat_rate', 'notes', 'payment_terms_days', 'auto_send', 'auto_generate', 'is_active',
  ];

  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // Handle items separately (serialize to JSON)
  if (req.body.items) {
    updates.push('items_json = ?');
    params.push(JSON.stringify(req.body.items));
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE recurring_invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const template = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(id);
  res.json(template);
}));

/**
 * DELETE /api/invoices/recurring/:id - Delete a recurring invoice template
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Recurring invoice template', id);

  db.prepare('DELETE FROM recurring_invoices WHERE id = ?').run(id);
  res.json({ success: true, message: 'Recurring invoice template deleted' });
}));

/**
 * POST /api/invoices/recurring/:id/generate - Manually generate an invoice from template
 */
router.post('/:id/generate', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const template = db.prepare('SELECT * FROM recurring_invoices WHERE id = ?').get(id) as {
    id: string; client_id: string | null; project_id: string | null;
    vat_rate: number; notes: string | null; payment_terms_days: number;
    items_json: string; auto_send: number; frequency: string; next_date: string;
  } | undefined;

  if (!template) throw new NotFoundError('Recurring invoice template', id);

  const invoiceId = generateInvoiceFromTemplate(db, template);

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as Record<string, unknown>;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);

  res.status(201).json({ ...invoice, items });
}));

/**
 * POST /api/invoices/recurring/process - Process all due recurring invoices (cron job endpoint)
 */
router.post('/process', asyncHandler(async (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const dueTemplates = db.prepare(
    `SELECT * FROM recurring_invoices 
     WHERE is_active = 1 AND auto_generate = 1 AND next_date <= ?
     AND (end_date IS NULL OR end_date >= ?)`
  ).all(today, today) as Array<{
    id: string; client_id: string | null; project_id: string | null;
    vat_rate: number; notes: string | null; payment_terms_days: number;
    items_json: string; auto_send: number; frequency: string; next_date: string;
  }>;

  const results: Array<{ template_id: string; invoice_id: string; invoice_number: string }> = [];

  for (const template of dueTemplates) {
    try {
      const invoiceId = generateInvoiceFromTemplate(db, template);
      const invoice = db.prepare('SELECT invoice_number FROM invoices WHERE id = ?').get(invoiceId) as { invoice_number: string };
      results.push({
        template_id: template.id,
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
      });
    } catch (error) {
      log.error({ err: error, templateId: template.id }, 'Failed to generate recurring invoice');
    }
  }

  log.info({ processed: dueTemplates.length, generated: results.length }, 'Recurring invoice processing complete');

  res.json({
    processed: dueTemplates.length,
    generated: results.length,
    results,
  });
}));

export default router;
