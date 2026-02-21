/**
 * CategorySuggestion Component
 *
 * Inline suggestion chip that appears when a vendor is selected
 * and the system has a category recommendation.
 *
 * Displays confidence percentage and allows one-click acceptance.
 */

import { Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../../types'

export interface CategorySuggestionProps {
  /** Suggested category key (e.g., 'telecom', 'software') */
  category: string
  /** Confidence score 0-1 */
  confidence?: number
  /** Called when user accepts the suggestion */
  onAccept: () => void
  /** Called when user dismisses the suggestion */
  onDismiss?: () => void
}

/**
 * Get human-readable label for a category key.
 */
function getCategoryLabel(category: string): string {
  const entry = EXPENSE_CATEGORIES[category as ExpenseCategory]
  return entry?.label ?? category
}

export function CategorySuggestion({
  category,
  confidence,
  onAccept,
  onDismiss,
}: CategorySuggestionProps) {
  const label = getCategoryLabel(category)
  const confidencePercent = confidence != null ? Math.round(confidence * 100) : null

  return (
    <div
      className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-950 dark:border-blue-800"
      role="status"
      aria-label={`Suggested category: ${label}`}
      data-testid="category-suggestion"
    >
      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <span className="text-sm text-blue-800 dark:text-blue-200 flex-1">
        Suggested: <strong>{label}</strong>
        {confidencePercent != null && (
          <span className="ml-1 text-blue-600 dark:text-blue-400">
            ({confidencePercent}% match)
          </span>
        )}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
        onClick={onAccept}
        data-testid="category-suggestion-accept"
      >
        Apply
      </Button>
      {onDismiss && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 dark:text-blue-400"
          onClick={onDismiss}
          aria-label="Dismiss suggestion"
          data-testid="category-suggestion-dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

export default CategorySuggestion
