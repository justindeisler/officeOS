/**
 * DATEV Mapping Tests
 *
 * Comprehensive tests for EÜR → SKR mapping and DATEV record generation.
 * Target: 30+ tests with 100% coverage of mapping functions.
 */

import { describe, it, expect } from 'vitest'
import type { Income, Expense, VatRate } from '../types'
import type { ChartOfAccounts, DatevVatCode } from '../types/datev'
import {
  getVatCode,
  vatCodeToRate,
  mapEuerToSkr,
  getCounterAccount,
  isIncomeAccount,
  formatDatevDate,
  parseDatevDate,
  formatGermanNumber,
  parseGermanNumber,
  mapIncomeToDatev,
  mapExpenseToDatev,
  mapDepreciationToDatev,
  truncateDescription,
  validateDatevRecord,
  getAllMappings,
  isIncomeCategory,
} from './datev-mapping'

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

// ============================================================================
// VAT CODE MAPPING TESTS
// ============================================================================

describe('getVatCode', () => {
  it('should return 3 for 19% VAT', () => {
    expect(getVatCode(19)).toBe(3)
  })

  it('should return 2 for 7% VAT', () => {
    expect(getVatCode(7)).toBe(2)
  })

  it('should return 0 for 0% VAT', () => {
    expect(getVatCode(0)).toBe(0)
  })
})

describe('vatCodeToRate', () => {
  it('should return 19 for code 3', () => {
    expect(vatCodeToRate(3)).toBe(19)
  })

  it('should return 7 for code 2', () => {
    expect(vatCodeToRate(2)).toBe(7)
  })

  it('should return 0 for code 0', () => {
    expect(vatCodeToRate(0)).toBe(0)
  })
})

// ============================================================================
// EÜR TO SKR MAPPING TESTS
// ============================================================================

describe('mapEuerToSkr', () => {
  describe('SKR03 mappings', () => {
    it('should map services (19%) to account 8400', () => {
      expect(mapEuerToSkr('services', 'SKR03', 19)).toBe(8400)
    })

    it('should map services (7%) to account 8300', () => {
      expect(mapEuerToSkr('services', 'SKR03', 7)).toBe(8300)
    })

    it('should map services (0%) to account 8120', () => {
      expect(mapEuerToSkr('services', 'SKR03', 0)).toBe(8120)
    })

    it('should map subcontractor to account 3100', () => {
      expect(mapEuerToSkr('subcontractor', 'SKR03')).toBe(3100)
    })

    it('should map software to account 4964', () => {
      expect(mapEuerToSkr('software', 'SKR03')).toBe(4964)
    })

    it('should map telecom to account 4920', () => {
      expect(mapEuerToSkr('telecom', 'SKR03')).toBe(4920)
    })

    it('should map travel to account 4670', () => {
      expect(mapEuerToSkr('travel', 'SKR03')).toBe(4670)
    })

    it('should map insurance to account 4360', () => {
      expect(mapEuerToSkr('insurance', 'SKR03')).toBe(4360)
    })

    it('should map bank_fees to account 4970', () => {
      expect(mapEuerToSkr('bank_fees', 'SKR03')).toBe(4970)
    })

    it('should map training to account 4945', () => {
      expect(mapEuerToSkr('training', 'SKR03')).toBe(4945)
    })

    it('should map books to account 4940', () => {
      expect(mapEuerToSkr('books', 'SKR03')).toBe(4940)
    })

    it('should map office_supplies to account 4930', () => {
      expect(mapEuerToSkr('office_supplies', 'SKR03')).toBe(4930)
    })

    it('should map home_office to account 4288', () => {
      expect(mapEuerToSkr('home_office', 'SKR03')).toBe(4288)
    })

    it('should map depreciation/afa to account 4830', () => {
      expect(mapEuerToSkr('depreciation', 'SKR03')).toBe(4830)
      expect(mapEuerToSkr('afa', 'SKR03')).toBe(4830)
    })

    it('should map unknown category to 4980 (other)', () => {
      expect(mapEuerToSkr('unknown_category', 'SKR03')).toBe(4980)
    })
  })

  describe('SKR04 mappings', () => {
    it('should map services (19%) to account 4400', () => {
      expect(mapEuerToSkr('services', 'SKR04', 19)).toBe(4400)
    })

    it('should map services (7%) to account 4300', () => {
      expect(mapEuerToSkr('services', 'SKR04', 7)).toBe(4300)
    })

    it('should map services (0%) to account 4120', () => {
      expect(mapEuerToSkr('services', 'SKR04', 0)).toBe(4120)
    })

    it('should map subcontractor to account 5900', () => {
      expect(mapEuerToSkr('subcontractor', 'SKR04')).toBe(5900)
    })

    it('should map software to account 6815', () => {
      expect(mapEuerToSkr('software', 'SKR04')).toBe(6815)
    })

    it('should map depreciation to account 6220', () => {
      expect(mapEuerToSkr('depreciation', 'SKR04')).toBe(6220)
    })

    it('should map unknown category to 6890 (other)', () => {
      expect(mapEuerToSkr('unknown_category', 'SKR04')).toBe(6890)
    })
  })
})

describe('getCounterAccount', () => {
  it('should return 1200 for SKR03', () => {
    expect(getCounterAccount('SKR03')).toBe(1200)
  })

  it('should return 1800 for SKR04', () => {
    expect(getCounterAccount('SKR04')).toBe(1800)
  })
})

describe('isIncomeAccount', () => {
  it('should identify SKR03 income accounts (8xxx)', () => {
    expect(isIncomeAccount(8400, 'SKR03')).toBe(true)
    expect(isIncomeAccount(8300, 'SKR03')).toBe(true)
    expect(isIncomeAccount(8120, 'SKR03')).toBe(true)
  })

  it('should identify SKR03 expense accounts', () => {
    expect(isIncomeAccount(4964, 'SKR03')).toBe(false)
    expect(isIncomeAccount(3100, 'SKR03')).toBe(false)
  })

  it('should identify SKR04 income accounts (4xxx)', () => {
    expect(isIncomeAccount(4400, 'SKR04')).toBe(true)
    expect(isIncomeAccount(4300, 'SKR04')).toBe(true)
  })

  it('should identify SKR04 expense accounts', () => {
    expect(isIncomeAccount(6815, 'SKR04')).toBe(false)
    expect(isIncomeAccount(5900, 'SKR04')).toBe(false)
  })
})

// ============================================================================
// DATE FORMATTING TESTS
// ============================================================================

describe('formatDatevDate', () => {
  it('should format date as DDMM', () => {
    expect(formatDatevDate(new Date('2024-03-15'))).toBe('1503')
  })

  it('should pad single digit day', () => {
    expect(formatDatevDate(new Date('2024-01-05'))).toBe('0501')
  })

  it('should handle December', () => {
    expect(formatDatevDate(new Date('2024-12-25'))).toBe('2512')
  })
})

describe('parseDatevDate', () => {
  it('should parse DDMM back to date', () => {
    const result = parseDatevDate('1503', 2024)
    expect(result.getDate()).toBe(15)
    expect(result.getMonth()).toBe(2) // March is 2
    expect(result.getFullYear()).toBe(2024)
  })

  it('should use current year if not specified', () => {
    const result = parseDatevDate('0105')
    expect(result.getFullYear()).toBe(new Date().getFullYear())
  })
})

// ============================================================================
// NUMBER FORMATTING TESTS
// ============================================================================

describe('formatGermanNumber', () => {
  it('should format with comma as decimal separator', () => {
    expect(formatGermanNumber(1234.56)).toBe('1234,56')
  })

  it('should format integer with trailing zeros', () => {
    expect(formatGermanNumber(100)).toBe('100,00')
  })

  it('should format small decimal', () => {
    expect(formatGermanNumber(0.5)).toBe('0,50')
  })

  it('should handle rounding', () => {
    expect(formatGermanNumber(1234.567)).toBe('1234,57')
  })
})

describe('parseGermanNumber', () => {
  it('should parse German formatted number', () => {
    expect(parseGermanNumber('1234,56')).toBe(1234.56)
  })

  it('should parse integer', () => {
    expect(parseGermanNumber('100,00')).toBe(100)
  })
})

// ============================================================================
// INCOME TO DATEV RECORD TESTS
// ============================================================================

describe('mapIncomeToDatev', () => {
  it('should map income to DATEV record with correct account', () => {
    const income = createMockIncome()
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.account).toBe(8400)
    expect(record.counterAccount).toBe(1200)
  })

  it('should set debit/credit to H (credit) for income', () => {
    const income = createMockIncome()
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.debitCredit).toBe('H')
  })

  it('should use gross amount', () => {
    const income = createMockIncome({ grossAmount: 1190 })
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.amount).toBe(1190)
    expect(record.baseAmount).toBe(1190)
  })

  it('should set correct VAT code', () => {
    const income19 = createMockIncome({ vatRate: 19 })
    const income7 = createMockIncome({ vatRate: 7, euerCategory: 'services' })

    expect(mapIncomeToDatev(income19, 'SKR03').vatCode).toBe(3)
    expect(mapIncomeToDatev(income7, 'SKR03').vatCode).toBe(2)
  })

  it('should format date correctly', () => {
    const income = createMockIncome({ date: new Date('2024-03-15') })
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.documentDate).toBe('1503')
  })

  it('should include invoice number as document reference', () => {
    const income = createMockIncome({ invoiceId: 'RE-2024-001' })
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.documentRef1).toBe('RE-2024-001')
  })

  it('should use SKR04 accounts when specified', () => {
    const income = createMockIncome()
    const record = mapIncomeToDatev(income, 'SKR04')

    expect(record.account).toBe(4400)
    expect(record.counterAccount).toBe(1800)
  })

  it('should set currency to EUR', () => {
    const income = createMockIncome()
    const record = mapIncomeToDatev(income, 'SKR03')

    expect(record.currency).toBe('EUR')
  })
})

// ============================================================================
// EXPENSE TO DATEV RECORD TESTS
// ============================================================================

describe('mapExpenseToDatev', () => {
  it('should map expense to DATEV record with correct account', () => {
    const expense = createMockExpense({ euerCategory: 'software' })
    const record = mapExpenseToDatev(expense, 'SKR03')

    expect(record.account).toBe(4964)
    expect(record.counterAccount).toBe(1200)
  })

  it('should set debit/credit to S (debit) for expense', () => {
    const expense = createMockExpense()
    const record = mapExpenseToDatev(expense, 'SKR03')

    expect(record.debitCredit).toBe('S')
  })

  it('should use gross amount', () => {
    const expense = createMockExpense({ grossAmount: 59.5 })
    const record = mapExpenseToDatev(expense, 'SKR03')

    expect(record.amount).toBe(59.5)
  })

  it('should include vendor in description', () => {
    const expense = createMockExpense({
      vendor: 'Adobe',
      description: 'Subscription',
    })
    const record = mapExpenseToDatev(expense, 'SKR03')

    expect(record.description).toContain('Adobe')
  })

  it('should map different expense categories correctly', () => {
    const categories: Array<{ category: string; expectedAccount: number }> = [
      { category: 'telecom', expectedAccount: 4920 },
      { category: 'travel', expectedAccount: 4670 },
      { category: 'insurance', expectedAccount: 4360 },
      { category: 'bank_fees', expectedAccount: 4970 },
    ]

    categories.forEach(({ category, expectedAccount }) => {
      const expense = createMockExpense({ euerCategory: category })
      const record = mapExpenseToDatev(expense, 'SKR03')
      expect(record.account).toBe(expectedAccount)
    })
  })
})

// ============================================================================
// DEPRECIATION RECORD TESTS
// ============================================================================

describe('mapDepreciationToDatev', () => {
  it('should create depreciation record with correct account', () => {
    const record = mapDepreciationToDatev(
      'MacBook Pro',
      500,
      new Date('2024-12-31'),
      'SKR03'
    )

    expect(record.account).toBe(4830)
    expect(record.amount).toBe(500)
  })

  it('should set VAT code to 0 (no VAT on depreciation)', () => {
    const record = mapDepreciationToDatev(
      'MacBook Pro',
      500,
      new Date('2024-12-31'),
      'SKR03'
    )

    expect(record.vatCode).toBe(0)
  })

  it('should include asset name in description', () => {
    const record = mapDepreciationToDatev(
      'MacBook Pro',
      500,
      new Date('2024-12-31'),
      'SKR03'
    )

    expect(record.description).toContain('AfA')
    expect(record.description).toContain('MacBook Pro')
  })

  it('should use SKR04 account when specified', () => {
    const record = mapDepreciationToDatev(
      'MacBook Pro',
      500,
      new Date('2024-12-31'),
      'SKR04'
    )

    expect(record.account).toBe(6220)
  })
})

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('truncateDescription', () => {
  it('should not truncate short descriptions', () => {
    const desc = 'Short description'
    expect(truncateDescription(desc)).toBe(desc)
  })

  it('should truncate descriptions over 60 chars', () => {
    const longDesc = 'A'.repeat(70)
    const result = truncateDescription(longDesc)

    expect(result.length).toBe(60)
    expect(result.endsWith('...')).toBe(true)
  })

  it('should handle exactly 60 char descriptions', () => {
    const desc = 'A'.repeat(60)
    expect(truncateDescription(desc)).toBe(desc)
  })
})

describe('validateDatevRecord', () => {
  it('should return empty array for valid record', () => {
    const record = mapIncomeToDatev(createMockIncome(), 'SKR03')
    const errors = validateDatevRecord(record)

    expect(errors).toHaveLength(0)
  })

  it('should catch zero amount', () => {
    const income = createMockIncome({ grossAmount: 0 })
    const record = mapIncomeToDatev(income, 'SKR03')
    const errors = validateDatevRecord(record)

    expect(errors).toContain('Amount must be greater than 0')
  })

  it('should catch missing account', () => {
    const record = mapIncomeToDatev(createMockIncome(), 'SKR03')
    record.account = 0
    const errors = validateDatevRecord(record)

    expect(errors).toContain('Account number is required')
  })

  it('should catch invalid date format', () => {
    const record = mapIncomeToDatev(createMockIncome(), 'SKR03')
    record.documentDate = '123' // Invalid - should be 4 chars
    const errors = validateDatevRecord(record)

    expect(errors).toContain('Document date must be in DDMM format')
  })

  it('should catch invalid debit/credit indicator', () => {
    const record = mapIncomeToDatev(createMockIncome(), 'SKR03')
    ;(record as any).debitCredit = 'X'
    const errors = validateDatevRecord(record)

    expect(errors).toContain('Debit/Credit indicator must be S or H')
  })
})

describe('getAllMappings', () => {
  it('should return SKR03 mappings', () => {
    const mappings = getAllMappings('SKR03')
    expect(mappings.length).toBeGreaterThan(10)
    expect(mappings.some((m) => m.skr03Account === 8400)).toBe(true)
  })

  it('should return SKR04 mappings', () => {
    const mappings = getAllMappings('SKR04')
    expect(mappings.length).toBeGreaterThan(10)
    expect(mappings.some((m) => m.skr04Account === 4400)).toBe(true)
  })
})

describe('isIncomeCategory', () => {
  it('should identify income categories', () => {
    expect(isIncomeCategory('services')).toBe(true)
    expect(isIncomeCategory('services_7')).toBe(true)
    expect(isIncomeCategory('asset_sale')).toBe(true)
    expect(isIncomeCategory('ust_refund')).toBe(true)
  })

  it('should identify expense categories', () => {
    expect(isIncomeCategory('software')).toBe(false)
    expect(isIncomeCategory('telecom')).toBe(false)
    expect(isIncomeCategory('travel')).toBe(false)
  })
})
