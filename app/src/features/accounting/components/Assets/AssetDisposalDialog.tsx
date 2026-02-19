/**
 * AssetDisposalDialog Component
 *
 * Dialog for disposing/selling an asset.
 * Collects disposal date, price, and reason, shows gain/loss preview.
 */

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Asset } from '../../types'

export interface AssetDisposalDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Asset to dispose */
  asset: Asset | null
  /** Callback when disposal is confirmed */
  onConfirm: (data: {
    disposalDate: Date
    disposalPrice: number
    disposalReason: string
    status: 'disposed' | 'sold'
  }) => Promise<void>
  /** Loading state */
  isLoading?: boolean
}

/**
 * Format number as German currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Get current book value from depreciation schedule
 */
function getCurrentBookValue(asset: Asset): number {
  const currentYear = new Date().getFullYear()
  const entry = asset.depreciationSchedule
    .filter(e => e.year <= currentYear)
    .sort((a, b) => b.year - a.year)[0]
  return entry?.bookValue ?? asset.purchasePrice
}

/**
 * Get book value at a specific date from depreciation schedule
 */
function getBookValueAtDate(asset: Asset, date: Date): number {
  const year = date.getFullYear()
  const entry = asset.depreciationSchedule
    .filter(e => e.year <= year)
    .sort((a, b) => b.year - a.year)[0]
  return entry?.bookValue ?? asset.purchasePrice
}

const DISPOSAL_REASONS = [
  { value: 'sold', label: 'Sold' },
  { value: 'scrapped', label: 'Scrapped' },
  { value: 'donated', label: 'Donated' },
  { value: 'stolen', label: 'Stolen / Lost' },
  { value: 'other', label: 'Other' },
] as const

export function AssetDisposalDialog({
  open,
  onOpenChange,
  asset,
  onConfirm,
  isLoading = false,
}: AssetDisposalDialogProps) {
  const [disposalDate, setDisposalDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [disposalPrice, setDisposalPrice] = useState('0')
  const [disposalReason, setDisposalReason] = useState('sold')
  const [error, setError] = useState<string | null>(null)

  // Calculate gain/loss preview
  const preview = useMemo(() => {
    if (!asset) return null
    const date = new Date(disposalDate)
    const price = parseFloat(disposalPrice) || 0
    const bookValue = getBookValueAtDate(asset, date)
    const gainLoss = price - bookValue

    return {
      bookValue,
      gainLoss,
      isGain: gainLoss > 0,
      isLoss: gainLoss < 0,
      isBreakEven: gainLoss === 0,
    }
  }, [asset, disposalDate, disposalPrice])

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDisposalDate(new Date().toISOString().split('T')[0])
      setDisposalPrice('0')
      setDisposalReason('sold')
      setError(null)
    }
    onOpenChange(isOpen)
  }

  const handleConfirm = async () => {
    if (!asset) return

    const price = parseFloat(disposalPrice) || 0
    if (price < 0) {
      setError('Disposal price cannot be negative')
      return
    }

    if (!disposalDate) {
      setError('Disposal date is required')
      return
    }

    setError(null)

    const status: 'disposed' | 'sold' = price > 0 ? 'sold' : 'disposed'

    try {
      await onConfirm({
        disposalDate: new Date(disposalDate),
        disposalPrice: price,
        disposalReason,
        status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispose asset')
    }
  }

  if (!asset) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dispose Asset</DialogTitle>
          <DialogDescription>
            Mark "{asset.name}" as disposed or sold. This action records the disposal for EÜR reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Disposal Date */}
          <div className="space-y-2">
            <Label htmlFor="disposal-date">Disposal Date</Label>
            <Input
              id="disposal-date"
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
            />
          </div>

          {/* Disposal Price */}
          <div className="space-y-2">
            <Label htmlFor="disposal-price">
              Sale Price (€)
              <span className="text-muted-foreground font-normal ml-1">
                — enter 0 if scrapped or donated
              </span>
            </Label>
            <Input
              id="disposal-price"
              type="number"
              step="0.01"
              min="0"
              value={disposalPrice}
              onChange={(e) => setDisposalPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Disposal Reason */}
          <div className="space-y-2">
            <Label htmlFor="disposal-reason">Reason</Label>
            <Select value={disposalReason} onValueChange={setDisposalReason}>
              <SelectTrigger id="disposal-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {DISPOSAL_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gain/Loss Preview */}
          {preview && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Disposal Preview
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Original Price</div>
                  <div className="font-medium">{formatCurrency(asset.purchasePrice)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Book Value</div>
                  <div className="font-medium">{formatCurrency(preview.bookValue)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Sale Price</div>
                  <div className="font-medium">
                    {formatCurrency(parseFloat(disposalPrice) || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    {preview.isGain ? 'Gain' : preview.isLoss ? 'Loss' : 'Break Even'}
                  </div>
                  <div
                    className={cn(
                      'font-semibold',
                      preview.isGain && 'text-green-600 dark:text-green-400',
                      preview.isLoss && 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {preview.isGain ? '+' : ''}
                    {formatCurrency(preview.gainLoss)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                {preview.isGain
                  ? 'Gain will be reported as income (EÜR line 16 – Veräußerungsgewinne)'
                  : preview.isLoss
                  ? 'Loss will be reported as expense (EÜR line 35 – Anlagenabgang)'
                  : 'No gain or loss to report'}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Disposing...' : 'Confirm Disposal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AssetDisposalDialog
