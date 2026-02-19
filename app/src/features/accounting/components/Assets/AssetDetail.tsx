/**
 * AssetDetail Component
 *
 * Displays detailed information about an asset including
 * purchase details, depreciation schedule, and status.
 * Allows editing and disposal of active assets.
 */

import type { Asset, AssetCategory, AssetStatus } from '../../types'
import { DepreciationTable } from './DepreciationTable'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'

export interface AssetDetailProps {
  /** Asset to display */
  asset: Asset
  /** Callback when edit button clicked */
  onEdit: (asset: Asset) => void
  /** Callback when dispose button clicked */
  onDispose: (asset: Asset) => void
  /** Callback when back button clicked */
  onBack: () => void
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

  const entry = asset.depreciationSchedule
    .filter(e => e.year <= currentYear)
    .sort((a, b) => b.year - a.year)[0]

  return entry?.bookValue ?? asset.purchasePrice
}

export function AssetDetail({
  asset,
  onEdit,
  onDispose,
  onBack,
  className,
}: AssetDetailProps) {
  const isActive = asset.status === 'active'
  const currentBookValue = getCurrentBookValue(asset)

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{asset.name}</h1>
            {asset.description && (
              <p className="text-muted-foreground">{asset.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onEdit(asset)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {isActive && (
            <Button variant="destructive" onClick={() => onDispose(asset)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Dispose
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge variant={getStatusVariant(asset.status)}>
          {getStatusLabel(asset.status)}
        </Badge>
        <Badge variant="outline">{getCategoryLabel(asset.category)}</Badge>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Purchase Information */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Purchase Date</div>
                <div className="font-medium">{formatDate(asset.purchaseDate)}</div>
              </div>
              {asset.vendor && (
                <div>
                  <div className="text-sm text-muted-foreground">Vendor</div>
                  <div className="font-medium">{asset.vendor}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Net Price</div>
                <div className="font-medium">{formatCurrency(asset.purchasePrice)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Vorsteuer</div>
                <div className="font-medium">{formatCurrency(asset.vatPaid)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Gross Price</div>
                <div className="font-semibold">{formatCurrency(asset.grossPrice)}</div>
              </div>
            </div>

            {(asset.location || asset.inventoryNumber) && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                {asset.location && (
                  <div>
                    <div className="text-sm text-muted-foreground">Location</div>
                    <div className="font-medium">{asset.location}</div>
                  </div>
                )}
                {asset.inventoryNumber && (
                  <div>
                    <div className="text-sm text-muted-foreground">Inventory №</div>
                    <div className="font-medium">{asset.inventoryNumber}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Depreciation Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Depreciation (AfA)</CardTitle>
            <CardDescription>
              {asset.afaMethod === 'immediate' ? 'Immediate write-off (GWG)' : 'Linear depreciation method'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">AfA Period</div>
                <div className="font-medium">
                  {asset.afaMethod === 'immediate' ? 'Immediate' : `${asset.afaYears} years`}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Annual AfA</div>
                <div className="font-medium">{formatCurrency(asset.afaAnnualAmount)}/year</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Original Value</div>
                <div className="font-medium">{formatCurrency(asset.purchasePrice)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Current Book Value</div>
                <div className="font-semibold text-primary">{formatCurrency(currentBookValue)}</div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground">EÜR Classification</div>
              <div className="font-medium">Line {asset.euerLine} - {asset.euerCategory}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disposal Information (if disposed/sold) */}
      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle>Disposal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-medium">{getStatusLabel(asset.status)}</div>
              </div>
              {asset.disposalDate && (
                <div>
                  <div className="text-sm text-muted-foreground">Disposal Date</div>
                  <div className="font-medium">{formatDate(asset.disposalDate)}</div>
                </div>
              )}
              {asset.status === 'sold' && asset.disposalPrice !== undefined && (
                <div>
                  <div className="text-sm text-muted-foreground">Sale Price</div>
                  <div className="font-medium">{formatCurrency(asset.disposalPrice)}</div>
                </div>
              )}
              {asset.disposalReason && (
                <div>
                  <div className="text-sm text-muted-foreground">Reason</div>
                  <div className="font-medium capitalize">{asset.disposalReason}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depreciation Schedule */}
      <DepreciationTable
        schedule={asset.depreciationSchedule}
        purchasePrice={asset.purchasePrice}
        purchaseDate={asset.purchaseDate}
        afaYears={asset.afaYears}
      />
    </div>
  )
}

export default AssetDetail
