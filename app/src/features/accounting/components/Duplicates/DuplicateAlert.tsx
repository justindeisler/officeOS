/**
 * DuplicateAlert Component
 *
 * Inline warning banner that appears in expense/income forms
 * when potential duplicate records are detected.
 *
 * Shows up to 3 duplicate candidates with similarity scores,
 * "View" buttons to open duplicates, and a "Not a duplicate" dismiss button.
 */

import { AlertTriangle, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DuplicateCandidate } from '../../api/duplicates'

export interface DuplicateAlertProps {
  /** Record type */
  type: 'income' | 'expense'
  /** Duplicate candidates to display */
  duplicates: DuplicateCandidate[]
  /** Whether a check is currently in progress */
  isChecking?: boolean
  /** Called when user dismisses the alert */
  onIgnore: () => void
  /** Called when user wants to view a duplicate record */
  onView: (duplicateId: string) => void
}

/**
 * Format a number as Euro currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format an ISO date string to German locale
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function DuplicateAlert({
  type,
  duplicates,
  isChecking = false,
  onIgnore,
  onView,
}: DuplicateAlertProps) {
  // Show loading spinner if checking and no duplicates yet
  if (isChecking && duplicates.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2" data-testid="duplicate-checking">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking for duplicates...</span>
      </div>
    )
  }

  // Don't render if no duplicates
  if (duplicates.length === 0) {
    return null
  }

  return (
    <div
      className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded-r-md"
      role="alert"
      data-testid="duplicate-alert"
    >
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800">
            {duplicates.length === 1
              ? 'Possible duplicate detected'
              : `${duplicates.length} possible duplicates detected`}
          </h3>

          <div className="mt-2 space-y-1">
            {duplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex justify-between items-center py-1 text-sm text-amber-700"
                data-testid="duplicate-candidate"
              >
                <span className="truncate mr-2">
                  {dup.partner} · {formatCurrency(dup.amount)} · {formatDate(dup.date)}
                  <span className="text-amber-600 ml-2 font-medium">
                    ({Math.round(dup.similarity_score * 100)}% match)
                  </span>
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-amber-700 hover:text-amber-900 flex-shrink-0 h-auto p-0"
                  onClick={() => onView(dup.id)}
                  data-testid={`view-duplicate-${dup.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onIgnore}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
              data-testid="dismiss-duplicates"
            >
              Not a duplicate
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DuplicateAlert
