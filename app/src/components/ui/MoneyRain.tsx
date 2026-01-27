import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MoneyRainProps {
  isActive: boolean
  onComplete?: () => void
  iconCount?: number
}

interface MoneyIcon {
  id: number
  x: number
  delay: number
  duration: number
  rotation: number
  scale: number
}

/**
 * MoneyRain - A celebratory animation of money icons falling from the top
 * Triggered when an invoice is marked as paid
 */
export function MoneyRain({
  isActive,
  onComplete,
  iconCount = 20
}: MoneyRainProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Generate random positions and timings for each icon
  const icons = useMemo<MoneyIcon[]>(() => {
    return Array.from({ length: iconCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // Random horizontal position (0-100%)
      delay: Math.random() * 0.8, // Staggered start (0-800ms)
      duration: 2 + Math.random() * 1, // Fall duration (2-3s)
      rotation: (Math.random() - 0.5) * 60, // Random rotation (-30 to +30 degrees)
      scale: 1.5 + Math.random(), // Random scale (1.5x to 2.5x)
    }))
  }, [iconCount])

  useEffect(() => {
    if (isActive) {
      setIsVisible(true)

      // Auto-hide after animation completes
      const timer = setTimeout(() => {
        setIsVisible(false)
        onComplete?.()
      }, 3500) // Total animation time + buffer

      return () => clearTimeout(timer)
    }
  }, [isActive, onComplete])

  // Don't render anything if reduced motion is preferred
  if (prefersReducedMotion) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 9999 }}
          aria-hidden="true"
        >
          {icons.map((icon) => (
            <motion.div
              key={icon.id}
              className="absolute text-4xl select-none"
              style={{
                left: `${icon.x}%`,
                fontSize: `${icon.scale}rem`,
              }}
              initial={{
                y: -100,
                x: '-50%',
                rotate: icon.rotation - 20,
                opacity: 0,
              }}
              animate={{
                y: '100vh',
                rotate: icon.rotation + 20,
                opacity: [0, 1, 1, 0],
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: icon.duration,
                delay: icon.delay,
                ease: [0.16, 1, 0.3, 1],
                opacity: {
                  duration: icon.duration,
                  times: [0, 0.1, 0.8, 1],
                },
              }}
            >
              💸
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
