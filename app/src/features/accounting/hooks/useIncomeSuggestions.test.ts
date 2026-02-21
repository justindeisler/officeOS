import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIncomeSuggestions } from './useIncomeSuggestions'

// Mock the API module
vi.mock('../api/suggestions', () => ({
  getIncomeSuggestions: vi.fn(),
}))

import { getIncomeSuggestions } from '../api/suggestions'

const mockGetIncomeSuggestions = vi.mocked(getIncomeSuggestions)

const mockSuggestions = {
  recentClients: [
    { client: 'Acme Corp', count: 5, lastAmount: 5000 },
    { client: 'TechStart GmbH', count: 3, lastAmount: 2500 },
  ],
}

describe('useIncomeSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetIncomeSuggestions.mockResolvedValue(mockSuggestions)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches suggestions on mount', async () => {
    const { result } = renderHook(() => useIncomeSuggestions())

    expect(result.current.suggestions).toBeNull()
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(mockSuggestions)
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockGetIncomeSuggestions).toHaveBeenCalledTimes(1)
  })

  it('returns recent clients in suggestions', async () => {
    const { result } = renderHook(() => useIncomeSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions?.recentClients).toHaveLength(2)
      expect(result.current.suggestions?.recentClients?.[0].client).toBe('Acme Corp')
    })
  })

  it('handles API errors gracefully', async () => {
    mockGetIncomeSuggestions.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useIncomeSuggestions())

    await waitFor(() => {
      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.suggestions).toBeNull()
    })
  })

  it('can manually refresh', async () => {
    const { result } = renderHook(() => useIncomeSuggestions())

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(mockSuggestions)
    })

    const updated = {
      recentClients: [
        { client: 'New Client', count: 1, lastAmount: 1000 },
      ],
    }
    mockGetIncomeSuggestions.mockResolvedValue(updated)

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.suggestions?.recentClients?.[0].client).toBe('New Client')
    })
  })
})
