/**
 * useUstVoranmeldung Hook
 *
 * React hook for managing quarterly VAT declarations (USt-Voranmeldung).
 * Provides calculation, status tracking, and filing operations.
 */

import { useState, useCallback, useEffect } from 'react'
import type { UstVoranmeldung } from '../types'
import * as reportsApi from '../api/reports'

export interface UseUstVoranmeldungOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean
  /** Initial year to fetch */
  year?: number
  /** Initial quarter to fetch */
  quarter?: 1 | 2 | 3 | 4
}

export interface UseUstVoranmeldungReturn {
  /** Current USt-Voranmeldung */
  ustVoranmeldung: UstVoranmeldung | null
  /** All quarters for selected year */
  allQuarters: UstVoranmeldung[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Selected year */
  selectedYear: number
  /** Selected quarter */
  selectedQuarter: 1 | 2 | 3 | 4
  /** Set selected year */
  setSelectedYear: (year: number) => void
  /** Set selected quarter */
  setSelectedQuarter: (quarter: 1 | 2 | 3 | 4) => void
  /** Fetch USt-Voranmeldung for year/quarter */
  fetchUstVoranmeldung: (year: number, quarter: 1 | 2 | 3 | 4) => Promise<void>
  /** Fetch all quarters for a year */
  fetchAllQuarters: (year: number) => Promise<void>
  /** Mark USt-Voranmeldung as filed */
  markAsFiled: (year: number, quarter: 1 | 2 | 3 | 4) => Promise<void>
  /** Refresh current data */
  refresh: () => Promise<void>
}

/**
 * Get current quarter
 */
function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth()
  return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4
}

/**
 * Hook for managing USt-Voranmeldung (quarterly VAT declarations)
 */
export function useUstVoranmeldung(
  options: UseUstVoranmeldungOptions = {}
): UseUstVoranmeldungReturn {
  const {
    autoFetch = true,
    year = new Date().getFullYear(),
    quarter = getCurrentQuarter(),
  } = options

  const [ustVoranmeldung, setUstVoranmeldung] = useState<UstVoranmeldung | null>(null)
  const [allQuarters, setAllQuarters] = useState<UstVoranmeldung[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(quarter)

  /**
   * Fetch USt-Voranmeldung for specific year and quarter
   */
  const fetchUstVoranmeldung = useCallback(
    async (fetchYear: number, fetchQuarter: 1 | 2 | 3 | 4) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await reportsApi.getUstVoranmeldung(fetchYear, fetchQuarter)
        setUstVoranmeldung(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch USt-Voranmeldung'
        )
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Fetch all quarters for a year
   */
  const fetchAllQuarters = useCallback(async (fetchYear: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await reportsApi.getUstVoranmeldungenForYear(fetchYear)
      setAllQuarters(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch quarterly data'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Mark USt-Voranmeldung as filed
   */
  const markAsFiled = useCallback(
    async (fileYear: number, fileQuarter: 1 | 2 | 3 | 4) => {
      setIsLoading(true)
      setError(null)

      try {
        const filed = await reportsApi.markUstAsFiled(fileYear, fileQuarter)
        setUstVoranmeldung(filed)

        // Update allQuarters if it contains this quarter
        setAllQuarters((prev) =>
          prev.map((q) =>
            q.year === fileYear && q.quarter === fileQuarter ? filed : q
          )
        )
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to mark as filed'
        )
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Refresh current data
   */
  const refresh = useCallback(async () => {
    await fetchUstVoranmeldung(selectedYear, selectedQuarter)
  }, [selectedYear, selectedQuarter, fetchUstVoranmeldung])

  /**
   * Update when year/quarter changes
   */
  useEffect(() => {
    if (autoFetch) {
      fetchUstVoranmeldung(selectedYear, selectedQuarter)
    }
  }, [autoFetch, selectedYear, selectedQuarter, fetchUstVoranmeldung])

  return {
    ustVoranmeldung,
    allQuarters,
    isLoading,
    error,
    selectedYear,
    selectedQuarter,
    setSelectedYear,
    setSelectedQuarter,
    fetchUstVoranmeldung,
    fetchAllQuarters,
    markAsFiled,
    refresh,
  }
}

export default useUstVoranmeldung
