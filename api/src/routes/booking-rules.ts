/**
 * Booking Rules API Routes
 *
 * CRUD for auto-booking rules and rule testing.
 */

import { Router } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../errors.js';
import { validateBody } from '../middleware/validateBody.js';
import { CreateBookingRuleSchema, UpdateBookingRuleSchema } from '../schemas/banking.js';
import type { BankTransaction } from '../services/bankingService.js';

const router = Router();

// ============================================================================
// Booking Rules CRUD
// ============================================================================

/**
 * GET /api/booking-rules - List all booking rules
 */
router.get('/', asyncHandler(async (_req, res) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM booking_rules ORDER BY priority ASC, created_at DESC').all();
  res.json(rules);
}));

/**
 * GET /api/booking-rules/:id - Get a single booking rule
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const rule = db.prepare('SELECT * FROM booking_rules WHERE id = ?').get(req.params.id);
  if (!rule) throw new NotFoundError('Booking rule', req.params.id);
  res.json(rule);
}));

/**
 * POST /api/booking-rules - Create a booking rule
 */
router.post('/', validateBody(CreateBookingRuleSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO booking_rules (
      id, name, description, priority, 
      condition_direction, condition_counterpart_pattern, condition_purpose_pattern,
      condition_amount_min, condition_amount_max, condition_iban_pattern,
      action_category, action_vat_rate, action_description_template, action_auto_confirm, action_match_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.body.name,
    req.body.description || null,
    req.body.priority ?? 100,
    req.body.condition_direction || null,
    req.body.condition_counterpart_pattern || null,
    req.body.condition_purpose_pattern || null,
    req.body.condition_amount_min ?? null,
    req.body.condition_amount_max ?? null,
    req.body.condition_iban_pattern || null,
    req.body.action_category || null,
    req.body.action_vat_rate ?? null,
    req.body.action_description_template || null,
    req.body.action_auto_confirm ?? 0,
    req.body.action_match_type || null,
    now, now
  );

  const rule = db.prepare('SELECT * FROM booking_rules WHERE id = ?').get(id);
  res.status(201).json(rule);
}));

/**
 * PATCH /api/booking-rules/:id - Update a booking rule
 */
router.patch('/:id', validateBody(UpdateBookingRuleSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM booking_rules WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Booking rule', id);

  const fields = [
    'name', 'description', 'priority', 'is_active',
    'condition_direction', 'condition_counterpart_pattern', 'condition_purpose_pattern',
    'condition_amount_min', 'condition_amount_max', 'condition_iban_pattern',
    'action_category', 'action_vat_rate', 'action_description_template', 'action_auto_confirm', 'action_match_type',
  ];

  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE booking_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const rule = db.prepare('SELECT * FROM booking_rules WHERE id = ?').get(id);
  res.json(rule);
}));

/**
 * DELETE /api/booking-rules/:id - Delete a booking rule
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM booking_rules WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError('Booking rule', id);

  db.prepare('DELETE FROM booking_rules WHERE id = ?').run(id);
  res.json({ success: true, message: 'Booking rule deleted' });
}));

/**
 * POST /api/booking-rules/test - Preview which transactions would match a rule
 */
router.post('/test', asyncHandler(async (req, res) => {
  const db = getDb();
  const rule = req.body.rule || req.body;

  // Get all unmatched transactions
  const transactions = db.prepare(
    `SELECT * FROM bank_transactions WHERE match_status = 'unmatched' AND is_duplicate = 0`
  ).all() as BankTransaction[];

  const matches: Array<{ id: string; counterpart_name: string | null; amount: number; booking_date: string; purpose: string | null }> = [];

  for (const tx of transactions) {
    if (evaluateRulePreview(rule, tx)) {
      matches.push({
        id: tx.id,
        counterpart_name: tx.counterpart_name,
        amount: tx.amount,
        booking_date: tx.booking_date,
        purpose: tx.purpose,
      });
    }
  }

  res.json({
    total_unmatched: transactions.length,
    would_match: matches.length,
    matches,
  });
}));

/**
 * GET /api/booking-rules/stats - Get rule match statistics
 */
router.get('/stats/overview', asyncHandler(async (_req, res) => {
  const db = getDb();

  const totalRules = (db.prepare('SELECT COUNT(*) as count FROM booking_rules').get() as { count: number }).count;
  const activeRules = (db.prepare('SELECT COUNT(*) as count FROM booking_rules WHERE is_active = 1').get() as { count: number }).count;
  const totalMatches = (db.prepare('SELECT SUM(match_count) as total FROM booking_rules').get() as { total: number | null }).total || 0;
  const topRules = db.prepare('SELECT id, name, match_count, last_matched_at FROM booking_rules WHERE match_count > 0 ORDER BY match_count DESC LIMIT 10').all();

  res.json({
    total_rules: totalRules,
    active_rules: activeRules,
    total_matches: totalMatches,
    top_rules: topRules,
  });
}));

/**
 * Preview rule evaluation without persisting.
 */
function evaluateRulePreview(
  rule: {
    condition_direction?: string | null;
    condition_counterpart_pattern?: string | null;
    condition_purpose_pattern?: string | null;
    condition_amount_min?: number | null;
    condition_amount_max?: number | null;
    condition_iban_pattern?: string | null;
  },
  tx: BankTransaction
): boolean {
  if (rule.condition_direction) {
    if (rule.condition_direction === 'credit' && tx.amount <= 0) return false;
    if (rule.condition_direction === 'debit' && tx.amount >= 0) return false;
  }
  if (rule.condition_counterpart_pattern) {
    if (!tx.counterpart_name) return false;
    if (!tx.counterpart_name.toLowerCase().includes(rule.condition_counterpart_pattern.toLowerCase())) return false;
  }
  if (rule.condition_purpose_pattern) {
    if (!tx.purpose) return false;
    if (!tx.purpose.toLowerCase().includes(rule.condition_purpose_pattern.toLowerCase())) return false;
  }
  const absAmount = Math.abs(tx.amount);
  if (rule.condition_amount_min != null && absAmount < rule.condition_amount_min) return false;
  if (rule.condition_amount_max != null && absAmount > rule.condition_amount_max) return false;
  if (rule.condition_iban_pattern) {
    if (!tx.counterpart_iban) return false;
    if (!tx.counterpart_iban.includes(rule.condition_iban_pattern)) return false;
  }
  return true;
}

export default router;
