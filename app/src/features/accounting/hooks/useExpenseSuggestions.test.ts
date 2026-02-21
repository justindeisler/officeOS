import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExpenseSuggestions } from './useExpenseSuggestions'

// Mock the API module
vi.mock('../api/suggestions', () => ({
  getExpenseSuggestions: vi.fn(),
}))

import { getExpenseSuggestions } from '../api/suggestions'

const mockGetExpenseSuggestions = vi.mocked(getExpenseSuggestions)

const mockSuggestions = {
  recentVendors: [
    { vendor: 'Deutsche Telekom', count: 12, lastAmount: 49.99 },
    { vendor: 'Amazon', count: 8, lastAmount: 99.0 },
  ],
  suggestedCategory: 'telecom',
  suggestedVatRate: 19,
  suggestedPaymentMethod: 'bank_transfer',
}

describe('useExpenseSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExpenseSuggestions.mockResolvedValue(mockSuggestions)
  })

  it('fetches suggestions on mount (no vendor)', async () => {
    const { result } = renderHook(() => useExpenseSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(mockSuggestions)
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockGetExpenseSuggestions).toHaveBeenCalledWith(undefined)
  })

  it('starts with loading state', () => {
    const { result } = renderHook(() => useExpenseSuggestions())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.suggestions).toBeNull()
  })

  it('re-fetches with vendor after debounce', async () => {
    const vendorSuggestions = {
      ...mockSuggestions,
      suggestedCategory: 'software',
    }

    // First call returns base, second returns vendor-specific
    mockGetExpenseSuggestions
      .mockResolvedValueOnce(mockSuggestions)
      .mockResolvedValueOnce(vendorSuggestions)

    const { result, rerender } = renderHook(
      ({ vendor }) => useExpenseSuggestions(vendor),
      { initialProps: { vendor: undefined as string | undefined } }
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.suggestions).toEqual(mockSuggestions)
    })

    // Change vendor — triggers debounced fetch
    rerender({ vendor: 'Adobe' })

    await waitFor(() => {
      expect(mockGetExpenseSuggestions).toHaveBeenCalledWith('Adobe')
    }, { timeout: 1000 })

    await waitFor(() => {
      expect(result.current.suggestions?.suggestedCategory).toBe('software')
    })
  })

  it('handles API errors gracefully', async () => {
    mockGetExpenseSuggestions.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useExpenseSuggestions())

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('can manually refresh suggestions', async () => {
    const { result } = renderHook(() => useExpenseSuggestions('Telekom'))

    await waitFor(() => {
      expect(result.current.suggestions).toBeTruthy()
    })

    const updated = { ...mockSuggestions, suggestedCategory: 'hosting' }
    mockGetExpenseSuggestions.mockResolvedValue(updated)

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.suggestions?.suggestedCategory).toBe('hosting')
    })
  })
})
