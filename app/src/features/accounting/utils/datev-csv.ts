/**
 * DATEV CSV Export (Buchungsstapel Format)
 *
 * Generates DATEV-compliant CSV files in the Buchungsstapel format (v10.0+).
 * Supports all 21 standard DATEV fields with proper German locale formatting.
 */

import type { DatevRecord, DatevExportOptions, DatevExportResult } from '../types/datev'
import type { Income, Expense } from '../types'
import {
  mapIncomeToDatev,
  mapExpenseToDatev,
  formatGermanNumber,
  validateDatevRecord,
} from './datev-mapping'

// ============================================================================
// DATEV CSV HEADER
// ============================================================================

/**
 * Standard DATEV Buchungsstapel header (21 fields)
 * Field names must match DATEV specification exactly
 */
export const DATEV_CSV_HEADER = [
  'Umsatz',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'Konto',
  'Gegenkonto',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  'Beleginfo - Art 1',
  'Beleginfo - Inhalt 1',
] as const

/**
 * Delimiter used in DATEV CSV (semicolon)
 */
export const DATEV_DELIMITER = ';'

// ============================================================================
// CSV GENERATION
// ============================================================================

/**
 * Convert a DATEV record to a CSV row
 */
export function datevRecordToCsvRow(record: DatevRecord): string {
  const fields = [
    formatGermanNumber(record.amount),
    record.debitCredit,
    record.currency,
    record.exchangeRate,
    formatGermanNumber(record.baseAmount),
    String(record.account),
    String(record.counterAccount),
    String(record.vatCode),
    record.documentDate,
    escapeCsvField(record.documentRef1),
    escapeCsvField(record.documentRef2),
    formatGermanNumber(record.discount),
    escapeCsvField(record.description),
    String(record.blocked),
    record.addressNumber,
    record.partnerBank,
    record.businessCase,
    String(record.interestBlocked),
    record.documentLink,
    record.documentInfoType,
    record.documentInfoContent,
  ]

  return fields.join(DATEV_DELIMITER)
}

/**
 * Escape a CSV field (handle semicolons and quotes)
 */
export function escapeCsvField(value: string): string {
  if (!value) return ''

  // If the field contains delimiter, quotes, or newlines, wrap in quotes
  if (value.includes(DATEV_DELIMITER) || value.includes('"') || value.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""')
    return `"${escaped}"`
  }

  return value
}

/**
 * Generate CSV content from DATEV records
 */
export function generateCsvContent(records: DatevRecord[]): string {
  const header = DATEV_CSV_HEADER.join(DATEV_DELIMITER)
  const rows = records.map(datevRecordToCsvRow)

  return [header, ...rows].join('\n')
}

/**
 * Convert Income transactions to DATEV records
 */
export function incomesToDatevRecords(
  incomes: Income[],
  chartOfAccounts: 'SKR03' | 'SKR04'
): DatevRecord[] {
  return incomes.map((income) => mapIncomeToDatev(income, chartOfAccounts))
}

/**
 * Convert Expense transactions to DATEV records
 */
export function expensesToDatevRecords(
  expenses: Expense[],
  chartOfAccounts: 'SKR03' | 'SKR04'
): DatevRecord[] {
  return expenses.map((expense) => mapExpenseToDatev(expense, chartOfAccounts))
}

// ============================================================================
// ENCODING
// ============================================================================

/**
 * Encode text to ISO-8859-1 (Latin-1)
 *
 * DATEV requires ISO-8859-1 encoding for proper handling of
 * German umlauts (ä, ö, ü, ß) and other special characters.
 */
export function encodeToLatin1(text: string): Uint8Array {
  const bytes: number[] = []

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)

    // ISO-8859-1 only supports characters 0-255
    if (charCode <= 255) {
      bytes.push(charCode)
    } else {
      // Replace unsupported characters with '?'
      bytes.push(63)
    }
  }

  return new Uint8Array(bytes)
}

/**
 * Create a Blob with ISO-8859-1 encoding
 */
export function createLatin1Blob(content: string): Blob {
  const bytes = encodeToLatin1(content)
  return new Blob([bytes], { type: 'text/csv;charset=iso-8859-1' })
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate DATEV CSV export from income and expense records
 */
export function generateDatevCsv(
  incomes: Income[],
  expenses: Expense[],
  options: DatevExportOptions
): DatevExportResult {
  const errors: string[] = []
  const warnings: string[] = []
  const records: DatevRecord[] = []

  // Filter by date range
  const filteredIncomes = incomes.filter((inc) => {
    const date = inc.date
    return date >= options.startDate && date <= options.endDate
  })

  const filteredExpenses = expenses.filter((exp) => {
    const date = exp.date
    return date >= options.startDate && date <= options.endDate
  })

  // Convert to DATEV records
  if (options.includeIncome !== false) {
    const incomeRecords = incomesToDatevRecords(
      filteredIncomes,
      options.chartOfAccounts
    )
    records.push(...incomeRecords)
  }

  if (options.includeExpenses !== false) {
    const expenseRecords = expensesToDatevRecords(
      filteredExpenses,
      options.chartOfAccounts
    )
    records.push(...expenseRecords)
  }

  // Validate all records
  records.forEach((record, index) => {
    const recordErrors = validateDatevRecord(record)
    if (recordErrors.length > 0) {
      errors.push(`Record ${index + 1}: ${recordErrors.join(', ')}`)
    }
  })

  // Add warnings for potential issues
  if (records.length === 0) {
    warnings.push('No records found in the selected date range')
  }

  return {
    records,
    recordCount: records.length,
    startDate: options.startDate,
    endDate: options.endDate,
    chartOfAccounts: options.chartOfAccounts,
    format: 'csv',
    errors,
    warnings,
  }
}

/**
 * Generate DATEV CSV file as a downloadable Blob
 */
export function generateDatevCsvBlob(result: DatevExportResult): Blob {
  const csvContent = generateCsvContent(result.records)
  return createLatin1Blob(csvContent)
}

/**
 * Generate a filename for the DATEV export
 */
export function generateDatevFilename(
  options: DatevExportOptions,
  extension: 'csv' | 'xml' = 'csv'
): string {
  const startStr = formatDateForFilename(options.startDate)
  const endStr = formatDateForFilename(options.endDate)
  const chart = options.chartOfAccounts

  return `DATEV_${chart}_${startStr}_${endStr}.${extension}`
}

/**
 * Format date for use in filename (YYYYMMDD)
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// ============================================================================
// DATEV FILE HEADER (Optional metadata section)
// ============================================================================

/**
 * Generate DATEV file header with metadata
 * This is an optional header that precedes the data
 */
export function generateDatevFileHeader(
  options: DatevExportOptions
): string {
  const lines: string[] = []

  // DATEV header format specification
  lines.push('EXTF') // External format marker
  lines.push('510') // Format version
  lines.push('21') // Data category (Buchungsstapel)
  lines.push(options.chartOfAccounts) // SKR type

  if (options.consultantNumber) {
    lines.push(`Berater: ${options.consultantNumber}`)
  }

  if (options.clientNumber) {
    lines.push(`Mandant: ${options.clientNumber}`)
  }

  // Date range
  const startStr = formatDateForFilename(options.startDate)
  const endStr = formatDateForFilename(options.endDate)
  lines.push(`Zeitraum: ${startStr} - ${endStr}`)

  return lines.join('\n')
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a date range is valid for export
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return startDate <= endDate
}

/**
 * Get period boundaries for common export periods
 */
export function getPeriodDates(
  year: number,
  period: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'year'
): { startDate: Date; endDate: Date } {
  switch (period) {
    case 'Q1':
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 2, 31),
      }
    case 'Q2':
      return {
        startDate: new Date(year, 3, 1),
        endDate: new Date(year, 5, 30),
      }
    case 'Q3':
      return {
        startDate: new Date(year, 6, 1),
        endDate: new Date(year, 8, 30),
      }
    case 'Q4':
      return {
        startDate: new Date(year, 9, 1),
        endDate: new Date(year, 11, 31),
      }
    case 'year':
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
      }
  }
}

/**
 * Get month boundaries
 */
export function getMonthDates(
  year: number,
  month: number
): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Last day of month
  return { startDate, endDate }
}
