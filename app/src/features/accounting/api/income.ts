/**
 * Income API - CRUD Operations
 *
 * Provides database operations for income records.
 * Uses @tauri-apps/plugin-sql for type-safe queries.
 * Falls back to REST API in web mode.
 */

import { getDb } from './db'
import type { Income, NewIncome, VatRate } from '../types'

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' &&
         '__TAURI__' in window &&
         !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

/**
 * Get API base URL
 */
function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('pa-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.statusText}`);
  }

  return response.json();
}

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
  euer_line: number
  euer_category: string
  payment_method: string | null
  bank_reference: string | null
  ust_period: string | null
  ust_reported: number // SQLite boolean as 0/1
  created_at: string
}

/**
 * Generate a unique ID for new records
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Calculate VAT amount from net amount and rate
 */
function calculateVat(netAmount: number, vatRate: VatRate): number {
  return Math.round(netAmount * (vatRate / 100) * 100) / 100
}

/**
 * Get all income records, ordered by date descending
 */
export async function getAllIncome(): Promise<Income[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Income[]>('/api/income');
    return data.map(item => ({
      ...item,
      date: new Date(item.date),
      createdAt: new Date(item.createdAt),
    }));
  }

  // Tauri mode - use database
  const db = await getDb()
  const results = await db.select<IncomeRow[]>(
    'SELECT * FROM income ORDER BY date DESC'
  )
  return results.map(mapDbToIncome)
}

/**
 * Get income record by ID
 */
export async function getIncomeById(id: string): Promise<Income | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      const data = await apiRequest<Income>(`/api/income/${id}`);
      return {
        ...data,
        date: new Date(data.date),
        createdAt: new Date(data.createdAt),
      };
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const db = await getDb()
  const results = await db.select<IncomeRow[]>(
    'SELECT * FROM income WHERE id = $1',
    [id]
  )
  if (results.length === 0) return null
  return mapDbToIncome(results[0])
}

/**
 * Get income records for a specific date range
 */
export async function getIncomeByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Income[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const data = await apiRequest<Income[]>(`/api/income?startDate=${start}&endDate=${end}`);
    return data.map(item => ({
      ...item,
      date: new Date(item.date),
      createdAt: new Date(item.createdAt),
    }));
  }

  // Tauri mode - use database
  const db = await getDb()
  const results = await db.select<IncomeRow[]>(
    'SELECT * FROM income WHERE date >= $1 AND date <= $2 ORDER BY date DESC',
    [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  )
  return results.map(mapDbToIncome)
}

/**
 * Get income records for a specific USt period (e.g., "2024-Q1")
 */
export async function getIncomeByUstPeriod(period: string): Promise<Income[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Income[]>(`/api/income?ustPeriod=${period}`);
    return data.map(item => ({
      ...item,
      date: new Date(item.date),
      createdAt: new Date(item.createdAt),
    }));
  }

  // Tauri mode - use database
  const db = await getDb()
  const results = await db.select<IncomeRow[]>(
    'SELECT * FROM income WHERE ust_period = $1 ORDER BY date DESC',
    [period]
  )
  return results.map(mapDbToIncome)
}

/**
 * Get unreported income for USt-Voranmeldung
 */
export async function getUnreportedIncome(): Promise<Income[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Income[]>('/api/income?ustReported=false');
    return data.map(item => ({
      ...item,
      date: new Date(item.date),
      createdAt: new Date(item.createdAt),
    }));
  }

  // Tauri mode - use database
  const db = await getDb()
  const results = await db.select<IncomeRow[]>(
    'SELECT * FROM income WHERE ust_reported = 0 ORDER BY date ASC'
  )
  return results.map(mapDbToIncome)
}

/**
 * Create a new income record
 */
export async function createIncome(data: NewIncome): Promise<Income> {
  // Use REST API in web mode
  if (!isTauri()) {
    const response = await apiRequest<Income>('/api/income', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        date: data.date.toISOString().split('T')[0],
      }),
    });
    return {
      ...response,
      date: new Date(response.date),
      createdAt: new Date(response.createdAt),
    };
  }

  // Tauri mode - use database
  const db = await getDb()
  const id = generateId()
  const vatAmount = calculateVat(data.netAmount, data.vatRate)
  const grossAmount = data.netAmount + vatAmount
  const now = new Date()

  // Determine USt period from date
  const quarter = Math.ceil((data.date.getMonth() + 1) / 3)
  const ustPeriod = data.ustPeriod ?? `${data.date.getFullYear()}-Q${quarter}`

  await db.execute(
    `INSERT INTO income (
      id, date, client_id, invoice_id, description, net_amount, vat_rate,
      vat_amount, gross_amount, euer_line, euer_category, payment_method,
      bank_reference, ust_period, ust_reported, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      data.date.toISOString().split('T')[0],
      data.clientId ?? null,
      data.invoiceId ?? null,
      data.description,
      data.netAmount,
      data.vatRate,
      vatAmount,
      grossAmount,
      data.euerLine ?? 14,
      data.euerCategory ?? 'services',
      data.paymentMethod ?? null,
      data.bankReference ?? null,
      ustPeriod,
      0, // ust_reported = false
      now.toISOString(),
    ]
  )

  return {
    id,
    date: data.date,
    clientId: data.clientId,
    invoiceId: data.invoiceId,
    description: data.description,
    netAmount: data.netAmount,
    vatRate: data.vatRate,
    vatAmount,
    grossAmount,
    euerLine: data.euerLine ?? 14,
    euerCategory: data.euerCategory ?? 'services',
    paymentMethod: data.paymentMethod,
    bankReference: data.bankReference,
    ustPeriod,
    ustReported: false,
    createdAt: now,
  }
}

/**
 * Update an existing income record
 */
export async function updateIncome(
  id: string,
  data: Partial<NewIncome>
): Promise<Income | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      const updateData = { ...data };
      if (data.date) {
        updateData.date = data.date.toISOString().split('T')[0] as any;
      }
      const response = await apiRequest<Income>(`/api/income/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      return {
        ...response,
        date: new Date(response.date),
        createdAt: new Date(response.createdAt),
      };
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const existing = await getIncomeById(id)
  if (!existing) return null

  const db = await getDb()

  // Build dynamic update
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.date !== undefined) {
    updates.push(`date = $${paramIndex++}`)
    values.push(data.date.toISOString().split('T')[0])
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(data.description)
  }
  if (data.clientId !== undefined) {
    updates.push(`client_id = $${paramIndex++}`)
    values.push(data.clientId)
  }
  if (data.invoiceId !== undefined) {
    updates.push(`invoice_id = $${paramIndex++}`)
    values.push(data.invoiceId)
  }
  if (data.paymentMethod !== undefined) {
    updates.push(`payment_method = $${paramIndex++}`)
    values.push(data.paymentMethod)
  }
  if (data.bankReference !== undefined) {
    updates.push(`bank_reference = $${paramIndex++}`)
    values.push(data.bankReference)
  }
  if (data.euerLine !== undefined) {
    updates.push(`euer_line = $${paramIndex++}`)
    values.push(data.euerLine)
  }
  if (data.euerCategory !== undefined) {
    updates.push(`euer_category = $${paramIndex++}`)
    values.push(data.euerCategory)
  }
  if (data.ustPeriod !== undefined) {
    updates.push(`ust_period = $${paramIndex++}`)
    values.push(data.ustPeriod)
  }

  // Recalculate amounts if net amount or VAT rate changed
  if (data.netAmount !== undefined || data.vatRate !== undefined) {
    const netAmount = data.netAmount ?? existing.netAmount
    const vatRate = data.vatRate ?? existing.vatRate
    const vatAmount = calculateVat(netAmount, vatRate)

    updates.push(`net_amount = $${paramIndex++}`)
    values.push(netAmount)
    updates.push(`vat_rate = $${paramIndex++}`)
    values.push(vatRate)
    updates.push(`vat_amount = $${paramIndex++}`)
    values.push(vatAmount)
    updates.push(`gross_amount = $${paramIndex++}`)
    values.push(netAmount + vatAmount)
  }

  if (updates.length > 0) {
    values.push(id) // for WHERE clause
    await db.execute(
      `UPDATE income SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  }

  return getIncomeById(id)
}

/**
 * Delete an income record
 */
export async function deleteIncome(id: string): Promise<boolean> {
  // Use REST API in web mode
  if (!isTauri()) {
    await apiRequest(`/api/income/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  // Tauri mode - use database
  const db = await getDb()
  await db.execute('DELETE FROM income WHERE id = $1', [id])
  return true
}

/**
 * Mark income records as reported for USt-Voranmeldung
 */
export async function markIncomeAsReported(ids: string[]): Promise<void> {
  // Use REST API in web mode
  if (!isTauri()) {
    await apiRequest('/api/income/mark-reported', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return;
  }

  // Tauri mode - use database
  const db = await getDb()
  for (const id of ids) {
    await db.execute('UPDATE income SET ust_reported = 1 WHERE id = $1', [id])
  }
}

/**
 * Get income summary for a period
 */
export async function getIncomeSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  totalNet: number
  totalVat: number
  totalGross: number
  count: number
  byVatRate: Record<number, { net: number; vat: number }>
}> {
  // Use REST API in web mode
  if (!isTauri()) {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    return await apiRequest(`/api/income/summary?startDate=${start}&endDate=${end}`);
  }

  // Tauri mode - use database
  const records = await getIncomeByDateRange(startDate, endDate)

  const summary = {
    totalNet: 0,
    totalVat: 0,
    totalGross: 0,
    count: records.length,
    byVatRate: {} as Record<number, { net: number; vat: number }>,
  }

  for (const record of records) {
    summary.totalNet += record.netAmount
    summary.totalVat += record.vatAmount
    summary.totalGross += record.grossAmount

    if (!summary.byVatRate[record.vatRate]) {
      summary.byVatRate[record.vatRate] = { net: 0, vat: 0 }
    }
    summary.byVatRate[record.vatRate].net += record.netAmount
    summary.byVatRate[record.vatRate].vat += record.vatAmount
  }

  // Round totals
  summary.totalNet = Math.round(summary.totalNet * 100) / 100
  summary.totalVat = Math.round(summary.totalVat * 100) / 100
  summary.totalGross = Math.round(summary.totalGross * 100) / 100

  return summary
}

/**
 * Map database record to Income type
 */
function mapDbToIncome(record: IncomeRow): Income {
  return {
    id: record.id,
    date: new Date(record.date),
    clientId: record.client_id ?? undefined,
    invoiceId: record.invoice_id ?? undefined,
    description: record.description,
    netAmount: record.net_amount,
    vatRate: record.vat_rate as VatRate,
    vatAmount: record.vat_amount,
    grossAmount: record.gross_amount,
    euerLine: record.euer_line ?? 14,
    euerCategory: record.euer_category ?? 'services',
    paymentMethod: record.payment_method as Income['paymentMethod'],
    bankReference: record.bank_reference ?? undefined,
    ustPeriod: record.ust_period ?? undefined,
    ustReported: record.ust_reported === 1,
    createdAt: new Date(record.created_at ?? Date.now()),
  }
}
