/**
 * Missing Receipt Service
 *
 * Tracks expenses without receipts and generates alerts for
 * missing documentation (GoBD compliance).
 *
 * German tax law requires receipts for expense deductibility.
 * This service monitors expenses and creates alerts based on
 * amount thresholds and age.
 *
 * Severity rules:
 * - Low:    < €150,  < 30 days old, no receipt
 * - Medium: €150-€1000 < 30 days, OR < €150 but > 30 days
 * - High:   > €1000, OR > 60 days without receipt
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';

const log = createLogger('missing-receipt');

// ============================================================================
// Types
// ============================================================================

export interface MissingReceiptAlert {
  id: string;
  expense_id: string;
  created_at: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  days_outstanding: number;
  amount: number;
  vendor: string;
  dismissed: boolean;
}

export interface AlertStats {
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface ExpenseRow {
  id: string;
  date: string;
  vendor: string | null;
  description: string;
  gross_amount: number;
  receipt_path: string | null;
  is_deleted: number;
  is_duplicate: number;
}

// ============================================================================
// Severity Calculation
// ============================================================================

/**
 * Calculate the number of days between a date string and now.
 */
function daysOutstanding(dateStr: string): number {
  const expenseDate = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - expenseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine alert severity based on amount and age.
 */
function calculateSeverity(grossAmount: number, days: number): 'low' | 'medium' | 'high' {
  // High: > €1000 OR > 60 days
  if (grossAmount > 1000 || days > 60) {
    return 'high';
  }

  // Medium: €150-€1000 (< 30 days) OR < €150 but > 30 days
  if (grossAmount >= 150 || days > 30) {
    return 'medium';
  }

  // Low: < €150, < 30 days
  return 'low';
}

/**
 * Build a human-readable reason string.
 */
function buildReason(grossAmount: number, vendor: string | null, days: number): string {
  const amountStr = grossAmount.toFixed(2);
  const vendorPart = vendor ? ` to ${vendor}` : '';
  return `Expense €${amountStr}${vendorPart} has no receipt (${days} days old)`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check a single expense for missing receipt and create/update/remove alert.
 *
 * - If the expense has a receipt, any existing alert is removed.
 * - If the expense is deleted or a duplicate, no alert is created.
 * - If an alert already exists, severity is updated if changed.
 * - If no alert exists, a new one is created.
 */
export function checkExpenseForMissingReceipt(db: Database.Database, expenseId: string): void {
  const expense = db.prepare(`
    SELECT id, date, vendor, description, gross_amount, receipt_path,
           COALESCE(is_deleted, 0) AS is_deleted,
           COALESCE(is_duplicate, 0) AS is_duplicate
    FROM expenses
    WHERE id = ?
  `).get(expenseId) as ExpenseRow | undefined;

  if (!expense) {
    return;
  }

  // Skip deleted or duplicate expenses
  if (expense.is_deleted || expense.is_duplicate) {
    // Remove any existing alert
    removeAlertForExpense(db, expenseId);
    return;
  }

  // If expense has a receipt, remove any existing alert
  if (expense.receipt_path && expense.receipt_path !== '') {
    removeAlertForExpense(db, expenseId);
    return;
  }

  // Calculate severity
  const days = daysOutstanding(expense.date);
  const severity = calculateSeverity(expense.gross_amount, days);
  const reason = buildReason(expense.gross_amount, expense.vendor, days);

  // Check for existing alert
  const existing = db.prepare(`
    SELECT id, severity FROM missing_receipt_alerts
    WHERE expense_id = ?
  `).get(expenseId) as { id: string; severity: string } | undefined;

  if (existing) {
    // Update severity and reason if changed
    if (existing.severity !== severity) {
      db.prepare(`
        UPDATE missing_receipt_alerts
        SET severity = ?, reason = ?, dismissed = FALSE, dismissed_at = NULL, dismissed_by = NULL
        WHERE id = ?
      `).run(severity, reason, existing.id);
    } else {
      // Just update the reason (days_outstanding changes)
      db.prepare(`
        UPDATE missing_receipt_alerts SET reason = ? WHERE id = ?
      `).run(reason, existing.id);
    }
  } else {
    // Create new alert
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO missing_receipt_alerts (id, expense_id, created_at, severity, reason, dismissed)
      VALUES (?, ?, ?, ?, ?, FALSE)
    `).run(id, expenseId, now, severity, reason);
  }
}

/**
 * Remove alert(s) for a specific expense (e.g., when receipt is uploaded).
 */
export function removeAlertForExpense(db: Database.Database, expenseId: string): void {
  db.prepare('DELETE FROM missing_receipt_alerts WHERE expense_id = ?').run(expenseId);
}

/**
 * Get all active (not dismissed) alerts with enriched expense data.
 */
export function getActiveAlerts(db: Database.Database): MissingReceiptAlert[] {
  const rows = db.prepare(`
    SELECT
      mra.id,
      mra.expense_id,
      mra.created_at,
      mra.severity,
      mra.reason,
      mra.dismissed,
      e.gross_amount AS amount,
      COALESCE(e.vendor, '') AS vendor,
      e.date AS expense_date
    FROM missing_receipt_alerts mra
    JOIN expenses e ON e.id = mra.expense_id
    WHERE mra.dismissed = FALSE
    ORDER BY
      CASE mra.severity
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      e.date ASC
  `).all() as Array<{
    id: string;
    expense_id: string;
    created_at: string;
    severity: 'low' | 'medium' | 'high';
    reason: string;
    dismissed: number;
    amount: number;
    vendor: string;
    expense_date: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    expense_id: row.expense_id,
    created_at: row.created_at,
    severity: row.severity,
    reason: row.reason,
    days_outstanding: daysOutstanding(row.expense_date),
    amount: row.amount,
    vendor: row.vendor,
    dismissed: false,
  }));
}

/**
 * Get all active alerts — alias matching the sprint spec.
 */
export function checkMissingReceipts(db: Database.Database): MissingReceiptAlert[] {
  return getActiveAlerts(db);
}

/**
 * Get alert statistics (active alerts only).
 */
export function getAlertStats(db: Database.Database): AlertStats {
  const rows = db.prepare(`
    SELECT severity, COUNT(*) AS count
    FROM missing_receipt_alerts
    WHERE dismissed = FALSE
    GROUP BY severity
  `).all() as Array<{ severity: string; count: number }>;

  const stats: AlertStats = { total: 0, high: 0, medium: 0, low: 0 };

  for (const row of rows) {
    const key = row.severity as keyof Omit<AlertStats, 'total'>;
    if (key in stats) {
      stats[key] = row.count;
    }
    stats.total += row.count;
  }

  return stats;
}

/**
 * Dismiss an alert.
 */
export function dismissAlert(db: Database.Database, alertId: string, dismissedBy = 'user'): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE missing_receipt_alerts
    SET dismissed = TRUE, dismissed_at = ?, dismissed_by = ?
    WHERE id = ?
  `).run(now, dismissedBy, alertId);
}

/**
 * Restore a dismissed alert.
 */
export function restoreAlert(db: Database.Database, alertId: string): void {
  db.prepare(`
    UPDATE missing_receipt_alerts
    SET dismissed = FALSE, dismissed_at = NULL, dismissed_by = NULL
    WHERE id = ?
  `).run(alertId);
}

/**
 * Daily scan: re-check all expenses without receipts.
 * Updates severity based on current age and creates alerts for
 * any newly eligible expenses.
 */
export function dailyScan(db: Database.Database): void {
  const expenses = db.prepare(`
    SELECT id
    FROM expenses
    WHERE COALESCE(is_deleted, 0) = 0
      AND COALESCE(is_duplicate, 0) = 0
      AND (receipt_path IS NULL OR receipt_path = '')
  `).all() as Array<{ id: string }>;

  for (const expense of expenses) {
    checkExpenseForMissingReceipt(db, expense.id);
  }

  log.info({ scanned: expenses.length }, 'Daily missing receipt scan completed');
}
