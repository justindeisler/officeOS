/**
 * AssetWidget Component
 *
 * Dashboard widget displaying asset overview:
 * - Total asset value (book value)
 * - Current year AfA (depreciation)
 * - Active asset count
 * - Recent acquisitions
 */

import React from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, TrendingDown, ChevronRight } from 'lucide-react'
import type { Asset } from '../../types'

export interface AssetWidgetProps {
  /** Total book value of all active assets */
  totalAssetValue?: number
  /** Current year depreciation total */
  yearlyAfA?: number
  /** Count of active assets */
  activeCount?: number
  /** Recent asset acquisitions (max 3) */
  recentAssets?: Asset[]
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Callback when "View All" is clicked */
  onNavigate?: (section: 'assets') => void
  /** Callback when an asset item is clicked */
  onAssetClick?: (assetId: string) => void
  /** Additional CSS classes */
  className?: string
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
 * Format date in German format
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function AssetWidget({
  totalAssetValue = 0,
  yearlyAfA = 0,
  activeCount = 0,
  recentAssets = [],
  isLoading = false,
  error = null,
  onNavigate,
  onAssetClick,
  className,
}: AssetWidgetProps) {
  const currentYear = new Date().getFullYear()
  const hasAssets = activeCount > 0 || recentAssets.length > 0

  // Loading state
  if (isLoading) {
    return (
      <Card
        data-testid="asset-widget"
        className={cn('', className)}
        role="region"
        aria-label="Asset Overview"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            Laden...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card
        data-testid="asset-widget"
        className={cn('', className)}
        role="region"
        aria-label="Asset Overview"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{getErrorMessage(error)}</div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!hasAssets) {
    return (
      <Card
        data-testid="asset-widget"
        className={cn('', className)}
        role="region"
        aria-label="Asset Overview"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            <p>No assets registered</p>
            <p className="text-xs mt-1">Keine Anlagen vorhanden</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => onNavigate?.('assets')}
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      data-testid="asset-widget"
      className={cn('', className)}
      role="region"
      aria-label="Asset Overview"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assets
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {activeCount} aktiv
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Asset Value */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Value (Gesamtwert)</p>
            <p className="text-lg font-semibold">{formatCurrency(totalAssetValue)}</p>
          </div>

          {/* Current Year AfA */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              AfA {currentYear}
            </p>
            <p className="text-lg font-semibold">{formatCurrency(yearlyAfA)}</p>
          </div>
        </div>

        {/* Recent Acquisitions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Recent Acquisitions (Neueste Anlagen)
          </p>
          {recentAssets.length > 0 ? (
            <ul className="space-y-1" role="list">
              {recentAssets.slice(0, 3).map((asset) => (
                <li
                  key={asset.id}
                  role="listitem"
                  className={cn(
                    'flex items-center justify-between text-sm py-1 rounded px-1',
                    onAssetClick && 'hover:bg-muted cursor-pointer'
                  )}
                  onClick={() => onAssetClick?.(asset.id)}
                  onKeyDown={(e) => {
                    if (onAssetClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onAssetClick(asset.id)
                    }
                  }}
                  tabIndex={onAssetClick ? 0 : undefined}
                >
                  <span className="truncate">{asset.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDate(new Date(asset.purchaseDate))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No recent acquisitions (Keine neuen Anlagen)
            </p>
          )}
        </div>

        {/* View All Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onNavigate?.('assets')}
        >
          View All
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  )
}

export default AssetWidget
