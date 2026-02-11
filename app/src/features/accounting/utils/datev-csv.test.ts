/**
 * DATEV CSV Export Tests
 *
 * Comprehensive tests for CSV generation, encoding, structure validation,
 * data accuracy, and export functionality.
 * Target: 50+ tests with 98%+ coverage.
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
import { formatGermanNumber } from './datev-mapping'

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

  it('should have all required DATEV Buchungsstapel fields in order', () => {
    const expectedFields = [
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
    ]
    expect([...DATEV_CSV_HEADER]).toEqual(expectedFields)
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

  it('should handle German umlauts without escaping', () => {
    const result = escapeCsvField('Büroausstattung')
    expect(result).toBe('Büroausstattung')
  })

  it('should handle combined special characters', () => {
    const result = escapeCsvField('Item "A"; cost\nnew line')
    expect(result).toBe('"Item ""A""; cost\nnew line"')
  })

  it('should handle ß and other German chars', () => {
    const result = escapeCsvField('Straße München')
    expect(result).toBe('Straße München')
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

  it('should map all 21 fields to correct positions', () => {
    const record = createMockDatevRecord({
      amount: 500.25,
      debitCredit: 'S',
      currency: 'EUR',
      exchangeRate: '',
      baseAmount: 500.25,
      account: 4964,
      counterAccount: 1200,
      vatCode: 3,
      documentDate: '1003',
      documentRef1: 'BELEG-001',
      documentRef2: 'REF2',
      discount: 10.5,
      description: 'Test booking',
      blocked: 0,
      addressNumber: 'ADDR1',
      partnerBank: 'BANK1',
      businessCase: 'BIZ',
      interestBlocked: 0,
      documentLink: '/doc/1',
      documentInfoType: 'PDF',
      documentInfoContent: 'content',
    })
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields[0]).toBe('500,25')     // Umsatz
    expect(fields[1]).toBe('S')          // Soll/Haben
    expect(fields[2]).toBe('EUR')        // WKZ
    expect(fields[3]).toBe('')           // Kurs
    expect(fields[4]).toBe('500,25')     // Basis-Umsatz
    expect(fields[5]).toBe('4964')       // Konto
    expect(fields[6]).toBe('1200')       // Gegenkonto
    expect(fields[7]).toBe('3')          // BU-Schlüssel
    expect(fields[8]).toBe('1003')       // Belegdatum
    expect(fields[9]).toBe('BELEG-001')  // Belegfeld 1
    expect(fields[10]).toBe('REF2')      // Belegfeld 2
    expect(fields[11]).toBe('10,50')     // Skonto
    expect(fields[12]).toBe('Test booking') // Buchungstext
    expect(fields[13]).toBe('0')         // Postensperre
    expect(fields[14]).toBe('ADDR1')     // Diverse Adressnummer
    expect(fields[15]).toBe('BANK1')     // Geschäftspartnerbank
    expect(fields[16]).toBe('BIZ')       // Sachverhalt
    expect(fields[17]).toBe('0')         // Zinssperre
    expect(fields[18]).toBe('/doc/1')    // Beleglink
    expect(fields[19]).toBe('PDF')       // Beleginfo - Art 1
    expect(fields[20]).toBe('content')   // Beleginfo - Inhalt 1
  })

  it('should format zero amounts correctly', () => {
    const record = createMockDatevRecord({ amount: 0, baseAmount: 0, discount: 0 })
    const row = datevRecordToCsvRow(record)
    const fields = row.split(DATEV_DELIMITER)

    expect(fields[0]).toBe('0,00')
    expect(fields[4]).toBe('0,00')
    expect(fields[11]).toBe('0,00')
  })

  it('should escape description with semicolons', () => {
    const record = createMockDatevRecord({ description: 'Item; another item' })
    const row = datevRecordToCsvRow(record)

    expect(row).toContain('"Item; another item"')
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

  it('should use semicolon delimiter throughout', () => {
    const content = generateCsvContent([createMockDatevRecord()])
    const lines = content.split('\n')

    // Header should have 20 semicolons (21 fields)
    expect(lines[0].split(';')).toHaveLength(21)
    // Data row should also have 21 fields
    expect(lines[1].split(';').length).toBeGreaterThanOrEqual(21)
  })

  it('should use newline as row separator (not CRLF)', () => {
    const content = generateCsvContent([createMockDatevRecord()])
    expect(content).not.toContain('\r\n')
    expect(content).toContain('\n')
  })

  it('should produce content where header columns match data positions', () => {
    const record = createMockDatevRecord({ amount: 999.99 })
    const content = generateCsvContent([record])
    const lines = content.split('\n')
    const headerFields = lines[0].split(';')
    const dataFields = lines[1].split(';')

    // First column header is Umsatz, first data field is the amount
    expect(headerFields[0]).toBe('Umsatz')
    expect(dataFields[0]).toBe('999,99')
  })

  it('should handle large number of records', () => {
    const records = Array.from({ length: 100 }, (_, i) =>
      createMockDatevRecord({ amount: i * 10 + 1, description: `Booking ${i}` })
    )
    const content = generateCsvContent(records)
    const lines = content.split('\n')

    expect(lines).toHaveLength(101) // 1 header + 100 data
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

  it('should handle empty income array', () => {
    const records = incomesToDatevRecords([], 'SKR03')
    expect(records).toHaveLength(0)
  })

  it('should convert multiple incomes', () => {
    const incomes = [
      createMockIncome({ grossAmount: 100 }),
      createMockIncome({ id: 'inc-2', grossAmount: 200 }),
      createMockIncome({ id: 'inc-3', grossAmount: 300 }),
    ]
    const records = incomesToDatevRecords(incomes, 'SKR03')

    expect(records).toHaveLength(3)
    expect(records[0].amount).toBe(100)
    expect(records[1].amount).toBe(200)
    expect(records[2].amount).toBe(300)
  })

  it('should set debitCredit to H for all income records', () => {
    const incomes = [createMockIncome(), createMockIncome({ id: 'inc-2' })]
    const records = incomesToDatevRecords(incomes, 'SKR03')

    records.forEach((r) => expect(r.debitCredit).toBe('H'))
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

  it('should handle empty expense array', () => {
    const records = expensesToDatevRecords([], 'SKR04')
    expect(records).toHaveLength(0)
  })

  it('should convert multiple expenses with different categories', () => {
    const expenses = [
      createMockExpense({ euerCategory: 'software' }),
      createMockExpense({ id: 'exp-2', euerCategory: 'telecom' }),
      createMockExpense({ id: 'exp-3', euerCategory: 'travel' }),
    ]
    const records = expensesToDatevRecords(expenses, 'SKR03')

    expect(records).toHaveLength(3)
    expect(records[0].account).toBe(4964) // software
    expect(records[1].account).toBe(4920) // telecom
    expect(records[2].account).toBe(4670) // travel
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

  it('should handle empty string', () => {
    const bytes = encodeToLatin1('')
    expect(bytes).toEqual(new Uint8Array([]))
    expect(bytes.length).toBe(0)
  })

  it('should encode capital German umlauts', () => {
    const bytes = encodeToLatin1('ÄÖÜ')
    expect(bytes).toEqual(new Uint8Array([196, 214, 220]))
  })

  it('should encode mixed ASCII and special chars', () => {
    const bytes = encodeToLatin1('Hübner')
    expect(bytes).toEqual(new Uint8Array([72, 252, 98, 110, 101, 114]))
  })

  it('should encode semicolons and other delimiters', () => {
    const bytes = encodeToLatin1(';,.')
    expect(bytes).toEqual(new Uint8Array([59, 44, 46]))
  })

  it('should handle multi-byte Unicode chars by replacing with ?', () => {
    // Chinese character, emoji, etc. — all outside Latin-1
    const bytes = encodeToLatin1('中文')
    expect(bytes[0]).toBe(63) // ?
    expect(bytes[1]).toBe(63) // ?
  })

  it('should encode French accented chars within Latin-1', () => {
    const bytes = encodeToLatin1('éèêë')
    expect(bytes).toEqual(new Uint8Array([233, 232, 234, 235]))
  })

  it('should produce bytes of same length as input for ASCII strings', () => {
    const text = 'DATEV Export 2024'
    const bytes = encodeToLatin1(text)
    expect(bytes.length).toBe(text.length)
  })

  it('should correctly encode a full DATEV CSV line', () => {
    const line = 'Umsatz;Soll/Haben-Kennzeichen;WKZ Umsatz'
    const bytes = encodeToLatin1(line)
    // Verify round-trip for ASCII
    const decoded = Array.from(bytes).map((b) => String.fromCharCode(b)).join('')
    expect(decoded).toBe(line)
  })

  it('should encode German text with umlauts in descriptions', () => {
    const text = 'Büromöbel für Geschäft'
    const bytes = encodeToLatin1(text)
    // ü=252, ö=246, ü=252, ä=228
    expect(bytes[1]).toBe(252) // ü in Büromöbel
    expect(bytes[5]).toBe(246) // ö in Büromöbel
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

  it('should handle German umlauts correctly', () => {
    const blob = createLatin1Blob('äöü')
    expect(blob.size).toBe(3) // Each umlaut is 1 byte in Latin-1
  })

  it('should create blob from full CSV content', () => {
    const content = generateCsvContent([createMockDatevRecord()])
    const blob = createLatin1Blob(content)

    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('text/csv;charset=iso-8859-1')
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

  it('should set format to csv', () => {
    const options = createMockExportOptions()
    const result = generateDatevCsv([], [], options)

    expect(result.format).toBe('csv')
  })

  it('should include start and end dates in result', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-30'),
    })
    const result = generateDatevCsv([], [], options)

    expect(result.startDate).toEqual(new Date('2024-01-01'))
    expect(result.endDate).toEqual(new Date('2024-06-30'))
  })

  it('should filter expenses by date range too', () => {
    const expenses = [
      createMockExpense({ date: new Date('2024-02-15') }),
      createMockExpense({ id: 'exp-2', date: new Date('2024-07-15') }), // Outside range
    ]
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })

    const result = generateDatevCsv([], expenses, options)

    expect(result.recordCount).toBe(1)
  })

  it('should include both income and expenses by default', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions()

    const result = generateDatevCsv(incomes, expenses, options)

    expect(result.recordCount).toBe(2)
    const debitCredits = result.records.map((r) => r.debitCredit)
    expect(debitCredits).toContain('H') // income
    expect(debitCredits).toContain('S') // expense
  })

  it('should report validation errors for invalid records', () => {
    // Create income with zero gross amount → will fail validation
    const incomes = [createMockIncome({ grossAmount: 0 })]
    const options = createMockExportOptions()

    const result = generateDatevCsv(incomes, [], options)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Record 1')
  })

  it('should include boundary dates in filter', () => {
    const incomes = [
      createMockIncome({ date: new Date('2024-01-01') }), // Exactly on start
      createMockIncome({ id: 'inc-2', date: new Date('2024-03-31') }), // Exactly on end
    ]
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })

    const result = generateDatevCsv(incomes, [], options)

    expect(result.recordCount).toBe(2)
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

  it('should produce Latin-1 encoded blob', () => {
    const result = generateDatevCsv(
      [createMockIncome()],
      [],
      createMockExportOptions()
    )
    const blob = generateDatevCsvBlob(result)

    expect(blob.type).toBe('text/csv;charset=iso-8859-1')
  })

  it('should produce blob even for empty result', () => {
    const result = generateDatevCsv([], [], createMockExportOptions())
    const blob = generateDatevCsvBlob(result)

    // Should still have the header row
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

  it('should default to csv extension', () => {
    const options = createMockExportOptions()
    const filename = generateDatevFilename(options)

    expect(filename.endsWith('.csv')).toBe(true)
  })

  it('should format dates as YYYYMMDD', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30'),
    })
    const filename = generateDatevFilename(options)

    expect(filename).toContain('20240701')
    expect(filename).toContain('20240930')
  })

  it('should produce consistent format pattern', () => {
    const options = createMockExportOptions()
    const filename = generateDatevFilename(options)

    expect(filename).toMatch(/^DATEV_(SKR03|SKR04)_\d{8}_\d{8}\.(csv|xml)$/)
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

  it('should include data category 21 (Buchungsstapel)', () => {
    const options = createMockExportOptions()
    const header = generateDatevFileHeader(options)

    expect(header).toContain('21')
  })

  it('should include chart of accounts type', () => {
    const options = createMockExportOptions({ chartOfAccounts: 'SKR03' })
    const header = generateDatevFileHeader(options)

    expect(header).toContain('SKR03')
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

  it('should omit consultant number when not provided', () => {
    const options = createMockExportOptions()
    const header = generateDatevFileHeader(options)

    expect(header).not.toContain('Berater')
  })

  it('should omit client number when not provided', () => {
    const options = createMockExportOptions()
    const header = generateDatevFileHeader(options)

    expect(header).not.toContain('Mandant')
  })

  it('should include both consultant and client when both provided', () => {
    const options = createMockExportOptions({
      consultantNumber: '11111',
      clientNumber: '22222',
    })
    const header = generateDatevFileHeader(options)

    expect(header).toContain('Berater: 11111')
    expect(header).toContain('Mandant: 22222')
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
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(5) // June
    expect(endDate.getDate()).toBe(30)
  })

  it('should return Q3 dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'Q3')

    expect(startDate.getMonth()).toBe(6) // July
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(8) // September
    expect(endDate.getDate()).toBe(30)
  })

  it('should return Q4 dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'Q4')

    expect(startDate.getMonth()).toBe(9) // October
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(11) // December
    expect(endDate.getDate()).toBe(31)
  })

  it('should return full year dates', () => {
    const { startDate, endDate } = getPeriodDates(2024, 'year')

    expect(startDate.getMonth()).toBe(0)
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(11)
    expect(endDate.getDate()).toBe(31)
  })

  it('should use correct year', () => {
    const { startDate, endDate } = getPeriodDates(2023, 'Q1')

    expect(startDate.getFullYear()).toBe(2023)
    expect(endDate.getFullYear()).toBe(2023)
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

  it('should handle January', () => {
    const { startDate, endDate } = getMonthDates(2024, 1)

    expect(startDate.getMonth()).toBe(0)
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getDate()).toBe(31)
  })

  it('should handle non-leap year February', () => {
    const { startDate, endDate } = getMonthDates(2023, 2)

    expect(endDate.getDate()).toBe(28) // 2023 is not a leap year
  })

  it('should handle 30-day months', () => {
    const { endDate: apr } = getMonthDates(2024, 4) // April
    const { endDate: jun } = getMonthDates(2024, 6) // June
    const { endDate: sep } = getMonthDates(2024, 9) // September
    const { endDate: nov } = getMonthDates(2024, 11) // November

    expect(apr.getDate()).toBe(30)
    expect(jun.getDate()).toBe(30)
    expect(sep.getDate()).toBe(30)
    expect(nov.getDate()).toBe(30)
  })
})

// ============================================================================
// DATA ACCURACY / INTEGRATION TESTS
// ============================================================================

describe('CSV Data Accuracy (end-to-end)', () => {
  it('should preserve financial figures from source income', () => {
    const income = createMockIncome({
      grossAmount: 1547.23,
      vatRate: 19,
    })
    const options = createMockExportOptions()
    const result = generateDatevCsv([income], [], options)
    const record = result.records[0]

    expect(record.amount).toBe(1547.23)
    expect(record.baseAmount).toBe(1547.23)
  })

  it('should preserve financial figures from source expense', () => {
    const expense = createMockExpense({
      grossAmount: 237.89,
      vatRate: 7,
    })
    const options = createMockExportOptions()
    const result = generateDatevCsv([], [expense], options)
    const record = result.records[0]

    expect(record.amount).toBe(237.89)
    expect(record.baseAmount).toBe(237.89)
  })

  it('should produce CSV where amounts match German format of source amounts', () => {
    const income = createMockIncome({ grossAmount: 1547.23 })
    const options = createMockExportOptions()
    const result = generateDatevCsv([income], [], options)
    const csvContent = generateCsvContent(result.records)
    const dataLine = csvContent.split('\n')[1]

    expect(dataLine).toContain(formatGermanNumber(1547.23))
    expect(dataLine).toContain('1547,23')
  })

  it('should handle multiple records with different VAT rates', () => {
    const incomes = [
      createMockIncome({ grossAmount: 1190, vatRate: 19, euerCategory: 'services' }),
      createMockIncome({ id: 'inc-2', grossAmount: 107, vatRate: 7, euerCategory: 'services' }),
      createMockIncome({ id: 'inc-3', grossAmount: 500, vatRate: 0, euerCategory: 'services' }),
    ]
    const options = createMockExportOptions()
    const result = generateDatevCsv(incomes, [], options)

    expect(result.records[0].vatCode).toBe(3) // 19%
    expect(result.records[1].vatCode).toBe(2) // 7%
    expect(result.records[2].vatCode).toBe(0) // 0%
  })

  it('should correctly combine income and expense records in order', () => {
    const incomes = [createMockIncome({ grossAmount: 100 })]
    const expenses = [createMockExpense({ grossAmount: 50 })]
    const options = createMockExportOptions()

    const result = generateDatevCsv(incomes, expenses, options)

    // Income records come first, then expenses
    expect(result.records[0].debitCredit).toBe('H')
    expect(result.records[0].amount).toBe(100)
    expect(result.records[1].debitCredit).toBe('S')
    expect(result.records[1].amount).toBe(50)
  })
})
