import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDuplicateCheck } from './useDuplicateCheck'

// Mock the API module
vi.mock('../api/duplicates', () => ({
  checkForDuplicates: vi.fn(),
  checkForDuplicatesByFields: vi.fn(),
}))

import { checkForDuplicates, checkForDuplicatesByFields } from '../api/duplicates'

const mockCheckForDuplicates = vi.mocked(checkForDuplicates)
const mockCheckByFields = vi.mocked(checkForDuplicatesByFields)

const mockCandidates = [
  {
    id: 'dup-1',
    type: 'expense' as const,
    amount: 100,
    date: '2024-03-15',
    partner: 'Test Vendor',
    description: 'Test',
    similarity_score: 0.9,
    matched_fields: ['amount', 'date'],
  },
]

describe('useDuplicateCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockCheckByFields.mockResolvedValue(mockCandidates)
    mockCheckForDuplicates.mockResolvedValue(mockCandidates)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty duplicates initially', () => {
    const { result } = renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor'),
    )
    expect(result.current.duplicates).toEqual([])
    expect(result.current.isChecking).toBe(false)
  })

  it('does not check if amount is 0', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 0, '2024-03-15', 'Vendor'),
    )
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(mockCheckByFields).not.toHaveBeenCalled()
  })

  it('does not check if date is empty', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '', 'Vendor'),
    )
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(mockCheckByFields).not.toHaveBeenCalled()
  })

  it('debounces the API call by 500ms', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor'),
    )

    // Before debounce expires
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(mockCheckByFields).not.toHaveBeenCalled()

    // After debounce expires
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(mockCheckByFields).toHaveBeenCalledTimes(1)
  })

  it('calls checkForDuplicatesByFields for new records', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Test Vendor'),
    )

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockCheckByFields).toHaveBeenCalledWith(
      'expense', 100, '2024-03-15', 'Test Vendor',
    )
  })

  it('calls checkForDuplicates for existing records with recordId', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Test Vendor', {
        recordId: 'existing-id',
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockCheckForDuplicates).toHaveBeenCalledWith('expense', 'existing-id')
  })

  it('limits results to 3 candidates', async () => {
    const manyCandidates = [
      ...mockCandidates,
      { ...mockCandidates[0], id: 'dup-2' },
      { ...mockCandidates[0], id: 'dup-3' },
      { ...mockCandidates[0], id: 'dup-4' },
      { ...mockCandidates[0], id: 'dup-5' },
    ]
    mockCheckByFields.mockResolvedValue(manyCandidates)

    const { result } = renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor'),
    )

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Flush the resolved promise
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.duplicates).toHaveLength(3)
  })

  it('does not check when disabled', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor', {
        enabled: false,
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(mockCheckByFields).not.toHaveBeenCalled()
  })

  it('dismiss clears duplicates and prevents further checks', async () => {
    const { result } = renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor'),
    )

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Flush the resolved promise
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.duplicates).toHaveLength(1)

    // Dismiss
    act(() => {
      result.current.dismiss()
    })

    expect(result.current.duplicates).toEqual([])
    expect(result.current.isDismissed).toBe(true)
  })

  it('handles API errors gracefully', async () => {
    mockCheckByFields.mockRejectedValue(new Error('Network error'))
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor'),
    )

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Flush the rejected promise
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.duplicates).toEqual([])
    expect(result.current.isChecking).toBe(false)

    consoleSpy.mockRestore()
  })

  it('respects custom debounce delay', async () => {
    renderHook(() =>
      useDuplicateCheck('expense', 100, '2024-03-15', 'Vendor', {
        debounceMs: 1000,
      }),
    )

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(mockCheckByFields).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(mockCheckByFields).toHaveBeenCalledTimes(1)
  })
})
