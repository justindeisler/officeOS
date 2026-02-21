import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useInvoiceSuggestions } from './useInvoiceSuggestions'

// Mock the API module
vi.mock('../api/suggestions', () => ({
  getInvoiceSuggestions: vi.fn(),
}))

import { getInvoiceSuggestions } from '../api/suggestions'

const mockGetInvoiceSuggestions = vi.mocked(getInvoiceSuggestions)

const mockSuggestions = {
  nextInvoiceNumber: 'RE-2026-003',
  invoiceNumberPattern: 'RE-YYYY-NNN',
  suggestedPaymentTerms: 14,
  suggestedDueDate: '2026-08-14',
}

describe('useInvoiceSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInvoiceSuggestions.mockResolvedValue(mockSuggestions)
  })

  it('fetches suggestions on mount', async () => {
    const { result } = renderHook(() => useInvoiceSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(mockSuggestions)
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockGetInvoiceSuggestions).toHaveBeenCalledWith(undefined)
  })

  it('starts with loading state', () => {
    const { result } = renderHook(() => useInvoiceSuggestions())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.suggestions).toBeNull()
  })

  it('re-fetches when clientId changes', async () => {
    const clientSuggestions = {
      ...mockSuggestions,
      suggestedPaymentTerms: 30,
    }
    mockGetInvoiceSuggestions
      .mockResolvedValueOnce(mockSuggestions)
      .mockResolvedValueOnce(clientSuggestions)

    const { result, rerender } = renderHook(
      ({ clientId }) => useInvoiceSuggestions(clientId),
      { initialProps: { clientId: undefined as string | undefined } }
    )

    // Mount fetch
    await waitFor(() => {
      expect(result.current.suggestions?.suggestedPaymentTerms).toBe(14)
    })

    // Change clientId
    rerender({ clientId: 'client-123' })

    await waitFor(() => {
      expect(mockGetInvoiceSuggestions).toHaveBeenCalledWith('client-123')
      expect(result.current.suggestions?.suggestedPaymentTerms).toBe(30)
    }, { timeout: 1000 })
  })

  it('handles API errors gracefully', async () => {
    mockGetInvoiceSuggestions.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => useInvoiceSuggestions())

    await waitFor(() => {
      expect(result.current.error).toBe('Server error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('returns next invoice number in suggestions', async () => {
    const { result } = renderHook(() => useInvoiceSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions?.nextInvoiceNumber).toBe('RE-2026-003')
    })
  })

  it('can manually refresh', async () => {
    const { result } = renderHook(() => useInvoiceSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions).toBeTruthy()
    })

    const updated = { ...mockSuggestions, nextInvoiceNumber: 'RE-2026-004' }
    mockGetInvoiceSuggestions.mockResolvedValue(updated)

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.suggestions?.nextInvoiceNumber).toBe('RE-2026-004')
    })
  })
})
