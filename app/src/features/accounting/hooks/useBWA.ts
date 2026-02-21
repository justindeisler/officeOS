/**
 * BWA, SuSa & Profitability Hooks
 *
 * React hooks for fetching report data with loading/error states.
 * Follows the same pattern as useEuerReport.ts.
 */

import { useState, useCallback, useEffect } from 'react'
import type {
  BWAReport,
  SuSaReport,
  ProfitabilityByClientReport,
  ProfitabilityByCategoryReport,
} from '../api/bwa-reports'
import * as bwaReportsApi from '../api/bwa-reports'

// ============================================================================
// useBWA
// ============================================================================

export interface UseBWAOptions {
  /** Auto-fetch on mount and year change */
  autoFetch?: boolean
  /** Initial year */
  year?: number
}

export interface UseBWAReturn {
  data: BWAReport | null
  isLoading: boolean
  error: string | null
  selectedYear: number
  setSelectedYear: (year: number) => void
  refetch: () => Promise<void>
}

/**
 * Hook for fetching BWA (Betriebswirtschaftliche Auswertung) report data.
 */
export function useBWA(options: UseBWAOptions = {}): UseBWAReturn {
  const { autoFetch = true, year = new Date().getFullYear() } = options

  const [data, setData] = useState<BWAReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)

  const fetchData = useCallback(async (fetchYear: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const report = await bwaReportsApi.getBWA(fetchYear)
      setData(report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der BWA')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchData(selectedYear)
  }, [selectedYear, fetchData])

  useEffect(() => {
    if (autoFetch) {
      fetchData(selectedYear)
    }
  }, [autoFetch, selectedYear, fetchData])

  return { data, isLoading, error, selectedYear, setSelectedYear, refetch }
}

// ============================================================================
// useSuSa
// ============================================================================

export interface UseSuSaOptions {
  autoFetch?: boolean
  year?: number
}

export interface UseSuSaReturn {
  data: SuSaReport | null
  isLoading: boolean
  error: string | null
  selectedYear: number
  setSelectedYear: (year: number) => void
  refetch: () => Promise<void>
}

/**
 * Hook for fetching SuSa (Summen- und Saldenliste) report data.
 */
export function useSuSa(options: UseSuSaOptions = {}): UseSuSaReturn {
  const { autoFetch = true, year = new Date().getFullYear() } = options

  const [data, setData] = useState<SuSaReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)

  const fetchData = useCallback(async (fetchYear: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const report = await bwaReportsApi.getSuSa(fetchYear)
      setData(report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der SuSa')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchData(selectedYear)
  }, [selectedYear, fetchData])

  useEffect(() => {
    if (autoFetch) {
      fetchData(selectedYear)
    }
  }, [autoFetch, selectedYear, fetchData])

  return { data, isLoading, error, selectedYear, setSelectedYear, refetch }
}

// ============================================================================
// useProfitability
// ============================================================================

export interface UseProfitabilityOptions {
  autoFetch?: boolean
  year?: number
  type: 'client' | 'category'
}

export interface UseProfitabilityReturn {
  clientData: ProfitabilityByClientReport | null
  categoryData: ProfitabilityByCategoryReport | null
  isLoading: boolean
  error: string | null
  selectedYear: number
  setSelectedYear: (year: number) => void
  refetch: () => Promise<void>
}

/**
 * Hook for fetching profitability report data (by client or category).
 */
export function useProfitability(
  options: UseProfitabilityOptions
): UseProfitabilityReturn {
  const { autoFetch = true, year = new Date().getFullYear(), type } = options

  const [clientData, setClientData] = useState<ProfitabilityByClientReport | null>(null)
  const [categoryData, setCategoryData] = useState<ProfitabilityByCategoryReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)

  const fetchData = useCallback(
    async (fetchYear: number) => {
      setIsLoading(true)
      setError(null)
      try {
        if (type === 'client') {
          const report = await bwaReportsApi.getClientProfitability(fetchYear)
          setClientData(report)
        } else {
          const report = await bwaReportsApi.getCategoryProfitability(fetchYear)
          setCategoryData(report)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Fehler beim Laden der Rentabilitätsdaten'
        )
      } finally {
        setIsLoading(false)
      }
    },
    [type]
  )

  const refetch = useCallback(async () => {
    await fetchData(selectedYear)
  }, [selectedYear, fetchData])

  useEffect(() => {
    if (autoFetch) {
      fetchData(selectedYear)
    }
  }, [autoFetch, selectedYear, fetchData])

  return {
    clientData,
    categoryData,
    isLoading,
    error,
    selectedYear,
    setSelectedYear,
    refetch,
  }
}

export default useBWA
