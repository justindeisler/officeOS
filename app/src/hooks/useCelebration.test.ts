import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCelebration } from './useCelebration'

describe('useCelebration', () => {
  it('starts with isActive as false', () => {
    const { result } = renderHook(() => useCelebration())

    expect(result.current.isActive).toBe(false)
  })

  it('sets isActive to true when trigger is called', () => {
    const { result } = renderHook(() => useCelebration())

    act(() => {
      result.current.trigger()
    })

    expect(result.current.isActive).toBe(true)
  })

  it('sets isActive to false when onComplete is called', () => {
    const { result } = renderHook(() => useCelebration())

    // First trigger the celebration
    act(() => {
      result.current.trigger()
    })
    expect(result.current.isActive).toBe(true)

    // Then complete it
    act(() => {
      result.current.onComplete()
    })
    expect(result.current.isActive).toBe(false)
  })

  it('maintains stable function references', () => {
    const { result, rerender } = renderHook(() => useCelebration())

    const initialTrigger = result.current.trigger
    const initialOnComplete = result.current.onComplete

    rerender()

    // Functions should be stable (useCallback)
    expect(result.current.trigger).toBe(initialTrigger)
    expect(result.current.onComplete).toBe(initialOnComplete)
  })
})
