/**
 * Invoice Calculation Utilities
 *
 * Recalculate totals when a subset of line items is selected
 * (e.g., filtering business vs personal items on the same invoice).
 */

export interface LineItem {
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  confidence: number
}

export interface SelectedTotals {
  net_amount: number
  vat_amount: number
  gross_amount: number
  vat_rate: number
}

/**
 * Calculate totals for a subset of line items.
 *
 * Uses each item's `amount` field (which is typically the line-level net amount).
 * If an item has no amount, falls back to quantity × unitPrice.
 * Applies the original invoice VAT rate to compute VAT and gross.
 */
export function calculateSelectedTotals(
  lineItems: LineItem[],
  selectedIndices: number[],
  originalVatRate: number,
): SelectedTotals {
  const selectedItems = lineItems.filter((_, i) => selectedIndices.includes(i))

  const net = selectedItems.reduce((sum, item) => {
    const itemAmount =
      item.amount ??
      ((item.quantity ?? 0) * (item.unitPrice ?? 0))
    return sum + itemAmount
  }, 0)

  // Round to cents
  const roundedNet = Math.round(net * 100) / 100
  const vat = Math.round(roundedNet * (originalVatRate / 100) * 100) / 100
  const gross = Math.round((roundedNet + vat) * 100) / 100

  return {
    net_amount: roundedNet,
    vat_amount: vat,
    gross_amount: gross,
    vat_rate: originalVatRate,
  }
}

/**
 * Format a number as EUR currency string (German locale).
 */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}
