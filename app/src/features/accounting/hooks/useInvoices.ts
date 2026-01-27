/**
 * useInvoices Hook
 *
 * React hook for managing invoice state and operations.
 * Provides CRUD operations with loading and error states.
 * Includes invoice status management and income linking.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Invoice, NewInvoice, InvoiceStatus } from '../types'
import * as invoicesApi from '../api/invoices'

export interface UseInvoicesOptions {
  /** Auto-fetch invoices on mount */
  autoFetch?: boolean
  /** Filter by status */
  status?: InvoiceStatus
  /** Filter by client */
  clientId?: string
}

export interface UseInvoicesReturn {
  /** List of invoice records */
  invoices: Invoice[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch all invoices */
  fetchInvoices: () => Promise<void>
  /** Fetch invoices by status */
  fetchByStatus: (status: InvoiceStatus) => Promise<void>
  /** Fetch invoices by client */
  fetchByClient: (clientId: string) => Promise<void>
  /** Create a new invoice */
  createInvoice: (data: NewInvoice) => Promise<Invoice | null>
  /** Update an existing invoice */
  updateInvoice: (id: string, data: Partial<NewInvoice>) => Promise<Invoice | null>
  /** Delete an invoice */
  deleteInvoice: (id: string) => Promise<boolean>
  /** Mark invoice as sent */
  markAsSent: (id: string) => Promise<Invoice | null>
  /** Mark invoice as paid */
  markAsPaid: (id: string, paymentDate: Date, paymentMethod?: string) => Promise<Invoice | null>
  /** Cancel an invoice */
  cancelInvoice: (id: string) => Promise<Invoice | null>
  /** Get the next invoice number */
  getNextInvoiceNumber: () => Promise<string>
  /** Currently selected invoice */
  selectedInvoice: Invoice | null
  /** Set selected invoice */
  setSelectedInvoice: (invoice: Invoice | null) => void
  /** Refresh the invoice list */
  refresh: () => Promise<void>
}

/**
 * Hook for managing invoices
 */
export function useInvoices(options: UseInvoicesOptions = {}): UseInvoicesReturn {
  const { autoFetch = true, status: _status, clientId: _clientId } = options

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  /**
   * Fetch all invoices
   */
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await invoicesApi.getAllInvoices()
      setInvoices(data)
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      const message = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : JSON.stringify(err) || 'Failed to fetch invoices'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch invoices by status
   */
  const fetchByStatus = useCallback(async (status: InvoiceStatus) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await invoicesApi.getInvoicesByStatus(status)
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch invoices by client
   */
  const fetchByClient = useCallback(async (clientId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await invoicesApi.getInvoicesByClient(clientId)
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new invoice
   */
  const createInvoice = useCallback(async (data: NewInvoice): Promise<Invoice | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const newInvoice = await invoicesApi.createInvoice(data)
      setInvoices((prev) => [newInvoice, ...prev])
      return newInvoice
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Update an existing invoice
   */
  const updateInvoice = useCallback(
    async (id: string, data: Partial<NewInvoice>): Promise<Invoice | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updated = await invoicesApi.updateInvoice(id, data)
        if (updated) {
          setInvoices((prev) =>
            prev.map((invoice) => (invoice.id === id ? updated : invoice))
          )
          if (selectedInvoice?.id === id) {
            setSelectedInvoice(updated)
          }
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update invoice')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [selectedInvoice]
  )

  /**
   * Delete an invoice
   */
  const deleteInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const success = await invoicesApi.deleteInvoice(id)
        if (success) {
          setInvoices((prev) => prev.filter((invoice) => invoice.id !== id))
          if (selectedInvoice?.id === id) {
            setSelectedInvoice(null)
          }
        }
        return success
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete invoice')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [selectedInvoice]
  )

  /**
   * Mark invoice as sent
   */
  const markAsSent = useCallback(async (id: string): Promise<Invoice | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const updated = await invoicesApi.markAsSent(id)
      if (updated) {
        setInvoices((prev) =>
          prev.map((invoice) => (invoice.id === id ? updated : invoice))
        )
      }
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as sent')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Mark invoice as paid
   */
  const markAsPaid = useCallback(
    async (
      id: string,
      paymentDate: Date,
      paymentMethod?: string
    ): Promise<Invoice | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updated = await invoicesApi.markAsPaid(id, paymentDate, paymentMethod)
        if (updated) {
          setInvoices((prev) =>
            prev.map((invoice) => (invoice.id === id ? updated : invoice))
          )
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Cancel an invoice
   */
  const cancelInvoice = useCallback(async (id: string): Promise<Invoice | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const updated = await invoicesApi.cancelInvoice(id)
      if (updated) {
        setInvoices((prev) =>
          prev.map((invoice) => (invoice.id === id ? updated : invoice))
        )
      }
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invoice')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get the next invoice number
   */
  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    try {
      return await invoicesApi.getNextInvoiceNumber()
    } catch (err) {
      // Fallback to a basic format
      const year = new Date().getFullYear()
      return `RE-${year}-001`
    }
  }, [])

  /**
   * Refresh the invoice list
   */
  const refresh = useCallback(async () => {
    await fetchInvoices()
  }, [fetchInvoices])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchInvoices()
    }
  }, [autoFetch, fetchInvoices])

  return {
    invoices,
    isLoading,
    error,
    fetchInvoices,
    fetchByStatus,
    fetchByClient,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsSent,
    markAsPaid,
    cancelInvoice,
    getNextInvoiceNumber,
    selectedInvoice,
    setSelectedInvoice,
    refresh,
  }
}

export default useInvoices
