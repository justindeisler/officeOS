/**
 * Dunning (Mahnwesen) API Routes
 *
 * Payment reminders and escalation for overdue invoices.
 */

import { Router } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateDunningEntrySchema } from '../schemas/banking.js';
import { createLogger } from '../logger.js';

const router = Router();
const log = createLogger('dunning');

// ============================================================================
// Types
// ============================================================================

interface DunningEntry {
  id: string;
  invoice_id: string;
  level: number;
  sent_date: string | null;
  due_date: string | null;
  fee: number;
  interest_rate: number;
  interest_amount: number;
  notes: string | null;
  delivery_method: string;
  status: string;
  pdf_path: string | null;
  created_at: string;
}

// German dunning templates
const DUNNING_TEMPLATES: Record<number, { subject: string; body: string }> = {
  1: {
    subject: 'Zahlungserinnerung – Rechnung {invoice_number}',
    body: `Sehr geehrte Damen und Herren,

bei Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die folgende Rechnung noch nicht beglichen wurde:

Rechnung: {invoice_number}
Rechnungsdatum: {invoice_date}
Fälligkeitsdatum: {due_date}
Betrag: {total}€

Wir bitten Sie, den offenen Betrag innerhalb von 7 Tagen zu überweisen. Sollte sich diese Erinnerung mit Ihrer Zahlung überschneiden, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Mit freundlichen Grüßen`,
  },
  2: {
    subject: '1. Mahnung – Rechnung {invoice_number}',
    body: `Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung vom {last_reminder_date} konnten wir leider keinen Zahlungseingang für die folgende Rechnung verzeichnen:

Rechnung: {invoice_number}
Rechnungsdatum: {invoice_date}
Fälligkeitsdatum: {due_date}
Offener Betrag: {total}€
{fee_text}

Wir bitten Sie dringend, den offenen Betrag innerhalb von 10 Tagen zu begleichen.

Mit freundlichen Grüßen`,
  },
  3: {
    subject: '2. Mahnung – Rechnung {invoice_number} – Letzte Aufforderung',
    body: `Sehr geehrte Damen und Herren,

trotz wiederholter Zahlungsaufforderungen ist die folgende Rechnung weiterhin offen:

Rechnung: {invoice_number}
Rechnungsdatum: {invoice_date}
Fälligkeitsdatum: {due_date}
Offener Betrag: {total}€
{fee_text}
{interest_text}

Wir fordern Sie hiermit letztmalig auf, den gesamten ausstehenden Betrag innerhalb von 7 Tagen zu begleichen. Sollte bis dahin kein Zahlungseingang erfolgen, sehen wir uns gezwungen, rechtliche Schritte einzuleiten.

Mit freundlichen Grüßen`,
  },
};

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/dunning - List all dunning entries, optionally filtered by invoice
 */
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const { invoice_id } = req.query;

  let sql = `SELECT d.*, i.invoice_number, i.total as invoice_total, i.due_date as invoice_due_date
             FROM dunning_entries d
             JOIN invoices i ON d.invoice_id = i.id
             WHERE 1=1`;
  const params: unknown[] = [];

  if (invoice_id) {
    sql += ' AND d.invoice_id = ?';
    params.push(invoice_id);
  }

  sql += ' ORDER BY d.created_at DESC';

  const entries = db.prepare(sql).all(...params);
  res.json(entries);
}));

/**
 * GET /api/dunning/overdue - Get all overdue invoices with dunning status
 */
router.get('/overdue', asyncHandler(async (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const overdueInvoices = db.prepare(
    `SELECT i.*, c.name as client_name, c.email as client_email,
            (SELECT COUNT(*) FROM dunning_entries WHERE invoice_id = i.id) as dunning_count,
            (SELECT MAX(level) FROM dunning_entries WHERE invoice_id = i.id) as max_dunning_level
     FROM invoices i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE i.status IN ('sent', 'overdue') AND i.due_date < ?
     ORDER BY i.due_date ASC`
  ).all(today);

  // Auto-update overdue status
  db.prepare(
    `UPDATE invoices SET status = 'overdue' WHERE status = 'sent' AND due_date < ?`
  ).run(today);

  res.json(overdueInvoices);
}));

/**
 * POST /api/dunning - Create a dunning entry (send reminder)
 */
router.post('/', validateBody(CreateDunningEntrySchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { invoice_id, level, due_date, fee, interest_rate, notes, delivery_method } = req.body;

  // Validate invoice exists and is overdue/sent
  const invoice = db.prepare(
    'SELECT * FROM invoices WHERE id = ?'
  ).get(invoice_id) as {
    id: string; invoice_number: string; status: string; total: number;
    due_date: string; dunning_level: number;
  } | undefined;

  if (!invoice) throw new NotFoundError('Invoice', invoice_id);
  if (invoice.status === 'paid') throw new ValidationError('Invoice is already paid');
  if (invoice.status === 'cancelled') throw new ValidationError('Invoice is cancelled');

  // Validate level progression
  const currentLevel = invoice.dunning_level || 0;
  const requestedLevel = level ?? (currentLevel + 1);
  if (requestedLevel <= currentLevel) {
    throw new ValidationError(`Invoice already at dunning level ${currentLevel}. Next level must be ${currentLevel + 1} or higher.`);
  }
  if (requestedLevel > 3) {
    throw new ValidationError('Maximum dunning level is 3');
  }

  // Calculate interest if applicable
  let interestAmount = 0;
  if (interest_rate && interest_rate > 0) {
    const overdueDays = Math.max(0, Math.ceil(
      (Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000)
    ));
    interestAmount = Math.round(invoice.total * (interest_rate / 100) * (overdueDays / 365) * 100) / 100;
  }

  const id = generateId();
  const newDueDate = due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.prepare(
    `INSERT INTO dunning_entries (id, invoice_id, level, due_date, fee, interest_rate, interest_amount, notes, delivery_method, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'))`
  ).run(
    id,
    invoice_id,
    requestedLevel,
    newDueDate,
    fee ?? 0,
    interest_rate ?? 0,
    interestAmount,
    notes || null,
    delivery_method || 'email'
  );

  // Update invoice dunning level
  db.prepare(
    `UPDATE invoices SET dunning_level = ?, last_reminded_at = datetime('now'), status = 'overdue' WHERE id = ?`
  ).run(requestedLevel, invoice_id);

  const entry = db.prepare(
    `SELECT d.*, i.invoice_number FROM dunning_entries d JOIN invoices i ON d.invoice_id = i.id WHERE d.id = ?`
  ).get(id);

  log.info({ entryId: id, invoiceId: invoice_id, level: requestedLevel }, 'Dunning entry created');
  res.status(201).json(entry);
}));

/**
 * POST /api/dunning/:id/send - Mark dunning entry as sent
 */
router.post('/:id/send', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const entry = db.prepare('SELECT * FROM dunning_entries WHERE id = ?').get(id) as DunningEntry | undefined;
  if (!entry) throw new NotFoundError('Dunning entry', id);

  db.prepare(
    `UPDATE dunning_entries SET status = 'sent', sent_date = ? WHERE id = ?`
  ).run(new Date().toISOString().split('T')[0], id);

  const updated = db.prepare(
    `SELECT d.*, i.invoice_number FROM dunning_entries d JOIN invoices i ON d.invoice_id = i.id WHERE d.id = ?`
  ).get(id);
  res.json(updated);
}));

/**
 * GET /api/dunning/templates - Get dunning letter templates
 */
router.get('/templates', asyncHandler(async (_req, res) => {
  res.json(DUNNING_TEMPLATES);
}));

/**
 * GET /api/dunning/templates/:level - Get dunning template for a specific level, rendered for an invoice
 */
router.get('/templates/:level', asyncHandler(async (req, res) => {
  const db = getDb();
  const level = parseInt(req.params.level);
  const invoiceId = req.query.invoice_id as string;

  const template = DUNNING_TEMPLATES[level];
  if (!template) throw new NotFoundError('Dunning template', String(level));

  if (!invoiceId) {
    return res.json(template);
  }

  // Render template with invoice data
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as {
    invoice_number: string; invoice_date: string; due_date: string; total: number; last_reminded_at: string | null;
  } | undefined;

  if (!invoice) throw new NotFoundError('Invoice', invoiceId);

  const rendered = {
    subject: renderTemplate(template.subject, invoice),
    body: renderTemplate(template.body, invoice),
  };

  res.json(rendered);
}));

function renderTemplate(template: string, invoice: {
  invoice_number: string; invoice_date: string; due_date: string;
  total: number; last_reminded_at: string | null;
}): string {
  return template
    .replace(/{invoice_number}/g, invoice.invoice_number)
    .replace(/{invoice_date}/g, formatDateDE(invoice.invoice_date))
    .replace(/{due_date}/g, formatDateDE(invoice.due_date))
    .replace(/{total}/g, invoice.total.toFixed(2))
    .replace(/{last_reminder_date}/g, invoice.last_reminded_at ? formatDateDE(invoice.last_reminded_at) : '')
    .replace(/{fee_text}/g, '')
    .replace(/{interest_text}/g, '');
}

function formatDateDE(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export default router;
