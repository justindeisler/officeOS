/**
 * useAuditLog Hook
 *
 * React hook for fetching and searching the GoBD audit trail.
 */

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { AuditEntry, AuditSearchResult } from '@/lib/api'

export interface UseAuditLogOptions {
  /** Entity type to filter by */
  entityType?: string
  /** Entity ID to get trail for */
  entityId?: string
  /** Auto-fetch on mount */
  autoFetch?: boolean
}

export interface UseAuditLogReturn {
  /** Audit entries */
  entries: AuditEntry[]
  /** Total count */
  total: number
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Fetch audit log for a specific entity */
  fetchForEntity: (entityType: string, entityId: string) => Promise<void>
  /** Search audit logs with filters */
  search: (filters: {
    entity_type?: string
    action?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }) => Promise<void>
  /** Refresh current data */
  refresh: () => Promise<void>
}

export function useAuditLog(options: UseAuditLogOptions = {}): UseAuditLogReturn {
  const { entityType, entityId, autoFetch = true } = options

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchForEntity = useCallback(async (type: string, id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getAuditLog(type, id)
      setEntries(data)
      setTotal(data.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Audit-Logs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const search = useCallback(async (filters: {
    entity_type?: string
    action?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.searchAudit(filters)
      setEntries(result.entries || [])
      setTotal(result.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Audit-Suche')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (entityType && entityId) {
      await fetchForEntity(entityType, entityId)
    }
  }, [entityType, entityId, fetchForEntity])

  useEffect(() => {
    if (autoFetch && entityType && entityId) {
      fetchForEntity(entityType, entityId)
    }
  }, [autoFetch, entityType, entityId, fetchForEntity])

  return {
    entries,
    total,
    isLoading,
    error,
    fetchForEntity,
    search,
    refresh,
  }
}

export default useAuditLog
