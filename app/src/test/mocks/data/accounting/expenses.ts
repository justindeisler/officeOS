import type { Expense, VatRate, RecurringFrequency } from '@/features/accounting/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock expense record with sensible defaults
 * @example
 * const expense = createMockExpense({ vendor: 'Amazon' })
 * const gwgExpense = createMockExpense({ netAmount: 500, isGwg: true })
 */
export function createMockExpense(overrides: Partial<Expense> = {}): Expense {
  const id = overrides.id ?? generateTestId('expense')
  const now = new Date()
  const netAmount = overrides.netAmount ?? 100
  const vatRate: VatRate = overrides.vatRate ?? 19
  const vatAmount = overrides.vatAmount ?? netAmount * (vatRate / 100)
  const grossAmount = overrides.grossAmount ?? netAmount + vatAmount

  return {
    id,
    date: now,
    vendor: 'Test Vendor',
    description: 'Test Expense',
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    euerLine: 34,
    euerCategory: 'software',
    deductiblePercent: 100,
    isRecurring: false,
    vorsteuerClaimed: false,
    isGwg: false,
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock expenses
 */
export function createMockExpenses(count: number, overrides: Partial<Expense> = {}): Expense[] {
  return Array.from({ length: count }, (_, index) =>
    createMockExpense({
      description: `Test Expense ${index + 1}`,
      ...overrides,
    })
  )
}

/**
 * Create mock expense for different EÜR categories
 */
export function createMockExpensesByCategory(): Record<string, Expense> {
  const categories = [
    { category: 'software', line: 34, label: 'Software & Lizenzen' },
    { category: 'telecom', line: 34, label: 'Telekommunikation' },
    { category: 'hosting', line: 34, label: 'Hosting & Domains' },
    { category: 'travel', line: 34, label: 'Reisekosten' },
    { category: 'insurance', line: 34, label: 'Versicherungen' },
    { category: 'fremdleistungen', line: 25, label: 'Fremdleistungen' },
  ]

  return categories.reduce(
    (acc, { category, line, label }) => ({
      ...acc,
      [category]: createMockExpense({
        euerCategory: category,
        euerLine: line,
        description: label,
      }),
    }),
    {} as Record<string, Expense>
  )
}

/**
 * Create a recurring expense
 */
export function createMockRecurringExpense(
  frequency: RecurringFrequency,
  overrides: Partial<Expense> = {}
): Expense {
  return createMockExpense({
    isRecurring: true,
    recurringFrequency: frequency,
    description: `Monthly ${overrides.euerCategory ?? 'software'} subscription`,
    ...overrides,
  })
}

/**
 * Create a GWG expense (Geringwertige Wirtschaftsgüter)
 * Net amount between €250.01 and €800
 */
export function createMockGwgExpense(overrides: Partial<Expense> = {}): Expense {
  return createMockExpense({
    netAmount: 500,
    vatRate: 19,
    vatAmount: 95,
    grossAmount: 595,
    isGwg: true,
    euerCategory: 'equipment',
    description: 'GWG Equipment',
    ...overrides,
  })
}

/**
 * Create mock expense for a specific quarter
 */
export function createMockExpenseForQuarter(year: number, quarter: 1 | 2 | 3 | 4): Expense {
  const quarterStartMonth = (quarter - 1) * 3
  const date = new Date(year, quarterStartMonth, 15)

  return createMockExpense({
    date,
    ustPeriod: `${year}-Q${quarter}`,
    description: `Q${quarter} ${year} Expense`,
  })
}
