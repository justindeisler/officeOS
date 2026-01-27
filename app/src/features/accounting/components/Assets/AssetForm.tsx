/**
 * AssetForm Component
 *
 * Form for creating and editing asset records.
 * Features automatic AfA calculation, VAT calculation,
 * GWG detection, and category-based depreciation years.
 */

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Asset, NewAsset, VatRate, AssetCategory } from '../../types'
import { AFA_YEARS, GWG_THRESHOLDS } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Info } from 'lucide-react'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { AttachmentPreview } from './AttachmentPreview'
import type { PickedFile } from '@/services/attachmentService'

// Form validation schema
const assetFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  vendor: z.string().optional(),
  purchasePrice: z.number().positive('Amount must be positive'),
  vatRate: z.enum(['0', '7', '19']),
  category: z.enum(['computer', 'phone', 'furniture', 'equipment', 'software']),
  location: z.string().optional(),
  inventoryNumber: z.string().optional(),
})

type AssetFormData = z.infer<typeof assetFormSchema>

export interface AssetFormProps {
  /** Existing asset for editing */
  asset?: Asset
  /** Callback when form is submitted */
  onSubmit: (data: NewAsset) => Promise<void> | void
  /** Callback when form is cancelled */
  onCancel: () => void
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
 * Category display labels
 */
const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'computer', label: 'Computer (3 years)' },
  { value: 'phone', label: 'Phone (5 years)' },
  { value: 'furniture', label: 'Furniture (13 years)' },
  { value: 'equipment', label: 'Equipment (5 years)' },
  { value: 'software', label: 'Software (3 years)' },
]

/**
 * Detect GWG status based on net amount
 */
function detectGwgStatus(netAmount: number): 'immediate' | 'gwg' | 'pool' | 'afa' | null {
  if (netAmount <= 0) return null
  if (netAmount <= GWG_THRESHOLDS.SOFORTABSCHREIBUNG) return 'immediate'
  if (netAmount <= GWG_THRESHOLDS.GWG_MAX) return 'gwg'
  if (netAmount <= GWG_THRESHOLDS.POOL_MAX) return 'pool'
  return 'afa'
}

/**
 * Check if asset qualifies for immediate write-off (GWG ≤€800)
 */
function isImmediateWriteoff(netAmount: number): boolean {
  return netAmount > 0 && netAmount <= GWG_THRESHOLDS.GWG_MAX
}

/**
 * Get GWG status display - shows "Immediate Write-off" for all ≤€800
 */
function getGwgDisplay(status: 'immediate' | 'gwg' | 'pool' | 'afa' | null): {
  label: string
  description: string
  variant: 'default' | 'secondary' | 'outline'
} | null {
  switch (status) {
    case 'immediate':
      return {
        label: 'Immediate Write-off',
        description: '≤€250: Full expense in year of purchase',
        variant: 'default',
      }
    case 'gwg':
      return {
        label: 'Immediate Write-off',
        description: '≤€800 (GWG): Full expense in year of purchase',
        variant: 'default',
      }
    case 'pool':
      return {
        label: 'Pool Method',
        description: '€800-€1000: Pool depreciation (5 years) or regular AfA',
        variant: 'outline',
      }
    case 'afa':
      return {
        label: 'Regular AfA',
        description: '>€1000: Standard linear depreciation',
        variant: 'outline',
      }
    default:
      return null
  }
}

export function AssetForm({
  asset,
  onSubmit,
  onCancel,
  className,
}: AssetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // State for pending file upload (new file selected but not yet saved)
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null)
  // State for existing bill path (from asset being edited)
  const [currentBillPath, setCurrentBillPath] = useState<string | undefined>(asset?.billPath)
  // Track if we should remove the existing attachment on save
  const [shouldRemoveBill, setShouldRemoveBill] = useState(false)

  const isEditing = !!asset

  // Calculate VAT rate from existing asset data
  const getVatRateFromAsset = (asset: Asset | undefined): '0' | '7' | '19' => {
    if (!asset || asset.purchasePrice <= 0) return '19'
    if (asset.vatPaid === 0) return '0'
    const calculatedRate = Math.round((asset.vatPaid / asset.purchasePrice) * 100)
    if (calculatedRate === 7) return '7'
    if (calculatedRate === 19) return '19'
    return '0'
  }

  const defaultValues: AssetFormData = {
    name: asset?.name ?? '',
    description: asset?.description ?? '',
    purchaseDate: asset?.purchaseDate
      ? asset.purchaseDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    vendor: asset?.vendor ?? '',
    purchasePrice: asset?.purchasePrice ?? 0,
    vatRate: getVatRateFromAsset(asset),
    category: asset?.category ?? 'computer',
    location: asset?.location ?? '',
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues,
  })

  const watchPurchasePrice = watch('purchasePrice')
  const watchVatRate = watch('vatRate')
  const watchCategory = watch('category')

  // Calculate VAT and gross amounts
  const calculations = useMemo(() => {
    const net = Number(watchPurchasePrice) || 0
    const rate = Number(watchVatRate) || 19
    const vat = Math.round(net * (rate / 100) * 100) / 100
    const gross = Math.round((net + vat) * 100) / 100
    const isImmediate = isImmediateWriteoff(net)
    const afaYears = isImmediate ? 1 : (AFA_YEARS[watchCategory as AssetCategory] || 3)
    // For immediate write-off, show full amount; otherwise annual depreciation
    const annualAfa = net > 0
      ? (isImmediate ? net : Math.round((net / afaYears) * 100) / 100)
      : 0

    return { net, vat, gross, rate, afaYears, annualAfa, isImmediate }
  }, [watchPurchasePrice, watchVatRate, watchCategory])

  // GWG status detection
  const gwgStatus = useMemo(() => {
    return detectGwgStatus(calculations.net)
  }, [calculations.net])

  const gwgDisplay = getGwgDisplay(gwgStatus)

  // Handle file selection from dropzone
  const handleFileSelect = (file: PickedFile) => {
    setPendingFile(file)
    setShouldRemoveBill(false) // Cancel any pending removal
  }

  // Handle removing the current attachment
  const handleRemoveAttachment = () => {
    if (pendingFile) {
      // Just clear the pending file
      setPendingFile(null)
    } else if (currentBillPath) {
      // Mark existing attachment for removal on save
      setCurrentBillPath(undefined)
      setShouldRemoveBill(true)
    }
  }

  // Handle form submission
  const handleFormSubmit = async (data: AssetFormData) => {
    setIsSubmitting(true)

    try {
      // Determine the bill path to save
      let billPath: string | undefined = undefined

      // If there's a pending file, we'll need to save it after the asset is created
      // For now, we pass the source path and let the caller handle saving
      if (pendingFile) {
        // For new assets, we need the asset ID to save the file
        // We'll pass the source path and handle copying in the hook/API
        billPath = pendingFile.path
      } else if (!shouldRemoveBill && currentBillPath) {
        // Keep existing bill path
        billPath = currentBillPath
      }
      // If shouldRemoveBill is true, billPath stays undefined (removes attachment)

      const newAsset: NewAsset = {
        name: data.name,
        description: data.description || undefined,
        purchaseDate: new Date(data.purchaseDate),
        vendor: data.vendor || undefined,
        purchasePrice: data.purchasePrice,
        vatRate: Number(data.vatRate) as VatRate,
        afaYears: calculations.afaYears,
        afaMethod: calculations.isImmediate ? 'immediate' : undefined,
        category: data.category as AssetCategory,
        location: data.location || undefined,
        billPath,
      }

      await onSubmit(newAsset)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">
          {isEditing ? 'Edit Asset' : 'Add Asset'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? 'Update the asset record details below.'
            : 'Enter the details for the new asset.'}
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="e.g., MacBook Pro 16&quot;"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          placeholder="e.g., Development laptop for work"
          {...register('description')}
        />
      </div>

      {/* Purchase Date and Vendor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Purchase Date</Label>
          <Input
            id="purchaseDate"
            type="date"
            {...register('purchaseDate')}
            aria-invalid={!!errors.purchaseDate}
          />
          {errors.purchaseDate && (
            <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor (optional)</Label>
          <Input
            id="vendor"
            placeholder="e.g., Apple, Amazon"
            {...register('vendor')}
          />
        </div>
      </div>

      {/* Purchase Price and VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchasePrice">Purchase Price (Net, €)</Label>
          <Input
            id="purchasePrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('purchasePrice', { valueAsNumber: true })}
            aria-invalid={!!errors.purchasePrice}
          />
          {errors.purchasePrice && (
            <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatRate">VAT Rate</Label>
          <Select
            value={watchVatRate}
            onValueChange={(value) => setValue('vatRate', value as '0' | '7' | '19')}
          >
            <SelectTrigger id="vatRate">
              <SelectValue placeholder="Select VAT rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="19">19%</SelectItem>
              <SelectItem value="7">7%</SelectItem>
              <SelectItem value="0">0%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* VAT Calculation Display */}
      <div className="rounded-lg bg-muted p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Net</div>
            <div className="font-medium">{formatCurrency(calculations.net)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Vorsteuer ({calculations.rate}%)</div>
            <div className="font-medium">{formatCurrency(calculations.vat)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Gross</div>
            <div className="font-semibold">{formatCurrency(calculations.gross)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              {calculations.isImmediate ? 'Write-off' : 'AfA/Year'}
            </div>
            <div className="font-medium">
              {calculations.isImmediate
                ? `${formatCurrency(calculations.annualAfa)} (full)`
                : `${formatCurrency(calculations.annualAfa)}/year`}
            </div>
          </div>
        </div>

        {/* GWG Status */}
        {gwgDisplay && (
          <div className="mt-3 flex items-start gap-2 text-sm">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <Badge variant={gwgDisplay.variant} className="mb-1">
                {gwgDisplay.label}
              </Badge>
              <p className="text-muted-foreground">{gwgDisplay.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={watchCategory}
          onValueChange={(value) => setValue('category', value as AssetCategory)}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {calculations.isImmediate
            ? 'Depreciation: Immediate write-off (GWG)'
            : `Depreciation period: ${calculations.afaYears} years (linear AfA)`}
        </p>
      </div>

      {/* Location and Inventory Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location (optional)</Label>
          <Input
            id="location"
            placeholder="e.g., Home Office, Büro"
            {...register('location')}
          />
        </div>

        <div className="space-y-2">
          <Label>Inventory Number</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            {isEditing && asset?.inventoryNumber
              ? asset.inventoryNumber
              : 'Auto-generated on save'}
          </div>
        </div>
      </div>

      {/* Bill Attachment */}
      <div className="space-y-2">
        <Label>Bill/Invoice (optional)</Label>
        {pendingFile ? (
          // Show pending file that will be uploaded on save
          <AttachmentPreview
            filePath={pendingFile.path}
            fileName={pendingFile.name}
            onRemove={handleRemoveAttachment}
            disabled={isSubmitting}
          />
        ) : currentBillPath ? (
          // Show existing attached file
          <AttachmentPreview
            filePath={currentBillPath}
            onRemove={handleRemoveAttachment}
            disabled={isSubmitting}
          />
        ) : (
          // Show file dropzone for selecting a file
          <FileDropzone
            onFileSelect={handleFileSelect}
            disabled={isSubmitting}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Attach a PDF of the purchase invoice or receipt
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}

export default AssetForm
