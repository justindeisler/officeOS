/**
 * Server-Side DATEV Export Service
 * 
 * Generates DATEV-compliant CSV files (Buchungsstapel format) server-side.
 * Replaces client-side export with full SKR03/SKR04 compliance.
 * 
 * DATEV format: EXTF (ASCII) with semicolon delimiter
 * Encoding: ISO-8859-1 (Latin-1)
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';
import { generateId, getCurrentTimestamp } from '../database.js';

const log = createLogger('datev-export');

// ============================================================================
// Types
// ============================================================================

export interface DatevRecord {
  amount: number;          // Umsatz (gross amount)
  debitCredit: 'S' | 'H'; // Soll/Haben (debit/credit)
  currency: string;        // WKZ (EUR)
  account: number;         // Konto
  counterAccount: number;  // Gegenkonto
  vatCode: number;         // BU-Schlüssel (0=exempt, 2=7%, 3=19%)
  documentDate: string;    // Belegdatum (DDMM)
  documentRef1: string;    // Belegfeld 1 (invoice/receipt number)
  description: string;     // Buchungstext (max 60 chars)
  documentRef2?: string;   // Belegfeld 2
}

export interface DatevExportOptions {
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  chartOfAccounts: 'SKR03' | 'SKR04';
  consultantNumber?: string; // Berater-Nr.
  clientNumber?: string;     // Mandant-Nr.
  includeIncome?: boolean;
  includeExpenses?: boolean;
  includeDepreciation?: boolean;
}

export interface DatevExportResult {
  csv: string;
  recordCount: number;
  filename: string;
  records: DatevRecord[];
  errors: string[];
  warnings: string[];
}

// ============================================================================
// SKR03 Account Mappings
// ============================================================================

const SKR03_INCOME: Record<string, number> = {
  'services': 8400,      // Erlöse 19%
  'services_7': 8300,    // Erlöse 7%
  'services_0': 8120,    // Steuerfreie Umsätze
  'asset_sale': 8820,    // Erlöse Anlagenverkauf
  'ust_refund': 8955,    // USt-Erstattung
};

const SKR03_EXPENSES: Record<string, number> = {
  'software': 4964,        // EDV-Kosten
  'hosting': 4964,         // EDV-Kosten
  'telecom': 4920,         // Telekommunikation
  'hardware': 4964,        // EDV-Kosten (or 0200-0700 for assets)
  'office_supplies': 4930, // Bürobedarf
  'travel': 4660,          // Reisekosten
  'training': 4945,        // Fortbildungskosten
  'books': 4940,           // Fachliteratur
  'insurance': 4360,       // Versicherungen
  'bank_fees': 4970,       // Nebenkosten des Geldverkehrs
  'legal': 4950,           // Rechts- und Beratungskosten
  'marketing': 4600,       // Werbekosten
  'fremdleistungen': 4900, // Fremdleistungen
  'depreciation': 4830,    // Abschreibungen (AfA)
  'homeoffice': 4288,      // Arbeitszimmer
  'other': 4900,           // Sonstige betriebliche Aufwendungen
};

const SKR04_INCOME: Record<string, number> = {
  'services': 4400,
  'services_7': 4300,
  'services_0': 4120,
  'asset_sale': 4845,
  'ust_refund': 4950,
};

const SKR04_EXPENSES: Record<string, number> = {
  'software': 6520,
  'hosting': 6520,
  'telecom': 6810,
  'hardware': 6520,
  'office_supplies': 6815,
  'travel': 6650,
  'training': 6820,
  'books': 6821,
  'insurance': 6400,
  'bank_fees': 6855,
  'legal': 6825,
  'marketing': 6600,
  'fremdleistungen': 6300,
  'depreciation': 6220,
  'homeoffice': 6311,
  'other': 6300,
};

const SKR03_COUNTER: Record<string, number> = {
  'bank_transfer': 1200,
  'paypal': 1360,
  'credit_card': 1361,
  'cash': 1000,
  'default': 1200,
};

const SKR04_COUNTER: Record<string, number> = {
  'bank_transfer': 1800,
  'paypal': 1460,
  'credit_card': 1461,
  'cash': 1600,
  'default': 1800,
};

// ============================================================================
// Core Export Function
// ============================================================================

/**
 * Generate a complete DATEV export from the database
 */
export function generateDatevExport(
  db: Database.Database,
  options: DatevExportOptions
): DatevExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: DatevRecord[] = [];

  const skr = options.chartOfAccounts;
  const incomeAccounts = skr === 'SKR03' ? SKR03_INCOME : SKR04_INCOME;
  const expenseAccounts = skr === 'SKR03' ? SKR03_EXPENSES : SKR04_EXPENSES;
  const counterAccounts = skr === 'SKR03' ? SKR03_COUNTER : SKR04_COUNTER;

  // Get income records
  if (options.includeIncome !== false) {
    const incomeRows = db.prepare(
      `SELECT i.*, c.name as client_name 
       FROM income i 
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.date >= ? AND i.date <= ? 
       AND (i.is_deleted IS NULL OR i.is_deleted = 0)
       ORDER BY i.date ASC`
    ).all(options.startDate, options.endDate) as Array<{
      id: string; date: string; description: string; net_amount: number;
      vat_rate: number; vat_amount: number; gross_amount: number;
      euer_category: string | null; payment_method: string | null;
      invoice_id: string | null; reference_number: string | null;
      client_name: string | null;
    }>;

    for (const row of incomeRows) {
      const category = row.euer_category || 'services';
      const vatKey = row.vat_rate === 7 ? 'services_7' : (row.vat_rate === 0 ? 'services_0' : 'services');
      const account = incomeAccounts[category] || incomeAccounts[vatKey] || incomeAccounts['services'];
      const counterAccount = counterAccounts[row.payment_method || 'default'] || counterAccounts['default'];

      records.push({
        amount: row.gross_amount,
        debitCredit: 'H', // Credit for income
        currency: 'EUR',
        account,
        counterAccount,
        vatCode: getVatCode(row.vat_rate),
        documentDate: formatDatevDate(row.date),
        documentRef1: row.reference_number || row.invoice_id || '',
        description: truncate(`${row.client_name || ''}: ${row.description}`.trim(), 60),
      });
    }
  }

  // Get expense records
  if (options.includeExpenses !== false) {
    const expenseRows = db.prepare(
      `SELECT * FROM expenses 
       WHERE date >= ? AND date <= ? 
       AND (is_deleted IS NULL OR is_deleted = 0)
       ORDER BY date ASC`
    ).all(options.startDate, options.endDate) as Array<{
      id: string; date: string; vendor: string | null; description: string;
      category: string; net_amount: number; vat_rate: number; vat_amount: number;
      gross_amount: number; payment_method: string | null;
      reference_number: string | null; receipt_path: string | null;
      deductible_percent: number;
    }>;

    for (const row of expenseRows) {
      const account = expenseAccounts[row.category] || expenseAccounts['other'];
      const counterAccount = counterAccounts[row.payment_method || 'default'] || counterAccounts['default'];

      // Apply deductible percent to amount
      const deductibleFraction = (row.deductible_percent ?? 100) / 100;
      const amount = Math.round(row.gross_amount * deductibleFraction * 100) / 100;

      if (amount <= 0) continue;

      records.push({
        amount,
        debitCredit: 'S', // Debit for expenses
        currency: 'EUR',
        account,
        counterAccount,
        vatCode: getVatCode(row.vat_rate),
        documentDate: formatDatevDate(row.date),
        documentRef1: row.reference_number || '',
        description: truncate(`${row.vendor || ''}: ${row.description}`.trim(), 60),
        documentRef2: row.receipt_path ? extractFilename(row.receipt_path) : undefined,
      });
    }
  }

  // Get depreciation records
  if (options.includeDepreciation !== false) {
    const year = parseInt(options.startDate.substring(0, 4), 10);
    const depRows = db.prepare(
      `SELECT ds.*, a.name as asset_name 
       FROM depreciation_schedule ds
       JOIN assets a ON ds.asset_id = a.id
       WHERE ds.year = ?
       ORDER BY a.name ASC`
    ).all(year) as Array<{
      asset_id: string; year: number; depreciation_amount: number;
      asset_name: string;
    }>;

    const afaAccount = expenseAccounts['depreciation'];
    const counterAccount = counterAccounts['default'];

    for (const row of depRows) {
      if (row.depreciation_amount <= 0) continue;

      records.push({
        amount: row.depreciation_amount,
        debitCredit: 'S',
        currency: 'EUR',
        account: afaAccount,
        counterAccount,
        vatCode: 0, // No VAT on depreciation
        documentDate: `3112`, // Year-end (Dec 31)
        documentRef1: '',
        description: truncate(`AfA: ${row.asset_name}`, 60),
      });
    }
  }

  // Validate records
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.amount <= 0) errors.push(`Record ${i + 1}: Amount must be positive`);
    if (!r.account) errors.push(`Record ${i + 1}: Missing account number`);
    if (!r.counterAccount) errors.push(`Record ${i + 1}: Missing counter account`);
  }

  if (records.length === 0) {
    warnings.push('No records found in the selected date range');
  }

  // Generate CSV
  const csv = generateCsv(records, options);

  // Generate filename
  const startStr = options.startDate.replace(/-/g, '');
  const endStr = options.endDate.replace(/-/g, '');
  const filename = `DATEV_${skr}_${startStr}_${endStr}.csv`;

  log.info({
    recordCount: records.length,
    startDate: options.startDate,
    endDate: options.endDate,
    chartOfAccounts: skr,
  }, 'DATEV export generated');

  return {
    csv,
    recordCount: records.length,
    filename,
    records,
    errors,
    warnings,
  };
}

// ============================================================================
// CSV Generation
// ============================================================================

function generateCsv(records: DatevRecord[], options: DatevExportOptions): string {
  const lines: string[] = [];

  // EXTF Header
  lines.push([
    '"EXTF"', '510', '21', // Format, Version, Category
    '"Buchungsstapel"', '', '', // Description
    `"${options.consultantNumber || ''}"`, // Berater-Nr.
    `"${options.clientNumber || ''}"`, // Mandant-Nr.
    '', // WJ-Beginn
    `"${options.chartOfAccounts}"`, // Kontenplan
    '', '', '', '', '', // Padding
  ].join(';'));

  // Column headers
  const headers = [
    'Umsatz', 'Soll/Haben', 'WKZ', 'Konto', 'Gegenkonto',
    'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2',
    'Buchungstext',
  ];
  lines.push(headers.join(';'));

  // Data rows
  for (const r of records) {
    const row = [
      formatGermanNumber(r.amount),
      r.debitCredit,
      r.currency,
      String(r.account),
      String(r.counterAccount),
      String(r.vatCode),
      r.documentDate,
      escapeCsv(r.documentRef1),
      escapeCsv(r.documentRef2 || ''),
      escapeCsv(r.description),
    ];
    lines.push(row.join(';'));
  }

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function getVatCode(vatRate: number): number {
  if (vatRate === 19) return 3;
  if (vatRate === 7) return 2;
  return 0;
}

function formatDatevDate(dateStr: string): string {
  // YYYY-MM-DD → DDMM
  const day = dateStr.substring(8, 10);
  const month = dateStr.substring(5, 7);
  return `${day}${month}`;
}

function formatGermanNumber(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function escapeCsv(value: string): string {
  if (!value) return '';
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function extractFilename(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
}
