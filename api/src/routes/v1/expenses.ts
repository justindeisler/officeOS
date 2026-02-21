/**
 * Public REST API v1 — Expenses
 *
 * CRUD endpoints for expense records with pagination and consistent formatting.
 */

import { Router, type Request, type Response } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import { paginate } from '../../utils/pagination.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface ExpenseRow {
  id: string;
  date: string;
  vendor: string | null;
  description: string;
  category: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number | null;
  euer_category: string | null;
  payment_method: string | null;
  receipt_path: string | null;
  deductible_percent: number;
  created_at: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/expenses — List all expenses (paginated)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { page, limit, start_date, end_date, category, vendor } = req.query;

  let sql = 'SELECT * FROM expenses WHERE (is_deleted IS NULL OR is_deleted = 0)';
  const params: unknown[] = [];

  if (start_date) {
    sql += ' AND date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND date <= ?';
    params.push(end_date);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (vendor) {
    sql += ' AND vendor LIKE ?';
    params.push(`%${vendor}%`);
  }

  sql += ' ORDER BY date DESC';

  const records = db.prepare(sql).all(...params) as ExpenseRow[];
  const result = paginate(records, { page: page as string, limit: limit as string });
  sendSuccess(res, result.items, 200, result.meta);
}));

/**
 * GET /api/v1/expenses/:id — Get single expense
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const record = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)'
  ).get(req.params.id) as ExpenseRow | undefined;

  if (!record) {
    return sendError(res, 'Expense not found', 'NOT_FOUND', 404);
  }
  sendSuccess(res, record);
}));

/**
 * POST /api/v1/expenses — Create expense
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const {
    date, vendor, description, category, net_amount,
    vat_rate = 19, euer_line = 34, euer_category,
    payment_method, receipt_path, deductible_percent = 100,
  } = req.body;

  if (!date || !description || !category || net_amount === undefined) {
    return sendError(res, 'date, description, category, and net_amount are required', 'VALIDATION_ERROR', 400);
  }

  const id = generateId();
  const now = getCurrentTimestamp();
  const vatAmount = Math.round(net_amount * (vat_rate / 100) * 100) / 100;
  const grossAmount = Math.round((net_amount + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate,
     vat_amount, gross_amount, euer_line, euer_category, payment_method, receipt_path,
     deductible_percent, ust_reported, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id, date, vendor || null, description, category, net_amount, vat_rate,
    vatAmount, grossAmount, euer_line, euer_category || null,
    payment_method || null, receipt_path || null, deductible_percent, now
  );

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow;
  sendSuccess(res, created, 201);
}));

/**
 * PATCH /api/v1/expenses/:id — Update expense
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)'
  ).get(id) as ExpenseRow | undefined;

  if (!existing) {
    return sendError(res, 'Expense not found', 'NOT_FOUND', 404);
  }

  const fields = ['date', 'vendor', 'description', 'category', 'euer_line', 'euer_category',
    'payment_method', 'receipt_path', 'deductible_percent'];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // Recalculate VAT if amounts change
  if (req.body.net_amount !== undefined || req.body.vat_rate !== undefined) {
    const netAmount = req.body.net_amount ?? existing.net_amount;
    const vatRate = req.body.vat_rate ?? existing.vat_rate;
    const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;
    updates.push('net_amount = ?', 'vat_rate = ?', 'vat_amount = ?', 'gross_amount = ?');
    params.push(netAmount, vatRate, vatAmount, grossAmount);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow;
  sendSuccess(res, updated);
}));

/**
 * DELETE /api/v1/expenses/:id — Soft-delete expense
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)'
  ).get(id) as ExpenseRow | undefined;

  if (!existing) {
    return sendError(res, 'Expense not found', 'NOT_FOUND', 404);
  }

  db.prepare('UPDATE expenses SET is_deleted = 1 WHERE id = ?').run(id);
  sendSuccess(res, { id, deleted: true });
}));

export default router;
