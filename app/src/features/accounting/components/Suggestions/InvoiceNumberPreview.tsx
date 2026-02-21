/**
 * InvoiceNumberPreview Component
 *
 * Shows the next suggested invoice number with pattern explanation.
 * Allows one-click acceptance to auto-fill the invoice number field.
 */

import { Hash, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface InvoiceNumberPreviewProps {
  /** The suggested next invoice number */
  nextNumber: string
  /** Pattern description (e.g., "RE-YYYY-NNN") */
  pattern?: string
  /** Called when user accepts the number */
  onAccept: () => void
  /** Whether the suggestion has been accepted */
  accepted?: boolean
}

/**
 * Detect pattern description from a given invoice number.
 * Falls back to the provided pattern prop if given.
 */
function detectPatternDescription(number: string): string {
  // Year-based: RE-2026-003 → "RE-YYYY-NNN"
  const yearBased = number.match(/^(.+?)[_-](\d{4})[_-](\d{1,5})$/)
  if (yearBased) {
    const prefix = yearBased[1]
    const numLen = yearBased[3].length
    const numPattern = 'N'.repeat(numLen)
    return `${prefix}-YYYY-${numPattern}`
  }

  // Sequential with prefix: INV-003 → "INV-NNN"
  const seqPrefix = number.match(/^(.+?)[_-](\d{1,5})$/)
  if (seqPrefix) {
    const prefix = seqPrefix[1]
    const numLen = seqPrefix[2].length
    return `${prefix}-${'N'.repeat(numLen)}`
  }

  // Pure numeric
  if (/^\d+$/.test(number)) {
    return 'N'.repeat(number.length)
  }

  return 'auto-generated'
}

export function InvoiceNumberPreview({
  nextNumber,
  pattern,
  onAccept,
  accepted = false,
}: InvoiceNumberPreviewProps) {
  if (!nextNumber) return null

  const patternDesc = pattern || detectPatternDescription(nextNumber)

  return (
    <div
      className="flex items-center justify-between p-2.5 bg-green-50 border-l-4 border-green-400 rounded-r-md dark:bg-green-950 dark:border-green-600"
      role="status"
      aria-label={`Next invoice number: ${nextNumber}`}
      data-testid="invoice-number-preview"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Hash className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-green-900 dark:text-green-100 truncate">
            {nextNumber}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300">
            Based on pattern {patternDesc}
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={accepted ? 'default' : 'outline'}
        className={
          accepted
            ? 'bg-green-600 hover:bg-green-700 text-white shrink-0 ml-2'
            : 'border-green-400 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900 shrink-0 ml-2'
        }
        onClick={onAccept}
        disabled={accepted}
        data-testid="invoice-number-accept"
      >
        {accepted ? (
          <>
            <Check className="mr-1 h-3.5 w-3.5" />
            Applied
          </>
        ) : (
          'Use this number'
        )}
      </Button>
    </div>
  )
}

export default InvoiceNumberPreview
