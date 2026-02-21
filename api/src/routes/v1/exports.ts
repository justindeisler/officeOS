/**
 * Public REST API v1 — Exports
 *
 * Endpoints for generating DATEV and CSV exports.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import { generateDatevExport, type DatevExportOptions } from '../../services/datevExportService.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface IncomeRow {
  id: string;
  date: string;
  description: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
}

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
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/v1/exports/datev — Generate DATEV export
 */
router.post('/datev', asyncHandler(async (req: Request, res: Response) => {
  const {
    start_date, end_date,
    chart_of_accounts = 'SKR03',
    consultant_number, client_number,
  } = req.body;

  if (!start_date || !end_date) {
    return sendError(res, 'start_date and end_date are required (YYYY-MM-DD)', 'VALIDATION_ERROR', 400);
  }

  const validCharts = ['SKR03', 'SKR04'];
  const chart = (chart_of_accounts as string).toUpperCase();
  if (!validCharts.includes(chart)) {
    return sendError(res, 'chart_of_accounts must be SKR03 or SKR04', 'VALIDATION_ERROR', 400);
  }

  const db = getDb();
  const options: DatevExportOptions = {
    startDate: start_date,
    endDate: end_date,
    chartOfAccounts: chart as 'SKR03' | 'SKR04',
    consultantNumber: consultant_number,
    clientNumber: client_number,
  };

  const result = generateDatevExport(db, options);

  if (result.errors.length > 0) {
    return sendError(res, 'DATEV export has errors', 'EXPORT_ERROR', 400, {
      errors: result.errors,
      warnings: result.warnings,
      recordCount: result.recordCount,
    });
  }

  sendSuccess(res, {
    csv: result.csv,
    filename: result.filename,
    recordCount: result.recordCount,
    warnings: result.warnings,
  });
}));

/**
 * POST /api/v1/exports/csv — Generate CSV export of income/expenses
 */
router.post('/csv', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, type = 'all' } = req.body;

  if (!start_date || !end_date) {
    return sendError(res, 'start_date and end_date are required (YYYY-MM-DD)', 'VALIDATION_ERROR', 400);
  }

  const db = getDb();
  const rows: string[] = [];

  if (type === 'all' || type === 'income') {
    const income = db.prepare(
      `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY date`
    ).all(start_date, end_date) as IncomeRow[];

    if (rows.length === 0) {
      rows.push('type,date,description,net_amount,vat_rate,vat_amount,gross_amount');
    }
    for (const r of income) {
      rows.push(`income,"${r.date}","${(r.description || '').replace(/"/g, '""')}",${r.net_amount},${r.vat_rate},${r.vat_amount},${r.gross_amount}`);
    }
  }

  if (type === 'all' || type === 'expenses') {
    const expenses = db.prepare(
      `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY date`
    ).all(start_date, end_date) as ExpenseRow[];

    if (rows.length === 0) {
      rows.push('type,date,description,vendor,category,net_amount,vat_rate,vat_amount,gross_amount');
    }
    for (const r of expenses) {
      rows.push(`expense,"${r.date}","${(r.description || '').replace(/"/g, '""')}","${(r.vendor || '').replace(/"/g, '""')}","${r.category}",${r.net_amount},${r.vat_rate},${r.vat_amount},${r.gross_amount}`);
    }
  }

  const csv = rows.join('\n');
  const filename = `export_${start_date}_${end_date}.csv`;

  sendSuccess(res, { csv, filename, rowCount: rows.length - 1 });
}));

export default router;
