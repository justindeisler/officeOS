/**
 * DATEV XML Export Tests
 *
 * Tests for XML generation, validation, and export functionality.
 * Target: 15+ tests with 95% coverage.
 */

import { describe, it, expect } from 'vitest'
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

  it('should include attributes', () => {
    const result = createElement('Tag', 'Content', { attr: 'value' })
    expect(result).toBe('<Tag attr="value">Content</Tag>')
  })

  it('should escape content', () => {
    const result = createElement('Tag', '<special>')
    expect(result).toBe('<Tag>&lt;special&gt;</Tag>')
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

  it('should include amount', () => {
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

  it('should include tax code for VAT transactions', () => {
    const record = createMockDatevRecord({ vatCode: 3 })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<TaxCode>19</TaxCode>')
  })

  it('should include document reference', () => {
    const record = createMockDatevRecord({ documentRef1: 'RE-2024-001' })
    const result = recordToXmlTransaction(record, 2024)

    expect(result).toContain('<DocumentNumber>RE-2024-001</DocumentNumber>')
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

  it('should include period dates', () => {
    const options = createMockExportOptions({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
    })
    const result = generateXmlHeader(options)

    expect(result).toContain('<PeriodStart>2024-01-01</PeriodStart>')
    expect(result).toContain('<PeriodEnd>2024-03-31</PeriodEnd>')
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

  it('should add warning for empty result', () => {
    const options = createMockExportOptions()
    const result = generateDatevXml([], [], options)

    expect(result.warnings).toContain(
      'No records found in the selected date range'
    )
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
    const xml = '<?xml version="1.0" encoding="UTF-8"?><LedgerImport></LedgerImport>'
    const errors = validateXmlStructure(xml)

    expect(errors).toContain('Missing DATEV namespace')
  })
})

describe('prettyPrintXml', () => {
  it('should add indentation', () => {
    const xml = '<Parent><Child>Content</Child></Parent>'
    const result = prettyPrintXml(xml)

    expect(result).toContain('  ')
    expect(result.split('\n').length).toBeGreaterThan(1)
  })
})
