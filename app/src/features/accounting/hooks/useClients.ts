/**
 * useClients Hook
 *
 * React hook for managing client state and operations.
 * Provides CRUD operations with loading and error states.
 * 
 * Uses the centralized service layer which switches between
 * Tauri SQLite and REST API based on the environment.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Client, NewClient } from '../types'
import { clientService } from '@/services'

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
   * Maps from global Client type to accounting Client type
   */
  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await clientService.getAll()
      // Map from global Client type to accounting Client type
      // Global: company, contactInfo, notes, status, updatedAt
      // Accounting: address, vatId
      const mappedClients: Client[] = data.map((c) => ({
        id: c.id,
        name: c.name,
        // Use company as address fallback, or contactInfo
        address: (c as unknown as { address?: string }).address || c.company || undefined,
        // vatId may be stored in notes or contactInfo in global type
        vatId: (c as unknown as { vatId?: string }).vatId || undefined,
        email: c.email || undefined,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      }))
      setClients(mappedClients)
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
   * Maps accounting NewClient to global Client type for service
   */
  const createClient = useCallback(
    async (data: NewClient): Promise<Client | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const created = await clientService.create({
          name: data.name,
          company: data.address, // Map address to company field
          email: data.email,
          notes: data.vatId ? `VAT ID: ${data.vatId}` : undefined, // Store vatId in notes
          status: 'active',
        })
        const newClient: Client = {
          id: created.id,
          name: created.name,
          address: created.company || undefined,
          vatId: data.vatId, // Keep original vatId
          email: created.email || undefined,
          createdAt: created.createdAt ? new Date(created.createdAt) : new Date(),
        }
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
   * Maps accounting fields to global Client type for service
   */
  const updateClient = useCallback(
    async (id: string, data: Partial<NewClient>): Promise<Client | null> => {
      setIsLoading(true)
      setError(null)

      try {
        await clientService.update(id, {
          name: data.name,
          company: data.address, // Map address to company
          email: data.email,
          notes: data.vatId ? `VAT ID: ${data.vatId}` : undefined,
        })
        // Fetch the updated client
        const updated = await clientService.getById(id)
        if (updated) {
          const mappedClient: Client = {
            id: updated.id,
            name: updated.name,
            address: updated.company || undefined,
            vatId: data.vatId, // Keep the vatId we passed in
            email: updated.email || undefined,
            createdAt: updated.createdAt ? new Date(updated.createdAt) : new Date(),
          }
          setClients((prev) =>
            prev
              .map((client) => (client.id === id ? mappedClient : client))
              .sort((a, b) => a.name.localeCompare(b.name))
          )
          return mappedClient
        }
        return null
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
      await clientService.delete(id)
      setClients((prev) => prev.filter((client) => client.id !== id))
      return true
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
