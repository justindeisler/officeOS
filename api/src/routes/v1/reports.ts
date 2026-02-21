/**
 * Public REST API v1 — Reports (read-only)
 *
 * Endpoints for EÜR, USt-Voranmeldung, and BWA reports.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../../constants/euer.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface IncomeRow {
  id: string;
  date: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number | null;
  is_reverse_charge: number;
}

interface ExpenseRow {
  id: string;
  date: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number;
  deductible_percent?: number;
  category: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getQuarterDates(year: number, quarter: 1 | 2 | 3 | 4) {
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);
  const endDate = new Date(year, quarterStartMonth + 3, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/reports/euer?year=2024
 */
router.get('/euer', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string);
  if (!year || year < 2000 || year > 2099) {
    return sendError(res, 'Valid year parameter is required (2000-2099)', 'VALIDATION_ERROR', 400);
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const db = getDb();

  const incomeRecords = db.prepare(
    `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY date DESC`
  ).all(startDate, endDate) as IncomeRow[];

  const expenseRecords = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY date DESC`
  ).all(startDate, endDate) as ExpenseRow[];

  // Get asset depreciation
  const afaResult = db.prepare(
    `SELECT SUM(depreciation_amount) as total FROM depreciation_schedule WHERE year = ?`
  ).get(year) as { total: number } | undefined;
  const assetAfA = afaResult?.total || 0;

  // Group by EÜR line
  const incomeByLine: Record<number, number> = {};
  for (const r of incomeRecords) {
    const line = r.euer_line || EUER_LINES.BETRIEBSEINNAHMEN;
    incomeByLine[line] = (incomeByLine[line] || 0) + r.net_amount;
  }

  const expensesByLine: Record<number, number> = {};
  for (const r of expenseRecords) {
    const deductible = r.net_amount * ((r.deductible_percent ?? 100) / 100);
    expensesByLine[r.euer_line] = (expensesByLine[r.euer_line] || 0) + deductible;
  }

  // Add AfA
  expensesByLine[EUER_LINES.AFA] = (expensesByLine[EUER_LINES.AFA] || 0) + assetAfA;

  // Homeoffice
  const homeofficeRow = db.prepare("SELECT value FROM settings WHERE key = 'homeoffice_enabled'").get() as { value: string } | undefined;
  if (homeofficeRow?.value === 'true' && !expensesByLine[EUER_LINES.ARBEITSZIMMER]) {
    expensesByLine[EUER_LINES.ARBEITSZIMMER] = HOMEOFFICE_PAUSCHALE;
  }

  // Round everything
  for (const key of Object.keys(incomeByLine)) {
    incomeByLine[Number(key)] = round(incomeByLine[Number(key)]);
  }
  for (const key of Object.keys(expensesByLine)) {
    expensesByLine[Number(key)] = round(expensesByLine[Number(key)]);
  }

  const totalIncome = round(Object.values(incomeByLine).reduce((a, b) => a + b, 0));
  const totalExpenses = round(Object.values(expensesByLine).reduce((a, b) => a + b, 0));

  sendSuccess(res, {
    year,
    income: incomeByLine,
    expenses: expensesByLine,
    totalIncome,
    totalExpenses,
    gewinn: round(totalIncome - totalExpenses),
  });
}));

/**
 * GET /api/v1/reports/ust-va?year=2024&quarter=1
 */
router.get('/ust-va', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string);
  const quarter = parseInt(req.query.quarter as string) as 1 | 2 | 3 | 4;

  if (!year || !quarter || quarter < 1 || quarter > 4) {
    return sendError(res, 'Valid year and quarter (1-4) parameters are required', 'VALIDATION_ERROR', 400);
  }

  const { startDate, endDate } = getQuarterDates(year, quarter);
  const db = getDb();

  const incomeRecords = db.prepare(
    `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as IncomeRow[];

  const expenseRecords = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as ExpenseRow[];

  const normalIncome = incomeRecords.filter(i => !i.is_reverse_charge);
  const umsatzsteuer19 = normalIncome.filter(i => i.vat_rate === 19).reduce((s, i) => s + i.vat_amount, 0);
  const umsatzsteuer7 = normalIncome.filter(i => i.vat_rate === 7).reduce((s, i) => s + i.vat_amount, 0);
  const totalUmsatzsteuer = umsatzsteuer19 + umsatzsteuer7;
  const vorsteuer = expenseRecords.reduce((s, e) => {
    const frac = (e.deductible_percent ?? 100) / 100;
    return s + (e.vat_amount || 0) * frac;
  }, 0);

  sendSuccess(res, {
    period: `${year}-Q${quarter}`,
    year,
    quarter,
    startDate,
    endDate,
    umsatzsteuer19: round(umsatzsteuer19),
    umsatzsteuer7: round(umsatzsteuer7),
    totalUmsatzsteuer: round(totalUmsatzsteuer),
    vorsteuer: round(vorsteuer),
    zahllast: round(totalUmsatzsteuer - vorsteuer),
    status: 'draft',
  });
}));

/**
 * GET /api/v1/reports/bwa?year=2024&month=3
 */
router.get('/bwa', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string);
  const month = req.query.month ? parseInt(req.query.month as string) : undefined;

  if (!year || year < 2000 || year > 2099) {
    return sendError(res, 'Valid year parameter is required (2000-2099)', 'VALIDATION_ERROR', 400);
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    return sendError(res, 'Month must be between 1 and 12', 'VALIDATION_ERROR', 400);
  }

  const db = getDb();
  let startDate: string;
  let endDate: string;

  if (month) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  const incomeRecords = db.prepare(
    `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as IncomeRow[];

  const expenseRecords = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as ExpenseRow[];

  const totalIncome = round(incomeRecords.reduce((s, r) => s + r.net_amount, 0));
  const totalExpenses = round(expenseRecords.reduce((s, r) => s + r.net_amount * ((r.deductible_percent ?? 100) / 100), 0));

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenseRecords) {
    const cat = e.category || 'other';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + e.net_amount * ((e.deductible_percent ?? 100) / 100);
  }
  for (const key of Object.keys(expensesByCategory)) {
    expensesByCategory[key] = round(expensesByCategory[key]);
  }

  sendSuccess(res, {
    period: month ? `${year}-${month.toString().padStart(2, '0')}` : `${year}`,
    year,
    month: month || null,
    totalIncome,
    totalExpenses,
    result: round(totalIncome - totalExpenses),
    expensesByCategory,
    incomeCount: incomeRecords.length,
    expenseCount: expenseRecords.length,
  });
}));

export default router;
