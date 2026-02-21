/**
 * useExpenseSuggestions Hook
 *
 * Fetches smart suggestions for expense forms.
 * Re-fetches when vendor changes (debounced 300ms).
 * Loads recent vendors on mount.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ExpenseSuggestions } from '../api/suggestions'
import { getExpenseSuggestions } from '../api/suggestions'

export interface UseExpenseSuggestionsResult {
  suggestions: ExpenseSuggestions | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useExpenseSuggestions(vendor?: string): UseExpenseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<ExpenseSuggestions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchSuggestions = useCallback(async (vendorQuery?: string) => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const result = await getExpenseSuggestions(vendorQuery)
      setSuggestions(result)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const message = err instanceof Error ? err.message : 'Failed to load suggestions'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount (no vendor = get recent vendors list)
  useEffect(() => {
    fetchSuggestions()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when vendor changes (debounced)
  useEffect(() => {
    if (!vendor) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(vendor)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [vendor, fetchSuggestions])

  const refresh = useCallback(() => {
    fetchSuggestions(vendor)
  }, [vendor, fetchSuggestions])

  return { suggestions, isLoading, error, refresh }
}
