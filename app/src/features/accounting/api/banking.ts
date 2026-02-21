/**
 * Banking API
 *
 * Wrapper around bankingService for use within accounting features.
 * Re-exports types and provides convenience methods.
 */

import {
  bankingService,
  type BankAccount,
  type BankTransaction,
  type BookingRule,
  type RecurringInvoice,
  type DunningEntry,
  type AutoMatchResult,
} from '@/services/web/bankingService'

// Re-export types
export type {
  BankAccount,
  BankTransaction,
  BookingRule,
  RecurringInvoice,
  DunningEntry,
  AutoMatchResult,
}

// ============================================================================
// Bank Accounts
// ============================================================================

export async function getBankAccounts(): Promise<BankAccount[]> {
  return bankingService.getAccounts()
}

export async function createBankAccount(data: {
  bank_name: string
  iban: string
  bic?: string
  account_name?: string
  balance?: number
}): Promise<BankAccount> {
  return bankingService.connectAccount(data)
}

export async function syncBankAccount(
  accountId: string,
  transactions?: unknown[]
): Promise<{ transactions_imported: number; duplicates_skipped: number }> {
  return bankingService.syncAccount(accountId, transactions)
}

export async function deleteBankAccount(accountId: string): Promise<void> {
  return bankingService.deleteAccount(accountId)
}

// ============================================================================
// Transactions
// ============================================================================

export async function getBankTransactions(
  filters?: Record<string, string>
): Promise<BankTransaction[]> {
  return bankingService.getTransactions(filters)
}

export async function getUnmatchedTransactions(): Promise<BankTransaction[]> {
  return bankingService.getUnmatchedTransactions()
}

export async function autoMatchTransactions(): Promise<AutoMatchResult> {
  return bankingService.autoMatch()
}

export async function matchTransaction(
  txId: string,
  matchType: string,
  matchedId: string
): Promise<BankTransaction> {
  return bankingService.matchTransaction(txId, matchType, matchedId)
}

export async function ignoreTransaction(
  txId: string,
  reason?: string
): Promise<BankTransaction> {
  return bankingService.ignoreTransaction(txId, reason)
}

export async function createExpenseFromTransaction(
  txId: string,
  data: { category: string; description?: string; vat_rate?: number }
): Promise<unknown> {
  return bankingService.createExpenseFromTransaction(txId, data)
}

export async function createIncomeFromTransaction(
  txId: string,
  data: { description?: string; vat_rate?: number; client_id?: string }
): Promise<unknown> {
  return bankingService.createIncomeFromTransaction(txId, data)
}

export async function generateSepa(
  payments: Array<{
    recipient_name: string
    recipient_iban: string
    amount: number
    purpose: string
  }>,
  debtor?: { name: string; iban: string; bic: string }
): Promise<Blob> {
  return bankingService.generateSepa(payments, debtor)
}

// ============================================================================
// Booking Rules
// ============================================================================

export async function getBookingRules(): Promise<BookingRule[]> {
  return bankingService.getRules()
}

export async function createBookingRule(
  data: Partial<BookingRule>
): Promise<BookingRule> {
  return bankingService.createRule(data)
}

export async function updateBookingRule(
  id: string,
  data: Partial<BookingRule>
): Promise<BookingRule> {
  return bankingService.updateRule(id, data)
}

export async function deleteBookingRule(id: string): Promise<void> {
  return bankingService.deleteRule(id)
}

export async function testBookingRule(
  rule: Partial<BookingRule>
): Promise<{ total_unmatched: number; would_match: number; matches: unknown[] }> {
  return bankingService.testRule(rule)
}

// ============================================================================
// Recurring Invoices
// ============================================================================

export async function getRecurringInvoices(): Promise<RecurringInvoice[]> {
  return bankingService.getRecurringInvoices()
}

export async function createRecurringInvoice(
  data: unknown
): Promise<RecurringInvoice> {
  return bankingService.createRecurringInvoice(data)
}

export async function updateRecurringInvoice(
  id: string,
  data: unknown
): Promise<RecurringInvoice> {
  return bankingService.updateRecurringInvoice(id, data)
}

export async function deleteRecurringInvoice(id: string): Promise<void> {
  return bankingService.deleteRecurringInvoice(id)
}

export async function generateFromRecurring(id: string): Promise<unknown> {
  return bankingService.generateFromRecurring(id)
}

export async function processRecurring(): Promise<{
  processed: number
  generated: number
  results: unknown[]
}> {
  return bankingService.processRecurring()
}

// ============================================================================
// Dunning
// ============================================================================

export async function getDunningEntries(
  invoiceId?: string
): Promise<DunningEntry[]> {
  return bankingService.getDunningEntries(invoiceId)
}

export async function getOverdueInvoices(): Promise<unknown[]> {
  return bankingService.getOverdueInvoices()
}

export async function createDunning(data: {
  invoice_id: string
  level?: number
  fee?: number
  interest_rate?: number
  notes?: string
}): Promise<DunningEntry> {
  return bankingService.createDunning(data)
}

export async function sendDunning(id: string): Promise<DunningEntry> {
  return bankingService.sendDunning(id)
}

export async function getDunningTemplates(): Promise<
  Record<number, { subject: string; body: string }>
> {
  return bankingService.getDunningTemplates()
}
