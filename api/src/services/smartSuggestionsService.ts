/**
 * Smart Suggestions Service
 *
 * Provides context-aware recommendations when creating new records:
 * - Recent vendors/clients (frequency-based, last 90 days)
 * - Next invoice number (pattern detection + smart increment)
 * - Suggested VAT rates, payment methods, payment terms
 * - Integration with auto-categorization service
 *
 * Used by the form prefilling API to speed up data entry.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';
import { suggestCategory } from './autoCategorizeService.js';

const log = createLogger('smart-suggestions');

// ============================================================================
// Types
// ============================================================================

export interface VendorSuggestion {
  vendor: string;
  count: number;
  lastAmount: number;
}

export interface ClientSuggestion {
  client: string;
  count: number;
  lastAmount: number;
}

export interface SmartSuggestions {
  // For expenses
  recentVendors?: VendorSuggestion[];
  suggestedCategory?: string;
  suggestedVatRate?: number;
  suggestedPaymentMethod?: string;

  // For income
  recentClients?: ClientSuggestion[];

  // For invoices
  nextInvoiceNumber?: string;
  suggestedPaymentTerms?: number;
  suggestedDueDate?: string;
}

export interface InvoiceNumberPattern {
  pattern: 'sequential' | 'year-based' | 'date-based' | 'unknown';
  prefix?: string;
  lastNumber?: number;
  year?: number;
}

// ============================================================================
// Invoice Number Pattern Detection
// ============================================================================

/**
 * Detect the pattern used in existing invoice numbers.
 *
 * Supported patterns:
 * - Year-based: RE-2024-001, INV-2024-042, 2024-RE-007
 * - Sequential: 001, 002, 003 or INV-001, INV-002
 * - Date-based: INV-20240115-01
 * - Unknown: fallback
 */
export function detectInvoiceNumberPattern(
  invoiceNumbers: string[]
): InvoiceNumberPattern {
  if (!invoiceNumbers.length) {
    return { pattern: 'unknown' };
  }

  // Take the last invoice number (most recent)
  const last = invoiceNumbers[0]; // Already sorted DESC

  // Try year-based pattern: PREFIX-YYYY-NNN or PREFIX-YYYY-NN
  const yearBasedMatch = last.match(/^(.+?)[_-](\d{4})[_-](\d{1,5})$/);
  if (yearBasedMatch) {
    return {
      pattern: 'year-based',
      prefix: yearBasedMatch[1],
      year: parseInt(yearBasedMatch[2], 10),
      lastNumber: parseInt(yearBasedMatch[3], 10),
    };
  }

  // Try date-based pattern: PREFIX-YYYYMMDD-NN
  const dateBasedMatch = last.match(/^(.+?)[_-](\d{8})[_-](\d{1,5})$/);
  if (dateBasedMatch) {
    const dateStr = dateBasedMatch[2];
    const year = parseInt(dateStr.substring(0, 4), 10);
    // Validate it looks like a date (month 01-12, day 01-31)
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        pattern: 'date-based',
        prefix: dateBasedMatch[1],
        year,
        lastNumber: parseInt(dateBasedMatch[3], 10),
      };
    }
  }

  // Try simple sequential: PREFIX-NNN or just NNN
  const seqWithPrefixMatch = last.match(/^(.+?)[_-](\d{1,5})$/);
  if (seqWithPrefixMatch) {
    return {
      pattern: 'sequential',
      prefix: seqWithPrefixMatch[1],
      lastNumber: parseInt(seqWithPrefixMatch[2], 10),
    };
  }

  // Pure numeric
  const pureNumMatch = last.match(/^(\d{1,5})$/);
  if (pureNumMatch) {
    return {
      pattern: 'sequential',
      lastNumber: parseInt(pureNumMatch[1], 10),
    };
  }

  return { pattern: 'unknown' };
}

/**
 * Generate the next invoice number based on detected pattern.
 */
export function getNextInvoiceNumber(db: Database.Database): string {
  const invoices = db.prepare(
    `SELECT invoice_number FROM invoices
     ORDER BY created_at DESC, invoice_number DESC
     LIMIT 5`
  ).all() as Array<{ invoice_number: string }>;

  const numbers = invoices.map(i => i.invoice_number);
  const detected = detectInvoiceNumberPattern(numbers);
  const currentYear = new Date().getFullYear();

  switch (detected.pattern) {
    case 'year-based': {
      const prefix = detected.prefix!;
      const lastNum = detected.lastNumber!;
      const invoiceYear = detected.year!;

      // Year rollover: if the detected year is before current year, start fresh
      if (invoiceYear < currentYear) {
        return `${prefix}-${currentYear}-001`;
      }

      const nextNum = lastNum + 1;
      const padded = String(nextNum).padStart(3, '0');
      return `${prefix}-${invoiceYear}-${padded}`;
    }

    case 'sequential': {
      const nextNum = (detected.lastNumber || 0) + 1;
      const padded = String(nextNum).padStart(3, '0');
      if (detected.prefix) {
        return `${detected.prefix}-${padded}`;
      }
      return padded;
    }

    case 'date-based': {
      const prefix = detected.prefix!;
      const now = new Date();
      const dateStr = [
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      return `${prefix}-${dateStr}-01`;
    }

    case 'unknown':
    default: {
      // Fallback: INV-YYYYMMDD-001
      const now = new Date();
      const dateStr = [
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      return `INV-${dateStr}-001`;
    }
  }
}

// ============================================================================
// Expense Suggestions
// ============================================================================

/**
 * Get smart suggestions for creating a new expense.
 *
 * Returns:
 * - Top 10 recent vendors (by frequency in last 90 days)
 * - Most common VAT rate
 * - Most common payment method
 */
export function getSuggestionsForExpense(
  db: Database.Database,
  vendor?: string
): SmartSuggestions {
  const suggestions: SmartSuggestions = {};

  try {
    // 1. Recent vendors (top 10 by frequency, last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().split('T')[0];

    const vendorRows = db.prepare(`
      SELECT
        vendor,
        COUNT(*) as count,
        MAX(gross_amount) as lastAmount,
        MAX(date) as lastDate
      FROM expenses
      WHERE (is_deleted IS NULL OR is_deleted = 0)
        AND (is_duplicate IS NULL OR is_duplicate = 0)
        AND vendor IS NOT NULL
        AND vendor != ''
        AND date >= ?
      GROUP BY vendor
      ORDER BY count DESC
      LIMIT 10
    `).all(cutoff) as Array<{ vendor: string; count: number; lastAmount: number; lastDate: string }>;

    // For lastAmount, get the actual last transaction amount per vendor
    suggestions.recentVendors = vendorRows.map(row => {
      const lastTx = db.prepare(`
        SELECT gross_amount FROM expenses
        WHERE vendor = ?
          AND (is_deleted IS NULL OR is_deleted = 0)
          AND (is_duplicate IS NULL OR is_duplicate = 0)
        ORDER BY date DESC, created_at DESC
        LIMIT 1
      `).get(row.vendor) as { gross_amount: number } | undefined;

      return {
        vendor: row.vendor,
        count: row.count,
        lastAmount: lastTx ? lastTx.gross_amount : row.lastAmount,
      };
    });

    // 2. Most common VAT rate (overall or for specific vendor)
    if (vendor) {
      const vatRow = db.prepare(`
        SELECT vat_rate, COUNT(*) as cnt
        FROM expenses
        WHERE vendor = ?
          AND (is_deleted IS NULL OR is_deleted = 0)
          AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY vat_rate
        ORDER BY cnt DESC
        LIMIT 1
      `).get(vendor) as { vat_rate: number; cnt: number } | undefined;

      if (vatRow) {
        suggestions.suggestedVatRate = vatRow.vat_rate;
      }
    }

    if (!suggestions.suggestedVatRate) {
      const globalVat = db.prepare(`
        SELECT vat_rate, COUNT(*) as cnt
        FROM expenses
        WHERE (is_deleted IS NULL OR is_deleted = 0)
          AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND date >= ?
        GROUP BY vat_rate
        ORDER BY cnt DESC
        LIMIT 1
      `).get(cutoff) as { vat_rate: number; cnt: number } | undefined;

      if (globalVat) {
        suggestions.suggestedVatRate = globalVat.vat_rate;
      }
    }

    // 3. Most common payment method (for vendor or global)
    if (vendor) {
      const pmRow = db.prepare(`
        SELECT payment_method, COUNT(*) as cnt
        FROM expenses
        WHERE vendor = ?
          AND (is_deleted IS NULL OR is_deleted = 0)
          AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND payment_method IS NOT NULL
          AND payment_method != ''
        GROUP BY payment_method
        ORDER BY cnt DESC
        LIMIT 1
      `).get(vendor) as { payment_method: string; cnt: number } | undefined;

      if (pmRow) {
        suggestions.suggestedPaymentMethod = pmRow.payment_method;
      }
    }

    if (!suggestions.suggestedPaymentMethod) {
      const globalPm = db.prepare(`
        SELECT payment_method, COUNT(*) as cnt
        FROM expenses
        WHERE (is_deleted IS NULL OR is_deleted = 0)
          AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND payment_method IS NOT NULL
          AND payment_method != ''
          AND date >= ?
        GROUP BY payment_method
        ORDER BY cnt DESC
        LIMIT 1
      `).get(cutoff) as { payment_method: string; cnt: number } | undefined;

      if (globalPm) {
        suggestions.suggestedPaymentMethod = globalPm.payment_method;
      }
    }

    // 4. Suggested category (via auto-categorization service)
    if (vendor) {
      try {
        const categorySuggestions = suggestCategory(db, vendor, '', 0);
        if (categorySuggestions.length > 0) {
          suggestions.suggestedCategory = categorySuggestions[0].category;
        }
      } catch (e) {
        // Auto-categorize may fail if model can't train — that's OK
        log.debug({ err: e }, 'Auto-categorization unavailable for suggestions');
      }
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to generate expense suggestions');
  }

  return suggestions;
}

// ============================================================================
// Income Suggestions
// ============================================================================

/**
 * Get smart suggestions for creating a new income record.
 *
 * Returns:
 * - Top 10 recent clients (by frequency in last 90 days)
 */
export function getSuggestionsForIncome(
  db: Database.Database
): SmartSuggestions {
  const suggestions: SmartSuggestions = {};

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().split('T')[0];

    // Recent clients from income records joined with clients table
    const clientRows = db.prepare(`
      SELECT
        c.name as client,
        COUNT(*) as count
      FROM income i
      JOIN clients c ON i.client_id = c.id
      WHERE (i.is_deleted IS NULL OR i.is_deleted = 0)
        AND (i.is_duplicate IS NULL OR i.is_duplicate = 0)
        AND c.status = 'active'
        AND i.date >= ?
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `).all(cutoff) as Array<{ client: string; count: number }>;

    suggestions.recentClients = clientRows.map(row => {
      const lastTx = db.prepare(`
        SELECT i.gross_amount FROM income i
        JOIN clients c ON i.client_id = c.id
        WHERE c.name = ?
          AND (i.is_deleted IS NULL OR i.is_deleted = 0)
          AND (i.is_duplicate IS NULL OR i.is_duplicate = 0)
        ORDER BY i.date DESC, i.created_at DESC
        LIMIT 1
      `).get(row.client) as { gross_amount: number } | undefined;

      return {
        client: row.client,
        count: row.count,
        lastAmount: lastTx ? lastTx.gross_amount : 0,
      };
    });

    // If no income-based clients found, fall back to active clients
    if (!suggestions.recentClients || suggestions.recentClients.length === 0) {
      const activeClients = db.prepare(`
        SELECT name as client FROM clients
        WHERE status = 'active'
        ORDER BY updated_at DESC
        LIMIT 10
      `).all() as Array<{ client: string }>;

      suggestions.recentClients = activeClients.map(c => ({
        client: c.client,
        count: 0,
        lastAmount: 0,
      }));
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to generate income suggestions');
  }

  return suggestions;
}

// ============================================================================
// Invoice Suggestions
// ============================================================================

/**
 * Get smart suggestions for creating a new invoice.
 *
 * Returns:
 * - Next invoice number
 * - Suggested payment terms (based on client history)
 * - Suggested due date
 */
export function getSuggestionsForInvoice(
  db: Database.Database,
  clientId?: string
): SmartSuggestions {
  const suggestions: SmartSuggestions = {};

  try {
    // 1. Next invoice number
    suggestions.nextInvoiceNumber = getNextInvoiceNumber(db);

    // 2. Payment terms from client history
    if (clientId) {
      const termsRow = db.prepare(`
        SELECT
          CAST(julianday(due_date) - julianday(invoice_date) AS INTEGER) as terms
        FROM invoices
        WHERE client_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).all(clientId) as Array<{ terms: number }>;

      if (termsRow.length > 0) {
        // Use the most common payment terms
        const termsCounts = new Map<number, number>();
        for (const row of termsRow) {
          // Round to standard terms (7, 14, 21, 30, 45, 60, 90)
          const rounded = roundToStandardTerms(row.terms);
          termsCounts.set(rounded, (termsCounts.get(rounded) || 0) + 1);
        }
        let maxCount = 0;
        let bestTerms = 14;
        for (const [terms, count] of termsCounts) {
          if (count > maxCount) {
            maxCount = count;
            bestTerms = terms;
          }
        }
        suggestions.suggestedPaymentTerms = bestTerms;
      }
    }

    // Default payment terms if none found
    if (!suggestions.suggestedPaymentTerms) {
      // Check global most common
      const globalTerms = db.prepare(`
        SELECT
          CAST(julianday(due_date) - julianday(invoice_date) AS INTEGER) as terms,
          COUNT(*) as cnt
        FROM invoices
        GROUP BY terms
        ORDER BY cnt DESC
        LIMIT 1
      `).get() as { terms: number; cnt: number } | undefined;

      suggestions.suggestedPaymentTerms = globalTerms
        ? roundToStandardTerms(globalTerms.terms)
        : 14;
    }

    // 3. Suggested due date
    const paymentDays = suggestions.suggestedPaymentTerms || 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentDays);
    suggestions.suggestedDueDate = dueDate.toISOString().split('T')[0];
  } catch (error) {
    log.error({ err: error }, 'Failed to generate invoice suggestions');
  }

  return suggestions;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Round a number of days to the nearest standard payment term.
 */
function roundToStandardTerms(days: number): number {
  const standardTerms = [7, 14, 21, 30, 45, 60, 90];
  let closest = standardTerms[0];
  let minDiff = Math.abs(days - closest);

  for (const term of standardTerms) {
    const diff = Math.abs(days - term);
    if (diff < minDiff) {
      minDiff = diff;
      closest = term;
    }
  }

  return closest;
}
