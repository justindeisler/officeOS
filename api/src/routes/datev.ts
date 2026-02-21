/**
 * DATEV Export API Routes (Server-Side)
 * 
 * Replaces client-side DATEV generation with full server-side export.
 * Supports SKR03/SKR04 with transaction-level detail.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../errors.js';
import { generateDatevExport, type DatevExportOptions } from '../services/datevExportService.js';

const router = Router();

/**
 * GET /api/exports/datev/preview
 * Preview what will be exported without generating the file
 */
router.get('/preview', asyncHandler(async (req: Request, res: Response) => {
  const { start, end, chart = 'SKR03' } = req.query;

  if (!start || !end) {
    throw new ValidationError('start and end date parameters are required (YYYY-MM-DD)');
  }

  const db = getDb();
  const options: DatevExportOptions = {
    startDate: start as string,
    endDate: end as string,
    chartOfAccounts: (chart as string).toUpperCase() as 'SKR03' | 'SKR04',
  };

  const result = generateDatevExport(db, options);

  // Return preview without CSV content
  res.json({
    recordCount: result.recordCount,
    filename: result.filename,
    records: result.records,
    errors: result.errors,
    warnings: result.warnings,
  });
}));

/**
 * POST /api/exports/datev/generate
 * Generate DATEV export file
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const {
    start_date,
    end_date,
    chart_of_accounts = 'SKR03',
    consultant_number,
    client_number,
    include_income = true,
    include_expenses = true,
    include_depreciation = true,
  } = req.body;

  if (!start_date || !end_date) {
    throw new ValidationError('start_date and end_date are required (YYYY-MM-DD)');
  }

  const validCharts = ['SKR03', 'SKR04'];
  const chart = chart_of_accounts.toUpperCase();
  if (!validCharts.includes(chart)) {
    throw new ValidationError('chart_of_accounts must be SKR03 or SKR04');
  }

  const db = getDb();
  const options: DatevExportOptions = {
    startDate: start_date,
    endDate: end_date,
    chartOfAccounts: chart as 'SKR03' | 'SKR04',
    consultantNumber: consultant_number,
    clientNumber: client_number,
    includeIncome: include_income,
    includeExpenses: include_expenses,
    includeDepreciation: include_depreciation,
  };

  const result = generateDatevExport(db, options);

  if (result.errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      warnings: result.warnings,
      recordCount: result.recordCount,
    });
  }

  res.json({
    success: true,
    csv: result.csv,
    filename: result.filename,
    recordCount: result.recordCount,
    warnings: result.warnings,
  });
}));

/**
 * POST /api/exports/datev/download
 * Generate and download DATEV CSV file directly
 */
router.post('/download', asyncHandler(async (req: Request, res: Response) => {
  const {
    start_date,
    end_date,
    chart_of_accounts = 'SKR03',
    consultant_number,
    client_number,
  } = req.body;

  if (!start_date || !end_date) {
    throw new ValidationError('start_date and end_date are required');
  }

  const db = getDb();
  const result = generateDatevExport(db, {
    startDate: start_date,
    endDate: end_date,
    chartOfAccounts: (chart_of_accounts as string).toUpperCase() as 'SKR03' | 'SKR04',
    consultantNumber: consultant_number,
    clientNumber: client_number,
  });

  if (result.errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
    });
  }

  // Convert to ISO-8859-1 (Latin-1) as required by DATEV
  const latin1Buffer = Buffer.from(result.csv, 'latin1');

  res.setHeader('Content-Type', 'text/csv; charset=iso-8859-1');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(latin1Buffer);
}));

export default router;
