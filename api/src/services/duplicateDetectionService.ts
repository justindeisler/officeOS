/**
 * Duplicate Detection Service
 *
 * Detects potential duplicate expenses and income records based on:
 * - Exact amount match
 * - Same day or within 48 hours
 * - Fuzzy vendor/client name matching (Levenshtein distance)
 *
 * Records marked as duplicates are excluded from EÜR/USt-VA calculations.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';

const log = createLogger('duplicate-detection');

// ============================================================================
// Types
// ============================================================================

export interface DuplicateCandidate {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  partner: string;       // vendor (expenses) or client/description (income)
  description: string;
  similarity_score: number;  // 0–1 composite
  matched_fields: string[];  // e.g. ['amount', 'date', 'vendor']
}

export interface MarkedDuplicate {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  partner: string;
  description: string;
  duplicate_of_id: string;
}

// ============================================================================
// String Normalisation & Levenshtein
// ============================================================================

/** Suffixes commonly appended to German company names */
const COMPANY_SUFFIXES = [
  'gmbh', 'gbr', 'ag', 'kg', 'ohg', 'ug', 'e.v.', 'ev',
  'ltd', 'llc', 'inc', 'co', 'corp', 'plc', 'sa', 'bv',
  'gmbh & co. kg', 'gmbh & co kg',
  'gmbh & co. ohg', 'gmbh & co ohg',
];

/**
 * Normalise a partner/vendor name for comparison:
 * lowercase, trim, strip legal suffixes, collapse whitespace.
 */
export function normalisePartner(name: string): string {
  if (!name) return '';
  let n = name.toLowerCase().trim();

  // Remove common legal suffixes (longest first to avoid partial matches)
  const sorted = [...COMPANY_SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sorted) {
    if (n.endsWith(suffix)) {
      n = n.slice(0, -suffix.length).trim();
    }
  }

  // Strip trailing punctuation, collapse whitespace
  n = n.replace(/[.,;:\-]+$/g, '').replace(/\s+/g, ' ').trim();
  return n;
}

/**
 * Standard Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Compute a 0–1 similarity score between two partner names.
 * Uses normalisation + Levenshtein distance.
 */
export function partnerSimilarity(a: string, b: string): number {
  const na = normalisePartner(a);
  const nb = normalisePartner(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Compute date similarity: 1.0 = same day, 0.8 = within 48 h, 0 otherwise.
 */
export function dateSimilarity(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) return 1.0;   // same day (or within 24 h)
  if (diffHours <= 48) return 0.8;
  return 0;
}

// ============================================================================
// Duplicate Finding
// ============================================================================

/** Minimum composite score to count as a duplicate candidate */
const DUPLICATE_THRESHOLD = 0.6;

/** Minimum partner similarity to count as a "match" */
const PARTNER_THRESHOLD = 0.6;

/**
 * Find potential duplicates for a given record.
 *
 * @param db        Database handle
 * @param type      'income' | 'expense'
 * @param amount    Net amount to compare (exact match required)
 * @param date      ISO date string
 * @param partner   Vendor (expense) or client/description (income)
 * @param excludeId Optional record ID to exclude from results (the record itself)
 */
export function findDuplicates(
  db: Database.Database,
  type: 'income' | 'expense',
  amount: number,
  date: string,
  partner: string,
  excludeId?: string,
): DuplicateCandidate[] {
  // Date window: ±3 days to capture 48 h window safely
  const refDate = new Date(date);
  const from = new Date(refDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(refDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const table = type === 'expense' ? 'expenses' : 'income';
  const partnerCol = type === 'expense' ? 'vendor' : 'description';

  // Query candidates: same amount, within date window, not deleted, not already marked duplicate
  let sql = `
    SELECT id, date, ${partnerCol} AS partner, description, net_amount
    FROM ${table}
    WHERE net_amount = ?
      AND date >= ? AND date <= ?
      AND (is_deleted IS NULL OR is_deleted = 0)
      AND (is_duplicate IS NULL OR is_duplicate = 0)
  `;
  const params: unknown[] = [amount, from, to];

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    date: string;
    partner: string | null;
    description: string;
    net_amount: number;
  }>;

  const candidates: DuplicateCandidate[] = [];

  for (const row of rows) {
    const matchedFields: string[] = ['amount']; // amount always matches (query filter)

    // Date similarity
    const dSim = dateSimilarity(date, row.date);
    if (dSim === 0) continue; // outside 48 h window
    if (dSim >= 0.8) matchedFields.push('date');

    // Partner similarity
    const rowPartner = row.partner || row.description || '';
    const pSim = partnerSimilarity(partner, rowPartner);
    if (pSim >= PARTNER_THRESHOLD) {
      matchedFields.push(type === 'expense' ? 'vendor' : 'client');
    }

    // Composite score: weighted average
    //   amount = 0.4 (always 1.0 since we filter), date = 0.3, partner = 0.3
    const composite = 0.4 * 1.0 + 0.3 * dSim + 0.3 * pSim;

    if (composite >= DUPLICATE_THRESHOLD) {
      candidates.push({
        id: row.id,
        type,
        amount: row.net_amount,
        date: row.date,
        partner: rowPartner,
        description: row.description,
        similarity_score: Math.round(composite * 100) / 100,
        matched_fields: matchedFields,
      });
    }
  }

  // Sort by highest similarity first
  candidates.sort((a, b) => b.similarity_score - a.similarity_score);

  return candidates;
}

// ============================================================================
// Mark / Unmark
// ============================================================================

/**
 * Mark a record as a duplicate of another record.
 */
export function markAsDuplicate(
  db: Database.Database,
  type: 'income' | 'expense',
  recordId: string,
  duplicateOfId: string,
): void {
  const table = type === 'expense' ? 'expenses' : 'income';

  const result = db.prepare(
    `UPDATE ${table} SET is_duplicate = 1, duplicate_of_id = ? WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)`,
  ).run(duplicateOfId, recordId);

  if (result.changes === 0) {
    throw new Error(`Record ${recordId} not found in ${table}`);
  }

  log.info({ type, recordId, duplicateOfId }, 'Marked as duplicate');
}

/**
 * Unmark a record so it is no longer treated as a duplicate.
 */
export function unmarkAsDuplicate(
  db: Database.Database,
  type: 'income' | 'expense',
  recordId: string,
): void {
  const table = type === 'expense' ? 'expenses' : 'income';

  const result = db.prepare(
    `UPDATE ${table} SET is_duplicate = 0, duplicate_of_id = NULL WHERE id = ?`,
  ).run(recordId);

  if (result.changes === 0) {
    throw new Error(`Record ${recordId} not found in ${table}`);
  }

  log.info({ type, recordId }, 'Unmarked duplicate');
}

// ============================================================================
// List Marked Duplicates
// ============================================================================

/**
 * List all records currently marked as duplicates.
 */
export function listMarkedDuplicates(
  db: Database.Database,
  type?: 'income' | 'expense',
): MarkedDuplicate[] {
  const results: MarkedDuplicate[] = [];

  if (!type || type === 'expense') {
    const expRows = db.prepare(
      `SELECT id, 'expense' AS type, net_amount AS amount, date, vendor AS partner, description, duplicate_of_id
       FROM expenses
       WHERE is_duplicate = 1 AND (is_deleted IS NULL OR is_deleted = 0)
       ORDER BY date DESC`,
    ).all() as MarkedDuplicate[];
    results.push(...expRows);
  }

  if (!type || type === 'income') {
    const incRows = db.prepare(
      `SELECT id, 'income' AS type, net_amount AS amount, date, description AS partner, description, duplicate_of_id
       FROM income
       WHERE is_duplicate = 1 AND (is_deleted IS NULL OR is_deleted = 0)
       ORDER BY date DESC`,
    ).all() as MarkedDuplicate[];
    results.push(...incRows);
  }

  return results;
}
