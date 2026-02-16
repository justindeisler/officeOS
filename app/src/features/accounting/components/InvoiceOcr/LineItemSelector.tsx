/**
 * LineItemSelector Component
 *
 * Displays extracted invoice line items with checkboxes so the user
 * can select which items are business expenses (and exclude personal ones).
 *
 * Shows a running total of selected items with VAT breakdown.
 * Mobile-friendly: full-width tap targets, sticky footer.
 */

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Package,
  ShoppingCart,
} from 'lucide-react'
import {
  calculateSelectedTotals,
  formatEur,
  type LineItem,
} from '../../utils/invoiceCalculations'

// ============================================================================
// Types
// ============================================================================

export interface LineItemSelectorProps {
  lineItems: LineItem[]
  vatRate: number
  vendor?: string
  onContinue: (selectedIndices: number[]) => void
  onBack: () => void
  className?: string
}

// ============================================================================
// Component
// ============================================================================

export function LineItemSelector({
  lineItems,
  vatRate,
  vendor,
  onContinue,
  onBack,
  className,
}: LineItemSelectorProps) {
  // All items selected by default
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    () => lineItems.map((_, i) => i),
  )

  const toggleItem = useCallback((index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b),
    )
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIndices(lineItems.map((_, i) => i))
  }, [lineItems])

  const deselectAll = useCallback(() => {
    setSelectedIndices([])
  }, [])

  const totals = useMemo(
    () => calculateSelectedTotals(lineItems, selectedIndices, vatRate),
    [lineItems, selectedIndices, vatRate],
  )

  const allSelected = selectedIndices.length === lineItems.length
  const noneSelected = selectedIndices.length === 0

  const handleContinue = useCallback(() => {
    if (!noneSelected) {
      onContinue(selectedIndices)
    }
  }, [noneSelected, onContinue, selectedIndices])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Select Business Expenses</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Which items from {vendor ? <span className="font-medium">{vendor}</span> : 'this invoice'} are for business use?
          Deselect personal items.
        </p>
      </div>

      {/* Select/Deselect all */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          {selectedIndices.length} of {lineItems.length} items selected
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={selectAll}
            disabled={allSelected}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={deselectAll}
            disabled={noneSelected}
          >
            Deselect all
          </Button>
        </div>
      </div>

      {/* Line items list */}
      <div className="space-y-1 mb-4 max-h-[50vh] overflow-y-auto pr-1">
        {lineItems.map((item, index) => {
          const isSelected = selectedIndices.includes(index)
          const itemAmount = item.amount ?? ((item.quantity ?? 0) * (item.unitPrice ?? 0))

          return (
            <button
              key={index}
              type="button"
              onClick={() => toggleItem(index)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                'hover:bg-muted/50 active:bg-muted/70',
                isSelected
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-muted bg-muted/20 opacity-60',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleItem(index)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
                aria-label={`Select ${item.description}`}
              />

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium leading-tight',
                      !isSelected && 'line-through text-muted-foreground',
                    )}
                  >
                    {item.description || 'Unnamed item'}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      !isSelected && 'text-muted-foreground',
                    )}
                  >
                    {formatEur(itemAmount)}
                  </span>
                </div>

                {/* Quantity × Unit Price detail */}
                {item.quantity != null && item.unitPrice != null && (
                  <div className="text-xs text-muted-foreground">
                    {item.quantity} × {formatEur(item.unitPrice)}
                  </div>
                )}

                {/* Personal tag when deselected */}
                {!isSelected && (
                  <Badge variant="outline" className="text-[10px] mt-1 border-muted-foreground/30 text-muted-foreground">
                    personal
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Sticky totals footer */}
      <div className="border-t pt-3 mt-auto space-y-3">
        {/* Warning if none selected */}
        {noneSelected && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Select at least one item to continue
            </span>
          </div>
        )}

        {/* Totals summary */}
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Selected: {selectedIndices.length} item{selectedIndices.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Net</div>
              <div className="font-medium tabular-nums">{formatEur(totals.net_amount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">VAT ({vatRate}%)</div>
              <div className="font-medium tabular-nums">{formatEur(totals.vat_amount)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Total</div>
              <div className="font-semibold tabular-nums">{formatEur(totals.gross_amount)}</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={noneSelected}
          >
            Continue to Review
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LineItemSelector
