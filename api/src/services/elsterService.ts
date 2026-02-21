/**
 * ELSTER Integration Service
 * 
 * Handles electronic tax filing with the German ELSTER system.
 * 
 * Architecture Decision (Phase 1):
 *   Use an API provider approach rather than direct ERiC library integration.
 *   ERiC requires native C bindings and platform-specific builds.
 *   For Phase 1, we generate the ELSTER-compatible XML and provide
 *   manual submission workflow. API provider integration can be added later.
 * 
 * Supported filing types:
 *   - USt-VA (Umsatzsteuer-Voranmeldung) — monthly/quarterly VAT return
 *   - ZM (Zusammenfassende Meldung) — EU sales listing
 *   - EÜR (Einnahmenüberschussrechnung) — annual profit/loss report
 */

import type Database from 'better-sqlite3';
import { generateId, getCurrentTimestamp } from '../database.js';
import { createLogger } from '../logger.js';
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../constants/euer.js';
import { EXPENSE_CATEGORY_MAP } from '../constants/expense-categories.js';
import { auditCreate, type AuditContext } from './auditService.js';

const log = createLogger('elster');

// ============================================================================
// Types
// ============================================================================

export interface UstVaData {
  year: number;
  period: string;           // '01'-'12' for monthly, 'Q1'-'Q4' for quarterly
  periodType: 'monthly' | 'quarterly';
  
  // Kennzahlen (tax line numbers)
  kz81: number;             // Steuerpflichtige Umsätze 19% — Bemessungsgrundlage
  kz86: number;             // Steuerpflichtige Umsätze 7% — Bemessungsgrundlage
  kz36_base: number;        // USt 19% — calculated tax amount
  kz36_tax: number;         // (internal) 
  kz35_base: number;        // USt 7% — calculated tax amount
  kz35_tax: number;         // (internal)
  kz66: number;             // Vorsteuerbeträge aus Rechnungen (§15 Abs. 1 S. 1 Nr. 1)
  kz67: number;             // Vorsteuer aus §13b-Leistungen
  kz83: number;             // Verbleibende USt-Vorauszahlung (Zahllast)
  
  // Additional context
  steuernummer?: string;
  taxOfficeNumber?: string;
}

export interface ZmData {
  year: number;
  quarter: number;
  entries: ZmEntry[];
  steuernummer?: string;
}

export interface ZmEntry {
  vatId: string;             // USt-IdNr. of EU customer
  countryCode: string;       // ISO country code
  totalAmount: number;       // Total supplies to this customer in period
  serviceIndicator: boolean; // true = services, false = goods
}

export interface EuerData {
  year: number;
  income: Record<number, number>;    // EÜR line → amount
  expenses: Record<number, number>;  // EÜR line → amount
  totalIncome: number;
  totalExpenses: number;
  gewinn: number;
  steuernummer?: string;
}

export interface ElsterSubmission {
  id: string;
  type: string;
  period: string;
  status: string;
  xml_content: string | null;
  response_xml: string | null;
  transfer_ticket: string | null;
  error_message: string | null;
  tax_data: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  test_mode: number;
  created_at: string;
}

// ============================================================================
// USt-VA (VAT Advance Return) Functions
// ============================================================================

/**
 * Calculate USt-VA data for a given period
 */
export function calculateUstVa(
  db: Database.Database,
  year: number,
  period: string,
  periodType: 'monthly' | 'quarterly'
): UstVaData {
  let startDate: string;
  let endDate: string;

  if (periodType === 'monthly') {
    const month = parseInt(period, 10);
    startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = new Date(year, month, 0); // Last day of month
    endDate = `${year}-${String(month).padStart(2, '0')}-${String(endMonth.getDate()).padStart(2, '0')}`;
  } else {
    const quarter = parseInt(period.replace('Q', ''), 10);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonthNum = quarter * 3;
    startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endMonth = new Date(year, endMonthNum, 0);
    endDate = `${year}-${String(endMonthNum).padStart(2, '0')}-${String(endMonth.getDate()).padStart(2, '0')}`;
  }

  // Get income for the period (exclude soft-deleted)
  const incomeRecords = db.prepare(
    `SELECT * FROM income WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as Array<{
    net_amount: number; vat_rate: number; vat_amount: number;
  }>;

  // Get expenses for the period (exclude soft-deleted)
  const expenseRecords = db.prepare(
    `SELECT * FROM expenses WHERE date >= ? AND date <= ? AND (is_deleted IS NULL OR is_deleted = 0)`
  ).all(startDate, endDate) as Array<{
    category: string; net_amount: number; vat_rate: number; vat_amount: number;
    deductible_percent?: number;
  }>;

  // Kz81: 19% tax base (Bemessungsgrundlage)
  const kz81 = incomeRecords
    .filter(i => i.vat_rate === 19)
    .reduce((sum, i) => sum + i.net_amount, 0);

  // Kz86: 7% tax base
  const kz86 = incomeRecords
    .filter(i => i.vat_rate === 7)
    .reduce((sum, i) => sum + i.net_amount, 0);

  // Tax amounts
  const kz36_tax = Math.round(kz81 * 0.19 * 100) / 100;
  const kz35_tax = Math.round(kz86 * 0.07 * 100) / 100;

  // Kz66: Vorsteuer from invoices
  const kz66 = expenseRecords.reduce((sum, e) => {
    const categoryInfo = EXPENSE_CATEGORY_MAP.get(e.category);
    if (categoryInfo && !categoryInfo.vorsteuer) return sum;
    const deductibleFraction = (e.deductible_percent ?? 100) / 100;
    return sum + (e.vat_amount || 0) * deductibleFraction;
  }, 0);

  // Kz83: Zahllast
  const kz83 = kz36_tax + kz35_tax - kz66;

  const round = (n: number) => Math.round(n * 100) / 100;

  // Get settings
  const steuernummer = getSettingValue(db, 'tax_number');

  return {
    year,
    period,
    periodType,
    kz81: round(kz81),
    kz86: round(kz86),
    kz36_base: round(kz81),
    kz36_tax: round(kz36_tax),
    kz35_base: round(kz86),
    kz35_tax: round(kz35_tax),
    kz66: round(kz66),
    kz67: 0, // §13b reverse charge (Phase 2)
    kz83: round(kz83),
    steuernummer: steuernummer || undefined,
  };
}

/**
 * Generate ELSTER-compatible USt-VA XML
 * Note: This generates the data portion. Full ELSTER envelope requires ERiC or API provider.
 */
export function generateUstVaXml(data: UstVaData): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">');
  lines.push('  <TransferHeader>');
  lines.push('    <Verfahren>ElsterAnmeldung</Verfahren>');
  lines.push('    <DatenArt>UStVA</DatenArt>');
  lines.push('    <Vorgang>send</Vorgang>');
  lines.push('  </TransferHeader>');
  lines.push('  <DatenTeil>');
  lines.push('    <Nutzdatenblock>');
  lines.push('      <Nutzdaten>');
  lines.push('        <Anmeldungssteuern art="UStVA" version="202501">');
  
  // Period
  const zeitraum = data.periodType === 'monthly'
    ? String(parseInt(data.period, 10)).padStart(2, '0')
    : data.period;
  lines.push(`          <Jahr>${data.year}</Jahr>`);
  lines.push(`          <Zeitraum>${zeitraum}</Zeitraum>`);

  if (data.steuernummer) {
    lines.push(`          <Steuernummer>${escapeXml(data.steuernummer)}</Steuernummer>`);
  }

  // Kennzahlen
  if (data.kz81 > 0) {
    lines.push(`          <Kz81>${formatCents(data.kz81)}</Kz81>`);
    lines.push(`          <Kz36>${formatCents(data.kz36_tax)}</Kz36>`);
  }
  if (data.kz86 > 0) {
    lines.push(`          <Kz86>${formatCents(data.kz86)}</Kz86>`);
    lines.push(`          <Kz35>${formatCents(data.kz35_tax)}</Kz35>`);
  }
  if (data.kz66 > 0) {
    lines.push(`          <Kz66>${formatCents(data.kz66)}</Kz66>`);
  }
  if (data.kz67 > 0) {
    lines.push(`          <Kz67>${formatCents(data.kz67)}</Kz67>`);
  }
  lines.push(`          <Kz83>${formatCents(data.kz83)}</Kz83>`);

  lines.push('        </Anmeldungssteuern>');
  lines.push('      </Nutzdaten>');
  lines.push('    </Nutzdatenblock>');
  lines.push('  </DatenTeil>');
  lines.push('</Elster>');

  return lines.join('\n');
}

// ============================================================================
// ZM (Zusammenfassende Meldung) Functions
// ============================================================================

/**
 * Calculate ZM data from invoice records with EU clients
 */
export function calculateZm(
  db: Database.Database,
  year: number,
  quarter: number
): ZmData {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  // Find income from EU B2B clients
  const records = db.prepare(`
    SELECT c.vat_id, c.country_code, SUM(i.net_amount) as total
    FROM income i
    JOIN clients c ON i.client_id = c.id
    WHERE i.date >= ? AND i.date <= ?
      AND c.is_eu_business = 1
      AND c.vat_id IS NOT NULL
      AND c.country_code != 'DE'
      AND (i.is_deleted IS NULL OR i.is_deleted = 0)
    GROUP BY c.vat_id, c.country_code
  `).all(startDate, endDate) as Array<{
    vat_id: string; country_code: string; total: number;
  }>;

  const entries: ZmEntry[] = records.map(r => ({
    vatId: r.vat_id,
    countryCode: r.country_code,
    totalAmount: Math.round(r.total * 100) / 100,
    serviceIndicator: true, // Default to services for freelancers
  }));

  return {
    year,
    quarter,
    entries,
    steuernummer: getSettingValue(db, 'tax_number') || undefined,
  };
}

/**
 * Generate ELSTER-compatible ZM XML
 */
export function generateZmXml(data: ZmData): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Elster xmlns="http://www.elster.de/elsterxml/schema/v11">');
  lines.push('  <TransferHeader>');
  lines.push('    <Verfahren>ElsterAnmeldung</Verfahren>');
  lines.push('    <DatenArt>ZM</DatenArt>');
  lines.push('    <Vorgang>send</Vorgang>');
  lines.push('  </TransferHeader>');
  lines.push('  <DatenTeil>');
  lines.push('    <Nutzdatenblock>');
  lines.push('      <Nutzdaten>');
  lines.push(`        <ZM jahr="${data.year}" quartal="${data.quarter}">`);

  if (data.steuernummer) {
    lines.push(`          <Steuernummer>${escapeXml(data.steuernummer)}</Steuernummer>`);
  }

  for (const entry of data.entries) {
    lines.push('          <ZMEintrag>');
    lines.push(`            <UStIdNr>${escapeXml(entry.vatId)}</UStIdNr>`);
    lines.push(`            <Land>${entry.countryCode}</Land>`);
    lines.push(`            <Betrag>${formatCents(entry.totalAmount)}</Betrag>`);
    lines.push(`            <Leistung>${entry.serviceIndicator ? '1' : '0'}</Leistung>`);
    lines.push('          </ZMEintrag>');
  }

  lines.push('        </ZM>');
  lines.push('      </Nutzdaten>');
  lines.push('    </Nutzdatenblock>');
  lines.push('  </DatenTeil>');
  lines.push('</Elster>');

  return lines.join('\n');
}

// ============================================================================
// Submission Management
// ============================================================================

/**
 * Create a submission record (draft)
 */
export function createSubmission(
  db: Database.Database,
  type: 'ust_va' | 'zm' | 'euer',
  period: string,
  xmlContent: string,
  taxData: unknown,
  testMode = false,
  context: AuditContext = {}
): ElsterSubmission {
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO elster_submissions 
    (id, type, period, status, xml_content, tax_data, test_mode, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(id, type, period, xmlContent, JSON.stringify(taxData), testMode ? 1 : 0, now, now);

  auditCreate(db, 'period_lock', id, {
    type: 'elster_submission', submission_type: type, period,
  }, context);

  log.info({ id, type, period, testMode }, 'ELSTER submission created');

  return db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(id) as ElsterSubmission;
}

/**
 * Update submission status
 */
export function updateSubmissionStatus(
  db: Database.Database,
  id: string,
  status: string,
  responseXml?: string,
  transferTicket?: string,
  errorMessage?: string
): void {
  const now = getCurrentTimestamp();
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const params: unknown[] = [status, now];

  if (responseXml) {
    updates.push('response_xml = ?');
    params.push(responseXml);
  }
  if (transferTicket) {
    updates.push('transfer_ticket = ?');
    params.push(transferTicket);
  }
  if (errorMessage) {
    updates.push('error_message = ?');
    params.push(errorMessage);
  }
  if (status === 'submitted') {
    updates.push('submitted_at = ?');
    params.push(now);
  }
  if (status === 'accepted') {
    updates.push('accepted_at = ?');
    params.push(now);
  }

  params.push(id);
  db.prepare(`UPDATE elster_submissions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  log.info({ id, status, transferTicket }, 'ELSTER submission status updated');
}

/**
 * Get submission history
 */
export function getSubmissions(
  db: Database.Database,
  filters: { type?: string; period?: string; year?: number } = {}
): ElsterSubmission[] {
  let sql = 'SELECT * FROM elster_submissions WHERE 1=1';
  const params: unknown[] = [];

  if (filters.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.period) {
    sql += ' AND period = ?';
    params.push(filters.period);
  }
  if (filters.year) {
    sql += ' AND period LIKE ?';
    params.push(`${filters.year}%`);
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params) as ElsterSubmission[];
}

// ============================================================================
// Helpers
// ============================================================================

function getSettingValue(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCents(amount: number): string {
  return amount.toFixed(2);
}
