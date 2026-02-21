/**
 * usePeriodLocks Hook
 *
 * React hook for managing GoBD period locks.
 * Provides fetching, locking, and unlocking operations.
 */

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { PeriodLock, PeriodLocksResponse } from '@/lib/api'

export interface PeriodStatus {
  key: string
  type: string
  locked: boolean
  lock?: PeriodLock
}

export interface UsePeriodLocksOptions {
  /** Year to fetch periods for */
  year?: number
  /** Auto-fetch on mount */
  autoFetch?: boolean
}

export interface UsePeriodLocksReturn {
  /** All period statuses for the selected year */
  periods: PeriodStatus[]
  /** All locks */
  locks: PeriodLock[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Selected year */
  selectedYear: number
  /** Set selected year */
  setSelectedYear: (year: number) => void
  /** Lock a period */
  lockPeriod: (key: string, reason?: string) => Promise<void>
  /** Unlock a period */
  unlockPeriod: (key: string, reason: string) => Promise<void>
  /** Refresh data */
  refresh: () => Promise<void>
  /** Check if a specific period key is locked */
  isPeriodLocked: (key: string) => boolean
}

export function usePeriodLocks(options: UsePeriodLocksOptions = {}): UsePeriodLocksReturn {
  const { year = new Date().getFullYear(), autoFetch = true } = options

  const [periods, setPeriods] = useState<PeriodStatus[]>([])
  const [locks, setLocks] = useState<PeriodLock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(year)

  const fetchPeriods = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getPeriodLocks({ year: selectedYear })
      setPeriods(data.periods || [])
      setLocks(data.locks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Periodensperre')
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear])

  const handleLockPeriod = useCallback(async (key: string, reason?: string) => {
    setError(null)
    try {
      await api.lockPeriod(key, reason)
      await fetchPeriods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Sperren')
      throw err
    }
  }, [fetchPeriods])

  const handleUnlockPeriod = useCallback(async (key: string, reason: string) => {
    setError(null)
    try {
      await api.unlockPeriod(key, reason)
      await fetchPeriods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Entsperren')
      throw err
    }
  }, [fetchPeriods])

  const isPeriodLocked = useCallback((key: string): boolean => {
    return periods.some(p => p.key === key && p.locked)
  }, [periods])

  useEffect(() => {
    if (autoFetch) {
      fetchPeriods()
    }
  }, [autoFetch, fetchPeriods])

  return {
    periods,
    locks,
    isLoading,
    error,
    selectedYear,
    setSelectedYear,
    lockPeriod: handleLockPeriod,
    unlockPeriod: handleUnlockPeriod,
    refresh: fetchPeriods,
    isPeriodLocked,
  }
}

export default usePeriodLocks
