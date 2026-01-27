/**
 * DATEV CSV Export Tests
 *
 * Tests for CSV generation, encoding, and export functionality.
 * Target: 20+ tests with 95% coverage.
 */

import { describe, it, expect } from 'vitest'
import type { Income, Expense } from '../types'
import type { DatevExportOptions, DatevRecord } from '../types/datev'
import {
  DATEV_CSV_HEADER,
  DATEV_DELIMITER,
  datevRecordToCsvRow,
  escapeCsvField,
  generateCsvContent,
  incomesToDatevRecords,
  expensesToDatevRecords,
  encodeToLatin1,
  createLatin1Blob,
  generateDatevCsv,
  generateDatevCsvBlob,
  generateDatevFilename,
  generateDatevFileHeader,
  isValidDateRange,
  getPeriodDates,
  getMonthDates,
} from './datev-csv'

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockIncome = (overrides: Partial<Income> = {}): Income => ({
  id: 'inc-1',
  date: new Date('2024-03-15'),
  clientId: 'client-1',
  invoiceId: 'RE-2024-001',
  description: 'Software development services',
  netAmount: 1000,
  vatRate: 19,
  vatAmount: 190,
  grossAmount: 1190,
  euerLine: 14,
  euerCategory: 'services',
  paymentMethod: 'bank_transfer',
  ustPeriod: '2024-Q1',
  ustReported: false,
  createdAt: new Date(),
  ...overrides,
})

const createMockExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp-1',
  date: new Date('2024-03-10'),
  vendor: 'Adobe',
  description: 'Creative Cloud subscription',
  netAmount: 50,
  vatRate: 19,
  vatAmount: 9.5,
  grossAmount: 59.5,
  euerLine: 34,
  euerCategory: 'software',
  deductiblePercent: 100,
  isRecurring: true,
  recurringFrequency: 'monthly',
  vorsteuerClaimed: false,
  isGwg: false,
  createdAt: new Date(),
  ...overrides,
})

const createMockDatevRecord = (overrides: Partial<DatevRecord> = {}): DatevRecord => ({
  amount: 1190,
  debitCredit: 'H',
  currency: 'EUR',
  exchangeRate: '',
  baseAmount: 1190,
  account: 8400,
  counterAccount: 1200,
  vatCode: 3,
  documentDate: '1503',
  documentRef1: 'RE-2024-001',
  documentRef2: '',
  discount: 0,
  description: 'Software development',
  blocked: 0,
  addressNumber: '',
  partnerBank: '',
  businessCase: '',
  interestBlocked: 0,
  documentLink: '',
  documentInfoType: '',
  documentInfoContent: '',
  ...overrides,
})

const createMockExportOptions = (
  overrides: Partial<DatevExportOptions> = {}
): DatevExportOptions => ({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-03-31'),
  chartOfAccounts: 'SKR03',
  format: 'csv',
  ...overrides,
})

// ============================================================================
// HEADER AND DELIMITER TESTS
// ============================================================================

describe('DATEV CSV Constants', () => {
  it('should have 21 header fields', () => {
    expect(DATEV_CSV_HEADER).toHaveLength(21)
  })

  it('should use semicolon as delimiter', () => {
    expect(DATEV_DELIMITER).toBe(';')
  })

  it('should have correct first field name', () => {
    expect(DATEV_CSV_HEADER[0]).toBe('Umsatz')
  })

  it('should have correct last field name', () => {
    expect(DATEV_CSV_HEADER[20]).toBe('Beleginfo - Inhalt 1')
  })
})

// ============================================================================
// CSV FIELD ESCAPING TESTS
// ============================================================================

describe('escapeCsvField', () => {
  it('should return empty string for empty input', () => {
    expect(escapeCsvField('')).toBe('')
  })

  it('should return simple text unchanged', () => {
    expect(escapeCsvField('Simple text')).toBe('Simple text')
  })

  it('should escape fields containing semicolon', () => {
    const result = escapeCsvField('Text; with semicolon')
    expect(result).toBe('"Text; with semicolon"')
  })

  it('should escape fields containing quotes', () => {
    const result = escapeCsvField('Text with "quotes"')
    expect(result).toBe('"Text with ""quotes"""')
  })

  it('should escape fields containing newlines', () => {
    const result = escapeCsvField('Line 1\nLine 2')
    expect(result).toBe('"Line 1\nLine 2"')
  })

  it('should handle German umlauts', () => {
    const result = escapeCsvField('Büroausstattung')
    expect(result).toBe('Büroausstattung')
  })
})

// ============================================================================
// CSV ROW GENERATION TESTS
// ============================================================================

describe('datevRecordToCsvRow', () => {
  it('should generate row with 21 fields', () => {
    const record = createMockDatevRecord()
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields).toHaveLength(21)
  })

  it('should format amount with German decimal', () => {
    const record = createMockDatevRecord({ amount: 1234.56 })
    const row = datevRecordToCsvRow(record)

    expect(row).toContain('1234,56')
  })

  it('should include debit/credit indicator', () => {
    const record = createMockDatevRecord({ debitCredit: 'H' })
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields[1]).toBe('H')
  })

  it('should include VAT code', () => {
    const record = createMockDatevRecord({ vatCode: 3 })
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields[7]).toBe('3')
  })

  it('should include account numbers', () => {
    const record = createMockDatevRecord({
      account: 8400,
      counterAccount: 1200,
    })
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields[5]).toBe('8400')
    expect(fields[6]).toBe('1200')
  })
})

// ============================================================================
// CSV CONTENT GENERATION TESTS
// ============================================================================

describe('generateCsvContent', () => {
  it('should include header row', () => {
    const records = [createMockDatevRecord()]
    const content = generateCsvContent(records)

    expect(content.startsWith('Umsatz;')).toBe(true)
  })

  it('should have header plus data rows', () => {
    const records = [createMockDatevRecord(), createMockDatevRecord()]
    const content = generateCsvContent(records)
    const lines = content.split('\n')

    expect(lines).toHaveLength(3) // 1 header + 2 data rows
  })

  it('should handle empty records array', () => {
    const content = generateCsvContent([])
    const lines = content.split('\n')

    expect(lines).toHaveLength(1) // Just header
    expect(lines[0]).toContain('Umsatz')
  })
})

// ============================================================================
// INCOME/EXPENSE CONVERSION TESTS
// ============================================================================

describe('incomesToDatevRecords', () => {
  it('should convert income array to DATEV records', () => {
    const incomes = [createMockIncome()]
    const records = incomesToDatevRecords(incomes, 'SKR03')

    expect(records).toHaveLength(1)
    expect(records[0].account).toBe(8400)
  })

  it('should use correct chart of accounts', () => {
    const incomes = [createMockIncome()]

    const skr03Records = incomesToDatevRecords(incomes, 'SKR03')
    const skr04Records = incomesToDatevRecords(incomes, 'SKR04')

    expect(skr03Records[0].account).toBe(8400)
    expect(skr04Records[0].account).toBe(4400)
  })
})

describe('expensesToDatevRecords', () => {
  it('should convert expense array to DATEV records', () => {
    const expenses = [createMockExpense()]
    const records = expensesToDatevRecords(expenses, 'SKR03')

    expect(records).toHaveLength(1)
    expect(records[0].account).toBe(4964)
  })

  it('should set debit indicator for expenses', () => {
    const expenses = [createMockExpense()]
    const records = expensesToDatevRecords(expenses, 'SKR03')

    expect(records[0].debitCredit).toBe('S')
  })
})

// ============================================================================
// ENCODING TESTS
// ============================================================================

describe('encodeToLatin1', () => {
  it('should encode ASCII characters correctly', () => {
    const bytes = encodeToLatin1('Hello')
    expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
  })

  it('should encode German umlauts', () => {
    const bytes = encodeToLatin1('äöü')
    expect(bytes).toEqual(new Uint8Array([228, 246, 252])) // ISO-8859-1 codes
  })

  it('should encode ß correctly', () => {
    const bytes = encodeToLatin1('ß')
    expect(bytes).toEqual(new Uint8Array([223]))
  })

  it('should replace unsupported characters with ?', () => {
    const bytes = encodeToLatin1('€') // Euro sign is not in Latin-1
    expect(bytes).toEqual(new Uint8Array([63])) // '?' = 63
  })
})

describe('createLatin1Blob', () => {
  it('should create blob with correct MIME type', () => {
    const blob = createLatin1Blob('test')
    expect(blob.type).toBe('text/csv;charset=iso-8859-1')
  })

  it('should have correct size', () => {
    const blob = createLatin1Blob('Hello')
    expect(blob.size).toBe(5)
  })
})

// ============================================================================
// MAIN EXPORT FUNCTION TESTS
// ============================================================================

describe('generateDatevCsv', () => {
  it('should generate result with correct record count', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions()

    const result = generateDatevCsv(incomes, expenses, options)

    expect(result.recordCount).toBe(2)
    expect(result.records).toHaveLength(2)
  })

  it('should filter by date range', () => {
    const incomes = [
      createMockIncome({ date: new Date('2024-02-15') }),
      createMockIncome({ date: new Date('2024-06-15') }), // Outside range
    ]
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })

    const result = generateDatevCsv(incomes, [], options)

    expect(result.recordCount).toBe(1)
  })

  it('should exclude income when option is false', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions({ includeIncome: false })

    const result = generateDatevCsv(incomes, expenses, options)

    expect(result.recordCount).toBe(1)
    expect(result.records[0].debitCredit).toBe('S') // Only expense
  })

  it('should exclude expenses when option is false', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions({ includeExpenses: false })

    const result = generateDatevCsv(incomes, expenses, options)

    expect(result.recordCount).toBe(1)
    expect(result.records[0].debitCredit).toBe('H') // Only income
  })

  it('should add warning for empty result', () => {
    const options = createMockExportOptions()
    const result = generateDatevCsv([], [], options)

    expect(result.warnings).toContain(
      'No records found in the selected date range'
    )
  })

  it('should include chart of accounts in result', () => {
    const options = createMockExportOptions({ chartOfAccounts: 'SKR04' })
    const result = generateDatevCsv([], [], options)

    expect(result.chartOfAccounts).toBe('SKR04')
  })
})

describe('generateDatevCsvBlob', () => {
  it('should generate blob from result', () => {
    const result = generateDatevCsv(
      [createMockIncome()],
      [],
      createMockExportOptions()
    )
    const blob = generateDatevCsvBlob(result)

    expect(blob instanceof Blob).toBe(true)
    expect(blob.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// FILENAME GENERATION TESTS
// ============================================================================

describe('generateDatevFilename', () => {
  it('should generate filename with date range', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      chartOfAccounts: 'SKR03',
    })

    const filename = generateDatevFilename(options)

    expect(filename).toBe('DATEV_SKR03_20240101_20240331.csv')
  })

  it('should use xml extension when specified', () => {
    const options = createMockExportOptions()
    const filename = generateDatevFilename(options, 'xml')

    expect(filename.endsWith('.xml')).toBe(true)
  })

  it('should include chart of accounts type', () => {
    const options = createMockExportOptions({ chartOfAccounts: 'SKR04' })
    const filename = generateDatevFilename(options)

    expect(filename).toContain('SKR04')
  })
})

// ============================================================================
// FILE HEADER TESTS
// ============================================================================

describe('generateDatevFileHeader', () => {
  it('should include format markers', () => {
    const options = createMockExportOptions()
    const header = generateDatevFileHeader(options)

    expect(header).toContain('EXTF')
    expect(header).toContain('510')
  })

  it('should include consultant number when provided', () => {
    const options = createMockExportOptions({ consultantNumber: '12345' })
    const header = generateDatevFileHeader(options)

    expect(header).toContain('Berater: 12345')
  })

  it('should include client number when provided', () => {
    const options = createMockExportOptions({ clientNumber: '99999' })
    const header = generateDatevFileHeader(options)

    expect(header).toContain('Mandant: 99999')
  })

  it('should include date range', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })
    const header = generateDatevFileHeader(options)

    expect(header).toContain('Zeitraum')
    expect(header).toContain('20240101')
    expect(header).toContain('20240331')
  })
})

// ============================================================================
// DATE RANGE HELPER TESTS
// ============================================================================

describe('isValidDateRange', () => {
  it('should return true for valid range', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-12-31')

    expect(isValidDateRange(start, end)).toBe(true)
  })

  it('should return true for same date', () => {
    const date = new Date('2024-06-15')

    expect(isValidDateRange(date, date)).toBe(true)
  })

  it('should return false for invalid range', () => {
    const start = new Date('2024-12-31')
    const end = new Date('2024-01-01')

    expect(isValidDateRange(start, end)).toBe(false)
  })
})

describe('getPeriodDates', () => {
  it('should return Q1 dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'Q1')

    expect(startDate.getMonth()).toBe(0) // January
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(2) // March
    expect(endDate.getDate()).toBe(31)
  })

  it('should return Q2 dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'Q2')

    expect(startDate.getMonth()).toBe(3) // April
    expect(endDate.getMonth()).toBe(5) // June
  })

  it('should return full year dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'year')

    expect(startDate.getMonth()).toBe(0)
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(11)
    expect(endDate.getDate()).toBe(31)
  })
})

describe('getMonthDates', () => {
  it('should return correct month boundaries', () => {
    const { startDate, endDate } = getMonthDates(2024, 2) // February

    expect(startDate.getMonth()).toBe(1)
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(1)
    expect(endDate.getDate()).toBe(29) // 2024 is a leap year
  })

  it('should handle December correctly', () => {
    const { startDate, endDate } = getMonthDates(2024, 12)

    expect(startDate.getMonth()).toBe(11)
    expect(endDate.getDate()).toBe(31)
  })
})
