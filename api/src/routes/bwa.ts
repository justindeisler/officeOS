/**
 * BWA & SUSA Report API Routes
 *
 * Endpoints for:
 * - BWA (Betriebswirtschaftliche Auswertung) — monthly P&L overview
 * - SuSa (Summen- und Saldenliste) — trial balance
 * - Profitability reports — by client and by category
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../errors.js';
import { generateBWA, generateMonthlyAggregate } from '../services/bwaService.js';
import { generateSuSa } from '../services/susaService.js';
import { EXPENSE_CATEGORY_MAP } from '../constants/expense-categories.js';

const router = Router();

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const YearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2099),
});

const YearMonthParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2099),
  month: z.coerce.number().int().min(1).max(12),
});

// ============================================================================
// Database Row Types (for profitability queries)
// ============================================================================

interface ClientIncomeRow {
  client_id: string | null;
  client_name: string | null;
  total: number;
}

interface CategoryIncomeRow {
  euer_category: string;
  total: number;
}

interface CategoryExpenseRow {
  category: string;
  total: number;
}

// ============================================================================
// BWA Routes
// ============================================================================

/**
 * GET /api/reports/bwa/:year
 * Full year BWA (12 months)
 */
router.get('/bwa/:year', asyncHandler(async (req: Request, res: Response) => {
  const parsed = YearParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError('Invalid year parameter (must be 2000-2099)');
  }

  const db = getDb();
  const report = generateBWA(db, parsed.data.year);
  res.json(report);
}));

/**
 * GET /api/reports/bwa/:year/:month
 * Single month BWA
 */
router.get('/bwa/:year/:month', asyncHandler(async (req: Request, res: Response) => {
  const parsed = YearMonthParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError('Invalid year/month parameters');
  }

  const db = getDb();
  const { year, month } = parsed.data;
  const aggregate = generateMonthlyAggregate(db, year, month);

  // Return as a single-month BWA report
  const totalIncome = aggregate.income.total;
  const totalExpenses = aggregate.expenses.total;
  const profit = aggregate.profit;

  res.json({
    year,
    month,
    aggregate,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      profit,
      profit_margin_percent: totalIncome > 0
        ? Math.round((profit / totalIncome) * 10000) / 100
        : 0,
    },
  });
}));

// ============================================================================
// SuSa Routes
// ============================================================================

/**
 * GET /api/reports/susa/:year
 * Summen- und Saldenliste (trial balance)
 */
router.get('/susa/:year', asyncHandler(async (req: Request, res: Response) => {
  const parsed = YearParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError('Invalid year parameter (must be 2000-2099)');
  }

  const db = getDb();
  const report = generateSuSa(db, parsed.data.year);
  res.json(report);
}));

// ============================================================================
// Profitability Routes
// ============================================================================

/**
 * GET /api/reports/profitability/by-client/:year
 * Income aggregated by client
 */
router.get('/profitability/by-client/:year', asyncHandler(async (req: Request, res: Response) => {
  const parsed = YearParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError('Invalid year parameter (must be 2000-2099)');
  }

  const { year } = parsed.data;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const db = getDb();

  // Income grouped by client
  const clientIncome = db.prepare(
    `SELECT i.client_id, c.name as client_name, SUM(i.net_amount) as total
     FROM income i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE i.date >= ? AND i.date <= ?
       AND (i.is_deleted IS NULL OR i.is_deleted = 0)
     GROUP BY i.client_id
     ORDER BY total DESC`
  ).all(startDate, endDate) as ClientIncomeRow[];

  // Total expenses (not client-specific since expenses aren't linked to clients)
  const totalExpensesRow = db.prepare(
    `SELECT SUM(net_amount * (COALESCE(deductible_percent, 100) / 100.0)) as total
     FROM expenses
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)`
  ).get(startDate, endDate) as { total: number | null };

  const totalExpenses = totalExpensesRow?.total ?? 0;
  const totalIncome = clientIncome.reduce((sum, r) => sum + r.total, 0);

  const round = (n: number) => Math.round(n * 100) / 100;

  const clients = clientIncome
    .filter(r => r.client_id !== null)
    .map(r => ({
      client_id: r.client_id!,
      client_name: r.client_name || 'Unknown',
      income: round(r.total),
      // Proportional expense allocation
      expenses: totalIncome > 0
        ? round(totalExpenses * (r.total / totalIncome))
        : 0,
      profit: totalIncome > 0
        ? round(r.total - totalExpenses * (r.total / totalIncome))
        : round(r.total),
      profit_margin_percent: totalIncome > 0 && r.total > 0
        ? round(((r.total - totalExpenses * (r.total / totalIncome)) / r.total) * 100)
        : 0,
    }));

  const unassignedIncome = clientIncome
    .filter(r => r.client_id === null)
    .reduce((sum, r) => sum + r.total, 0);

  res.json({
    year,
    clients,
    unassigned: {
      income: round(unassignedIncome),
      expenses: totalIncome > 0
        ? round(totalExpenses * (unassignedIncome / totalIncome))
        : round(totalExpenses),
      profit: totalIncome > 0
        ? round(unassignedIncome - totalExpenses * (unassignedIncome / totalIncome))
        : round(unassignedIncome - totalExpenses),
    },
  });
}));

/**
 * GET /api/reports/profitability/by-category/:year
 * Income/expenses aggregated by category
 */
router.get('/profitability/by-category/:year', asyncHandler(async (req: Request, res: Response) => {
  const parsed = YearParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError('Invalid year parameter (must be 2000-2099)');
  }

  const { year } = parsed.data;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const db = getDb();

  const round = (n: number) => Math.round(n * 100) / 100;

  // Income by euer_category
  const incomeCategories = db.prepare(
    `SELECT COALESCE(euer_category, 'uncategorized') as euer_category,
            SUM(net_amount) as total
     FROM income
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     GROUP BY euer_category
     ORDER BY total DESC`
  ).all(startDate, endDate) as CategoryIncomeRow[];

  // Expenses by category
  const expenseCategories = db.prepare(
    `SELECT category,
            SUM(net_amount * (COALESCE(deductible_percent, 100) / 100.0)) as total
     FROM expenses
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     GROUP BY category
     ORDER BY total DESC`
  ).all(startDate, endDate) as CategoryExpenseRow[];

  res.json({
    year,
    income_categories: incomeCategories.map(r => ({
      category: r.euer_category,
      total: round(r.total),
    })),
    expense_categories: expenseCategories.map(r => ({
      category: r.category,
      category_name: EXPENSE_CATEGORY_MAP.get(r.category)?.name || r.category,
      total: round(r.total),
    })),
  });
}));

export default router;
