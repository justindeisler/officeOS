/**
 * useClients Hook
 *
 * React hook for managing client state and operations.
 * Provides CRUD operations with loading and error states.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Client, NewClient } from '../types'
import * as clientsApi from '../api/clients'

export interface UseClientsOptions {
  /** Auto-fetch clients on mount */
  autoFetch?: boolean
}

export interface UseClientsReturn {
  /** List of client records */
  clients: Client[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch all clients */
  fetchClients: () => Promise<void>
  /** Create a new client */
  createClient: (data: NewClient) => Promise<Client | null>
  /** Update an existing client */
  updateClient: (id: string, data: Partial<NewClient>) => Promise<Client | null>
  /** Delete a client */
  deleteClient: (id: string) => Promise<boolean>
  /** Refresh the client list */
  refresh: () => Promise<void>
}

/**
 * Hook for managing clients
 */
export function useClients(options: UseClientsOptions = {}): UseClientsReturn {
  const { autoFetch = true } = options

  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all clients
   */
  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await clientsApi.getAllClients()
      setClients(data)
    } catch (err) {
      console.error('Failed to fetch clients:', err)
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err) || 'Failed to fetch clients'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new client
   */
  const createClient = useCallback(
    async (data: NewClient): Promise<Client | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const newClient = await clientsApi.createClient(data)
        setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)))
        return newClient
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create client')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Update an existing client
   */
  const updateClient = useCallback(
    async (id: string, data: Partial<NewClient>): Promise<Client | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updated = await clientsApi.updateClient(id, data)
        if (updated) {
          setClients((prev) =>
            prev
              .map((client) => (client.id === id ? updated : client))
              .sort((a, b) => a.name.localeCompare(b.name))
          )
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update client')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Delete a client
   */
  const deleteClient = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const success = await clientsApi.deleteClient(id)
      if (success) {
        setClients((prev) => prev.filter((client) => client.id !== id))
      }
      return success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Refresh the client list
   */
  const refresh = useCallback(async () => {
    await fetchClients()
  }, [fetchClients])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchClients()
    }
  }, [autoFetch, fetchClients])

  return {
    clients,
    isLoading,
    error,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    refresh,
  }
}

export default useClients
