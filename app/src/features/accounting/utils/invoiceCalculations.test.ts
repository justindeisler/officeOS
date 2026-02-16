import { describe, it, expect } from 'vitest'
import {
  calculateSelectedTotals,
  formatEur,
  type LineItem,
} from './invoiceCalculations'

const sampleItems: LineItem[] = [
  { description: 'Wireless Mouse', quantity: 1, unitPrice: 24.99, amount: 24.99, confidence: 0.95 },
  { description: 'USB-C Cable 3m', quantity: 2, unitPrice: 12.99, amount: 25.98, confidence: 0.92 },
  { description: 'Coffee Beans 1kg', quantity: 1, unitPrice: 18.50, amount: 18.50, confidence: 0.88 },
  { description: 'Mechanical Keyboard', quantity: 1, unitPrice: 89.00, amount: 89.00, confidence: 0.97 },
]

describe('calculateSelectedTotals', () => {
  it('calculates totals for all items selected', () => {
    const result = calculateSelectedTotals(sampleItems, [0, 1, 2, 3], 19)
    expect(result.net_amount).toBe(158.47)
    expect(result.vat_rate).toBe(19)
    expect(result.vat_amount).toBe(30.11) // 158.47 * 0.19 = 30.1093 → 30.11
    expect(result.gross_amount).toBe(188.58)
  })

  it('calculates totals for a subset of items (business only)', () => {
    // Select items 0, 1, 3 (skip Coffee Beans)
    const result = calculateSelectedTotals(sampleItems, [0, 1, 3], 19)
    expect(result.net_amount).toBe(139.97)
    expect(result.vat_amount).toBe(26.59) // 139.97 * 0.19 = 26.5943 → 26.59
    expect(result.gross_amount).toBe(166.56)
  })

  it('returns zero totals when no items selected', () => {
    const result = calculateSelectedTotals(sampleItems, [], 19)
    expect(result.net_amount).toBe(0)
    expect(result.vat_amount).toBe(0)
    expect(result.gross_amount).toBe(0)
    expect(result.vat_rate).toBe(19)
  })

  it('handles single item selection', () => {
    const result = calculateSelectedTotals(sampleItems, [2], 19)
    expect(result.net_amount).toBe(18.50)
    expect(result.vat_amount).toBe(3.52) // 18.50 * 0.19 = 3.515 → 3.52
    expect(result.gross_amount).toBe(22.02)
  })

  it('works with 7% VAT rate', () => {
    const result = calculateSelectedTotals(sampleItems, [0], 7)
    expect(result.net_amount).toBe(24.99)
    expect(result.vat_rate).toBe(7)
    expect(result.vat_amount).toBe(1.75) // 24.99 * 0.07 = 1.7493 → 1.75
    expect(result.gross_amount).toBe(26.74)
  })

  it('works with 0% VAT rate', () => {
    const result = calculateSelectedTotals(sampleItems, [0, 1], 0)
    expect(result.net_amount).toBe(50.97) // 24.99 + 25.98
    expect(result.vat_amount).toBe(0)
    expect(result.gross_amount).toBe(50.97)
  })

  it('falls back to quantity × unitPrice when amount is null', () => {
    const items: LineItem[] = [
      { description: 'Item A', quantity: 3, unitPrice: 10.00, amount: null, confidence: 0.8 },
      { description: 'Item B', quantity: 2, unitPrice: 5.50, amount: null, confidence: 0.8 },
    ]
    const result = calculateSelectedTotals(items, [0, 1], 19)
    expect(result.net_amount).toBe(41.00) // 30 + 11
    expect(result.vat_amount).toBe(7.79) // 41 * 0.19 = 7.79
    expect(result.gross_amount).toBe(48.79)
  })

  it('handles items with all null numeric fields gracefully', () => {
    const items: LineItem[] = [
      { description: 'Mystery Item', quantity: null, unitPrice: null, amount: null, confidence: 0.5 },
    ]
    const result = calculateSelectedTotals(items, [0], 19)
    expect(result.net_amount).toBe(0)
    expect(result.vat_amount).toBe(0)
    expect(result.gross_amount).toBe(0)
  })

  it('handles out-of-range indices gracefully', () => {
    const result = calculateSelectedTotals(sampleItems, [0, 99], 19)
    // Only index 0 exists
    expect(result.net_amount).toBe(24.99)
  })
})

describe('formatEur', () => {
  it('formats a positive amount', () => {
    const formatted = formatEur(139.97)
    // German locale uses comma for decimals and period for thousands
    expect(formatted).toContain('139,97')
    expect(formatted).toContain('€')
  })

  it('formats zero', () => {
    const formatted = formatEur(0)
    expect(formatted).toContain('0,00')
  })

  it('formats negative amounts', () => {
    const formatted = formatEur(-24.99)
    expect(formatted).toContain('24,99')
  })
})
