import type { UstVoranmeldung, EuerReport } from '@/features/accounting/types'
import { EUER_LINES } from '@/features/accounting/types'

/**
 * Get quarter date range
 */
function getQuarterDates(year: number, quarter: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const quarterStartMonth = (quarter - 1) * 3
  const start = new Date(year, quarterStartMonth, 1)
  const end = new Date(year, quarterStartMonth + 3, 0) // Last day of quarter
  return { start, end }
}

/**
 * Create a mock USt-Voranmeldung (Quarterly VAT Declaration)
 * @example
 * const ust = createMockUstVoranmeldung({ year: 2024, quarter: 1 })
 * const filedUst = createMockUstVoranmeldung({ status: 'filed' })
 */
export function createMockUstVoranmeldung(
  overrides: Partial<UstVoranmeldung> = {}
): UstVoranmeldung {
  const year = overrides.year ?? 2024
  const quarter = overrides.quarter ?? 1
  const { start, end } = getQuarterDates(year, quarter)

  const umsatzsteuer19 = overrides.umsatzsteuer19 ?? 1900 // €10,000 net at 19%
  const umsatzsteuer7 = overrides.umsatzsteuer7 ?? 70 // €1,000 net at 7%
  const totalUmsatzsteuer =
    overrides.totalUmsatzsteuer ?? umsatzsteuer19 + umsatzsteuer7
  const vorsteuer = overrides.vorsteuer ?? 500 // Input VAT from expenses
  const zahllast = overrides.zahllast ?? totalUmsatzsteuer - vorsteuer

  return {
    period: `${year}-Q${quarter}`,
    year,
    quarter,
    startDate: start,
    endDate: end,
    umsatzsteuer19,
    umsatzsteuer7,
    totalUmsatzsteuer,
    vorsteuer,
    zahllast,
    status: 'draft',
    ...overrides,
  }
}

/**
 * Create multiple mock USt-Voranmeldungen for a year
 */
export function createMockUstVoranmeldungenForYear(
  year: number = 2024
): UstVoranmeldung[] {
  const quarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
  return quarters.map((quarter) =>
    createMockUstVoranmeldung({
      year,
      quarter,
      umsatzsteuer19: 1900 * quarter, // Increasing amounts per quarter
      umsatzsteuer7: 70 * quarter,
      vorsteuer: 500 * quarter,
    })
  )
}

/**
 * Create a filed USt-Voranmeldung
 */
export function createMockFiledUstVoranmeldung(
  overrides: Partial<UstVoranmeldung> = {}
): UstVoranmeldung {
  const filedDate = new Date()
  return createMockUstVoranmeldung({
    status: 'filed',
    filedDate,
    ...overrides,
  })
}

/**
 * Create USt-Voranmeldung with refund (negative Zahllast)
 */
export function createMockUstVoranmeldungWithRefund(
  overrides: Partial<UstVoranmeldung> = {}
): UstVoranmeldung {
  return createMockUstVoranmeldung({
    umsatzsteuer19: 190, // Small income VAT
    umsatzsteuer7: 0,
    vorsteuer: 500, // Higher input VAT (e.g., large purchase)
    zahllast: -310, // Refund expected
    ...overrides,
  })
}

/**
 * Create a mock EÜR Report (Annual Profit Calculation)
 * @example
 * const euer = createMockEuerReport({ year: 2024 })
 * const profitableYear = createMockEuerReport({ gewinn: 50000 })
 */
export function createMockEuerReport(overrides: Partial<EuerReport> = {}): EuerReport {
  const year = overrides.year ?? 2024

  // Default income by line
  const defaultIncome: Record<number, number> = {
    [EUER_LINES.BETRIEBSEINNAHMEN]: 60000, // Line 14: Business income
    [EUER_LINES.UST_ERSTATTUNG]: 500, // Line 18: VAT refunds
  }

  // Default expenses by line
  const defaultExpenses: Record<number, number> = {
    [EUER_LINES.FREMDLEISTUNGEN]: 5000, // Line 25: Subcontractors
    [EUER_LINES.VORSTEUER]: 3000, // Line 27: Input VAT
    [EUER_LINES.GEZAHLTE_UST]: 8000, // Line 28: Output VAT paid
    [EUER_LINES.AFA]: 1500, // Line 30: Depreciation
    [EUER_LINES.ARBEITSZIMMER]: 1260, // Line 33: Home office (Pauschale)
    [EUER_LINES.SONSTIGE]: 4000, // Line 34: Other expenses
  }

  const income = overrides.income ?? defaultIncome
  const expenses = overrides.expenses ?? defaultExpenses

  const totalIncome =
    overrides.totalIncome ?? Object.values(income).reduce((a, b) => a + b, 0)
  const totalExpenses =
    overrides.totalExpenses ?? Object.values(expenses).reduce((a, b) => a + b, 0)
  const gewinn = overrides.gewinn ?? totalIncome - totalExpenses

  return {
    year,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    gewinn,
    ...overrides,
  }
}

/**
 * Create EÜR report with loss (negative Gewinn)
 */
export function createMockEuerReportWithLoss(
  overrides: Partial<EuerReport> = {}
): EuerReport {
  return createMockEuerReport({
    income: {
      [EUER_LINES.BETRIEBSEINNAHMEN]: 20000,
      [EUER_LINES.UST_ERSTATTUNG]: 0,
    },
    expenses: {
      [EUER_LINES.FREMDLEISTUNGEN]: 15000,
      [EUER_LINES.VORSTEUER]: 2000,
      [EUER_LINES.GEZAHLTE_UST]: 3800,
      [EUER_LINES.AFA]: 3000,
      [EUER_LINES.ARBEITSZIMMER]: 1260,
      [EUER_LINES.SONSTIGE]: 5000,
    },
    totalIncome: 20000,
    totalExpenses: 30060,
    gewinn: -10060,
    ...overrides,
  })
}

/**
 * Create mock quarterly data for testing
 * Returns income and expense records for a specific quarter
 */
export interface MockQuarterlyData {
  year: number
  quarter: 1 | 2 | 3 | 4
  income: {
    netAmount: number
    vatRate: 0 | 7 | 19
    vatAmount: number
  }[]
  expenses: {
    netAmount: number
    vatRate: 0 | 7 | 19
    vatAmount: number
    vorsteuerClaimed: boolean
  }[]
}

export function createMockQuarterlyData(
  year: number = 2024,
  quarter: 1 | 2 | 3 | 4 = 1
): MockQuarterlyData {
  return {
    year,
    quarter,
    income: [
      { netAmount: 5000, vatRate: 19, vatAmount: 950 },
      { netAmount: 3000, vatRate: 19, vatAmount: 570 },
      { netAmount: 1000, vatRate: 7, vatAmount: 70 },
    ],
    expenses: [
      { netAmount: 500, vatRate: 19, vatAmount: 95, vorsteuerClaimed: true },
      { netAmount: 200, vatRate: 19, vatAmount: 38, vorsteuerClaimed: true },
      { netAmount: 100, vatRate: 7, vatAmount: 7, vorsteuerClaimed: true },
      { netAmount: 50, vatRate: 0, vatAmount: 0, vorsteuerClaimed: false }, // Insurance
    ],
  }
}

/**
 * Calculate expected USt values from quarterly data
 */
export function calculateExpectedUstFromQuarterlyData(data: MockQuarterlyData): {
  umsatzsteuer19: number
  umsatzsteuer7: number
  totalUmsatzsteuer: number
  vorsteuer: number
  zahllast: number
} {
  const umsatzsteuer19 = data.income
    .filter((i) => i.vatRate === 19)
    .reduce((sum, i) => sum + i.vatAmount, 0)

  const umsatzsteuer7 = data.income
    .filter((i) => i.vatRate === 7)
    .reduce((sum, i) => sum + i.vatAmount, 0)

  const totalUmsatzsteuer = umsatzsteuer19 + umsatzsteuer7

  const vorsteuer = data.expenses
    .filter((e) => e.vorsteuerClaimed)
    .reduce((sum, e) => sum + e.vatAmount, 0)

  const zahllast = totalUmsatzsteuer - vorsteuer

  return {
    umsatzsteuer19,
    umsatzsteuer7,
    totalUmsatzsteuer,
    vorsteuer,
    zahllast,
  }
}
