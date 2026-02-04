/**
 * Assets API
 *
 * Database operations for asset management with depreciation (AfA).
 * Uses @tauri-apps/plugin-sql for Tauri-compatible database operations.
 * Falls back to REST API in web mode.
 */

import { getDb } from './db'
import type { Asset, NewAsset, AssetCategory, VatRate, DepreciationEntry, AssetStatus, AfaMethod } from '../types'
import { AFA_YEARS, GWG_THRESHOLDS } from '../types'
import { attachmentService } from '@/services/attachmentService'

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
 * Database row type for assets
 */
interface AssetRow {
  id: string
  name: string
  description: string | null
  purchase_date: string
  vendor: string | null
  purchase_price: number
  vat_paid: number
  gross_price: number
  afa_method: string
  afa_years: number
  afa_start_date: string
  afa_annual_amount: number
  status: string
  disposal_date: string | null
  disposal_price: number | null
  euer_line: number
  euer_category: string
  category: string | null
  inventory_number: string | null
  location: string | null
  bill_path: string | null
  created_at: string
}

/**
 * Database row type for depreciation entries
 */
interface DepreciationRow {
  id: string
  asset_id: string
  year: number
  months: number
  amount: number
  cumulative: number
  book_value: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate VAT amount from net amount and rate
 */
function calculateVat(netAmount: number, vatRate: VatRate): number {
  return Math.round(netAmount * (vatRate / 100) * 100) / 100
}

/**
 * Calculate depreciation schedule for an asset using linear method
 * with monthly pro-rata for first and last years
 */
function calculateDepreciationSchedule(
  assetId: string,
  purchasePrice: number,
  purchaseDate: Date,
  afaYears: number
): DepreciationEntry[] {
  const schedule: DepreciationEntry[] = []
  const annualAmount = purchasePrice / afaYears

  // Calculate months in first year (month is 0-indexed, so +1)
  // If purchased in January (month 0), we get 12 months
  const purchaseMonth = purchaseDate.getMonth()
  const firstYearMonths = 12 - purchaseMonth
  const firstYearAmount = (annualAmount * firstYearMonths) / 12

  let cumulative = 0
  let bookValue = purchasePrice
  const startYear = purchaseDate.getFullYear()

  // First year (pro-rata)
  cumulative += firstYearAmount
  bookValue -= firstYearAmount
  schedule.push({
    id: crypto.randomUUID(),
    assetId,
    year: startYear,
    months: firstYearMonths,
    amount: Math.round(firstYearAmount * 100) / 100,
    cumulative: Math.round(cumulative * 100) / 100,
    bookValue: Math.round(bookValue * 100) / 100,
  })

  // Full years (years 2 through afaYears-1 or all remaining if first year was full)
  const fullYearsCount = firstYearMonths === 12 ? afaYears - 1 : afaYears - 1
  for (let i = 1; i <= fullYearsCount; i++) {
    cumulative += annualAmount
    bookValue -= annualAmount
    if (bookValue < 0) bookValue = 0

    schedule.push({
      id: crypto.randomUUID(),
      assetId,
      year: startYear + i,
      months: 12,
      amount: Math.round(annualAmount * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
      bookValue: Math.round(bookValue * 100) / 100,
    })
  }

  // Last year (remaining months if first year was pro-rata)
  if (firstYearMonths < 12) {
    const lastYearMonths = 12 - firstYearMonths
    const lastYearAmount = (annualAmount * lastYearMonths) / 12
    cumulative += lastYearAmount
    bookValue = 0

    schedule.push({
      id: crypto.randomUUID(),
      assetId,
      year: startYear + afaYears,
      months: lastYearMonths,
      amount: Math.round(lastYearAmount * 100) / 100,
      cumulative: Math.round(purchasePrice * 100) / 100,
      bookValue: 0,
    })
  }

  return schedule
}

/**
 * Calculate immediate write-off (GWG) - full depreciation in year of purchase
 * Used for assets ≤€800 net (Geringwertige Wirtschaftsgüter)
 */
function calculateImmediateWriteoff(
  assetId: string,
  purchasePrice: number,
  purchaseDate: Date
): DepreciationEntry[] {
  const year = purchaseDate.getFullYear()

  return [{
    id: crypto.randomUUID(),
    assetId,
    year,
    months: 12,
    amount: Math.round(purchasePrice * 100) / 100,
    cumulative: Math.round(purchasePrice * 100) / 100,
    bookValue: 0,
  }]
}

/**
 * Map database row to DepreciationEntry type
 */
function rowToDepreciationEntry(row: DepreciationRow): DepreciationEntry {
  return {
    id: row.id,
    assetId: row.asset_id,
    year: row.year,
    months: row.months,
    amount: row.amount,
    cumulative: row.cumulative,
    bookValue: row.book_value,
  }
}

/**
 * Map database row to Asset type
 * Works for both Tauri DB rows and REST API responses (snake_case)
 */
function rowToAsset(row: AssetRow | Record<string, unknown>, schedule: DepreciationEntry[] = []): Asset {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? undefined,
    purchaseDate: new Date(row.purchase_date as string),
    vendor: (row.vendor as string) ?? undefined,
    purchasePrice: row.purchase_price as number,
    vatPaid: (row.vat_paid as number) ?? 0,
    grossPrice: (row.gross_price as number) ?? (row.purchase_price as number),
    afaMethod: (row.afa_method ?? row.depreciation_method ?? 'linear') as Asset['afaMethod'],
    afaYears: (row.afa_years ?? row.useful_life_years ?? 3) as number,
    afaStartDate: new Date((row.afa_start_date ?? row.purchase_date) as string),
    afaAnnualAmount: (row.afa_annual_amount ?? 0) as number,
    status: (row.status ?? 'active') as AssetStatus,
    disposalDate: row.disposal_date ? new Date(row.disposal_date as string) : undefined,
    disposalPrice: (row.disposal_price as number) ?? undefined,
    euerLine: (row.euer_line ?? 30) as number,
    euerCategory: (row.euer_category ?? 'afa_beweglich') as string,
    category: (row.category as AssetCategory),
    inventoryNumber: (row.inventory_number as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    billPath: (row.bill_path as string) ?? undefined,
    depreciationSchedule: schedule,
    createdAt: new Date((row.created_at as string) ?? Date.now()),
  }
}

/**
 * Get depreciation schedule for an asset
 */
async function getDepreciationSchedule(assetId: string): Promise<DepreciationEntry[]> {
  const db = await getDb()
  const rows = await db.select<DepreciationRow[]>(
    'SELECT * FROM depreciation_schedule WHERE asset_id = $1 ORDER BY year ASC',
    [assetId]
  )
  return rows.map(rowToDepreciationEntry)
}

/**
 * Save depreciation schedule to database
 */
async function saveDepreciationSchedule(schedule: DepreciationEntry[]): Promise<void> {
  const db = await getDb()
  for (const entry of schedule) {
    await db.execute(
      `INSERT INTO depreciation_schedule (
        id, asset_id, year, months, amount, cumulative, book_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.id,
        entry.assetId,
        entry.year,
        entry.months,
        entry.amount,
        entry.cumulative,
        entry.bookValue,
      ]
    )
  }
}

// ============================================================================
// INVENTORY NUMBER GENERATION
// ============================================================================

/**
 * Generate the next inventory number in sequence (INV-001, INV-002, etc.)
 */
async function getNextInventoryNumber(): Promise<string> {
  const db = await getDb()
  const result = await db.select<{ max_num: string | null }[]>(
    `SELECT inventory_number as max_num FROM assets
     WHERE inventory_number IS NOT NULL
     ORDER BY inventory_number DESC LIMIT 1`
  )

  if (result.length === 0 || !result[0].max_num) {
    return 'INV-001'
  }

  // Parse "INV-XXX" format
  const match = result[0].max_num.match(/INV-(\d+)/)
  if (!match) {
    return 'INV-001'
  }

  const nextNum = parseInt(match[1], 10) + 1
  return `INV-${String(nextNum).padStart(3, '0')}`
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all assets ordered by purchase date
 */
export async function getAllAssets(): Promise<Asset[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/api/assets');
    return data.map(item => rowToAsset(item));
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<AssetRow[]>(
    'SELECT * FROM assets ORDER BY purchase_date DESC'
  )

  const result: Asset[] = []
  for (const row of rows) {
    const schedule = await getDepreciationSchedule(row.id)
    result.push(rowToAsset(row, schedule))
  }

  return result
}

/**
 * Get asset by ID
 */
export async function getAssetById(id: string): Promise<Asset | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      const data = await apiRequest<Record<string, unknown>>(`/api/assets/${id}`);
      return rowToAsset(data);
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<AssetRow[]>(
    'SELECT * FROM assets WHERE id = $1',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const schedule = await getDepreciationSchedule(id)
  return rowToAsset(rows[0], schedule)
}

/**
 * Get assets by category
 */
export async function getAssetsByCategory(category: AssetCategory): Promise<Asset[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>(`/api/assets?category=${category}`);
    return data.map(item => rowToAsset(item));
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<AssetRow[]>(
    'SELECT * FROM assets WHERE category = $1 ORDER BY purchase_date DESC',
    [category]
  )

  const result: Asset[] = []
  for (const row of rows) {
    const schedule = await getDepreciationSchedule(row.id)
    result.push(rowToAsset(row, schedule))
  }

  return result
}

/**
 * Get assets by status
 */
export async function getAssetsByStatus(status: AssetStatus): Promise<Asset[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>(`/api/assets?status=${status}`);
    return data.map(item => rowToAsset(item));
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<AssetRow[]>(
    'SELECT * FROM assets WHERE status = $1 ORDER BY purchase_date DESC',
    [status]
  )

  const result: Asset[] = []
  for (const row of rows) {
    const schedule = await getDepreciationSchedule(row.id)
    result.push(rowToAsset(row, schedule))
  }

  return result
}

/**
 * Get active assets only
 */
export async function getActiveAssets(): Promise<Asset[]> {
  return await getAssetsByStatus('active')
}

/**
 * Get disposed or sold assets
 */
export async function getDisposedAssets(): Promise<Asset[]> {
  // Use REST API in web mode
  if (!isTauri()) {
    const data = await apiRequest<Record<string, unknown>[]>('/api/assets?status=disposed,sold');
    return data.map(item => rowToAsset(item));
  }

  // Tauri mode - use database
  const db = await getDb()
  const rows = await db.select<AssetRow[]>(
    `SELECT * FROM assets WHERE status IN ('disposed', 'sold') ORDER BY purchase_date DESC`
  )

  const result: Asset[] = []
  for (const row of rows) {
    const schedule = await getDepreciationSchedule(row.id)
    result.push(rowToAsset(row, schedule))
  }

  return result
}

/**
 * Create a new asset with automatic depreciation schedule
 * Automatically applies immediate write-off for GWG assets (≤€800 net)
 * @param data Asset data
 * @param existingId Optional pre-generated ID (used when file attachments are saved before asset creation)
 */
export async function createAsset(data: NewAsset, existingId?: string): Promise<Asset> {
  // Use REST API in web mode
  if (!isTauri()) {
    const response = await apiRequest<Record<string, unknown>>('/api/assets', {
      method: 'POST',
      body: JSON.stringify({
        id: existingId,
        name: data.name,
        description: data.description,
        purchase_date: data.purchaseDate.toISOString().split('T')[0],
        vendor: data.vendor,
        purchase_price: data.purchasePrice,
        vat_rate: data.vatRate,
        afa_method: data.afaMethod,
        afa_years: data.afaYears,
        category: data.category,
        inventory_number: data.inventoryNumber,
        location: data.location,
        bill_path: data.billPath,
      }),
    });
    return rowToAsset(response);
  }

  // Tauri mode - use database
  const db = await getDb()
  const id = existingId ?? crypto.randomUUID()
  const now = new Date().toISOString()

  const vatAmount = calculateVat(data.purchasePrice, data.vatRate)
  const grossPrice = data.purchasePrice + vatAmount

  // Determine afaMethod based on GWG rules if not explicitly set
  let afaMethod: AfaMethod = data.afaMethod ?? 'linear'
  let afaYears = data.afaYears ?? AFA_YEARS[data.category]

  // Auto-apply immediate write-off for GWG assets (≤€800 net)
  if (!data.afaMethod && data.purchasePrice <= GWG_THRESHOLDS.GWG_MAX) {
    afaMethod = 'immediate'
    afaYears = 1
  }

  // Calculate depreciation schedule based on method
  const depreciationSchedule = afaMethod === 'immediate'
    ? calculateImmediateWriteoff(id, data.purchasePrice, data.purchaseDate)
    : calculateDepreciationSchedule(id, data.purchasePrice, data.purchaseDate, afaYears)

  // For immediate write-off, annual amount equals full purchase price
  const afaAnnualAmount = afaMethod === 'immediate'
    ? data.purchasePrice
    : data.purchasePrice / afaYears

  // Auto-generate inventory number if not provided
  const inventoryNumber = data.inventoryNumber || await getNextInventoryNumber()

  // Insert asset
  await db.execute(
    `INSERT INTO assets (
      id, name, description, purchase_date, vendor, purchase_price,
      vat_paid, gross_price, afa_method, afa_years, afa_start_date,
      afa_annual_amount, status, euer_line, euer_category, category,
      inventory_number, location, bill_path, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      id,
      data.name,
      data.description ?? null,
      data.purchaseDate.toISOString().split('T')[0],
      data.vendor ?? null,
      data.purchasePrice,
      vatAmount,
      grossPrice,
      afaMethod,
      afaYears,
      data.purchaseDate.toISOString().split('T')[0],
      afaAnnualAmount,
      'active',
      30, // AfA line in EÜR
      'afa_beweglich',
      data.category,
      inventoryNumber,
      data.location ?? 'Home Office',
      data.billPath ?? null,
      now,
    ]
  )

  // Insert depreciation schedule
  await saveDepreciationSchedule(depreciationSchedule)

  return {
    id,
    name: data.name,
    description: data.description,
    purchaseDate: data.purchaseDate,
    vendor: data.vendor,
    purchasePrice: data.purchasePrice,
    vatPaid: vatAmount,
    grossPrice,
    afaMethod,
    afaYears,
    afaStartDate: data.purchaseDate,
    afaAnnualAmount,
    status: 'active',
    euerLine: 30,
    euerCategory: 'afa_beweglich',
    category: data.category,
    inventoryNumber,
    location: data.location ?? 'Home Office',
    billPath: data.billPath,
    depreciationSchedule,
    createdAt: new Date(now),
  }
}

/**
 * Update an asset
 */
export async function updateAsset(
  id: string,
  data: Partial<NewAsset>
): Promise<Asset | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    try {
      // Convert camelCase to snake_case for API
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.purchaseDate) updateData.purchase_date = data.purchaseDate.toISOString().split('T')[0];
      if (data.vendor !== undefined) updateData.vendor = data.vendor;
      if (data.purchasePrice !== undefined) updateData.purchase_price = data.purchasePrice;
      if (data.vatRate !== undefined) updateData.vat_rate = data.vatRate;
      if (data.afaMethod !== undefined) updateData.afa_method = data.afaMethod;
      if (data.afaYears !== undefined) updateData.afa_years = data.afaYears;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.inventoryNumber !== undefined) updateData.inventory_number = data.inventoryNumber;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.billPath !== undefined) updateData.bill_path = data.billPath;
      
      const response = await apiRequest<Record<string, unknown>>(`/api/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
      return rowToAsset(response);
    } catch {
      return null;
    }
  }

  // Tauri mode - use database
  const existing = await getAssetById(id)
  if (!existing) return null

  const db = await getDb()

  // If purchase price or category changes, recalculate depreciation
  const purchasePrice = data.purchasePrice ?? existing.purchasePrice
  const category = data.category ?? existing.category
  const purchaseDate = data.purchaseDate ?? existing.purchaseDate
  let afaYears = data.afaYears ?? existing.afaYears

  // Determine afaMethod based on GWG rules
  let afaMethod: AfaMethod = data.afaMethod ?? existing.afaMethod

  // Auto-apply immediate write-off for GWG assets (≤€800 net) if afaMethod not explicitly set
  if (data.afaMethod === undefined && purchasePrice <= GWG_THRESHOLDS.GWG_MAX) {
    afaMethod = 'immediate'
    afaYears = 1
  }

  let depreciationSchedule = existing.depreciationSchedule
  let afaAnnualAmount = existing.afaAnnualAmount

  if (
    data.purchasePrice !== undefined ||
    data.category !== undefined ||
    data.purchaseDate !== undefined ||
    data.afaYears !== undefined ||
    data.afaMethod !== undefined
  ) {
    // Delete old depreciation schedule
    await db.execute('DELETE FROM depreciation_schedule WHERE asset_id = $1', [id])

    // Calculate new depreciation schedule based on method
    depreciationSchedule = afaMethod === 'immediate'
      ? calculateImmediateWriteoff(id, purchasePrice, purchaseDate)
      : calculateDepreciationSchedule(id, purchasePrice, purchaseDate, afaYears)

    // For immediate write-off, annual amount equals full purchase price
    afaAnnualAmount = afaMethod === 'immediate'
      ? purchasePrice
      : purchasePrice / afaYears

    // Insert new depreciation schedule
    await saveDepreciationSchedule(depreciationSchedule)
  }

  let vatPaid = existing.vatPaid
  let grossPrice = existing.grossPrice
  if (data.purchasePrice !== undefined || data.vatRate !== undefined) {
    const vatRate = data.vatRate ?? 19 // Default to 19% if not specified
    vatPaid = calculateVat(purchasePrice, vatRate)
    grossPrice = purchasePrice + vatPaid
  }

  // Build dynamic update
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(data.name)
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(data.description ?? null)
  }
  if (data.purchaseDate !== undefined) {
    updates.push(`purchase_date = $${paramIndex++}`)
    values.push(purchaseDate.toISOString().split('T')[0])
    updates.push(`afa_start_date = $${paramIndex++}`)
    values.push(purchaseDate.toISOString().split('T')[0])
  }
  if (data.vendor !== undefined) {
    updates.push(`vendor = $${paramIndex++}`)
    values.push(data.vendor ?? null)
  }
  if (data.purchasePrice !== undefined) {
    updates.push(`purchase_price = $${paramIndex++}`)
    values.push(purchasePrice)
  }
  if (data.purchasePrice !== undefined || data.vatRate !== undefined) {
    updates.push(`vat_paid = $${paramIndex++}`)
    values.push(vatPaid)
    updates.push(`gross_price = $${paramIndex++}`)
    values.push(grossPrice)
  }
  // Update afaYears and afaMethod if changed (including GWG auto-detection)
  if (data.afaYears !== undefined || data.purchasePrice !== undefined || data.afaMethod !== undefined) {
    updates.push(`afa_years = $${paramIndex++}`)
    values.push(afaYears)
    updates.push(`afa_method = $${paramIndex++}`)
    values.push(afaMethod)
    updates.push(`afa_annual_amount = $${paramIndex++}`)
    values.push(afaAnnualAmount)
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex++}`)
    values.push(category)
  }
  if (data.inventoryNumber !== undefined) {
    updates.push(`inventory_number = $${paramIndex++}`)
    values.push(data.inventoryNumber ?? null)
  }
  if (data.location !== undefined) {
    updates.push(`location = $${paramIndex++}`)
    values.push(data.location ?? null)
  }
  if (data.billPath !== undefined) {
    updates.push(`bill_path = $${paramIndex++}`)
    values.push(data.billPath ?? null)
  }

  if (updates.length > 0) {
    values.push(id)
    await db.execute(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  }

  return await getAssetById(id)
}

/**
 * Delete an asset
 */
export async function deleteAsset(id: string): Promise<boolean> {
  // Use REST API in web mode
  if (!isTauri()) {
    await apiRequest(`/api/assets/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  // Tauri mode - use database
  const existing = await getAssetById(id)
  if (!existing) return false

  const db = await getDb()

  // Clean up attachment files
  await attachmentService.cleanupAssetAttachments(id)

  // Delete depreciation schedule first
  await db.execute('DELETE FROM depreciation_schedule WHERE asset_id = $1', [id])
  await db.execute('DELETE FROM assets WHERE id = $1', [id])

  return true
}

/**
 * Dispose of an asset (mark as disposed or sold)
 */
export async function disposeAsset(
  id: string,
  disposalDate: Date,
  status: 'disposed' | 'sold',
  disposalPrice?: number
): Promise<Asset | null> {
  // Use REST API in web mode
  if (!isTauri()) {
    const response = await apiRequest<Record<string, unknown>>(`/api/assets/${id}/dispose`, {
      method: 'POST',
      body: JSON.stringify({
        disposal_date: disposalDate.toISOString().split('T')[0],
        status,
        disposal_price: disposalPrice,
      }),
    });
    return rowToAsset(response);
  }

  // Tauri mode - use database
  const existing = await getAssetById(id)
  if (!existing) return null

  const db = await getDb()
  await db.execute(
    `UPDATE assets SET status = $1, disposal_date = $2, disposal_price = $3 WHERE id = $4`,
    [
      status,
      disposalDate.toISOString().split('T')[0],
      status === 'sold' ? disposalPrice ?? null : null,
      id,
    ]
  )

  return await getAssetById(id)
}

// ============================================================================
// BOOK VALUE CALCULATIONS
// ============================================================================

/**
 * Get current book value of an asset
 */
export function getCurrentBookValue(asset: Asset): number {
  const currentYear = new Date().getFullYear()

  // Find the depreciation entry for current year or last available
  const entry = asset.depreciationSchedule
    .filter(e => e.year <= currentYear)
    .sort((a, b) => b.year - a.year)[0]

  return entry?.bookValue ?? asset.purchasePrice
}

/**
 * Get total depreciation for a year across all active assets
 */
export async function getYearlyDepreciation(year: number): Promise<number> {
  const assets = await getActiveAssets()

  return assets.reduce((total, asset) => {
    const entry = asset.depreciationSchedule.find(e => e.year === year)
    return total + (entry?.amount ?? 0)
  }, 0)
}

/**
 * Get depreciation summary by category for a year
 */
export async function getDepreciationByCategory(
  year: number
): Promise<Record<AssetCategory, number>> {
  const assets = await getActiveAssets()

  const summary: Record<AssetCategory, number> = {
    computer: 0,
    phone: 0,
    furniture: 0,
    equipment: 0,
    software: 0,
  }

  for (const asset of assets) {
    const entry = asset.depreciationSchedule.find(e => e.year === year)
    if (entry) {
      summary[asset.category] += entry.amount
    }
  }

  return summary
}

/**
 * Get total asset value (book value of all active assets)
 */
export async function getTotalAssetValue(): Promise<number> {
  const assets = await getActiveAssets()
  return assets.reduce((total, asset) => total + getCurrentBookValue(asset), 0)
}

// ============================================================================
// DISPOSAL CALCULATIONS
// ============================================================================

/**
 * Get assets disposed in a specific year
 */
export async function getDisposalsForYear(year: number): Promise<Asset[]> {
  const disposedAssets = await getDisposedAssets()
  return disposedAssets.filter(asset => {
    if (!asset.disposalDate) return false
    const disposalYear = new Date(asset.disposalDate).getFullYear()
    return disposalYear === year
  })
}

/**
 * Get book value at disposal date
 */
export function getBookValueAtDisposal(asset: Asset): number {
  if (!asset.disposalDate) return getCurrentBookValue(asset)

  const disposalYear = new Date(asset.disposalDate).getFullYear()

  // Find the depreciation entry for the disposal year
  const entry = asset.depreciationSchedule.find(e => e.year === disposalYear)
  if (entry) {
    return entry.bookValue
  }

  // Find the last entry before disposal year
  const lastEntry = asset.depreciationSchedule
    .filter(e => e.year < disposalYear)
    .sort((a, b) => b.year - a.year)[0]

  return lastEntry?.bookValue ?? asset.purchasePrice
}

/**
 * Calculate disposal gain/loss for an asset
 * Positive = gain (income), Negative = loss (expense)
 */
export function calculateDisposalGainLoss(asset: Asset): number {
  if (asset.status !== 'sold' || !asset.disposalPrice) {
    // If disposed (not sold), the entire remaining book value is a loss
    return -getBookValueAtDisposal(asset)
  }

  const bookValue = getBookValueAtDisposal(asset)
  return asset.disposalPrice - bookValue
}

/**
 * Get total disposal gains for a year
 */
export async function getDisposalGains(year: number): Promise<number> {
  const disposals = await getDisposalsForYear(year)
  return disposals.reduce((total, asset) => {
    const gainLoss = calculateDisposalGainLoss(asset)
    return total + (gainLoss > 0 ? gainLoss : 0)
  }, 0)
}

/**
 * Get total disposal losses for a year
 */
export async function getDisposalLosses(year: number): Promise<number> {
  const disposals = await getDisposalsForYear(year)
  return disposals.reduce((total, asset) => {
    const gainLoss = calculateDisposalGainLoss(asset)
    return total + (gainLoss < 0 ? Math.abs(gainLoss) : 0)
  }, 0)
}
