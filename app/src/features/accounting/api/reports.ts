/**
 * Reports API - Tax Report Generation
 *
 * Provides functions to generate USt-Voranmeldung (quarterly VAT)
 * and EÜR (annual profit) reports from income and expense data.
 * Uses @tauri-apps/plugin-sql for Tauri-compatible database operations.
 */

import { getDb } from './db'
import { getYearlyDepreciation, getDisposalGains, getDisposalLosses } from './assets'
import type {
  UstVoranmeldung,
  EuerReport,
  Income,
  Expense,
  VatRate,
} from '../types'
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../types'

/**
 * Database row type for income
 */
interface IncomeRow {
  id: string
  date: string
  client_id: string | null
  invoice_id: string | null
  description: string
  net_amount: number
  vat_rate: number
  vat_amount: number
  gross_amount: number
  euer_line: number | null
  euer_category: string | null
  payment_method: string | null
  bank_reference: string | null
  ust_period: string | null
  ust_reported: number // SQLite boolean as 0/1
  created_at: string
}

/**
 * Database row type for expenses
 */
interface ExpenseRow {
  id: string
  date: string
  vendor: string
  description: string
  net_amount: number
  vat_rate: number
  vat_amount: number
  gross_amount: number
  euer_line: number
  euer_category: string
  deductible_percent: number
  payment_method: string | null
  receipt_path: string | null
  is_recurring: number // SQLite boolean as 0/1
  recurring_frequency: string | null
  ust_period: string | null
  vorsteuer_claimed: number // SQLite boolean as 0/1
  is_gwg: number // SQLite boolean as 0/1
  asset_id: string | null
  created_at: string
}

/**
 * Get quarter date boundaries
 */
function getQuarterDates(
  year: number,
  quarter: 1 | 2 | 3 | 4
): { startDate: Date; endDate: Date } {
  const quarterStartMonth = (quarter - 1) * 3
  const startDate = new Date(year, quarterStartMonth, 1)
  const endDate = new Date(year, quarterStartMonth + 3, 0) // Last day of quarter
  return { startDate, endDate }
}

/**
 * Map database record to Income type
 */
function rowToIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    date: new Date(row.date),
    clientId: row.client_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    description: row.description,
    netAmount: row.net_amount,
    vatRate: row.vat_rate as VatRate,
    vatAmount: row.vat_amount,
    grossAmount: row.gross_amount,
    euerLine: row.euer_line ?? 14,
    euerCategory: row.euer_category ?? 'services',
    paymentMethod: row.payment_method as Income['paymentMethod'],
    bankReference: row.bank_reference ?? undefined,
    ustPeriod: row.ust_period ?? undefined,
    ustReported: row.ust_reported === 1,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Map database record to Expense type
 */
function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: new Date(row.date),
    vendor: row.vendor,
    description: row.description,
    netAmount: row.net_amount,
    vatRate: row.vat_rate as VatRate,
    vatAmount: row.vat_amount,
    grossAmount: row.gross_amount,
    euerLine: row.euer_line,
    euerCategory: row.euer_category,
    deductiblePercent: row.deductible_percent,
    paymentMethod: row.payment_method as Expense['paymentMethod'],
    receiptPath: row.receipt_path ?? undefined,
    isRecurring: row.is_recurring === 1,
    recurringFrequency: row.recurring_frequency as Expense['recurringFrequency'],
    ustPeriod: row.ust_period ?? undefined,
    vorsteuerClaimed: row.vorsteuer_claimed === 1,
    isGwg: row.is_gwg === 1,
    assetId: row.asset_id ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Get income records for a specific quarter
 */
async function getIncomeForQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<Income[]> {
  const { startDate, endDate } = getQuarterDates(year, quarter)
  const db = await getDb()

  const results = await db.select<IncomeRow[]>(
    `SELECT * FROM income
     WHERE date >= $1 AND date <= $2
     ORDER BY date DESC`,
    [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ]
  )

  return results.map(rowToIncome)
}

/**
 * Get expense records for a specific quarter
 */
async function getExpensesForQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<Expense[]> {
  const { startDate, endDate } = getQuarterDates(year, quarter)
  const db = await getDb()

  const results = await db.select<ExpenseRow[]>(
    `SELECT * FROM expenses
     WHERE date >= $1 AND date <= $2
     ORDER BY date DESC`,
    [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ]
  )

  return results.map(rowToExpense)
}

/**
 * Get income records for a specific year
 */
async function getIncomeForYear(year: number): Promise<Income[]> {
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)
  const db = await getDb()

  const results = await db.select<IncomeRow[]>(
    `SELECT * FROM income
     WHERE date >= $1 AND date <= $2
     ORDER BY date DESC`,
    [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ]
  )

  return results.map(rowToIncome)
}

/**
 * Get expense records for a specific year
 */
async function getExpensesForYear(year: number): Promise<Expense[]> {
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)
  const db = await getDb()

  const results = await db.select<ExpenseRow[]>(
    `SELECT * FROM expenses
     WHERE date >= $1 AND date <= $2
     ORDER BY date DESC`,
    [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ]
  )

  return results.map(rowToExpense)
}

/**
 * Calculate USt-Voranmeldung for a quarter
 */
export async function getUstVoranmeldung(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<UstVoranmeldung> {
  const { startDate, endDate } = getQuarterDates(year, quarter)

  const incomeRecords = await getIncomeForQuarter(year, quarter)
  const expenseRecords = await getExpensesForQuarter(year, quarter)

  // Calculate Umsatzsteuer (output VAT) by rate
  const umsatzsteuer19 = incomeRecords
    .filter((i) => i.vatRate === 19)
    .reduce((sum, i) => sum + i.vatAmount, 0)

  const umsatzsteuer7 = incomeRecords
    .filter((i) => i.vatRate === 7)
    .reduce((sum, i) => sum + i.vatAmount, 0)

  const totalUmsatzsteuer = umsatzsteuer19 + umsatzsteuer7

  // Calculate Vorsteuer (input VAT) from claimed expenses
  const vorsteuer = expenseRecords
    .filter((e) => e.vorsteuerClaimed)
    .reduce((sum, e) => sum + e.vatAmount, 0)

  // Zahllast = total output VAT - total input VAT
  // Positive = owe money, Negative = refund expected
  const zahllast = totalUmsatzsteuer - vorsteuer

  // Round all values to 2 decimal places
  const round = (n: number) => Math.round(n * 100) / 100

  return {
    period: `${year}-Q${quarter}`,
    year,
    quarter,
    startDate,
    endDate,
    umsatzsteuer19: round(umsatzsteuer19),
    umsatzsteuer7: round(umsatzsteuer7),
    totalUmsatzsteuer: round(totalUmsatzsteuer),
    vorsteuer: round(vorsteuer),
    zahllast: round(zahllast),
    status: 'draft',
  }
}

/**
 * Get all USt-Voranmeldungen for a year
 */
export async function getUstVoranmeldungenForYear(
  year: number
): Promise<UstVoranmeldung[]> {
  const quarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
  const results = await Promise.all(
    quarters.map((q) => getUstVoranmeldung(year, q))
  )
  return results
}

/**
 * Mark a USt-Voranmeldung as filed
 * This updates all income records in that period as reported
 */
export async function markUstAsFiled(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<UstVoranmeldung> {
  const { startDate, endDate } = getQuarterDates(year, quarter)
  const db = await getDb()

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  // Mark all income in this period as reported
  await db.execute(
    `UPDATE income SET ust_reported = 1 WHERE date >= $1 AND date <= $2`,
    [startDateStr, endDateStr]
  )

  // Mark all expenses in this period as Vorsteuer claimed
  await db.execute(
    `UPDATE expenses SET vorsteuer_claimed = 1 WHERE date >= $1 AND date <= $2`,
    [startDateStr, endDateStr]
  )

  // Get updated report
  const report = await getUstVoranmeldung(year, quarter)

  return {
    ...report,
    status: 'filed',
    filedDate: new Date(),
  }
}

/**
 * Calculate EÜR report for a year
 * Includes asset depreciation (AfA) from the assets module
 */
export async function getEuerReport(year: number): Promise<EuerReport> {
  const incomeRecords = await getIncomeForYear(year)
  const expenseRecords = await getExpensesForYear(year)

  // Get asset depreciation (AfA) for the year
  const assetAfA = await getYearlyDepreciation(year)

  // Group income by EÜR line number
  const incomeByLine: Record<number, number> = {}
  for (const record of incomeRecords) {
    const line = record.euerLine
    incomeByLine[line] = (incomeByLine[line] || 0) + record.netAmount
  }

  // Group expenses by EÜR line number
  const expensesByLine: Record<number, number> = {}
  for (const record of expenseRecords) {
    const line = record.euerLine
    // Apply deductible percentage
    const deductible = record.netAmount * (record.deductiblePercent / 100)
    expensesByLine[line] = (expensesByLine[line] || 0) + deductible
  }

  // Add asset depreciation (AfA) to line 30
  // This combines any expense-based AfA with asset-based AfA
  expensesByLine[EUER_LINES.AFA] = (expensesByLine[EUER_LINES.AFA] || 0) + assetAfA

  // Add asset disposal gains to line 16 (Veräußerungsgewinne)
  const disposalGains = await getDisposalGains(year)
  if (disposalGains > 0) {
    incomeByLine[EUER_LINES.ENTNAHME_VERKAUF] = (incomeByLine[EUER_LINES.ENTNAHME_VERKAUF] || 0) + disposalGains
  }

  // Add asset disposal losses to line 35 (Anlagenabgang - Restbuchwert)
  const disposalLosses = await getDisposalLosses(year)
  if (disposalLosses > 0) {
    expensesByLine[EUER_LINES.ANLAGENABGANG_VERLUST] = (expensesByLine[EUER_LINES.ANLAGENABGANG_VERLUST] || 0) + disposalLosses
  }

  // Check if Homeoffice-Pauschale should be included
  // Only include if there are no specific Arbeitszimmer expenses
  if (!expensesByLine[EUER_LINES.ARBEITSZIMMER]) {
    expensesByLine[EUER_LINES.ARBEITSZIMMER] = HOMEOFFICE_PAUSCHALE
  }

  // Calculate totals
  const totalIncome = Object.values(incomeByLine).reduce((a, b) => a + b, 0)
  const totalExpenses = Object.values(expensesByLine).reduce((a, b) => a + b, 0)
  const gewinn = totalIncome - totalExpenses

  // Round all values
  const round = (n: number) => Math.round(n * 100) / 100

  // Round values in records
  for (const key of Object.keys(incomeByLine)) {
    incomeByLine[Number(key)] = round(incomeByLine[Number(key)])
  }
  for (const key of Object.keys(expensesByLine)) {
    expensesByLine[Number(key)] = round(expensesByLine[Number(key)])
  }

  return {
    year,
    income: incomeByLine,
    expenses: expensesByLine,
    totalIncome: round(totalIncome),
    totalExpenses: round(totalExpenses),
    gewinn: round(gewinn),
  }
}

/**
 * Get EÜR line details for display
 */
export function getEuerLineDetails(): {
  income: { line: number; name: string; description: string }[]
  expenses: { line: number; name: string; description: string }[]
} {
  return {
    income: [
      {
        line: EUER_LINES.BETRIEBSEINNAHMEN,
        name: 'Betriebseinnahmen',
        description: 'Standard taxable business income (19% or 7%)',
      },
      {
        line: EUER_LINES.ENTNAHME_VERKAUF,
        name: 'Veräußerungsgewinne',
        description: 'Gains from asset sales (selling price - book value)',
      },
      {
        line: EUER_LINES.UST_ERSTATTUNG,
        name: 'USt-Erstattung',
        description: 'VAT refunds from tax office',
      },
    ],
    expenses: [
      {
        line: EUER_LINES.FREMDLEISTUNGEN,
        name: 'Fremdleistungen',
        description: 'Subcontractors, freelancers',
      },
      {
        line: EUER_LINES.VORSTEUER,
        name: 'Vorsteuer',
        description: 'Input VAT on purchases',
      },
      {
        line: EUER_LINES.GEZAHLTE_UST,
        name: 'Gezahlte USt',
        description: 'Output VAT paid to tax office',
      },
      {
        line: EUER_LINES.AFA,
        name: 'AfA',
        description: 'Depreciation of movable assets',
      },
      {
        line: EUER_LINES.ARBEITSZIMMER,
        name: 'Arbeitszimmer',
        description: 'Home office costs (Pauschale: €1,260/year)',
      },
      {
        line: EUER_LINES.SONSTIGE,
        name: 'Sonstige',
        description: 'Other fully deductible business expenses',
      },
      {
        line: EUER_LINES.ANLAGENABGANG_VERLUST,
        name: 'Anlagenabgang (Verlust)',
        description: 'Losses from asset disposals (remaining book value)',
      },
    ],
  }
}
