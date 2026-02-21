/**
 * Smart Suggestions API Routes
 *
 * Context-aware recommendations for form prefilling when creating
 * new expenses, income records, or invoices.
 *
 * GET /api/smart-suggestions/expense        — Suggestions for new expense
 * GET /api/smart-suggestions/income         — Suggestions for new income
 * GET /api/smart-suggestions/invoice        — Suggestions for new invoice
 * GET /api/smart-suggestions/invoice-number — Next invoice number only
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getSuggestionsForExpense,
  getSuggestionsForIncome,
  getSuggestionsForInvoice,
  getNextInvoiceNumber,
} from '../services/smartSuggestionsService.js';

const router = Router();

// ─── Expense Suggestions ──────────────────────────────────────────

/**
 * GET /api/smart-suggestions/expense
 * Query params:
 *   vendor - (optional) Pre-selected vendor for targeted suggestions
 */
router.get(
  '/expense',
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const vendor = req.query.vendor as string | undefined;
    const suggestions = getSuggestionsForExpense(db, vendor);
    res.json(suggestions);
  })
);

// ─── Income Suggestions ───────────────────────────────────────────

/**
 * GET /api/smart-suggestions/income
 */
router.get(
  '/income',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const suggestions = getSuggestionsForIncome(db);
    res.json(suggestions);
  })
);

// ─── Invoice Suggestions ──────────────────────────────────────────

/**
 * GET /api/smart-suggestions/invoice
 * Query params:
 *   clientId - (optional) Client ID for payment terms history
 */
router.get(
  '/invoice',
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const clientId = req.query.clientId as string | undefined;
    const suggestions = getSuggestionsForInvoice(db, clientId);
    res.json(suggestions);
  })
);

// ─── Invoice Number Only ──────────────────────────────────────────

/**
 * GET /api/smart-suggestions/invoice-number
 * Returns just the next suggested invoice number.
 */
router.get(
  '/invoice-number',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const nextNumber = getNextInvoiceNumber(db);
    res.json({ nextInvoiceNumber: nextNumber });
  })
);

export default router;
