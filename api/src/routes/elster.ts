/**
 * ELSTER Tax Filing Routes
 * 
 * Endpoints for USt-VA, ZM, and EÜR electronic tax filing.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError, NotFoundError } from '../errors.js';
import { extractAuditContext } from '../services/auditService.js';
import {
  calculateUstVa,
  generateUstVaXml,
  calculateZm,
  generateZmXml,
  createSubmission,
  updateSubmissionStatus,
  getSubmissions,
} from '../services/elsterService.js';

const router = Router();

// ============================================================================
// USt-VA (VAT Advance Return)
// ============================================================================

/**
 * POST /api/tax/elster/ust-va
 * Calculate and generate USt-VA for a period
 */
router.post('/ust-va', asyncHandler(async (req: Request, res: Response) => {
  const { year, period, period_type = 'quarterly', test_mode = true } = req.body;

  if (!year || !period) {
    throw new ValidationError('year and period are required');
  }

  const periodType = period_type === 'monthly' ? 'monthly' : 'quarterly';
  const db = getDb();
  const context = extractAuditContext(req);

  // Calculate tax data
  const data = calculateUstVa(db, year, period, periodType as 'monthly' | 'quarterly');

  // Generate XML
  const xml = generateUstVaXml(data);

  // Create submission record
  const periodKey = `${year}-${period}`;
  const submission = createSubmission(db, 'ust_va', periodKey, xml, data, test_mode, context);

  res.status(201).json({
    submission,
    taxData: data,
    xml,
  });
}));

/**
 * POST /api/tax/elster/ust-va/validate
 * Validate USt-VA data without creating a submission
 */
router.post('/ust-va/validate', asyncHandler(async (req: Request, res: Response) => {
  const { year, period, period_type = 'quarterly' } = req.body;

  if (!year || !period) {
    throw new ValidationError('year and period are required');
  }

  const db = getDb();
  const data = calculateUstVa(db, year, period, period_type as 'monthly' | 'quarterly');
  const xml = generateUstVaXml(data);

  // Validation checks
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.steuernummer) {
    errors.push('Steuernummer ist nicht konfiguriert (Einstellungen → Firmenprofil)');
  }
  if (data.kz81 === 0 && data.kz86 === 0) {
    warnings.push('Keine steuerpflichtigen Umsätze im Zeitraum');
  }
  if (data.kz83 < 0) {
    warnings.push(`Erstattungsbetrag: ${Math.abs(data.kz83).toFixed(2)} € (Vorsteuerüberhang)`);
  }

  res.json({
    valid: errors.length === 0,
    errors,
    warnings,
    taxData: data,
    xml,
  });
}));

// ============================================================================
// ZM (Zusammenfassende Meldung)
// ============================================================================

/**
 * POST /api/tax/elster/zm
 * Calculate and generate ZM for a quarter
 */
router.post('/zm', asyncHandler(async (req: Request, res: Response) => {
  const { year, quarter, test_mode = true } = req.body;

  if (!year || !quarter) {
    throw new ValidationError('year and quarter are required');
  }

  const db = getDb();
  const context = extractAuditContext(req);

  const data = calculateZm(db, year, quarter);
  const xml = generateZmXml(data);

  const periodKey = `${year}-Q${quarter}`;
  const submission = createSubmission(db, 'zm', periodKey, xml, data, test_mode, context);

  res.status(201).json({
    submission,
    taxData: data,
    xml,
    entryCount: data.entries.length,
  });
}));

// ============================================================================
// EÜR (annual filing — XML generation)
// ============================================================================

/**
 * POST /api/tax/elster/euer
 * Generate EÜR submission data for a year
 */
router.post('/euer', asyncHandler(async (req: Request, res: Response) => {
  const { year, test_mode = true } = req.body;

  if (!year) {
    throw new ValidationError('year is required');
  }

  const db = getDb();
  const context = extractAuditContext(req);

  // Use the existing EÜR report logic to get the data
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const incomeRecords = db.prepare(
    `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as Array<{ net_amount: number; euer_line: number | null }>;

  const expenseRecords = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as Array<{ net_amount: number; euer_line: number; deductible_percent?: number }>;

  // Get depreciation
  const depResult = db.prepare(
    'SELECT SUM(depreciation_amount) as total FROM depreciation_schedule WHERE year = ?'
  ).get(year) as { total: number } | undefined;
  const depreciation = depResult?.total || 0;

  // Calculate income by line
  const incomeByLine: Record<number, number> = {};
  for (const r of incomeRecords) {
    const line = r.euer_line || 14;
    incomeByLine[line] = (incomeByLine[line] || 0) + r.net_amount;
  }

  // Calculate expenses by line
  const expensesByLine: Record<number, number> = {};
  for (const r of expenseRecords) {
    const deductible = r.net_amount * ((r.deductible_percent ?? 100) / 100);
    expensesByLine[r.euer_line] = (expensesByLine[r.euer_line] || 0) + deductible;
  }

  // Add depreciation
  expensesByLine[30] = (expensesByLine[30] || 0) + depreciation;

  const totalIncome = Object.values(incomeByLine).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expensesByLine).reduce((a, b) => a + b, 0);
  const gewinn = totalIncome - totalExpenses;

  const euerData = {
    year,
    income: incomeByLine,
    expenses: expensesByLine,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    gewinn: Math.round(gewinn * 100) / 100,
  };

  // Generate a simple XML representation (full ELSTER EÜR XML is complex)
  const xml = generateEuerXml(euerData);

  const submission = createSubmission(db, 'euer', String(year), xml, euerData, test_mode, context);

  res.status(201).json({
    submission,
    taxData: euerData,
    xml,
  });
}));

// ============================================================================
// Submission Management
// ============================================================================

/**
 * GET /api/tax/elster/submissions
 * List all submissions
 */
router.get('/submissions', asyncHandler(async (req: Request, res: Response) => {
  const { type, period, year } = req.query;
  const db = getDb();

  const submissions = getSubmissions(db, {
    type: type as string,
    period: period as string,
    year: year ? parseInt(year as string) : undefined,
  });

  res.json(submissions);
}));

/**
 * GET /api/tax/elster/status/:id
 * Get a specific submission status
 */
router.get('/status/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const submission = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(req.params.id);

  if (!submission) {
    throw new NotFoundError('ELSTER submission', req.params.id);
  }

  res.json(submission);
}));

/**
 * POST /api/tax/elster/status/:id
 * Update submission status (e.g., after manual submission to ELSTER)
 */
router.post('/status/:id', asyncHandler(async (req: Request, res: Response) => {
  const { status, transfer_ticket, response_xml, error_message } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(req.params.id);
  if (!existing) {
    throw new NotFoundError('ELSTER submission', req.params.id);
  }

  if (!status) {
    throw new ValidationError('status is required');
  }

  updateSubmissionStatus(db, req.params.id, status, response_xml, transfer_ticket, error_message);

  const updated = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(req.params.id);
  res.json(updated);
}));

// ============================================================================
// Helpers
// ============================================================================

function generateEuerXml(data: { year: number; income: Record<number, number>; expenses: Record<number, number>; gewinn: number }): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">');
  lines.push('  <TransferHeader>');
  lines.push('    <Verfahren>ElsterErklaerung</Verfahren>');
  lines.push('    <DatenArt>ESt</DatenArt>');
  lines.push('    <Vorgang>send</Vorgang>');
  lines.push('  </TransferHeader>');
  lines.push('  <DatenTeil>');
  lines.push('    <Nutzdatenblock>');
  lines.push('      <Nutzdaten>');
  lines.push(`        <AnlageEUER jahr="${data.year}">`);

  // Income lines
  for (const [line, amount] of Object.entries(data.income)) {
    lines.push(`          <Zeile${line}>${amount.toFixed(2)}</Zeile${line}>`);
  }

  // Expense lines
  for (const [line, amount] of Object.entries(data.expenses)) {
    lines.push(`          <Zeile${line}>${amount.toFixed(2)}</Zeile${line}>`);
  }

  lines.push(`          <Gewinn>${data.gewinn.toFixed(2)}</Gewinn>`);
  lines.push('        </AnlageEUER>');
  lines.push('      </Nutzdaten>');
  lines.push('    </Nutzdatenblock>');
  lines.push('  </DatenTeil>');
  lines.push('</Elster>');

  return lines.join('\n');
}

export default router;
