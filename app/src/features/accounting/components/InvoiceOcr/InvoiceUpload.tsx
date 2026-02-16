/**
 * InvoiceUpload Component
 *
 * Drag-and-drop file upload for invoices with camera capture support on mobile.
 * Shows upload progress, processing state, and error handling.
 */

import { useState, useCallback, useRef } from 'react'
import { Upload, Camera, FileText, Loader2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface UploadedInvoice {
  attachmentId: string
  extractionId: string
  fileUrl: string
  thumbnailUrl: string | null
  file: File
  extraction: {
    status: string
    vendor: { value: string; confidence: number; raw_ocr_value?: string } | null
    invoice_number: { value: string; confidence: number } | null
    invoice_date: { value: string; confidence: number } | null
    net_amount: { value: number; confidence: number } | null
    vat_rate: { value: number; confidence: number } | null
    vat_amount: { value: number; confidence: number } | null
    gross_amount: { value: number; confidence: number } | null
    currency: { value: string; confidence: number } | null
    line_items: Array<{
      description: string
      quantity: number | null
      unitPrice: number | null
      amount: number | null
      confidence: number
    }>
    suggested_category: string | null
    suggested_description: string | null
    is_credit_note: boolean
    processing_time_ms: number
  }
  duplicate: { existing_expense_id: string; existing_date: string } | null
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'error'

export interface InvoiceUploadProps {
  onUploadComplete: (result: UploadedInvoice) => void
  onError?: (error: string) => void
  className?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'

export function InvoiceUpload({ onUploadComplete, onError, className }: InvoiceUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleError = useCallback((message: string) => {
    setError(message)
    setState('error')
    onError?.(message)
  }, [onError])

  const validateFile = useCallback((file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      handleError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`)
      return false
    }

    // Check extension-based validation (more reliable for HEIC on iOS)
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      handleError(`File type not supported. Accepted: PDF, JPEG, PNG, WebP, HEIC`)
      return false
    }

    return true
  }, [handleError])

  const uploadFile = useCallback(async (file: File) => {
    if (!validateFile(file)) return

    setState('uploading')
    setProgress(0)
    setError(null)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 80))
      }, 200)

      setState('processing')
      setProgress(85)

      const { api } = await import('@/lib/api')
      const result = await api.uploadInvoice(file)

      clearInterval(progressInterval)
      setProgress(100)

      onUploadComplete({
        attachmentId: result.attachment_id,
        extractionId: result.extraction_id,
        fileUrl: result.file_url,
        thumbnailUrl: result.thumbnail_url,
        file,
        extraction: result.extraction,
        duplicate: result.duplicate,
      })

      // Reset state after a short delay
      setTimeout(() => {
        setState('idle')
        setProgress(0)
      }, 500)
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }, [validateFile, onUploadComplete, handleError])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [uploadFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const isProcessing = state === 'uploading' || state === 'processing'

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-6 transition-all duration-200 cursor-pointer',
          'flex flex-col items-center justify-center gap-3 text-center',
          isDragging && 'border-primary bg-primary/5 scale-[1.02]',
          !isDragging && !isProcessing && 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
          isProcessing && 'border-muted-foreground/25 cursor-wait',
          state === 'error' && 'border-destructive/50 bg-destructive/5',
        )}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {state === 'uploading' ? 'Uploading...' : 'Extracting invoice data...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {state === 'uploading'
                  ? 'Sending file to server'
                  : 'AI is reading your invoice'}
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : state === 'error' ? (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Click to try again</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setState('idle')
                setError(null)
              }}
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragging ? (
              <FileText className="h-10 w-10 text-primary" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop invoice here' : 'Upload invoice'}
              </p>
              <p className="text-xs text-muted-foreground">
                Drop a file here, click to browse, or take a photo
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG · Max 10 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile camera button */}
      {state === 'idle' && (
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:hidden"
          onClick={(e) => {
            e.stopPropagation()
            cameraInputRef.current?.click()
          }}
        >
          <Camera className="h-4 w-4 mr-2" />
          Take Photo
        </Button>
      )}
    </div>
  )
}

export default InvoiceUpload
