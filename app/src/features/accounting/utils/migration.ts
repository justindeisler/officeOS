/**
 * Invoice Migration Utility
 *
 * Migrates legacy invoices from Zustand store to SQLite-based accounting system.
 * Creates corresponding income records for paid invoices.
 */

import { getDb } from '../api/db'
import { createIncome } from '../api/income'
import type { VatRate, PaymentMethod } from '../types'
import type { Invoice as LegacyInvoice, InvoiceLineItem as LegacyLineItem } from '@/types'

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationResult {
  success: boolean
  migratedInvoices: number
  createdIncomeRecords: number
  skippedInvoices: number
  errors: MigrationError[]
}

export interface MigrationError {
  invoiceId: string
  invoiceNumber: string
  error: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize legacy tax rate to valid VatRate
 * Legacy system could have any number, accounting system requires 0, 7, or 19
 */
function normalizeVatRate(taxRate: number): VatRate {
  if (taxRate === 0) return 0
  if (taxRate === 7) return 7
  // Default to 19% for all other rates
  return 19
}

/**
 * Calculate VAT amount from subtotal and rate
 */
function calculateVatAmount(subtotal: number, vatRate: VatRate): number {
  return Math.round(subtotal * (vatRate / 100) * 100) / 100
}

/**
 * Calculate quarter period from date
 */
function calculateUstPeriod(date: Date): string {
  const year = date.getFullYear()
  const quarter = Math.ceil((date.getMonth() + 1) / 3)
  return `${year}-Q${quarter}`
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Check if an invoice has already been migrated
 */
async function isInvoiceMigrated(invoiceNumber: string): Promise<boolean> {
  const db = await getDb()
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM invoices WHERE invoice_number = $1',
    [invoiceNumber]
  )
  return result[0]?.count > 0
}

/**
 * Migrate a single legacy invoice to the accounting system
 */
async function migrateSingleInvoice(
  legacyInvoice: LegacyInvoice
): Promise<{ success: boolean; incomeCreated: boolean; error?: string }> {
  const db = await getDb()

  try {
    // Check if already migrated
    if (await isInvoiceMigrated(legacyInvoice.invoiceNumber)) {
      return { success: false, incomeCreated: false, error: 'Already migrated' }
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const vatRate = normalizeVatRate(legacyInvoice.taxRate)

    // Map legacy fields to accounting fields
    const subtotal = legacyInvoice.amount
    const vatAmount = calculateVatAmount(subtotal, vatRate)
    const total = Math.round((subtotal + vatAmount) * 100) / 100

    // Convert status
    const status = legacyInvoice.status === 'pending' ? 'sent' : legacyInvoice.status

    // Insert invoice
    await db.execute(
      `INSERT INTO invoices (
        id, invoice_number, invoice_date, due_date, status, client_id,
        subtotal, vat_rate, vat_amount, total, payment_date, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        legacyInvoice.invoiceNumber,
        legacyInvoice.issueDate.split('T')[0],
        legacyInvoice.dueDate.split('T')[0],
        status,
        legacyInvoice.clientId || null,
        subtotal,
        vatRate,
        vatAmount,
        total,
        legacyInvoice.paidDate ? legacyInvoice.paidDate.split('T')[0] : null,
        legacyInvoice.notes || null,
        now,
      ]
    )

    // Insert line items
    for (const item of legacyInvoice.lineItems) {
      const itemId = crypto.randomUUID()
      const itemAmount = item.total

      await db.execute(
        `INSERT INTO invoice_items (
          id, invoice_id, description, quantity, unit, unit_price, amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          itemId,
          id,
          item.description,
          item.quantity,
          'hours', // Default unit since legacy system doesn't have it
          item.unitPrice,
          itemAmount,
        ]
      )
    }

    // Create income record for paid invoices
    let incomeCreated = false
    if (legacyInvoice.status === 'paid' && legacyInvoice.paidDate) {
      try {
        const paymentDate = new Date(legacyInvoice.paidDate)
        await createIncome({
          date: paymentDate,
          clientId: legacyInvoice.clientId || undefined,
          invoiceId: id,
          description: `Invoice ${legacyInvoice.invoiceNumber}`,
          netAmount: subtotal,
          vatRate,
          euerLine: 14, // Betriebseinnahmen
          euerCategory: 'services',
          ustPeriod: calculateUstPeriod(paymentDate),
        })
        incomeCreated = true
      } catch (incomeError) {
        console.error(`Failed to create income for invoice ${legacyInvoice.invoiceNumber}:`, incomeError)
        // Don't fail the invoice migration, just log the income creation failure
      }
    }

    return { success: true, incomeCreated }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, incomeCreated: false, error: message }
  }
}

/**
 * Migrate all legacy invoices to the accounting system
 *
 * @param legacyInvoices - Array of legacy invoices from Zustand store
 * @returns Migration result with counts and errors
 */
export async function migrateInvoices(
  legacyInvoices: LegacyInvoice[]
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedInvoices: 0,
    createdIncomeRecords: 0,
    skippedInvoices: 0,
    errors: [],
  }

  for (const invoice of legacyInvoices) {
    const migrationResult = await migrateSingleInvoice(invoice)

    if (migrationResult.success) {
      result.migratedInvoices++
      if (migrationResult.incomeCreated) {
        result.createdIncomeRecords++
      }
    } else if (migrationResult.error === 'Already migrated') {
      result.skippedInvoices++
    } else {
      result.errors.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        error: migrationResult.error || 'Unknown error',
      })
    }
  }

  if (result.errors.length > 0) {
    result.success = false
  }

  return result
}

/**
 * Get migration status - counts of legacy vs accounting invoices
 */
export async function getMigrationStatus(legacyInvoices: LegacyInvoice[]): Promise<{
  legacyCount: number
  accountingCount: number
  alreadyMigratedCount: number
  needsMigration: number
}> {
  const db = await getDb()

  // Count accounting invoices
  const accountingResult = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM invoices'
  )
  const accountingCount = accountingResult[0]?.count ?? 0

  // Check how many legacy invoices are already migrated
  let alreadyMigratedCount = 0
  for (const invoice of legacyInvoices) {
    if (await isInvoiceMigrated(invoice.invoiceNumber)) {
      alreadyMigratedCount++
    }
  }

  return {
    legacyCount: legacyInvoices.length,
    accountingCount,
    alreadyMigratedCount,
    needsMigration: legacyInvoices.length - alreadyMigratedCount,
  }
}

/**
 * Validate legacy invoices before migration
 * Returns list of issues that should be reviewed
 */
export function validateLegacyInvoices(legacyInvoices: LegacyInvoice[]): {
  valid: boolean
  issues: Array<{
    invoiceNumber: string
    issue: string
    severity: 'warning' | 'error'
  }>
} {
  const issues: Array<{
    invoiceNumber: string
    issue: string
    severity: 'warning' | 'error'
  }> = []

  for (const invoice of legacyInvoices) {
    // Check for non-standard VAT rates
    if (![0, 7, 19].includes(invoice.taxRate)) {
      issues.push({
        invoiceNumber: invoice.invoiceNumber,
        issue: `Non-standard VAT rate ${invoice.taxRate}% will be converted to 19%`,
        severity: 'warning',
      })
    }

    // Check for missing client
    if (!invoice.clientId) {
      issues.push({
        invoiceNumber: invoice.invoiceNumber,
        issue: 'No client linked - income record will have no client',
        severity: 'warning',
      })
    }

    // Check for paid invoices without payment date
    if (invoice.status === 'paid' && !invoice.paidDate) {
      issues.push({
        invoiceNumber: invoice.invoiceNumber,
        issue: 'Paid invoice without payment date - cannot create income record',
        severity: 'error',
      })
    }

    // Check for empty line items
    if (invoice.lineItems.length === 0) {
      issues.push({
        invoiceNumber: invoice.invoiceNumber,
        issue: 'Invoice has no line items',
        severity: 'error',
      })
    }

    // Check for zero amounts
    if (invoice.amount === 0 || invoice.totalAmount === 0) {
      issues.push({
        invoiceNumber: invoice.invoiceNumber,
        issue: 'Invoice has zero amount',
        severity: 'warning',
      })
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  }
}
