/**
 * ScanInvoiceDialog Component
 *
 * Full-screen dialog for the invoice scanning workflow:
 * Upload → Review (with inline line item selection) → Save
 *
 * Line item checkboxes are integrated directly into the review panel,
 * so users can see and toggle items without a separate selection step.
 */

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { InvoiceUpload, type UploadedInvoice } from './InvoiceUpload'
import { InvoiceReviewPanel } from './InvoiceReviewPanel'
import type { NewExpense } from '../../types'
import { toast } from 'sonner'

type FlowStep = 'upload' | 'review'

export interface ScanInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ScanInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: ScanInvoiceDialogProps) {
  const [step, setStep] = useState<FlowStep>('upload')
  const [uploadResult, setUploadResult] = useState<UploadedInvoice | null>(null)
  const [selectedLineItems, setSelectedLineItems] = useState<number[] | null>(null)

  const handleUploadComplete = useCallback((result: UploadedInvoice) => {
    setUploadResult(result)
    // Go straight to review — line item selection is now handled
    // inline within the InvoiceReviewPanel via checkboxes
    setSelectedLineItems(null)
    setStep('review')
  }, [])

  const handleBackFromReview = useCallback(() => {
    setStep('upload')
    setUploadResult(null)
    setSelectedLineItems(null)
  }, [])

  const handleSave = useCallback(async (
    data: NewExpense & { attachment_id: string; ocr_extraction_id: string }
  ) => {
    try {
      // Create expense directly via API to pass attachment_id
      const { api } = await import('@/lib/api')
      await api.createExpense({
        date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : String(data.date),
        vendor: data.vendor,
        description: data.description,
        category: data.euerCategory,
        net_amount: data.netAmount,
        vat_rate: Number(data.vatRate),
        euer_category: data.euerCategory,
        euer_line: data.euerLine,
        deductible_percent: data.deductiblePercent ?? 100,
        attachment_id: data.attachment_id,
        ocr_extraction_id: data.ocr_extraction_id,
      })

      const gross = data.netAmount * (1 + Number(data.vatRate) / 100)
      toast.success('Expense saved', {
        description: `${data.vendor} · ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(gross)} · Invoice attached`,
      })

      onSuccess?.()
      handleClose()
    } catch (err) {
      toast.error('Failed to save expense', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [onSuccess])

  const handleClose = useCallback(() => {
    setStep('upload')
    setUploadResult(null)
    setSelectedLineItems(null)
    onOpenChange(false)
  }, [onOpenChange])

  const handleCancel = useCallback(() => {
    if (step === 'review') {
      handleBackFromReview()
    } else {
      handleClose()
    }
  }, [step, handleBackFromReview, handleClose])

  // Determine dialog width based on step
  const maxWidth =
    step === 'review'
      ? 'max-w-[1100px]'
      : 'max-w-[500px]'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[calc(100vw-1rem)] max-h-[95vh] overflow-y-auto p-4 sm:p-6',
          maxWidth,
        )}
      >
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Scan Invoice</h2>
              <p className="text-sm text-muted-foreground">
                Upload an invoice PDF or photo. AI will extract the data automatically.
              </p>
            </div>
            <InvoiceUpload
              onUploadComplete={handleUploadComplete}
              onError={(err) => toast.error('Upload failed', { description: err })}
            />
          </div>
        )}

        {step === 'review' && uploadResult && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Review Extracted Data</h2>
              <p className="text-sm text-muted-foreground">
                Verify the extracted information and make corrections if needed.
              </p>
            </div>
            <InvoiceReviewPanel
              upload={uploadResult}
              selectedLineItems={selectedLineItems ?? undefined}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Helper to avoid circular import
function cn(...inputs: (string | false | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ')
}

export default ScanInvoiceDialog
