/**
 * DATEV XML Export (LedgerImport Format v6)
 *
 * Generates DATEV-compliant XML files in the LedgerImport format.
 * Supports the DATEV XML schema version 6 for advanced integrations.
 */

import type { DatevRecord, DatevExportOptions, DatevExportResult } from '../types/datev'
import type { Income, Expense } from '../types'
import {
  mapIncomeToDatev,
  mapExpenseToDatev,
  validateDatevRecord,
} from './datev-mapping'

// ============================================================================
// XML NAMESPACE AND SCHEMA
// ============================================================================

/**
 * DATEV LedgerImport XML namespace
 */
export const DATEV_XML_NAMESPACE = 'http://xml.datev.de/bedi/tps/ledger/v060'

/**
 * XML declaration with UTF-8 encoding
 */
export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

// ============================================================================
// XML BUILDING HELPERS
// ============================================================================

/**
 * Escape special XML characters
 */
export function escapeXml(text: string): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Create an XML element with optional content and attributes
 */
export function createElement(
  tagName: string,
  content: string | number | null,
  attributes?: Record<string, string>
): string {
  const attrStr = attributes
    ? ' ' +
      Object.entries(attributes)
        .map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ')
    : ''

  if (content === null || content === undefined || content === '') {
    return `<${tagName}${attrStr}/>`
  }

  const escapedContent =
    typeof content === 'number' ? content.toString() : escapeXml(content)

  return `<${tagName}${attrStr}>${escapedContent}</${tagName}>`
}

/**
 * Create a wrapper element with child elements
 */
export function wrapElements(tagName: string, children: string[]): string {
  const childContent = children.filter((c) => c).join('\n')
  return `<${tagName}>\n${childContent}\n</${tagName}>`
}

/**
 * Indent XML content
 */
export function indentXml(xml: string, spaces: number = 2): string {
  const lines = xml.split('\n')
  const indent = ' '.repeat(spaces)
  return lines.map((line) => indent + line).join('\n')
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date for DATEV XML (ISO format: YYYY-MM-DD)
 */
export function formatXmlDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse DATEV date (DDMM) to XML format (YYYY-MM-DD)
 */
export function datevDateToXmlDate(datevDate: string, year: number): string {
  const day = datevDate.slice(0, 2)
  const month = datevDate.slice(2, 4)
  return `${year}-${month}-${day}`
}

// ============================================================================
// TRANSACTION XML GENERATION
// ============================================================================

/**
 * Convert a DATEV record to an XML Transaction element
 */
export function recordToXmlTransaction(
  record: DatevRecord,
  year: number
): string {
  const elements: string[] = []

  // Date (required)
  const xmlDate = datevDateToXmlDate(record.documentDate, year)
  elements.push(createElement('Date', xmlDate))

  // Amount (required)
  elements.push(createElement('Amount', record.amount.toFixed(2)))

  // Account mapping
  if (record.debitCredit === 'S') {
    elements.push(createElement('DebitAccount', record.account))
    elements.push(createElement('CreditAccount', record.counterAccount))
  } else {
    elements.push(createElement('DebitAccount', record.counterAccount))
    elements.push(createElement('CreditAccount', record.account))
  }

  // Description
  if (record.description) {
    elements.push(createElement('Description', record.description))
  }

  // Tax information
  if (record.vatCode > 0) {
    const taxRate = record.vatCode === 3 ? 19 : record.vatCode === 2 ? 7 : 0
    elements.push(createElement('TaxCode', taxRate))
  }

  // Document reference
  if (record.documentRef1) {
    elements.push(createElement('DocumentNumber', record.documentRef1))
  }

  // Currency
  elements.push(createElement('Currency', record.currency))

  return wrapElements('Transaction', elements)
}

/**
 * Generate the Consolidate section containing all transactions
 */
export function generateConsolidateSection(
  records: DatevRecord[],
  year: number
): string {
  const transactions = records.map((record) =>
    indentXml(recordToXmlTransaction(record, year), 4)
  )

  return wrapElements('Consolidate', transactions)
}

// ============================================================================
// HEADER GENERATION
// ============================================================================

/**
 * Generate XML header with metadata
 */
export function generateXmlHeader(options: DatevExportOptions): string {
  const elements: string[] = []

  elements.push(createElement('Version', '6.0'))
  elements.push(createElement('Generator', 'Personal Assistant'))
  elements.push(createElement('GeneratedAt', new Date().toISOString()))

  if (options.consultantNumber) {
    elements.push(createElement('ConsultantNumber', options.consultantNumber))
  }

  if (options.clientNumber) {
    elements.push(createElement('ClientNumber', options.clientNumber))
  }

  elements.push(createElement('ChartOfAccounts', options.chartOfAccounts))
  elements.push(createElement('PeriodStart', formatXmlDate(options.startDate)))
  elements.push(createElement('PeriodEnd', formatXmlDate(options.endDate)))

  return wrapElements('Header', elements)
}

// ============================================================================
// MAIN XML GENERATION
// ============================================================================

/**
 * Build the complete DATEV XML document
 */
export function buildXmlDocument(
  records: DatevRecord[],
  options: DatevExportOptions
): string {
  const year = options.startDate.getFullYear()

  // Build document parts
  const header = indentXml(generateXmlHeader(options), 2)
  const consolidate = indentXml(generateConsolidateSection(records, year), 2)

  // Wrap in root element
  const rootContent = [header, consolidate].join('\n')
  const rootElement = `<LedgerImport xmlns="${DATEV_XML_NAMESPACE}">\n${rootContent}\n</LedgerImport>`

  return `${XML_DECLARATION}\n${rootElement}`
}

/**
 * Convert Income transactions to DATEV records for XML
 */
export function incomesToXmlRecords(
  incomes: Income[],
  chartOfAccounts: 'SKR03' | 'SKR04'
): DatevRecord[] {
  return incomes.map((income) => mapIncomeToDatev(income, chartOfAccounts))
}

/**
 * Convert Expense transactions to DATEV records for XML
 */
export function expensesToXmlRecords(
  expenses: Expense[],
  chartOfAccounts: 'SKR03' | 'SKR04'
): DatevRecord[] {
  return expenses.map((expense) => mapExpenseToDatev(expense, chartOfAccounts))
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate DATEV XML export from income and expense records
 */
export function generateDatevXml(
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
    const incomeRecords = incomesToXmlRecords(
      filteredIncomes,
      options.chartOfAccounts
    )
    records.push(...incomeRecords)
  }

  if (options.includeExpenses !== false) {
    const expenseRecords = expensesToXmlRecords(
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
    format: 'xml',
    errors,
    warnings,
  }
}

/**
 * Generate DATEV XML file as a string
 */
export function generateDatevXmlContent(result: DatevExportResult, options: DatevExportOptions): string {
  return buildXmlDocument(result.records, options)
}

/**
 * Generate DATEV XML file as a downloadable Blob
 */
export function generateDatevXmlBlob(result: DatevExportResult, options: DatevExportOptions): Blob {
  const xmlContent = buildXmlDocument(result.records, options)
  return new Blob([xmlContent], { type: 'application/xml;charset=utf-8' })
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate XML structure (basic validation)
 */
export function validateXmlStructure(xml: string): string[] {
  const errors: string[] = []

  // Check XML declaration
  if (!xml.startsWith(XML_DECLARATION)) {
    errors.push('Missing or invalid XML declaration')
  }

  // Check namespace
  if (!xml.includes(DATEV_XML_NAMESPACE)) {
    errors.push('Missing DATEV namespace')
  }

  // Check required elements
  if (!xml.includes('<LedgerImport')) {
    errors.push('Missing LedgerImport root element')
  }

  if (!xml.includes('<Consolidate>')) {
    errors.push('Missing Consolidate section')
  }

  // Check for basic XML validity
  const openTags = (xml.match(/<[^/!?][^>]*[^/]>/g) || []).length
  const closeTags = (xml.match(/<\/[^>]+>/g) || []).length
  const selfClosing = (xml.match(/<[^>]+\/>/g) || []).length

  // Very basic balance check (not foolproof)
  if (openTags !== closeTags + selfClosing) {
    errors.push('XML tags may not be properly balanced')
  }

  return errors
}

/**
 * Pretty print XML with proper indentation
 */
export function prettyPrintXml(xml: string): string {
  // Simple pretty print - add newlines and indentation
  let formatted = ''
  let indent = 0
  const lines = xml.replace(/></g, '>\n<').split('\n')

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('</')) {
      // Closing tag - decrease indent first
      indent = Math.max(0, indent - 1)
    }

    formatted += '  '.repeat(indent) + trimmed + '\n'

    if (
      trimmed.startsWith('<') &&
      !trimmed.startsWith('</') &&
      !trimmed.startsWith('<?') &&
      !trimmed.endsWith('/>') &&
      !trimmed.includes('</') // Not a self-contained tag
    ) {
      // Opening tag - increase indent
      indent++
    }
  })

  return formatted.trim()
}
