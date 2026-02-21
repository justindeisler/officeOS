/**
 * useInvoiceSuggestions Hook
 *
 * Fetches smart suggestions for invoice forms.
 * Re-fetches when clientId changes (debounced 300ms).
 * Loads next invoice number and defaults on mount.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { InvoiceSuggestions } from '../api/suggestions'
import { getInvoiceSuggestions } from '../api/suggestions'

export interface UseInvoiceSuggestionsResult {
  suggestions: InvoiceSuggestions | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useInvoiceSuggestions(clientId?: string): UseInvoiceSuggestionsResult {
  const [suggestions, setSuggestions] = useState<InvoiceSuggestions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const fetchSuggestions = useCallback(async (client?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getInvoiceSuggestions(client)
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

  // Fetch on mount
  useEffect(() => {
    mountedRef.current = true
    fetchSuggestions()
    return () => {
      mountedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when clientId changes (debounced)
  useEffect(() => {
    if (!clientId) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(clientId)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [clientId, fetchSuggestions])

  const refresh = useCallback(() => {
    fetchSuggestions(clientId)
  }, [clientId, fetchSuggestions])

  return { suggestions, isLoading, error, refresh }
}
