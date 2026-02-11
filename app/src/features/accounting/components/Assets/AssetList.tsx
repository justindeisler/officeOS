/**
 * AssetList Component
 *
 * Displays a table of asset records with sorting, filtering,
 * and summary statistics. Shows depreciation status, book value, and category.
 */

import { useState, useMemo, useEffect } from 'react'
import { useAssets } from '../../hooks/useAssets'
import type { Asset, AssetCategory, AssetStatus } from '../../types'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Search, Loader2, FileText } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { attachmentService } from '@/services/attachmentService'

export interface AssetListProps {
  /** Callback when add asset button is clicked */
  onAddAsset?: () => void
  /** Callback when an asset is selected for editing */
  onEditAsset?: (asset: Asset) => void
  /** Additional CSS classes */
  className?: string
  /** Trigger to refresh the asset list */
  refreshTrigger?: number
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
 * Format date in German locale
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Get display name for category
 */
function getCategoryLabel(category: AssetCategory): string {
  const labels: Record<AssetCategory, string> = {
    computer: 'Computer',
    phone: 'Phone',
    furniture: 'Furniture',
    equipment: 'Equipment',
    software: 'Software',
  }
  return labels[category]
}

/**
 * Get display name for status
 */
function getStatusLabel(status: AssetStatus): string {
  const labels: Record<AssetStatus, string> = {
    active: 'Active',
    disposed: 'Disposed',
    sold: 'Sold',
  }
  return labels[status]
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: AssetStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  const variants: Record<AssetStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    active: 'default',
    disposed: 'secondary',
    sold: 'outline',
  }
  return variants[status]
}

/**
 * Get current book value from depreciation schedule
 */
function getCurrentBookValue(asset: Asset): number {
  const currentYear = new Date().getFullYear()

  // Find the depreciation entry for current year or last available
  const entry = asset.depreciationSchedule
    .filter(e => e.year <= currentYear)
    .sort((a, b) => b.year - a.year)[0]

  return entry?.bookValue ?? asset.purchasePrice
}

export function AssetList({
  onAddAsset,
  onEditAsset,
  className,
  refreshTrigger,
}: AssetListProps) {
  const {
    assets,
    isLoading,
    error,
    deleteAsset,
    setSelectedAsset,
    refresh,
  } = useAssets()

  const [searchTerm, setSearchTerm] = useState('')
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh()
    }
  }, [refreshTrigger, refresh])

  // Filter assets by search term
  const filteredAssets = useMemo(() => {
    if (!searchTerm) return assets

    const term = searchTerm.toLowerCase()
    return assets.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.vendor?.toLowerCase().includes(term) ?? false) ||
        (item.description?.toLowerCase().includes(term) ?? false) ||
        item.category.toLowerCase().includes(term)
    )
  }, [assets, searchTerm])

  // Calculate totals
  const totals = useMemo(() => {
    const activeAssets = filteredAssets.filter(a => a.status === 'active')
    return {
      purchaseValue: filteredAssets.reduce((sum, a) => sum + a.purchasePrice, 0),
      bookValue: filteredAssets.reduce((sum, a) => sum + getCurrentBookValue(a), 0),
      activeCount: activeAssets.length,
    }
  }, [filteredAssets])

  // Handle row click
  const handleRowClick = (item: Asset) => {
    setSelectedAsset(item)
    onEditAsset?.(item)
  }

  // Handle delete
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingAssetId(id)
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (deletingAssetId) {
      await deleteAsset(deletingAssetId)
      setDeletingAssetId(null)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-destructive">{getErrorMessage(error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Assets</h2>
        <Button onClick={onAddAsset} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Empty state */}
      {filteredAssets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchTerm
              ? 'No assets match your search'
              : 'No assets yet. Add your first asset to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Book Value</TableHead>
                  <TableHead>AfA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className="font-medium">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.vendor || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(item.purchaseDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(getCurrentBookValue(item))}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {item.afaMethod === 'immediate' ? 'Immediate' : `${item.afaYears} years`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(item.status)}>
                        {getStatusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.billPath && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async (e) => {
                            e.stopPropagation()
                            console.log(`[AssetList] Opening attachment for asset ${item.id}:`, item.billPath)
                            try {
                              await attachmentService.openAttachment(item.billPath!)
                            } catch (err) {
                              const errorMsg = err instanceof Error ? err.message : 'Unknown error'
                              console.error('[AssetList] Failed to open attachment:', errorMsg)
                              alert(`Failed to open attachment: ${errorMsg}`)
                            }
                          }}
                          title="View attached bill"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(e, item.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex justify-start sm:justify-end">
            <div className="rounded-lg bg-muted p-3 sm:p-4 w-full sm:w-auto">
              <div className="text-sm font-medium text-muted-foreground">Summary</div>
              <div className="mt-1 grid grid-cols-3 gap-2 sm:gap-6 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Total Purchase</div>
                  <div className="font-medium text-sm sm:text-base">{formatCurrency(totals.purchaseValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Book Value</div>
                  <div className="font-semibold text-sm sm:text-base">{formatCurrency(totals.bookValue)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Active Assets</div>
                  <div className="font-medium text-sm sm:text-base">{totals.activeCount} active</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingAssetId}
        onOpenChange={(open) => !open && setDeletingAssetId(null)}
        title="Delete asset?"
        description="This will permanently delete this asset. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default AssetList
