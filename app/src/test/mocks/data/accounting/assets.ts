import type { Asset, DepreciationEntry, AssetCategory, NewAsset, VatRate } from '@/features/accounting/types'
import { AFA_YEARS } from '@/features/accounting/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Calculate depreciation schedule for an asset
 */
function calculateDepreciationSchedule(
  assetId: string,
  purchasePrice: number,
  purchaseDate: Date,
  afaYears: number
): DepreciationEntry[] {
  const schedule: DepreciationEntry[] = []
  const annualAmount = purchasePrice / afaYears

  // Calculate months in first year
  const firstYearMonths = 12 - purchaseDate.getMonth()
  const firstYearAmount = (annualAmount * firstYearMonths) / 12

  let cumulative = 0
  let bookValue = purchasePrice
  const startYear = purchaseDate.getFullYear()

  // First year (pro-rata)
  cumulative += firstYearAmount
  bookValue -= firstYearAmount
  schedule.push({
    id: generateTestId('dep'),
    assetId,
    year: startYear,
    months: firstYearMonths,
    amount: Math.round(firstYearAmount * 100) / 100,
    cumulative: Math.round(cumulative * 100) / 100,
    bookValue: Math.round(bookValue * 100) / 100,
  })

  // Full years
  for (let i = 1; i < afaYears; i++) {
    cumulative += annualAmount
    bookValue -= annualAmount
    if (bookValue < 0) bookValue = 0

    schedule.push({
      id: generateTestId('dep'),
      assetId,
      year: startYear + i,
      months: 12,
      amount: Math.round(annualAmount * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
      bookValue: Math.round(bookValue * 100) / 100,
    })
  }

  // Last year (remaining months if pro-rata)
  if (firstYearMonths < 12) {
    const lastYearMonths = 12 - firstYearMonths
    const lastYearAmount = (annualAmount * lastYearMonths) / 12
    cumulative += lastYearAmount
    bookValue = 0

    schedule.push({
      id: generateTestId('dep'),
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
 * Create a mock asset with sensible defaults
 * @example
 * const laptop = createMockAsset({ name: 'MacBook Pro', category: 'computer' })
 * const desk = createMockAsset({ name: 'Standing Desk', category: 'furniture' })
 */
export function createMockAsset(overrides: Partial<Asset> = {}): Asset {
  const id = overrides.id ?? generateTestId('asset')
  const now = new Date()
  const purchaseDate = overrides.purchaseDate ?? now
  const category: AssetCategory = overrides.category ?? 'computer'
  const afaYears = overrides.afaYears ?? AFA_YEARS[category]
  const purchasePrice = overrides.purchasePrice ?? 1500
  const vatRate: VatRate = 19
  const vatPaid = overrides.vatPaid ?? purchasePrice * (vatRate / 100)
  const grossPrice = overrides.grossPrice ?? purchasePrice + vatPaid
  const afaAnnualAmount = overrides.afaAnnualAmount ?? purchasePrice / afaYears

  const depreciationSchedule =
    overrides.depreciationSchedule ??
    calculateDepreciationSchedule(id, purchasePrice, purchaseDate, afaYears)

  return {
    id,
    name: 'Test Asset',
    description: 'A test asset for development',
    purchaseDate,
    vendor: 'Test Vendor',
    purchasePrice,
    vatPaid,
    grossPrice,
    afaMethod: 'linear',
    afaYears,
    afaStartDate: purchaseDate,
    afaAnnualAmount,
    status: 'active',
    euerLine: 30,
    euerCategory: 'afa_beweglich',
    category,
    location: 'Home Office',
    depreciationSchedule,
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock assets
 */
export function createMockAssets(count: number, overrides: Partial<Asset> = {}): Asset[] {
  const assetNames = [
    'MacBook Pro 16"',
    'Dell Monitor 27"',
    'Standing Desk',
    'Ergonomic Chair',
    'iPhone 15 Pro',
    'External SSD 2TB',
    'Mechanical Keyboard',
    'Webcam HD',
  ]

  const categories: AssetCategory[] = [
    'computer',
    'computer',
    'furniture',
    'furniture',
    'phone',
    'computer',
    'equipment',
    'equipment',
  ]

  return Array.from({ length: count }, (_, index) =>
    createMockAsset({
      name: assetNames[index % assetNames.length],
      category: categories[index % categories.length],
      inventoryNumber: `INV-${String(index + 1).padStart(4, '0')}`,
      ...overrides,
    })
  )
}

/**
 * Create mock asset by category with correct AfA years
 */
export function createMockAssetByCategory(category: AssetCategory, overrides: Partial<Asset> = {}): Asset {
  const categoryDefaults: Record<AssetCategory, { name: string; price: number }> = {
    computer: { name: 'MacBook Pro', price: 2500 },
    phone: { name: 'iPhone 15 Pro', price: 1199 },
    furniture: { name: 'Standing Desk', price: 800 },
    equipment: { name: 'Professional Camera', price: 1500 },
    software: { name: 'Adobe Creative Suite', price: 1200 },
  }

  const defaults = categoryDefaults[category]

  return createMockAsset({
    name: defaults.name,
    purchasePrice: defaults.price,
    category,
    afaYears: AFA_YEARS[category],
    ...overrides,
  })
}

/**
 * Create mock assets for all categories
 */
export function createMockAssetsByCategory(): Record<AssetCategory, Asset> {
  const categories: AssetCategory[] = ['computer', 'phone', 'furniture', 'equipment', 'software']

  return categories.reduce(
    (acc, category) => ({
      ...acc,
      [category]: createMockAssetByCategory(category),
    }),
    {} as Record<AssetCategory, Asset>
  )
}

/**
 * Create a disposed/sold asset
 */
export function createMockDisposedAsset(
  status: 'disposed' | 'sold' = 'disposed',
  overrides: Partial<Asset> = {}
): Asset {
  const now = new Date()
  const disposalDate = new Date(now)
  disposalDate.setMonth(disposalDate.getMonth() - 1)

  const purchaseDate = new Date(now)
  purchaseDate.setFullYear(purchaseDate.getFullYear() - 2)

  return createMockAsset({
    status,
    purchaseDate,
    disposalDate,
    disposalPrice: status === 'sold' ? 500 : undefined,
    ...overrides,
  })
}

/**
 * Create new asset data (for form submission)
 */
export function createNewMockAsset(overrides: Partial<NewAsset> = {}): NewAsset {
  return {
    name: 'New Asset',
    description: 'A new asset',
    purchaseDate: new Date(),
    vendor: 'Amazon',
    purchasePrice: 1000,
    vatRate: 19,
    afaYears: 3,
    category: 'computer',
    location: 'Home Office',
    ...overrides,
  }
}

/**
 * Create a depreciation entry
 */
export function createMockDepreciationEntry(
  assetId: string,
  overrides: Partial<DepreciationEntry> = {}
): DepreciationEntry {
  return {
    id: generateTestId('dep'),
    assetId,
    year: new Date().getFullYear(),
    months: 12,
    amount: 500,
    cumulative: 500,
    bookValue: 1000,
    ...overrides,
  }
}
