/**
 * useDuplicateCheck Hook
 *
 * Debounced duplicate checking for expense/income forms.
 * Calls the duplicates API when form fields change,
 * with a 500ms debounce to avoid excessive requests.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DuplicateCandidate } from '../api/duplicates'
import { checkForDuplicates, checkForDuplicatesByFields } from '../api/duplicates'

interface UseDuplicateCheckOptions {
  /** Existing record ID (for editing mode) */
  recordId?: string
  /** Whether duplicate checking is enabled (default: true) */
  enabled?: boolean
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number
}

interface UseDuplicateCheckResult {
  /** List of duplicate candidates found */
  duplicates: DuplicateCandidate[]
  /** Whether a check is in progress */
  isChecking: boolean
  /** Dismiss all duplicates for this session */
  dismiss: () => void
  /** Whether duplicates have been dismissed */
  isDismissed: boolean
}

/**
 * Hook that checks for potential duplicate records when form fields change.
 *
 * @param type     - 'income' or 'expense'
 * @param amount   - Net amount
 * @param date     - ISO date string (YYYY-MM-DD)
 * @param partner  - Vendor (expense) or description/client (income)
 * @param options  - Optional configuration
 */
export function useDuplicateCheck(
  type: 'income' | 'expense',
  amount: number,
  date: string,
  partner: string,
  options: UseDuplicateCheckOptions = {},
): UseDuplicateCheckResult {
  const { recordId, enabled = true, debounceMs = 500 } = options

  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Reset dismissed state when key fields change significantly
  const prevKeyRef = useRef('')

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    setDuplicates([])
  }, [])

  useEffect(() => {
    // Don't check if disabled or values are too minimal
    if (!enabled || !amount || amount <= 0 || !date) {
      setDuplicates([])
      return
    }

    // Build a key from fields — reset dismissed state if fields change significantly
    const key = `${type}:${amount}:${date}:${partner}`
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key
      // Only reset dismissed if this is a meaningful change (not initial render)
      if (isDismissed) {
        setIsDismissed(false)
      }
    }

    // Don't run check if dismissed
    if (isDismissed) return

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort()
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      setIsChecking(true)

      try {
        let results: DuplicateCandidate[]

        if (recordId) {
          // Editing mode — check against the existing record
          results = await checkForDuplicates(type, recordId)
        } else {
          // New record mode — check by field values
          results = await checkForDuplicatesByFields(type, amount, date, partner)
        }

        // Only update if not aborted
        if (!controller.signal.aborted) {
          // Limit to top 3 candidates
          setDuplicates(results.slice(0, 3))
        }
      } catch (error) {
        // Silently ignore aborted requests and network errors
        if (!controller.signal.aborted) {
          console.warn('Duplicate check failed:', error)
          setDuplicates([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsChecking(false)
        }
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [type, amount, date, partner, recordId, enabled, debounceMs, isDismissed])

  return { duplicates, isChecking, dismiss, isDismissed }
}
