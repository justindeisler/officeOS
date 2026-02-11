/**
 * DATEV XML Export Tests
 *
 * Comprehensive tests for XML generation, structure validation, encoding,
 * schema compliance, data accuracy, and export functionality.
 * Target: 50+ tests with 98%+ coverage.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Income, Expense } from '../types'
import type { DatevExportOptions, DatevRecord } from '../types/datev'
import {
  DATEV_XML_NAMESPACE,
  XML_DECLARATION,
  escapeXml,
  createElement,
  wrapElements,
  indentXml,
  formatXmlDate,
  datevDateToXmlDate,
  recordToXmlTransaction,
  generateConsolidateSection,
  generateXmlHeader,
  buildXmlDocument,
  incomesToXmlRecords,
  expensesToXmlRecords,
  generateDatevXml,
  generateDatevXmlContent,
  generateDatevXmlBlob,
  validateXmlStructure,
  prettyPrintXml,
} from './datev-xml'

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
  format: 'xml',
  ...overrides,
})

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('XML Constants', () => {
  it('should have correct namespace', () => {
    expect(DATEV_XML_NAMESPACE).toBe('http://xml.datev.de/bedi/tps/ledger/v060')
  })

  it('should have correct XML declaration', () => {
    expect(XML_DECLARATION).toBe('<?xml version="1.0" encoding="UTF-8"?>')
  })

  it('should declare UTF-8 encoding in XML declaration', () => {
    expect(XML_DECLARATION).toContain('encoding="UTF-8"')
  })
})

// ============================================================================
// XML HELPER TESTS
// ============================================================================

describe('escapeXml', () => {
  it('should return empty string for empty input', () => {
    expect(escapeXml('')).toBe('')
  })

  it('should escape ampersand', () => {
    expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('should escape less than', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b')
  })

  it('should escape greater than', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b')
  })

  it('should escape quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('should escape apostrophes', () => {
    expect(escapeXml("it's")).toBe('it&apos;s')
  })

  it('should handle multiple special characters', () => {
    const result = escapeXml('<tag attr="value">')
    expect(result).toBe('&lt;tag attr=&quot;value&quot;&gt;')
  })

  it('should not escape normal text', () => {
    expect(escapeXml('Normal text 123')).toBe('Normal text 123')
  })

  it('should handle German umlauts without escaping', () => {
    expect(escapeXml('Büroausstattung')).toBe('Büroausstattung')
  })

  it('should handle all five entities in one string', () => {
    const result = escapeXml('<"Tom & Jerry\'s"> show')
    expect(result).toBe('&lt;&quot;Tom &amp; Jerry&apos;s&quot;&gt; show')
  })
})

describe('createElement', () => {
  it('should create element with content', () => {
    expect(createElement('Name', 'Test')).toBe('<Name>Test</Name>')
  })

  it('should create element with number content', () => {
    expect(createElement('Amount', 1234.56)).toBe('<Amount>1234.56</Amount>')
  })

  it('should create self-closing element for null content', () => {
    expect(createElement('Empty', null)).toBe('<Empty/>')
  })

  it('should create self-closing element for empty string', () => {
    expect(createElement('Empty', '')).toBe('<Empty/>')
  })

  it('should create self-closing element for undefined content', () => {
    expect(createElement('Empty', undefined as unknown as string)).toBe('<Empty/>')
  })

  it('should include attributes', () => {
    const result = createElement('Tag', 'Content', { attr: 'value' })
    expect(result).toBe('<Tag attr="value">Content</Tag>')
  })

  it('should include multiple attributes', () => {
    const result = createElement('Tag', 'Content', { a: '1', b: '2' })
    expect(result).toContain('a="1"')
    expect(result).toContain('b="2"')
    expect(result).toContain('>Content</Tag>')
  })

  it('should escape content', () => {
    const result = createElement('Tag', '<special>')
    expect(result).toBe('<Tag>&lt;special&gt;</Tag>')
  })

  it('should escape attribute values', () => {
    const result = createElement('Tag', 'x', { key: 'a&b' })
    expect(result).toContain('key="a&amp;b"')
  })

  it('should handle zero as valid content', () => {
    const result = createElement('Count', 0)
    expect(result).toBe('<Count>0</Count>')
  })

  it('should self-close with attributes when content is null', () => {
    const result = createElement('Tag', null, { type: 'empty' })
    expect(result).toBe('<Tag type="empty"/>')
  })
})

describe('wrapElements', () => {
  it('should wrap child elements', () => {
    const children = ['<Child1>A</Child1>', '<Child2>B</Child2>']
    const result = wrapElements('Parent', children)

    expect(result).toContain('<Parent>')
    expect(result).toContain('</Parent>')
    expect(result).toContain('<Child1>A</Child1>')
  })

  it('should handle empty children', () => {
    const result = wrapElements('Parent', [])
    expect(result).toBe('<Parent>\n\n</Parent>')
  })

  it('should filter out empty string children', () => {
    const children = ['<A>1</A>', '', '<B>2</B>']
    const result = wrapElements('Root', children)

    expect(result).toContain('<A>1</A>')
    expect(result).toContain('<B>2</B>')
  })

  it('should join children with newlines', () => {
    const children = ['<A/>', '<B/>']
    const result = wrapElements('Root', children)

    expect(result).toContain('<A/>\n<B/>')
  })
})

describe('indentXml', () => {
  it('should indent with default spaces', () => {
    const result = indentXml('<Tag>Content</Tag>')
    expect(result).toBe('  <Tag>Content</Tag>')
  })

  it('should indent with custom spaces', () => {
    const result = indentXml('<Tag>Content</Tag>', 4)
    expect(result).toBe('    <Tag>Content</Tag>')
  })

  it('should indent multiline content', () => {
    const result = indentXml('<A>1</A>\n<B>2</B>', 2)
    expect(result).toBe('  <A>1</A>\n  <B>2</B>')
  })

  it('should handle zero indentation', () => {
    const result = indentXml('<Tag>Content</Tag>', 0)
    expect(result).toBe('<Tag>Content</Tag>')
  })
})

// ============================================================================
// DATE FORMATTING TESTS
// ============================================================================

describe('formatXmlDate', () => {
  it('should format date as YYYY-MM-DD', () => {
    const result = formatXmlDate(new Date('2024-03-15'))
    expect(result).toBe('2024-03-15')
  })

  it('should pad single digit month', () => {
    const result = formatXmlDate(new Date('2024-01-05'))
    expect(result).toBe('2024-01-05')
  })

  it('should format last day of year', () => {
    const result = formatXmlDate(new Date('2024-12-31'))
    expect(result).toBe('2024-12-31')
  })

  it('should format first day of year', () => {
    const result = formatXmlDate(new Date('2024-01-01'))
    expect(result).toBe('2024-01-01')
  })
})

describe('datevDateToXmlDate', () => {
  it('should convert DDMM to YYYY-MM-DD', () => {
    const result = datevDateToXmlDate('1503', 2024)
    expect(result).toBe('2024-03-15')
  })

  it('should handle first day of year', () => {
    const result = datevDateToXmlDate('0101', 2024)
    expect(result).toBe('2024-01-01')
  })

  it('should handle last day of year', () => {
    const result = datevDateToXmlDate('3112', 2024)
    expect(result).toBe('2024-12-31')
  })

  it('should use provided year', () => {
    const result = datevDateToXmlDate('1503', 2023)
    expect(result).toBe('2023-03-15')
  })
})

// ============================================================================
// TRANSACTION XML TESTS
// ============================================================================

describe('recordToXmlTransaction', () => {
  it('should create Transaction element', () => {
    const record = createMockDatevRecord()
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Transaction>')
    expect(result).toContain('</Transaction>')
  })

  it('should include date in XML format', () => {
    const record = createMockDatevRecord({ documentDate: '1503' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Date>2024-03-15</Date>')
  })

  it('should include amount with 2 decimal places', () => {
    const record = createMockDatevRecord({ amount: 1190 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Amount>1190.00</Amount>')
  })

  it('should swap accounts for credit transactions', () => {
    const record = createMockDatevRecord({
      debitCredit: 'H',
      account: 8400,
      counterAccount: 1200,
    })
    const result = recordToXmlTransaction(record, 2024)

    // For credit (H), the income account is credited
    expect(result).toContain('<DebitAccount>1200</DebitAccount>')
    expect(result).toContain('<CreditAccount>8400</CreditAccount>')
  })

  it('should keep accounts for debit transactions', () => {
    const record = createMockDatevRecord({
      debitCredit: 'S',
      account: 4964,
      counterAccount: 1200,
    })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<DebitAccount>4964</DebitAccount>')
    expect(result).toContain('<CreditAccount>1200</CreditAccount>')
  })

  it('should include tax code for 19% VAT', () => {
    const record = createMockDatevRecord({ vatCode: 3 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<TaxCode>19</TaxCode>')
  })

  it('should include tax code for 7% VAT', () => {
    const record = createMockDatevRecord({ vatCode: 2 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<TaxCode>7</TaxCode>')
  })

  it('should not include tax code for exempt (vatCode 0)', () => {
    const record = createMockDatevRecord({ vatCode: 0 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).not.toContain('<TaxCode>')
  })

  it('should include document reference', () => {
    const record = createMockDatevRecord({ documentRef1: 'RE-2024-001' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<DocumentNumber>RE-2024-001</DocumentNumber>')
  })

  it('should omit document reference when empty', () => {
    const record = createMockDatevRecord({ documentRef1: '' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).not.toContain('<DocumentNumber>')
  })

  it('should include description when present', () => {
    const record = createMockDatevRecord({ description: 'Test booking' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Description>Test booking</Description>')
  })

  it('should omit description when empty', () => {
    const record = createMockDatevRecord({ description: '' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).not.toContain('<Description>')
  })

  it('should escape special XML characters in description', () => {
    const record = createMockDatevRecord({ description: 'Tom & Jerry <2024>' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('Tom &amp; Jerry &lt;2024&gt;')
  })

  it('should include Currency element', () => {
    const record = createMockDatevRecord({ currency: 'EUR' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Currency>EUR</Currency>')
  })

  it('should format fractional amounts correctly', () => {
    const record = createMockDatevRecord({ amount: 59.5 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<Amount>59.50</Amount>')
  })
})

describe('generateConsolidateSection', () => {
  it('should wrap transactions in Consolidate element', () => {
    const records = [createMockDatevRecord()]
    const result = generateConsolidateSection(records, 2024)

    expect(result).toContain('<Consolidate>')
    expect(result).toContain('</Consolidate>')
    expect(result).toContain('<Transaction>')
  })

  it('should include multiple transactions', () => {
    const records = [createMockDatevRecord(), createMockDatevRecord()]
    const result = generateConsolidateSection(records, 2024)

    const transactionCount = (result.match(/<Transaction>/g) || []).length
    expect(transactionCount).toBe(2)
  })

  it('should handle empty records array', () => {
    const result = generateConsolidateSection([], 2024)

    expect(result).toContain('<Consolidate>')
    expect(result).toContain('</Consolidate>')
    expect(result).not.toContain('<Transaction>')
  })

  it('should indent transactions within Consolidate', () => {
    const records = [createMockDatevRecord()]
    const result = generateConsolidateSection(records, 2024)

    // Transactions should be indented (4 spaces per indentXml call)
    expect(result).toContain('    ')
  })
})

// ============================================================================
// HEADER TESTS
// ============================================================================

describe('generateXmlHeader', () => {
  it('should include version', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).toContain('<Version>6.0</Version>')
  })

  it('should include generator', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).toContain('<Generator>Personal Assistant</Generator>')
  })

  it('should include GeneratedAt timestamp', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).toContain('<GeneratedAt>')
    // Should be ISO format
    expect(result).toMatch(/<GeneratedAt>\d{4}-\d{2}-\d{2}T/)
  })

  it('should include chart of accounts', () => {
    const options = createMockExportOptions({ chartOfAccounts: 'SKR03' })
    const result = generateXmlHeader(options)

    expect(result).toContain('<ChartOfAccounts>SKR03</ChartOfAccounts>')
  })

  it('should include consultant number when provided', () => {
    const options = createMockExportOptions({ consultantNumber: '12345' })
    const result = generateXmlHeader(options)

    expect(result).toContain('<ConsultantNumber>12345</ConsultantNumber>')
  })

  it('should omit consultant number when not provided', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).not.toContain('<ConsultantNumber>')
  })

  it('should include client number when provided', () => {
    const options = createMockExportOptions({ clientNumber: '99999' })
    const result = generateXmlHeader(options)

    expect(result).toContain('<ClientNumber>99999</ClientNumber>')
  })

  it('should omit client number when not provided', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).not.toContain('<ClientNumber>')
  })

  it('should include period dates', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })
    const result = generateXmlHeader(options)

    expect(result).toContain('<PeriodStart>2024-01-01</PeriodStart>')
    expect(result).toContain('<PeriodEnd>2024-03-31</PeriodEnd>')
  })

  it('should be wrapped in Header element', () => {
    const options = createMockExportOptions()
    const result = generateXmlHeader(options)

    expect(result).toMatch(/^<Header>/)
    expect(result).toMatch(/<\/Header>$/)
  })
})

// ============================================================================
// INCOME/EXPENSE TO XML RECORDS TESTS
// ============================================================================

describe('incomesToXmlRecords', () => {
  it('should convert income to DATEV records', () => {
    const incomes = [createMockIncome()]
    const records = incomesToXmlRecords(incomes, 'SKR03')

    expect(records).toHaveLength(1)
    expect(records[0].debitCredit).toBe('H')
    expect(records[0].account).toBe(8400)
  })

  it('should handle empty array', () => {
    const records = incomesToXmlRecords([], 'SKR03')
    expect(records).toHaveLength(0)
  })

  it('should use SKR04 accounts', () => {
    const incomes = [createMockIncome()]
    const records = incomesToXmlRecords(incomes, 'SKR04')

    expect(records[0].account).toBe(4400)
  })
})

describe('expensesToXmlRecords', () => {
  it('should convert expense to DATEV records', () => {
    const expenses = [createMockExpense()]
    const records = expensesToXmlRecords(expenses, 'SKR03')

    expect(records).toHaveLength(1)
    expect(records[0].debitCredit).toBe('S')
  })

  it('should handle empty array', () => {
    const records = expensesToXmlRecords([], 'SKR04')
    expect(records).toHaveLength(0)
  })
})

// ============================================================================
// DOCUMENT GENERATION TESTS
// ============================================================================

describe('buildXmlDocument', () => {
  it('should start with XML declaration', () => {
    const records = [createMockDatevRecord()]
    const options = createMockExportOptions()
    const result = buildXmlDocument(records, options)

    expect(result.startsWith(XML_DECLARATION)).toBe(true)
  })

  it('should include namespace', () => {
    const records = [createMockDatevRecord()]
    const options = createMockExportOptions()
    const result = buildXmlDocument(records, options)

    expect(result).toContain(`xmlns="${DATEV_XML_NAMESPACE}"`)
  })

  it('should include Header and Consolidate sections', () => {
    const records = [createMockDatevRecord()]
    const options = createMockExportOptions()
    const result = buildXmlDocument(records, options)

    expect(result).toContain('<Header>')
    expect(result).toContain('<Consolidate>')
  })

  it('should have LedgerImport as root element', () => {
    const records = [createMockDatevRecord()]
    const options = createMockExportOptions()
    const result = buildXmlDocument(records, options)

    expect(result).toContain('<LedgerImport')
    expect(result).toContain('</LedgerImport>')
  })

  it('should produce valid XML with empty records', () => {
    const options = createMockExportOptions()
    const result = buildXmlDocument([], options)

    expect(result).toContain(XML_DECLARATION)
    expect(result).toContain('<LedgerImport')
    expect(result).toContain('<Header>')
    expect(result).toContain('<Consolidate>')
  })

  it('should include transaction data for each record', () => {
    const records = [
      createMockDatevRecord({ amount: 100, documentRef1: 'A' }),
      createMockDatevRecord({ amount: 200, documentRef1: 'B' }),
    ]
    const options = createMockExportOptions()
    const result = buildXmlDocument(records, options)

    expect(result).toContain('<Amount>100.00</Amount>')
    expect(result).toContain('<Amount>200.00</Amount>')
    expect(result).toContain('<DocumentNumber>A</DocumentNumber>')
    expect(result).toContain('<DocumentNumber>B</DocumentNumber>')
  })

  it('should use start year for date conversion', () => {
    const records = [createMockDatevRecord({ documentDate: '0101' })]
    const options = createMockExportOptions({
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
    })
    const result = buildXmlDocument(records, options)

    expect(result).toContain('<Date>2023-01-01</Date>')
  })
})

// ============================================================================
// MAIN EXPORT FUNCTION TESTS
// ============================================================================

describe('generateDatevXml', () => {
  it('should generate result with correct record count', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions()

    const result = generateDatevXml(incomes, expenses, options)

    expect(result.recordCount).toBe(2)
    expect(result.format).toBe('xml')
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

    const result = generateDatevXml(incomes, [], options)

    expect(result.recordCount).toBe(1)
  })

  it('should filter expenses by date range', () => {
    const expenses = [
      createMockExpense({ date: new Date('2024-02-15') }),
      createMockExpense({ id: 'exp-2', date: new Date('2024-07-15') }),
    ]
    const options = createMockExportOptions()

    const result = generateDatevXml([], expenses, options)

    expect(result.recordCount).toBe(1)
  })

  it('should add warning for empty result', () => {
    const options = createMockExportOptions()
    const result = generateDatevXml([], [], options)

    expect(result.warnings).toContain(
      'No records found in the selected date range'
    )
  })

  it('should exclude income when option is false', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions({ includeIncome: false })

    const result = generateDatevXml(incomes, expenses, options)

    expect(result.recordCount).toBe(1)
    expect(result.records[0].debitCredit).toBe('S')
  })

  it('should exclude expenses when option is false', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions({ includeExpenses: false })

    const result = generateDatevXml(incomes, expenses, options)

    expect(result.recordCount).toBe(1)
    expect(result.records[0].debitCredit).toBe('H')
  })

  it('should report validation errors for invalid records', () => {
    const incomes = [createMockIncome({ grossAmount: 0 })]
    const options = createMockExportOptions()

    const result = generateDatevXml(incomes, [], options)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Record 1')
  })

  it('should include metadata in result', () => {
    const options = createMockExportOptions({
      chartOfAccounts: 'SKR04',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-30'),
    })

    const result = generateDatevXml([], [], options)

    expect(result.chartOfAccounts).toBe('SKR04')
    expect(result.startDate).toEqual(new Date('2024-01-01'))
    expect(result.endDate).toEqual(new Date('2024-06-30'))
  })
})

describe('generateDatevXmlContent', () => {
  it('should return XML string', () => {
    const options = createMockExportOptions()
    const result = generateDatevXml([createMockIncome()], [], options)
    const xml = generateDatevXmlContent(result, options)

    expect(typeof xml).toBe('string')
    expect(xml).toContain(XML_DECLARATION)
    expect(xml).toContain('<LedgerImport')
  })

  it('should include all transaction data', () => {
    const options = createMockExportOptions()
    const result = generateDatevXml(
      [createMockIncome()],
      [createMockExpense()],
      options
    )
    const xml = generateDatevXmlContent(result, options)

    const transactionCount = (xml.match(/<Transaction>/g) || []).length
    expect(transactionCount).toBe(2)
  })
})

describe('generateDatevXmlBlob', () => {
  it('should generate blob with correct MIME type', () => {
    const result = generateDatevXml(
      [createMockIncome()],
      [],
      createMockExportOptions()
    )
    const blob = generateDatevXmlBlob(result, createMockExportOptions())

    expect(blob.type).toBe('application/xml;charset=utf-8')
  })

  it('should have content', () => {
    const result = generateDatevXml(
      [createMockIncome()],
      [],
      createMockExportOptions()
    )
    const blob = generateDatevXmlBlob(result, createMockExportOptions())

    expect(blob.size).toBeGreaterThan(0)
  })

  it('should produce blob for empty result', () => {
    const options = createMockExportOptions()
    const result = generateDatevXml([], [], options)
    const blob = generateDatevXmlBlob(result, options)

    // Should still have XML structure even with no transactions
    expect(blob.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateXmlStructure', () => {
  it('should pass valid XML', () => {
    const records = [createMockDatevRecord()]
    const options = createMockExportOptions()
    const xml = buildXmlDocument(records, options)

    const errors = validateXmlStructure(xml)

    expect(errors).toHaveLength(0)
  })

  it('should detect missing XML declaration', () => {
    const xml = '<LedgerImport></LedgerImport>'
    const errors = validateXmlStructure(xml)

    expect(errors).toContain('Missing or invalid XML declaration')
  })

  it('should detect missing namespace', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><LedgerImport><Consolidate></Consolidate></LedgerImport>'
    const errors = validateXmlStructure(xml)

    expect(errors).toContain('Missing DATEV namespace')
  })

  it('should detect missing LedgerImport root element', () => {
    const xml = `${XML_DECLARATION}<Root xmlns="${DATEV_XML_NAMESPACE}"><Consolidate></Consolidate></Root>`
    const errors = validateXmlStructure(xml)

    expect(errors).toContain('Missing LedgerImport root element')
  })

  it('should detect missing Consolidate section', () => {
    const xml = `${XML_DECLARATION}<LedgerImport xmlns="${DATEV_XML_NAMESPACE}"></LedgerImport>`
    const errors = validateXmlStructure(xml)

    expect(errors).toContain('Missing Consolidate section')
  })

  it('should validate generated XML passes all checks', () => {
    const options = createMockExportOptions({
      consultantNumber: '12345',
      clientNumber: '99999',
    })
    const records = [
      createMockDatevRecord({ amount: 100 }),
      createMockDatevRecord({ amount: 200, debitCredit: 'S', vatCode: 0 }),
    ]
    const xml = buildXmlDocument(records, options)
    const errors = validateXmlStructure(xml)

    expect(errors).toHaveLength(0)
  })
})

describe('prettyPrintXml', () => {
  it('should add indentation', () => {
    const xml = '<Parent><Child>Content</Child></Parent>'
    const result = prettyPrintXml(xml)

    expect(result).toContain('  ')
    expect(result.split('\n').length).toBeGreaterThan(1)
  })

  it('should handle self-closing tags', () => {
    const xml = '<Root><Empty/></Root>'
    const result = prettyPrintXml(xml)

    expect(result).toContain('<Empty/>')
  })

  it('should preserve XML declaration', () => {
    const xml = '<?xml version="1.0"?><Root><Child>A</Child></Root>'
    const result = prettyPrintXml(xml)

    expect(result).toContain('<?xml version="1.0"?>')
  })

  it('should indent nested elements', () => {
    const xml = '<A><B><C>text</C></B></A>'
    const result = prettyPrintXml(xml)
    const lines = result.split('\n')

    // A at level 0, B at level 1, C at level 2
    expect(lines[0].trim()).toBe('<A>')
    expect(lines[1]).toContain('  <B>')
  })
})

// ============================================================================
// XML DATA ACCURACY / INTEGRATION TESTS
// ============================================================================

describe('XML Data Accuracy (end-to-end)', () => {
  it('should correctly encode German umlauts in UTF-8 XML', () => {
    const income = createMockIncome({
      description: 'Büroausstattung für München',
    })
    const options = createMockExportOptions()
    const result = generateDatevXml([income], [], options)
    const xml = generateDatevXmlContent(result, options)

    // UTF-8 handles umlauts natively, no escaping needed
    expect(xml).toContain('Büroausstattung')
    // But XML special chars should still be escaped in description
    expect(xml).toContain('für')
  })

  it('should escape XML special characters in descriptions', () => {
    const income = createMockIncome({
      description: 'Design & Development <2024>',
    })
    const options = createMockExportOptions()
    const result = generateDatevXml([income], [], options)
    const xml = generateDatevXmlContent(result, options)

    expect(xml).toContain('&amp;')
    expect(xml).toContain('&lt;')
    expect(xml).toContain('&gt;')
  })

  it('should preserve amounts accurately across the pipeline', () => {
    const income = createMockIncome({ grossAmount: 12345.67 })
    const options = createMockExportOptions()
    const result = generateDatevXml([income], [], options)
    const xml = generateDatevXmlContent(result, options)

    expect(xml).toContain('<Amount>12345.67</Amount>')
  })

  it('should correctly map credit/debit in XML transaction', () => {
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const options = createMockExportOptions()
    const result = generateDatevXml(incomes, expenses, options)
    const xml = generateDatevXmlContent(result, options)

    // Income: H → DebitAccount=counterAccount, CreditAccount=account
    // Expense: S → DebitAccount=account, CreditAccount=counterAccount
    expect(xml).toContain('<CreditAccount>8400</CreditAccount>') // Income account credited
    expect(xml).toContain('<DebitAccount>4964</DebitAccount>') // Expense account debited
  })

  it('should handle large number of records in XML', () => {
    const incomes = Array.from({ length: 50 }, (_, i) =>
      createMockIncome({
        id: `inc-${i}`,
        date: new Date('2024-02-15'),
        grossAmount: (i + 1) * 100,
      })
    )
    const options = createMockExportOptions()
    const result = generateDatevXml(incomes, [], options)
    const xml = generateDatevXmlContent(result, options)

    const transactionCount = (xml.match(/<Transaction>/g) || []).length
    expect(transactionCount).toBe(50)
  })

  it('should produce well-formed XML with all optional fields', () => {
    const options = createMockExportOptions({
      consultantNumber: '12345',
      clientNumber: '99999',
      chartOfAccounts: 'SKR04',
    })
    const incomes = [createMockIncome()]
    const expenses = [createMockExpense()]
    const result = generateDatevXml(incomes, expenses, options)
    const xml = generateDatevXmlContent(result, options)

    // Validate structure
    const errors = validateXmlStructure(xml)
    expect(errors).toHaveLength(0)

    // Validate content
    expect(xml).toContain('<ConsultantNumber>12345</ConsultantNumber>')
    expect(xml).toContain('<ClientNumber>99999</ClientNumber>')
    expect(xml).toContain('<ChartOfAccounts>SKR04</ChartOfAccounts>')
  })
})
