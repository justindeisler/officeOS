/**
 * InvoiceReviewPanel Component
 *
 * Split-view panel showing document preview alongside extracted data.
 * Desktop: side-by-side. Mobile: stacked with collapsible preview.
 *
 * Features:
 * - Confidence indicators (amber for <70%)
 * - Amount validation (net + VAT = gross check)
 * - Pre-populated expense form
 * - Credit note detection
 * - Duplicate warning
 * - Inline line item checkboxes for selecting/deselecting items
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react'
import type { UploadedInvoice } from './InvoiceUpload'
import type { NewExpense, VatRate } from '../../types'
import { calculateSelectedTotals, formatEur } from '../../utils/invoiceCalculations'

// ============================================================================
// Types & Schema
// ============================================================================

const reviewFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor: z.string().min(1, 'Vendor is required'),
  description: z.string().min(1, 'Description is required'),
  netAmount: z.number().positive('Amount must be positive'),
  vatRate: z.enum(['0', '7', '19']),
  euerCategory: z.string().min(1),
  deductiblePercent: z.number().min(0).max(100),
})

type ReviewFormData = z.infer<typeof reviewFormSchema>

const CATEGORY_OPTIONS = [
  { value: 'software', label: 'Software & Lizenzen' },
  { value: 'telecom', label: 'Telekommunikation' },
  { value: 'hosting', label: 'Hosting & Domains' },
  { value: 'travel', label: 'Reisekosten' },
  { value: 'insurance', label: 'Versicherungen' },
  { value: 'bank_fees', label: 'Kontoführung' },
  { value: 'training', label: 'Fortbildung' },
  { value: 'books', label: 'Fachliteratur' },
  { value: 'office_supplies', label: 'Büromaterial' },
  { value: 'subcontractor', label: 'Fremdleistungen' },
  { value: 'homeoffice', label: 'Arbeitszimmer' },
  { value: 'other', label: 'Sonstige Kosten' },
]

// ============================================================================
// Confidence Indicator
// ============================================================================

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  if (confidence >= 0.9) {
    return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" aria-label="High confidence" />
  }
  if (confidence >= 0.7) {
    return <CheckCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" aria-label="Medium confidence" />
  }
  return (
    <AlertTriangle
      className="h-3.5 w-3.5 text-amber-500 shrink-0"
      aria-label="Low confidence - please verify"
    />
  )
}

function FieldWithConfidence({
  label,
  confidence,
  children,
  className,
}: {
  label: string
  confidence?: number
  children: React.ReactNode
  className?: string
}) {
  const isLowConfidence = confidence !== undefined && confidence < 0.7

  return (
    <div
      className={cn(
        'space-y-2',
        isLowConfidence && 'ring-1 ring-amber-300 rounded-md p-2 -m-2 bg-amber-50/50 dark:bg-amber-950/20',
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {confidence !== undefined && <ConfidenceIndicator confidence={confidence} />}
        {isLowConfidence && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Verify</span>
        )}
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// Format Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ============================================================================
// Main Component
// ============================================================================

export interface InvoiceReviewPanelProps {
  upload: UploadedInvoice
  /** If provided, initial selected line item indices (from LineItemSelector step) */
  selectedLineItems?: number[]
  onSave: (data: NewExpense & { attachment_id: string; ocr_extraction_id: string }) => Promise<void>
  onCancel: () => void
  className?: string
}

export function InvoiceReviewPanel({
  upload,
  selectedLineItems: initialSelectedLineItems,
  onSave,
  onCancel,
  className,
}: InvoiceReviewPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)

  const { extraction } = upload
  const hasLineItems = (extraction.line_items?.length ?? 0) > 0

  // Inline line item selection state — initialized from props or all selected
  const [inlineSelectedItems, setInlineSelectedItems] = useState<number[]>(
    () => initialSelectedLineItems ?? extraction.line_items?.map((_, i) => i) ?? [],
  )

  // The effective selected items (what we use for calculations)
  const selectedLineItems = hasLineItems ? inlineSelectedItems : undefined

  // Are we showing a filtered subset of items?
  const isFiltered = selectedLineItems !== undefined
    && extraction.line_items?.length > 0
    && selectedLineItems.length < extraction.line_items.length

  // Toggle a single line item
  const toggleLineItem = useCallback((index: number) => {
    setInlineSelectedItems((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index].sort((a, b) => a - b),
    )
  }, [])

  // Select/deselect all
  const selectAllItems = useCallback(() => {
    setInlineSelectedItems(extraction.line_items?.map((_, i) => i) ?? [])
  }, [extraction.line_items])

  const deselectAllItems = useCallback(() => {
    setInlineSelectedItems([])
  }, [])

  // Recalculate totals if a subset of items was selected
  const filteredTotals = useMemo(() => {
    if (!selectedLineItems || !extraction.line_items?.length) return null
    return calculateSelectedTotals(
      extraction.line_items,
      selectedLineItems,
      extraction.vat_rate?.value ?? 19,
    )
  }, [selectedLineItems, extraction.line_items, extraction.vat_rate])

  // Determine default values from extraction (use filtered totals if available)
  const defaults = useMemo((): ReviewFormData => {
    return {
      date: extraction.invoice_date?.value || new Date().toISOString().split('T')[0],
      vendor: extraction.vendor?.value || '',
      description: extraction.suggested_description || '',
      netAmount: filteredTotals?.net_amount ?? extraction.net_amount?.value ?? 0,
      vatRate: String(filteredTotals?.vat_rate ?? extraction.vat_rate?.value ?? 19) as '0' | '7' | '19',
      euerCategory: extraction.suggested_category || 'software',
      deductiblePercent: 100,
    }
  }, [extraction, filteredTotals])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: defaults,
  })

  const watchNetAmount = watch('netAmount')
  const watchVatRate = watch('vatRate')

  // Update net amount when inline line item selection changes
  useEffect(() => {
    if (filteredTotals) {
      setValue('netAmount', filteredTotals.net_amount)
    }
  }, [filteredTotals, setValue])

  // Calculate VAT
  const calculations = useMemo(() => {
    const net = Number(watchNetAmount) || 0
    const rate = Number(watchVatRate) || 19
    const vat = Math.round(net * (rate / 100) * 100) / 100
    const gross = Math.round((net + vat) * 100) / 100
    return { net, vat, gross, rate }
  }, [watchNetAmount, watchVatRate])

  // Check amount mismatch with extraction
  const amountMismatch = useMemo(() => {
    if (!extraction.gross_amount?.value) return null
    const extractedGross = extraction.gross_amount.value
    const diff = Math.abs(calculations.gross - extractedGross)
    if (diff > 0.05) {
      return {
        extracted: extractedGross,
        calculated: calculations.gross,
        difference: diff,
      }
    }
    return null
  }, [calculations.gross, extraction.gross_amount])

  const handleFormSubmit = useCallback(async (data: ReviewFormData) => {
    setIsSubmitting(true)
    try {
      await onSave({
        date: new Date(data.date),
        vendor: data.vendor,
        description: data.description,
        netAmount: data.netAmount,
        vatRate: Number(data.vatRate) as VatRate,
        euerLine: 34,
        euerCategory: data.euerCategory,
        deductiblePercent: data.deductiblePercent,
        attachment_id: upload.attachmentId,
        ocr_extraction_id: upload.extractionId,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [onSave, upload.attachmentId, upload.extractionId])

  const isPdf = upload.file.type === 'application/pdf'
  // Use object URL from the original file for preview (avoids auth issues)
  const [previewUrl] = useState(() => URL.createObjectURL(upload.file))

  return (
    <div className={cn('flex flex-col lg:flex-row gap-4 lg:gap-6', className)}>
      {/* Document Preview (left side on desktop, top on mobile) */}
      <div className="lg:w-1/2 lg:max-w-[500px]">
        {/* Mobile toggle */}
        <button
          type="button"
          className="flex lg:hidden items-center gap-2 w-full p-3 rounded-lg bg-muted mb-2"
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium flex-1 text-left">
            {upload.file.name}
          </span>
          {previewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Preview content */}
        <div className={cn(
          'rounded-lg border overflow-hidden bg-muted/30',
          !previewOpen && 'hidden lg:block',
        )}>
          <div className="p-2 bg-muted border-b hidden lg:flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium truncate flex-1">{upload.file.name}</span>
            <Badge variant="outline" className="text-[10px]">
              {(upload.file.size / 1024).toFixed(0)} KB
            </Badge>
          </div>

          <div className="relative" style={{ minHeight: '300px', maxHeight: '600px' }}>
            {isPdf ? (
              <iframe
                src={previewUrl}
                className="w-full h-[400px] lg:h-[560px]"
                title="Invoice preview"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Invoice preview"
                className="w-full h-auto max-h-[560px] object-contain"
              />
            )}
          </div>
        </div>

        {/* Processing info */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>
            Processed in {((extraction.processing_time_ms || 0) / 1000).toFixed(1)}s
          </span>
          {extraction.status === 'completed' && (
            <Badge variant="secondary" className="text-[10px]">
              {isFiltered && selectedLineItems
                ? `${selectedLineItems.length}/${extraction.line_items.length} items`
                : `${extraction.line_items?.length || 0} line items`}
            </Badge>
          )}
        </div>
      </div>

      {/* Extraction Form (right side on desktop, bottom on mobile) */}
      <div className="lg:flex-1 lg:min-w-0">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Warnings */}
          {extraction.is_credit_note && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-400">Credit Note Detected</span>
                <p className="text-amber-600 dark:text-amber-500 text-xs">
                  This appears to be a Gutschrift. Consider creating a negative expense.
                </p>
              </div>
            </div>
          )}

          {upload.duplicate && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">Possible Duplicate</span>
                <p className="text-blue-600 dark:text-blue-500 text-xs">
                  This file was already uploaded for an expense on {upload.duplicate.existing_date}.
                </p>
              </div>
            </div>
          )}

          {extraction.status !== 'completed' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-yellow-700 dark:text-yellow-400">
                  Extraction Incomplete
                </span>
                <p className="text-yellow-600 dark:text-yellow-500 text-xs">
                  Some fields could not be extracted. Please fill in the missing information manually.
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <FieldWithConfidence
            label="Invoice Date"
            confidence={extraction.invoice_date?.confidence}
          >
            <Input type="date" {...register('date')} aria-invalid={!!errors.date} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </FieldWithConfidence>

          {/* Vendor */}
          <FieldWithConfidence label="Vendor" confidence={extraction.vendor?.confidence}>
            <Input
              placeholder="e.g., Hetzner Online GmbH"
              {...register('vendor')}
              aria-invalid={!!errors.vendor}
            />
            {errors.vendor && <p className="text-sm text-destructive">{errors.vendor.message}</p>}
          </FieldWithConfidence>

          {/* Description */}
          <FieldWithConfidence label="Description">
            <Input
              placeholder="e.g., Cloud Server CX21"
              {...register('description')}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </FieldWithConfidence>

          {/* Amount and VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWithConfidence
              label="Net Amount (€)"
              confidence={extraction.net_amount?.confidence}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('netAmount', { valueAsNumber: true })}
                aria-invalid={!!errors.netAmount}
              />
              {errors.netAmount && (
                <p className="text-sm text-destructive">{errors.netAmount.message}</p>
              )}
            </FieldWithConfidence>

            <FieldWithConfidence
              label="VAT Rate"
              confidence={extraction.vat_rate?.confidence}
            >
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('vatRate')}
              >
                <option value="19">19%</option>
                <option value="7">7%</option>
                <option value="0">0%</option>
              </select>
            </FieldWithConfidence>
          </div>

          {/* VAT Calculation Display */}
          <div className="rounded-lg bg-muted p-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Net</div>
                <div className="font-medium">{formatCurrency(calculations.net)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">
                  Vorsteuer ({calculations.rate}%)
                </div>
                <div className="font-medium">{formatCurrency(calculations.vat)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Gross</div>
                <div className="font-semibold">{formatCurrency(calculations.gross)}</div>
              </div>
            </div>

            {amountMismatch && (
              <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>
                    Extracted gross: {formatCurrency(amountMismatch.extracted)} (diff:{' '}
                    {formatCurrency(amountMismatch.difference)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('euerCategory')}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Deductible (%)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                {...register('deductiblePercent', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Line Items with Checkboxes */}
          {hasLineItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">
                    Line Items
                  </Label>
                  <Badge variant="secondary" className="text-[10px]">
                    {inlineSelectedItems.length}/{extraction.line_items.length}
                  </Badge>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5"
                    onClick={selectAllItems}
                    disabled={inlineSelectedItems.length === extraction.line_items.length}
                  >
                    All
                  </button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5"
                    onClick={deselectAllItems}
                    disabled={inlineSelectedItems.length === 0}
                  >
                    None
                  </button>
                </div>
              </div>

              {isFiltered && (
                <p className="text-xs text-muted-foreground -mt-1">
                  Deselect personal items. Amounts update automatically.
                </p>
              )}

              <div className="rounded-lg border divide-y text-sm max-h-[40vh] overflow-y-auto">
                {extraction.line_items.map((item, index) => {
                  const isSelected = inlineSelectedItems.includes(index)
                  const itemAmount = item.amount ?? ((item.quantity ?? 0) * (item.unitPrice ?? 0))

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleLineItem(index)}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                        'hover:bg-muted/50 active:bg-muted/70',
                        isSelected
                          ? 'bg-transparent'
                          : 'bg-muted/20 opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleLineItem(index)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0"
                        aria-label={`Select ${item.description || 'item'}`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'text-sm leading-tight',
                              !isSelected && 'line-through text-muted-foreground',
                            )}
                          >
                            {item.description || 'Unnamed item'}
                            {item.quantity != null && item.quantity > 1 && (
                              <span className="text-xs text-muted-foreground ml-1">×{item.quantity}</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-medium tabular-nums shrink-0',
                              !isSelected && 'text-muted-foreground',
                            )}
                          >
                            {formatEur(itemAmount)}
                          </span>
                        </div>

                        {/* Unit price detail */}
                        {item.quantity != null && item.unitPrice != null && item.quantity > 1 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.quantity} × {formatEur(item.unitPrice)}
                          </div>
                        )}

                        {/* Personal badge for deselected items */}
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

              {/* Warning if none selected */}
              {inlineSelectedItems.length === 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Select at least one item to save
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Invoice Number (read-only info) */}
          {extraction.invoice_number?.value && (
            <div className="text-xs text-muted-foreground">
              Invoice #: {extraction.invoice_number.value}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-background pb-2 sm:pb-0 sm:static sm:bg-transparent border-t sm:border-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || (hasLineItems && inlineSelectedItems.length === 0)}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InvoiceReviewPanel
