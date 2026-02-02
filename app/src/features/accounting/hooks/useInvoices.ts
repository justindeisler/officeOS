/**
 * useInvoices Hook
 *
 * React hook for managing invoice state and operations.
 * Provides CRUD operations with loading and error states.
 * Includes invoice status management and income linking.
 * 
 * Uses the centralized service layer which switches between
 * Tauri SQLite and REST API based on the environment.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Invoice, NewInvoice, InvoiceStatus } from '../types'
import { invoiceService } from '@/services'
import type { Invoice as GlobalInvoice } from '@/types'

// Map from global Invoice type to accounting Invoice type
function mapToAccountingInvoice(inv: GlobalInvoice): Invoice {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: new Date(inv.issueDate || inv.createdAt),
    dueDate: new Date(inv.dueDate),
    status: inv.status as InvoiceStatus,
    clientId: inv.clientId,
    projectId: inv.projectId,
    subtotal: inv.amount || 0,
    vatRate: (inv.taxRate || 19) as 0 | 7 | 19,
    vatAmount: inv.taxAmount || 0,
    total: inv.totalAmount || 0,
    paymentDate: inv.paidDate ? new Date(inv.paidDate) : undefined,
    paymentMethod: undefined,
    notes: inv.notes,
    items: (inv.lineItems || []).map(item => ({
      id: item.id,
      invoiceId: inv.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'hours',
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    createdAt: new Date(inv.createdAt),
  }
}

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
      const data = await invoiceService.getAll()
      setInvoices(data.map(mapToAccountingInvoice))
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
      const data = await invoiceService.getByStatus(status)
      setInvoices(data.map(mapToAccountingInvoice))
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
      const data = await invoiceService.getByClient(clientId)
      setInvoices(data.map(mapToAccountingInvoice))
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
      // Map NewInvoice to the format expected by invoiceService
      const serviceData = {
        invoiceNumber: '', // Will be generated
        clientId: data.clientId || '',
        projectId: data.projectId,
        issueDate: data.invoiceDate.toISOString(),
        dueDate: data.dueDate.toISOString(),
        status: 'draft' as const,
        amount: data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        taxRate: data.vatRate,
        taxAmount: 0,
        totalAmount: 0,
        notes: data.notes,
        lineItems: data.items.map(item => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'hours',
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
        })),
        updatedAt: new Date().toISOString(),
      }
      const created = await invoiceService.create(serviceData)
      const newInvoice = mapToAccountingInvoice(created)
      setInvoices((prev) => [newInvoice, ...prev])
      return newInvoice
    } catch (err) {
      console.error('Failed to create invoice:', err)
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
        await invoiceService.update(id, data as unknown as Partial<GlobalInvoice>)
        const updatedData = await invoiceService.getById(id)
        if (updatedData) {
          const updated = mapToAccountingInvoice(updatedData)
          setInvoices((prev) =>
            prev.map((invoice) => (invoice.id === id ? updated : invoice))
          )
          if (selectedInvoice?.id === id) {
            setSelectedInvoice(updated)
          }
          return updated
        }
        return null
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
        await invoiceService.delete(id)
        setInvoices((prev) => prev.filter((invoice) => invoice.id !== id))
        if (selectedInvoice?.id === id) {
          setSelectedInvoice(null)
        }
        return true
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
      const result = await invoiceService.markAsSent(id)
      const updated = mapToAccountingInvoice(result)
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === id ? updated : invoice))
      )
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
        const result = await invoiceService.markAsPaid(id, paymentDate, paymentMethod)
        const updated = mapToAccountingInvoice(result)
        setInvoices((prev) =>
          prev.map((invoice) => (invoice.id === id ? updated : invoice))
        )
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
      const result = await invoiceService.cancelInvoice(id)
      const updated = mapToAccountingInvoice(result)
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === id ? updated : invoice))
      )
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
      return await invoiceService.getNextInvoiceNumber()
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
