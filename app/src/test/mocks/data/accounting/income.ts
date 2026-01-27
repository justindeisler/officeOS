import type { Income, VatRate } from '@/features/accounting/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock income record with sensible defaults
 * @example
 * const income = createMockIncome({ description: 'Consulting' })
 * const taxedIncome = createMockIncome({ netAmount: 1000, vatRate: 19 })
 */
export function createMockIncome(overrides: Partial<Income> = {}): Income {
  const id = overrides.id ?? generateTestId('income')
  const now = new Date()
  const netAmount = overrides.netAmount ?? 1000
  const vatRate: VatRate = overrides.vatRate ?? 19
  const vatAmount = overrides.vatAmount ?? netAmount * (vatRate / 100)
  const grossAmount = overrides.grossAmount ?? netAmount + vatAmount

  return {
    id,
    date: now,
    description: 'Test Income',
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    euerLine: 14,
    euerCategory: 'services',
    ustReported: false,
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock income records
 */
export function createMockIncomes(count: number, overrides: Partial<Income> = {}): Income[] {
  return Array.from({ length: count }, (_, index) =>
    createMockIncome({
      description: `Test Income ${index + 1}`,
      ...overrides,
    })
  )
}

/**
 * Create mock income for different VAT scenarios
 */
export function createMockIncomesByVatRate(): Record<VatRate, Income> {
  const rates: VatRate[] = [0, 7, 19]
  return rates.reduce(
    (acc, vatRate) => ({
      ...acc,
      [vatRate]: createMockIncome({
        vatRate,
        description: `Income at ${vatRate}% VAT`,
      }),
    }),
    {} as Record<VatRate, Income>
  )
}

/**
 * Create mock income for a specific quarter
 */
export function createMockIncomeForQuarter(year: number, quarter: 1 | 2 | 3 | 4): Income {
  const quarterStartMonth = (quarter - 1) * 3
  const date = new Date(year, quarterStartMonth, 15)

  return createMockIncome({
    date,
    ustPeriod: `${year}-Q${quarter}`,
    description: `Q${quarter} ${year} Income`,
  })
}
