/**
 * DATEV Mapping Utilities
 *
 * Core functions for mapping EÜR categories and transactions
 * to DATEV-compliant records.
 */

import type { Income, Expense, VatRate } from '../types'
import type {
  ChartOfAccounts,
  DatevRecord,
  DatevVatCode,
  DebitCredit,
  createEmptyDatevRecord,
} from '../types/datev'
import {
  EUER_TO_SKR03_MAPPINGS,
  getSkr03AccountForCategory,
  SKR03_COUNTER_ACCOUNTS,
} from '../constants/skr03'
import {
  EUER_TO_SKR04_MAPPINGS,
  getSkr04AccountForCategory,
  SKR04_COUNTER_ACCOUNTS,
} from '../constants/skr04'

// ============================================================================
// VAT CODE MAPPING
// ============================================================================

/**
 * Convert VatRate to DATEV BU-Schlüssel (VAT code)
 *
 * DATEV uses:
 * - 0 = Exempt (steuerfrei)
 * - 2 = 7% VAT
 * - 3 = 19% VAT
 */
export function getVatCode(vatRate: VatRate): DatevVatCode {
  switch (vatRate) {
    case 19:
      return 3
    case 7:
      return 2
    case 0:
    default:
      return 0
  }
}

/**
 * Convert DATEV BU-Schlüssel back to VatRate
 */
export function vatCodeToRate(vatCode: DatevVatCode): VatRate {
  switch (vatCode) {
    case 3:
      return 19
    case 2:
      return 7
    case 0:
    default:
      return 0
  }
}

// ============================================================================
// ACCOUNT MAPPING
// ============================================================================

/**
 * Get the appropriate account number for an EÜR category
 *
 * @param euerCategory - The EÜR expense/income category
 * @param chartOfAccounts - Which chart to use (SKR03 or SKR04)
 * @param vatRate - Optional VAT rate for dynamic account selection
 * @returns The account number in the selected chart
 */
export function mapEuerToSkr(
  euerCategory: string,
  chartOfAccounts: ChartOfAccounts,
  vatRate?: VatRate
): number {
  if (chartOfAccounts === 'SKR03') {
    return getSkr03AccountForCategory(euerCategory, vatRate)
  }
  return getSkr04AccountForCategory(euerCategory, vatRate)
}

/**
 * Get the counter account based on payment method and chart of accounts.
 * Maps payment methods to their corresponding financial accounts.
 */
export function getCounterAccount(
  chartOfAccounts: ChartOfAccounts,
  paymentMethod?: string | null
): number {
  if (chartOfAccounts === 'SKR03') {
    switch (paymentMethod) {
      case 'cash':          return 1000; // Kasse
      case 'paypal':        return 1360; // Geldtransit (PayPal)
      case 'credit_card':   return 1361; // Kreditkarte (common convention)
      case 'bank_transfer': return SKR03_COUNTER_ACCOUNTS.BANK;
      default:              return SKR03_COUNTER_ACCOUNTS.BANK;
    }
  }
  switch (paymentMethod) {
    case 'cash':          return 1600; // Kasse (SKR04)
    case 'paypal':        return 1460; // Geldtransit (SKR04)
    case 'credit_card':   return 1461; // Kreditkarte (SKR04)
    case 'bank_transfer': return SKR04_COUNTER_ACCOUNTS.BANK;
    default:              return SKR04_COUNTER_ACCOUNTS.BANK;
  }
}

/**
 * Check if an account is an income account
 */
export function isIncomeAccount(
  accountNumber: number,
  chartOfAccounts: ChartOfAccounts
): boolean {
  if (chartOfAccounts === 'SKR03') {
    // SKR03: Income accounts are 8xxx
    return accountNumber >= 8000 && accountNumber < 9000
  }
  // SKR04: Income accounts are 4xxx
  return accountNumber >= 4000 && accountNumber < 5000
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format a date to DATEV format (DDMM)
 *
 * DATEV expects dates in DDMM format (4 digits)
 */
export function formatDatevDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}${month}`
}

/**
 * Parse a DATEV date string (DDMM) back to a Date
 * Assumes current year
 */
export function parseDatevDate(datevDate: string, year?: number): Date {
  const currentYear = year ?? new Date().getFullYear()
  const day = parseInt(datevDate.slice(0, 2), 10)
  const month = parseInt(datevDate.slice(2, 4), 10) - 1
  return new Date(currentYear, month, day)
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format a number to German locale (comma as decimal separator)
 *
 * DATEV expects German number format: 1234,56
 */
export function formatGermanNumber(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

/**
 * Parse a German-formatted number string back to number
 */
export function parseGermanNumber(germanNumber: string): number {
  return parseFloat(germanNumber.replace(',', '.'))
}

// ============================================================================
// TRANSACTION TO DATEV RECORD MAPPING
// ============================================================================

/**
 * Create an empty DATEV record with default values
 */
function createBaseDatevRecord(): DatevRecord {
  return {
    amount: 0,
    debitCredit: 'S',
    currency: 'EUR',
    exchangeRate: '',
    baseAmount: 0,
    account: 0,
    counterAccount: 1200,
    vatCode: 0,
    documentDate: '',
    documentRef1: '',
    documentRef2: '',
    discount: 0,
    description: '',
    blocked: 0,
    addressNumber: '',
    partnerBank: '',
    businessCase: '',
    interestBlocked: 0,
    documentLink: '',
    documentInfoType: '',
    documentInfoContent: '',
  }
}

/**
 * Map an Income record to a DATEV record
 *
 * Income is credited (H = Haben) to the income account
 * Bank is debited (S = Soll) as the counter account
 */
export function mapIncomeToDatev(
  income: Income,
  chartOfAccounts: ChartOfAccounts
): DatevRecord {
  const account = mapEuerToSkr(
    income.euerCategory,
    chartOfAccounts,
    income.vatRate
  )
  const counterAccount = getCounterAccount(chartOfAccounts, income.paymentMethod)

  return {
    ...createBaseDatevRecord(),
    amount: income.grossAmount,
    debitCredit: 'H', // Credit for income
    baseAmount: income.grossAmount,
    account: account,
    counterAccount: counterAccount,
    vatCode: getVatCode(income.vatRate),
    documentDate: formatDatevDate(income.date),
    documentRef1: income.invoiceId ?? '',
    description: truncateDescription(income.description),
  }
}

/**
 * Map an Expense record to a DATEV record
 *
 * Expense is debited (S = Soll) to the expense account
 * Bank is credited (H = Haben) as the counter account
 */
export function mapExpenseToDatev(
  expense: Expense,
  chartOfAccounts: ChartOfAccounts
): DatevRecord {
  const account = mapEuerToSkr(
    expense.euerCategory,
    chartOfAccounts,
    expense.vatRate
  )
  const counterAccount = getCounterAccount(chartOfAccounts, expense.paymentMethod)

  return {
    ...createBaseDatevRecord(),
    amount: expense.grossAmount,
    debitCredit: 'S', // Debit for expense
    baseAmount: expense.grossAmount,
    account: account,
    counterAccount: counterAccount,
    vatCode: getVatCode(expense.vatRate),
    documentDate: formatDatevDate(expense.date),
    documentRef1: expense.receiptPath ? extractReceiptNumber(expense.receiptPath) : '',
    description: truncateDescription(`${expense.vendor}: ${expense.description}`),
  }
}

/**
 * Create a depreciation DATEV record for an asset
 *
 * @param assetName - Name of the asset
 * @param amount - Annual depreciation amount
 * @param date - Date of the depreciation entry
 * @param chartOfAccounts - Which chart to use
 */
export function mapDepreciationToDatev(
  assetName: string,
  amount: number,
  date: Date,
  chartOfAccounts: ChartOfAccounts
): DatevRecord {
  const account = mapEuerToSkr('depreciation', chartOfAccounts)
  // Depreciation counter account is the asset account (e.g. 0200 for computer)
  // but for simplicity we use the standard bank counter
  const counterAccount = getCounterAccount(chartOfAccounts)

  return {
    ...createBaseDatevRecord(),
    amount: amount,
    debitCredit: 'S', // Debit for depreciation expense
    baseAmount: amount,
    account: account,
    counterAccount: counterAccount,
    vatCode: 0, // No VAT on depreciation
    documentDate: formatDatevDate(date),
    documentRef1: '',
    description: truncateDescription(`AfA: ${assetName}`),
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Truncate description to DATEV maximum length (60 chars)
 */
export function truncateDescription(description: string): string {
  const maxLength = 60
  if (description.length <= maxLength) {
    return description
  }
  return description.slice(0, maxLength - 3) + '...'
}

/**
 * Extract a receipt number from a file path
 */
function extractReceiptNumber(receiptPath: string): string {
  // Extract filename without extension
  const filename = receiptPath.split('/').pop() ?? ''
  return filename.replace(/\.[^/.]+$/, '')
}

/**
 * Validate a DATEV record for export
 *
 * @returns Array of validation errors (empty if valid)
 */
export function validateDatevRecord(record: DatevRecord): string[] {
  const errors: string[] = []

  if (record.amount <= 0) {
    errors.push('Amount must be greater than 0')
  }

  if (!record.account || record.account === 0) {
    errors.push('Account number is required')
  }

  if (!record.counterAccount || record.counterAccount === 0) {
    errors.push('Counter account is required')
  }

  if (!record.documentDate || record.documentDate.length !== 4) {
    errors.push('Document date must be in DDMM format')
  }

  if (!['S', 'H'].includes(record.debitCredit)) {
    errors.push('Debit/Credit indicator must be S or H')
  }

  if (![0, 2, 3].includes(record.vatCode)) {
    errors.push('VAT code must be 0, 2, or 3')
  }

  return errors
}

/**
 * Get all EÜR category mappings for a chart of accounts
 */
export function getAllMappings(chartOfAccounts: ChartOfAccounts) {
  return chartOfAccounts === 'SKR03'
    ? EUER_TO_SKR03_MAPPINGS
    : EUER_TO_SKR04_MAPPINGS
}

/**
 * Check if a category is an income category
 */
export function isIncomeCategory(euerCategory: string): boolean {
  const incomeCats = [
    'services',
    'services_7',
    'services_exempt',
    'asset_sale',
    'ust_refund',
  ]
  return incomeCats.includes(euerCategory)
}
