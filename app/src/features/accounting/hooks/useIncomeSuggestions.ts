/**
 * useIncomeSuggestions Hook
 *
 * Fetches smart suggestions for income forms.
 * Loads recent clients on mount.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { IncomeSuggestions } from '../api/suggestions'
import { getIncomeSuggestions } from '../api/suggestions'

export interface UseIncomeSuggestionsResult {
  suggestions: IncomeSuggestions | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useIncomeSuggestions(): UseIncomeSuggestionsResult {
  const [suggestions, setSuggestions] = useState<IncomeSuggestions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getIncomeSuggestions()
      if (mountedRef.current) {
        setSuggestions(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to load suggestions'
        setError(message)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchSuggestions()
    return () => {
      mountedRef.current = false
    }
  }, [fetchSuggestions])

  return { suggestions, isLoading, error, refresh: fetchSuggestions }
}
