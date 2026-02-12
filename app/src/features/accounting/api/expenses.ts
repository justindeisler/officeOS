/**
 * Expenses API
 *
 * Database operations for expense management.
 * Uses @tauri-apps/plugin-sql for Tauri-compatible database operations.
 * Falls back to REST API in web mode.
 */

import { getDb } from './db'
import { isTauri, accountingClient } from '@/api'
import type { Expense, NewExpense, VatRate } from '../types'
import { GWG_THRESHOLDS } from '../types'

/** Make authenticated API request via centralized client */
const apiRequest = <T>(path: string, options?: RequestInit) =>
  accountingClient.request<T>(path, options);

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
 * Calculate VAT amount from net amount and rate
 */
function calculateVat(netAmount: number, vatRate: VatRate): number {
  return Math.round(netAmount * (vatRate / 100) * 100) / 100
}

/**
 * Detect GWG status based on net amount
 */
function isGwg(netAmount: number): boolean {
  return netAmount > GWG_THRESHOLDS.SOFORTABSCHREIBUNG && netAmount <= GWG_THRESHOLDS.GWG_MAX
}

/**
 * Calculate the USt period from a date
 */
function getUstPeriod(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3)
  return `${date.getFullYear()}-Q${quarter}`
}

/**
 * Convert database row to Expense type
 * Works for both Tauri DB rows and REST API responses (snake_case)
 */
function rowToExpense(row: ExpenseRow | Record<string, unknown>): Expense {
  return {
    id: (row.id as string),
    date: new Date((row.date as string)),
    vendor: (row.vendor as string),
    description: (row.description as string),
    netAmount: (row.net_amount as number),
    vatRate: (row.vat_rate as VatRate),
    vatAmount: (row.vat_amount as number),
    grossAmount: (row.gross_amount as number),
    euerLine: (row.euer_line as number),
    euerCategory: (row.euer_category as string),
    deductiblePercent: (row.deductible_percent as number) ?? 100,
    paymentMethod: (row.payment_method as Expense['paymentMethod']),
    receiptPath: (row.receipt_path as string) ?? undefined,
    isRecurring: row.is_recurring === 1,
    recurringFrequency: (row.recurring_frequency as Expense['recurringFrequency']),
    ustPeriod: (row.ust_period as string) ?? undefined,
    vorsteuerClaimed: row.vorsteuer_claimed === 1,
    isGwg: row.is_gwg === 1,
    assetId: (row.asset_id as string) ?? undefined,
    createdAt: new Date((row.created_at as string) ?? Date.now()),
  }
}

/**
 * Get all expenses ordered by date
 */
export async function getAllExpenses(): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/expenses');
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses ORDER BY date DESC'
  )
  return rows.map(rowToExpense)
}

/**
 * Get expense by ID
 */
export async function getExpenseById(id: string): Promise<Expense | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      const data = await apiRequest<Record<string, unknown>>(`/expenses/${id}`);
      return rowToExpense(data);
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE id = $1',
    [id]
  )
  return rows.length > 0 ? rowToExpense(rows[0]) : null
}

/**
 * Get expenses by date range
 */
export async function getExpensesByDateRange(start: Date, end: Date): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const data = await apiRequest<Record<string, unknown>[]>(`/expenses?startDate=${startStr}&endDate=${endStr}`);
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
    [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
  )
  return rows.map(rowToExpense)
}

/**
 * Get expenses by USt period
 */
export async function getExpensesByUstPeriod(period: string): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>(`/expenses?ustPeriod=${period}`);
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE ust_period = $1 ORDER BY date DESC',
    [period]
  )
  return rows.map(rowToExpense)
}

/**
 * Get expenses by category
 */
export async function getExpensesByCategory(category: string): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>(`/expenses?category=${category}`);
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE euer_category = $1 ORDER BY date DESC',
    [category]
  )
  return rows.map(rowToExpense)
}

/**
 * Get recurring expenses
 */
export async function getRecurringExpenses(): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/expenses?recurring=true');
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE is_recurring = 1 ORDER BY date DESC'
  )
  return rows.map(rowToExpense)
}

/**
 * Get GWG expenses
 */
export async function getGwgExpenses(): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/expenses?gwg=true');
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE is_gwg = 1 ORDER BY date DESC'
  )
  return rows.map(rowToExpense)
}

/**
 * Get unclaimed Vorsteuer expenses
 */
export async function getUnclaimedVorsteuer(): Promise<Expense[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/expenses?vorsteuerClaimed=false');
    return data.map(rowToExpense);
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<ExpenseRow[]>(
    'SELECT * FROM expenses WHERE vorsteuer_claimed = 0 ORDER BY date DESC'
  )
  return rows.map(rowToExpense)
}

/**
 * Create a new expense
 */
export async function createExpense(data: NewExpense): Promise<Expense> {
  // Use REST API in web mode
  if (!isTauri()) {
    const response = await apiRequest<Record<string, unknown>>('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        date: data.date.toISOString().split('T')[0],
        vendor: data.vendor,
        description: data.description,
        net_amount: data.netAmount,
        vat_rate: data.vatRate,
        euer_line: data.euerLine,
        euer_category: data.euerCategory,
        deductible_percent: data.deductiblePercent,
        payment_method: data.paymentMethod,
        receipt_path: data.receiptPath,
        is_recurring: data.isRecurring,
        recurring_frequency: data.recurringFrequency,
        ust_period: data.ustPeriod,
        asset_id: data.assetId,
      }),
    });
    return rowToExpense(response);
  }

  // Tauri mode - use database
  const db = await getDb()
  const vatAmount = calculateVat(data.netAmount, data.vatRate)
  const grossAmount = data.netAmount + vatAmount
  const ustPeriod = data.ustPeriod ?? getUstPeriod(data.date)
  const gwg = isGwg(data.netAmount)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO expenses (
      id, date, vendor, description, net_amount, vat_rate, vat_amount,
      gross_amount, euer_line, euer_category, deductible_percent,
      payment_method, receipt_path, is_recurring, recurring_frequency,
      ust_period, vorsteuer_claimed, is_gwg, asset_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      id,
      data.date.toISOString().split('T')[0],
      data.vendor,
      data.description,
      data.netAmount,
      data.vatRate,
      vatAmount,
      grossAmount,
      data.euerLine,
      data.euerCategory,
      data.deductiblePercent ?? 100,
      data.paymentMethod ?? null,
      data.receiptPath ?? null,
      data.isRecurring ? 1 : 0,
      data.recurringFrequency ?? null,
      ustPeriod,
      0, // vorsteuer_claimed = false
      gwg ? 1 : 0,
      data.assetId ?? null,
      now,
    ]
  )

  return {
    id,
    date: data.date,
    vendor: data.vendor,
    description: data.description,
    netAmount: data.netAmount,
    vatRate: data.vatRate,
    vatAmount,
    grossAmount,
    euerLine: data.euerLine,
    euerCategory: data.euerCategory,
    deductiblePercent: data.deductiblePercent ?? 100,
    paymentMethod: data.paymentMethod,
    receiptPath: data.receiptPath,
    isRecurring: data.isRecurring ?? false,
    recurringFrequency: data.recurringFrequency,
    ustPeriod,
    vorsteuerClaimed: false,
    isGwg: gwg,
    assetId: data.assetId,
    createdAt: new Date(now),
  }
}

/**
 * Update an expense
 */
export async function updateExpense(
  id: string,
  data: Partial<NewExpense>
): Promise<Expense | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      // Convert camelCase to snake_case for API
      const updateData: Record<string, unknown> = {};
      if (data.date) updateData.date = data.date.toISOString().split('T')[0];
      if (data.vendor !== undefined) updateData.vendor = data.vendor;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.netAmount !== undefined) updateData.net_amount = data.netAmount;
      if (data.vatRate !== undefined) updateData.vat_rate = data.vatRate;
      if (data.euerLine !== undefined) updateData.euer_line = data.euerLine;
      if (data.euerCategory !== undefined) updateData.euer_category = data.euerCategory;
      if (data.deductiblePercent !== undefined) updateData.deductible_percent = data.deductiblePercent;
      if (data.paymentMethod !== undefined) updateData.payment_method = data.paymentMethod;
      if (data.receiptPath !== undefined) updateData.receipt_path = data.receiptPath;
      if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;
      if (data.recurringFrequency !== undefined) updateData.recurring_frequency = data.recurringFrequency;
      if (data.ustPeriod !== undefined) updateData.ust_period = data.ustPeriod;
      if (data.assetId !== undefined) updateData.asset_id = data.assetId;
      
      const response = await apiRequest<Record<string, unknown>>(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      return rowToExpense(response);
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const existing = await getExpenseById(id)
  if (!existing) return null

  const db = await getDb()
  const netAmount = data.netAmount ?? existing.netAmount
  const vatRate = data.vatRate ?? existing.vatRate
  const vatAmount = calculateVat(netAmount, vatRate)
  const grossAmount = netAmount + vatAmount
  const gwg = isGwg(netAmount)

  // Build dynamic update
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.date !== undefined) {
    updates.push(`date = $${paramIndex++}`)
    values.push(data.date.toISOString().split('T')[0])
  }
  if (data.vendor !== undefined) {
    updates.push(`vendor = $${paramIndex++}`)
    values.push(data.vendor)
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(data.description)
  }
  if (data.netAmount !== undefined) {
    updates.push(`net_amount = $${paramIndex++}`)
    values.push(netAmount)
    updates.push(`vat_amount = $${paramIndex++}`)
    values.push(vatAmount)
    updates.push(`gross_amount = $${paramIndex++}`)
    values.push(grossAmount)
    updates.push(`is_gwg = $${paramIndex++}`)
    values.push(gwg ? 1 : 0)
  }
  if (data.vatRate !== undefined) {
    updates.push(`vat_rate = $${paramIndex++}`)
    values.push(vatRate)
    updates.push(`vat_amount = $${paramIndex++}`)
    values.push(vatAmount)
    updates.push(`gross_amount = $${paramIndex++}`)
    values.push(grossAmount)
  }
  if (data.euerLine !== undefined) {
    updates.push(`euer_line = $${paramIndex++}`)
    values.push(data.euerLine)
  }
  if (data.euerCategory !== undefined) {
    updates.push(`euer_category = $${paramIndex++}`)
    values.push(data.euerCategory)
  }
  if (data.deductiblePercent !== undefined) {
    updates.push(`deductible_percent = $${paramIndex++}`)
    values.push(data.deductiblePercent)
  }
  if (data.paymentMethod !== undefined) {
    updates.push(`payment_method = $${paramIndex++}`)
    values.push(data.paymentMethod)
  }
  if (data.receiptPath !== undefined) {
    updates.push(`receipt_path = $${paramIndex++}`)
    values.push(data.receiptPath)
  }
  if (data.isRecurring !== undefined) {
    updates.push(`is_recurring = $${paramIndex++}`)
    values.push(data.isRecurring ? 1 : 0)
  }
  if (data.recurringFrequency !== undefined) {
    updates.push(`recurring_frequency = $${paramIndex++}`)
    values.push(data.recurringFrequency)
  }
  if (data.ustPeriod !== undefined) {
    updates.push(`ust_period = $${paramIndex++}`)
    values.push(data.ustPeriod)
  }
  if (data.assetId !== undefined) {
    updates.push(`asset_id = $${paramIndex++}`)
    values.push(data.assetId)
  }

  if (updates.length > 0) {
    values.push(id)
    await db.execute(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  }

  return getExpenseById(id)
}

/**
 * Delete an expense
 */
export async function deleteExpense(id: string): Promise<boolean> {
  // Use REST API in web mode
  if (!isTauri()) {
    await apiRequest(`/expenses/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  // Tauri mode - use database
  const db = await getDb()
  await db.execute('DELETE FROM expenses WHERE id = $1', [id])
  return true
}

/**
 * Mark expenses as Vorsteuer claimed
 */
export async function markVorsteuerClaimed(ids: string[]): Promise<void> {
  // Use REST API in web mode
  if (!isTauri()) {
    await apiRequest('/expenses/mark-vorsteuer', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return;
  }

  // Tauri mode - use database
  const db = await getDb()
  for (const id of ids) {
    await db.execute('UPDATE expenses SET vorsteuer_claimed = 1 WHERE id = $1', [id])
  }
}

/**
 * Get Vorsteuer summary for a date range
 */
export async function getVorsteuerSummary(
  start: Date,
  end: Date
): Promise<{
  total: number
  byCategory: Record<string, number>
  byVatRate: Record<number, number>
}> {
  // Use REST API in web mode
  if (!isTauri()) {
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return await apiRequest(`/expenses/vorsteuer-summary?startDate=${startStr}&endDate=${endStr}`);
  }

  // Tauri mode - use database
  const rows = await getExpensesByDateRange(start, end)

  const summary = {
    total: 0,
    byCategory: {} as Record<string, number>,
    byVatRate: {} as Record<number, number>,
  }

  for (const expense of rows) {
    summary.total += expense.vatAmount

    if (!summary.byCategory[expense.euerCategory]) {
      summary.byCategory[expense.euerCategory] = 0
    }
    summary.byCategory[expense.euerCategory] += expense.vatAmount

    if (!summary.byVatRate[expense.vatRate]) {
      summary.byVatRate[expense.vatRate] = 0
    }
    summary.byVatRate[expense.vatRate] += expense.vatAmount
  }

  return summary
}
