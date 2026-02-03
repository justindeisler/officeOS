/**
 * Reports API Routes
 * Provides endpoints for USt-Voranmeldung (VAT) and EÜR (profit) reports
 */

import express from 'express';
import { getDb } from '../database.js';

const router = express.Router();

/**
 * Database row types
 */
interface IncomeRow {
  id: string;
  date: string;
  client_id: string | null;
  invoice_id: string | null;
  description: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number | null;
  euer_category: string | null;
  payment_method: string | null;
  bank_reference: string | null;
  ust_period: string | null;
  ust_reported: number;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  date: string;
  vendor: string;
  description: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number;
  euer_category: string;
  deductible_percent: number;
  payment_method: string | null;
  receipt_path: string | null;
  is_recurring: number;
  recurring_frequency: string | null;
  ust_period: string | null;
  vorsteuer_claimed: number;
  is_gwg: number;
  asset_id: string | null;
  created_at: string;
}

/**
 * EÜR Line constants (matching frontend types)
 */
const EUER_LINES = {
  BETRIEBSEINNAHMEN: 14,
  ENTNAHME_VERKAUF: 16,
  UST_ERSTATTUNG: 17,
  FREMDLEISTUNGEN: 21,
  VORSTEUER: 24,
  GEZAHLTE_UST: 29,
  AFA: 30,
  ARBEITSZIMMER: 33,
  ANLAGENABGANG_VERLUST: 35,
  SONSTIGE: 40,
};

const HOMEOFFICE_PAUSCHALE = 1260; // €1,260 per year

/**
 * Get quarter date boundaries
 */
function getQuarterDates(year: number, quarter: 1 | 2 | 3 | 4) {
  const quarterStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, quarterStartMonth, 1);
  const endDate = new Date(year, quarterStartMonth + 3, 0);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Get asset depreciation for a year
 */
async function getYearlyDepreciation(year: number): Promise<number> {
  const db = getDb();
  const result = db.prepare(
    `SELECT SUM(depreciation_amount) as total FROM depreciation_schedule WHERE year = ?`
  ).get(year) as { total: number } | undefined;
  return result?.total || 0;
}

/**
 * Get asset disposal gains for a year
 */
async function getDisposalGains(year: number): Promise<number> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = getDb();
  const result = db.prepare(
    `SELECT SUM(
      CASE
        WHEN disposal_price > (purchase_price - 
          (SELECT COALESCE(SUM(depreciation_amount), 0) FROM depreciation_schedule 
           WHERE asset_id = assets.id AND year < ?))
        THEN disposal_price - (purchase_price - 
          (SELECT COALESCE(SUM(depreciation_amount), 0) FROM depreciation_schedule 
           WHERE asset_id = assets.id AND year < ?))
        ELSE 0
      END
    ) as total
    FROM assets
    WHERE status = 'disposed'
      AND disposal_date >= ?
      AND disposal_date <= ?`
  ).get(year, year, startDate, endDate) as { total: number } | undefined;

  return result?.total || 0;
}

/**
 * Get asset disposal losses for a year
 */
async function getDisposalLosses(year: number): Promise<number> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = getDb();
  const result = db.prepare(
    `SELECT SUM(
      CASE
        WHEN disposal_price IS NULL OR disposal_price = 0
        THEN purchase_price - (SELECT COALESCE(SUM(depreciation_amount), 0) 
             FROM depreciation_schedule 
             WHERE asset_id = assets.id AND year < ?)
        WHEN disposal_price < (purchase_price - 
          (SELECT COALESCE(SUM(depreciation_amount), 0) FROM depreciation_schedule 
           WHERE asset_id = assets.id AND year < ?))
        THEN (purchase_price - 
          (SELECT COALESCE(SUM(depreciation_amount), 0) FROM depreciation_schedule 
           WHERE asset_id = assets.id AND year < ?)) - disposal_price
        ELSE 0
      END
    ) as total
    FROM assets
    WHERE status = 'disposed'
      AND disposal_date >= ?
      AND disposal_date <= ?`
  ).get(year, year, year, startDate, endDate) as { total: number } | undefined;

  return result?.total || 0;
}

/**
 * GET /api/reports/ust/:year/:quarter
 * Get USt-Voranmeldung for a specific quarter
 */
router.get('/ust/:year/:quarter', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const quarter = parseInt(req.params.quarter) as 1 | 2 | 3 | 4;

    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return res.status(400).json({ error: 'Invalid year or quarter' });
    }

    const { startDate, endDate } = getQuarterDates(year, quarter);

    const db = getDb();

    // Get income for the quarter
    const incomeRecords = db.prepare(
      `SELECT * FROM income WHERE date >= ? AND date <= ? ORDER BY date DESC`
    ).all(startDate, endDate) as IncomeRow[];

    // Get expenses for the quarter
    const expenseRecords = db.prepare(
      `SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC`
    ).all(startDate, endDate) as ExpenseRow[];

    // Calculate Umsatzsteuer (output VAT) by rate
    const umsatzsteuer19 = incomeRecords
      .filter((i) => i.vat_rate === 19)
      .reduce((sum, i) => sum + i.vat_amount, 0);

    const umsatzsteuer7 = incomeRecords
      .filter((i) => i.vat_rate === 7)
      .reduce((sum, i) => sum + i.vat_amount, 0);

    const totalUmsatzsteuer = umsatzsteuer19 + umsatzsteuer7;

    // Calculate Vorsteuer (input VAT) from claimed expenses
    const vorsteuer = expenseRecords
      .filter((e) => e.vorsteuer_claimed === 1)
      .reduce((sum, e) => sum + e.vat_amount, 0);

    // Zahllast = total output VAT - total input VAT
    const zahllast = totalUmsatzsteuer - vorsteuer;

    // Round all values to 2 decimal places
    const round = (n: number) => Math.round(n * 100) / 100;

    res.json({
      period: `${year}-Q${quarter}`,
      year,
      quarter,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      umsatzsteuer19: round(umsatzsteuer19),
      umsatzsteuer7: round(umsatzsteuer7),
      totalUmsatzsteuer: round(totalUmsatzsteuer),
      vorsteuer: round(vorsteuer),
      zahllast: round(zahllast),
      status: 'draft',
    });
  } catch (error) {
    console.error('Error fetching USt-Voranmeldung:', error);
    res.status(500).json({ error: 'Failed to fetch USt-Voranmeldung' });
  }
});

/**
 * GET /api/reports/ust/:year
 * Get all USt-Voranmeldungen for a year
 */
router.get('/ust/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (!year) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const quarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
    const results = await Promise.all(
      quarters.map(async (q) => {
        const response = await fetch(
          `http://localhost:${process.env.PORT || 3001}/api/reports/ust/${year}/${q}`
        );
        return response.json();
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Error fetching yearly USt-Voranmeldungen:', error);
    res.status(500).json({ error: 'Failed to fetch yearly USt-Voranmeldungen' });
  }
});

/**
 * POST /api/reports/ust/:year/:quarter/file
 * Mark USt-Voranmeldung as filed
 */
router.post('/ust/:year/:quarter/file', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const quarter = parseInt(req.params.quarter) as 1 | 2 | 3 | 4;

    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return res.status(400).json({ error: 'Invalid year or quarter' });
    }

    const { startDate, endDate } = getQuarterDates(year, quarter);

    const db = getDb();

    // Mark all income in this period as reported
    db.prepare(
      `UPDATE income SET ust_reported = 1 WHERE date >= ? AND date <= ?`
    ).run(startDate, endDate);

    // Mark all expenses in this period as Vorsteuer claimed
    db.prepare(
      `UPDATE expenses SET vorsteuer_claimed = 1 WHERE date >= ? AND date <= ?`
    ).run(startDate, endDate);

    // Get updated report (reuse the GET endpoint logic)
    const response = await fetch(
      `http://localhost:${process.env.PORT || 3001}/api/reports/ust/${year}/${quarter}`
    );
    const report = await response.json();

    res.json({
      ...report,
      status: 'filed',
      filedDate: new Date(),
    });
  } catch (error) {
    console.error('Error marking USt as filed:', error);
    res.status(500).json({ error: 'Failed to mark USt as filed' });
  }
});

/**
 * GET /api/reports/euer/:year
 * Get EÜR report for a year
 */
router.get('/euer/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (!year) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const db = getDb();

    // Get income for the year
    const incomeRecords = db.prepare(
      `SELECT * FROM income WHERE date >= ? AND date <= ? ORDER BY date DESC`
    ).all(startDate, endDate) as IncomeRow[];

    // Get expenses for the year
    const expenseRecords = db.prepare(
      `SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC`
    ).all(startDate, endDate) as ExpenseRow[];

    // Get asset depreciation (AfA) for the year
    const assetAfA = await getYearlyDepreciation(year);

    // Group income by EÜR line number
    const incomeByLine: Record<number, number> = {};
    for (const record of incomeRecords) {
      const line = record.euer_line || EUER_LINES.BETRIEBSEINNAHMEN;
      incomeByLine[line] = (incomeByLine[line] || 0) + record.net_amount;
    }

    // Group expenses by EÜR line number
    const expensesByLine: Record<number, number> = {};
    for (const record of expenseRecords) {
      const line = record.euer_line;
      // Apply deductible percentage
      const deductible = record.net_amount * (record.deductible_percent / 100);
      expensesByLine[line] = (expensesByLine[line] || 0) + deductible;
    }

    // Add asset depreciation (AfA) to line 30
    expensesByLine[EUER_LINES.AFA] =
      (expensesByLine[EUER_LINES.AFA] || 0) + assetAfA;

    // Add asset disposal gains to line 16
    const disposalGains = await getDisposalGains(year);
    if (disposalGains > 0) {
      incomeByLine[EUER_LINES.ENTNAHME_VERKAUF] =
        (incomeByLine[EUER_LINES.ENTNAHME_VERKAUF] || 0) + disposalGains;
    }

    // Add asset disposal losses to line 35
    const disposalLosses = await getDisposalLosses(year);
    if (disposalLosses > 0) {
      expensesByLine[EUER_LINES.ANLAGENABGANG_VERLUST] =
        (expensesByLine[EUER_LINES.ANLAGENABGANG_VERLUST] || 0) + disposalLosses;
    }

    // Check if Homeoffice-Pauschale should be included
    if (!expensesByLine[EUER_LINES.ARBEITSZIMMER]) {
      expensesByLine[EUER_LINES.ARBEITSZIMMER] = HOMEOFFICE_PAUSCHALE;
    }

    // Calculate totals
    const totalIncome = Object.values(incomeByLine).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(expensesByLine).reduce((a, b) => a + b, 0);
    const gewinn = totalIncome - totalExpenses;

    // Round all values
    const round = (n: number) => Math.round(n * 100) / 100;

    for (const key of Object.keys(incomeByLine)) {
      incomeByLine[Number(key)] = round(incomeByLine[Number(key)]);
    }
    for (const key of Object.keys(expensesByLine)) {
      expensesByLine[Number(key)] = round(expensesByLine[Number(key)]);
    }

    res.json({
      year,
      income: incomeByLine,
      expenses: expensesByLine,
      totalIncome: round(totalIncome),
      totalExpenses: round(totalExpenses),
      gewinn: round(gewinn),
    });
  } catch (error) {
    console.error('Error fetching EÜR report:', error);
    res.status(500).json({ error: 'Failed to fetch EÜR report' });
  }
});

/**
 * GET /api/reports/euer-lines
 * Get EÜR line details for display
 */
router.get('/euer-lines', (req, res) => {
  res.json({
    income: [
      {
        line: EUER_LINES.BETRIEBSEINNAHMEN,
        name: 'Betriebseinnahmen',
        description: 'Standard taxable business income (19% or 7%)',
      },
      {
        line: EUER_LINES.ENTNAHME_VERKAUF,
        name: 'Veräußerungsgewinne',
        description: 'Gains from asset sales (selling price - book value)',
      },
      {
        line: EUER_LINES.UST_ERSTATTUNG,
        name: 'USt-Erstattung',
        description: 'VAT refunds from tax office',
      },
    ],
    expenses: [
      {
        line: EUER_LINES.FREMDLEISTUNGEN,
        name: 'Fremdleistungen',
        description: 'Subcontractors, freelancers',
      },
      {
        line: EUER_LINES.VORSTEUER,
        name: 'Vorsteuer',
        description: 'Input VAT on purchases',
      },
      {
        line: EUER_LINES.GEZAHLTE_UST,
        name: 'Gezahlte USt',
        description: 'Output VAT paid to tax office',
      },
      {
        line: EUER_LINES.AFA,
        name: 'AfA',
        description: 'Depreciation of movable assets',
      },
      {
        line: EUER_LINES.ARBEITSZIMMER,
        name: 'Arbeitszimmer',
        description: 'Home office costs (Pauschale: €1,260/year)',
      },
      {
        line: EUER_LINES.SONSTIGE,
        name: 'Sonstige',
        description: 'Other fully deductible business expenses',
      },
      {
        line: EUER_LINES.ANLAGENABGANG_VERLUST,
        name: 'Anlagenabgang (Verlust)',
        description: 'Losses from asset disposals (remaining book value)',
      },
    ],
  });
});

export default router;
