/**
 * Sequential Numbering Service
 * 
 * GoBD requires gap-free sequential numbering for all financial records.
 * This service manages reference number sequences for income, expenses, etc.
 * 
 * Format:
 *   Income:   EI-{YYYY}-{NNN}  (Einnahme)
 *   Expense:  EA-{YYYY}-{NNN}  (Ausgabe)
 *   Invoice:  RE-{YYYY}-{NNN}  (Rechnung) — already exists
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';

const log = createLogger('sequence');

// ============================================================================
// Types
// ============================================================================

export type SequencePrefix = 'EI' | 'EA' | 'RE';

interface SequenceCounter {
  prefix: string;
  last_number: number;
  updated_at: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the next sequential number for a given prefix and year.
 * Uses the sequence_counters table for atomic increment.
 * Falls back to scanning existing records if no counter exists yet.
 */
export function getNextSequenceNumber(
  db: Database.Database,
  type: SequencePrefix,
  year?: number
): string {
  const currentYear = year || new Date().getFullYear();
  const prefix = `${type}-${currentYear}`;

  // Try to get existing counter
  const counter = db.prepare(
    'SELECT * FROM sequence_counters WHERE prefix = ?'
  ).get(prefix) as SequenceCounter | undefined;

  let nextNumber: number;

  if (counter) {
    nextNumber = counter.last_number + 1;
    db.prepare(
      'UPDATE sequence_counters SET last_number = ?, updated_at = datetime(\'now\') WHERE prefix = ?'
    ).run(nextNumber, prefix);
  } else {
    // Initialize counter — scan existing records to find the highest number
    const existingMax = getHighestExistingNumber(db, type, currentYear);
    nextNumber = existingMax + 1;
    
    db.prepare(
      'INSERT INTO sequence_counters (prefix, last_number, updated_at) VALUES (?, ?, datetime(\'now\'))'
    ).run(prefix, nextNumber);
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Scan existing records to find the highest reference number for a given type and year.
 */
function getHighestExistingNumber(
  db: Database.Database,
  type: SequencePrefix,
  year: number
): number {
  const prefix = `${type}-${year}-`;
  let tableName: string;
  let columnName: string;

  switch (type) {
    case 'EI':
      tableName = 'income';
      columnName = 'reference_number';
      break;
    case 'EA':
      tableName = 'expenses';
      columnName = 'reference_number';
      break;
    case 'RE':
      tableName = 'invoices';
      columnName = 'invoice_number';
      break;
    default:
      return 0;
  }

  const result = db.prepare(
    `SELECT ${columnName} FROM ${tableName} 
     WHERE ${columnName} LIKE ? 
     ORDER BY ${columnName} DESC 
     LIMIT 1`
  ).get(`${prefix}%`) as Record<string, string> | undefined;

  if (!result) return 0;

  const refNumber = result[columnName];
  const numPart = refNumber.replace(prefix, '');
  const parsed = parseInt(numPart, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Backfill reference numbers for existing records that don't have them.
 * Call this during migration or startup.
 */
export function backfillReferenceNumbers(db: Database.Database): {
  income: number;
  expenses: number;
} {
  let incomeCount = 0;
  let expenseCount = 0;

  // Backfill income
  const incomeWithout = db.prepare(
    'SELECT id, date FROM income WHERE reference_number IS NULL ORDER BY date ASC, created_at ASC'
  ).all() as Array<{ id: string; date: string }>;

  for (const record of incomeWithout) {
    const year = parseInt(record.date.substring(0, 4), 10);
    const refNumber = getNextSequenceNumber(db, 'EI', year);
    db.prepare('UPDATE income SET reference_number = ? WHERE id = ?').run(refNumber, record.id);
    incomeCount++;
  }

  // Backfill expenses
  const expenseWithout = db.prepare(
    'SELECT id, date FROM expenses WHERE reference_number IS NULL ORDER BY date ASC, created_at ASC'
  ).all() as Array<{ id: string; date: string }>;

  for (const record of expenseWithout) {
    const year = parseInt(record.date.substring(0, 4), 10);
    const refNumber = getNextSequenceNumber(db, 'EA', year);
    db.prepare('UPDATE expenses SET reference_number = ? WHERE id = ?').run(refNumber, record.id);
    expenseCount++;
  }

  if (incomeCount > 0 || expenseCount > 0) {
    log.info(
      { incomeCount, expenseCount },
      'Backfilled reference numbers for existing records'
    );
  }

  return { income: incomeCount, expenses: expenseCount };
}
