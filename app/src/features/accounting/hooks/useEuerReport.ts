/**
 * useEuerReport Hook
 *
 * React hook for managing annual EÜR (Einnahmen-Überschuss-Rechnung) reports.
 * Provides calculation and export functionality.
 */

import { useState, useCallback, useEffect } from 'react'
import type { EuerReport } from '../types'
import * as reportsApi from '../api/reports'

export interface UseEuerReportOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean
  /** Initial year to fetch */
  year?: number
}

export interface EuerLineDetail {
  line: number
  name: string
  description: string
}

export interface UseEuerReportReturn {
  /** Current EÜR report */
  euerReport: EuerReport | null
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Selected year */
  selectedYear: number
  /** Set selected year */
  setSelectedYear: (year: number) => void
  /** Fetch EÜR report for year */
  fetchEuerReport: (year: number) => Promise<void>
  /** Get line details (names, descriptions) */
  getLineDetails: () => {
    income: EuerLineDetail[]
    expenses: EuerLineDetail[]
  }
  /** Refresh current data */
  refresh: () => Promise<void>
}

/**
 * Hook for managing EÜR (annual profit) reports
 */
export function useEuerReport(
  options: UseEuerReportOptions = {}
): UseEuerReportReturn {
  const { autoFetch = true, year = new Date().getFullYear() } = options

  const [euerReport, setEuerReport] = useState<EuerReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)

  /**
   * Fetch EÜR report for specific year
   */
  const fetchEuerReport = useCallback(async (fetchYear: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await reportsApi.getEuerReport(fetchYear)
      setEuerReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch EÜR report')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get EÜR line details
   */
  const getLineDetails = useCallback(() => {
    return reportsApi.getEuerLineDetails()
  }, [])

  /**
   * Refresh current data
   */
  const refresh = useCallback(async () => {
    await fetchEuerReport(selectedYear)
  }, [selectedYear, fetchEuerReport])

  /**
   * Update when year changes
   */
  useEffect(() => {
    if (autoFetch) {
      fetchEuerReport(selectedYear)
    }
  }, [autoFetch, selectedYear, fetchEuerReport])

  return {
    euerReport,
    isLoading,
    error,
    selectedYear,
    setSelectedYear,
    fetchEuerReport,
    getLineDetails,
    refresh,
  }
}

export default useEuerReport
