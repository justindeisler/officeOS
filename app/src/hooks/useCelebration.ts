import { useState, useCallback } from 'react'

/**
 * Hook for managing celebratory animation state
 * Used to trigger effects like money rain when positive events occur
 */
export function useCelebration() {
  const [isActive, setIsActive] = useState(false)

  const trigger = useCallback(() => {
    setIsActive(true)
  }, [])

  const onComplete = useCallback(() => {
    setIsActive(false)
  }, [])

  return {
    isActive,
    trigger,
    onComplete,
  }
}
