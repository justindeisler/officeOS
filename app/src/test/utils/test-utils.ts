import { vi } from 'vitest'

/**
 * Wait for animations to complete
 * Default duration matches Framer Motion slow animation (600ms)
 */
export const waitForAnimation = (duration = 600) =>
  new Promise((resolve) => setTimeout(resolve, duration))

/**
 * Wait for next tick (useful for async state updates)
 */
export const waitForNextTick = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Create a mock function that can be awaited
 */
export const createAsyncMock = <T>(returnValue: T) => {
  return vi.fn().mockResolvedValue(returnValue)
}

/**
 * Create a mock function that rejects
 */
export const createRejectingMock = (error: Error) => {
  return vi.fn().mockRejectedValue(error)
}

/**
 * Mock Framer Motion for faster tests
 * Call this at the top of test files where animations slow down tests
 *
 * @example
 * beforeAll(() => {
 *   mockFramerMotion()
 * })
 */
export const mockFramerMotion = () => {
  vi.mock('framer-motion', async () => {
    const actual = await vi.importActual('framer-motion')
    return {
      ...(actual as object),
      motion: {
        div: 'div',
        span: 'span',
        button: 'button',
        a: 'a',
        ul: 'ul',
        li: 'li',
        nav: 'nav',
        header: 'header',
        footer: 'footer',
        main: 'main',
        section: 'section',
        article: 'article',
        aside: 'aside',
        form: 'form',
        input: 'input',
        img: 'img',
        svg: 'svg',
        path: 'path',
      },
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
      useAnimation: () => ({
        start: vi.fn(),
        stop: vi.fn(),
        set: vi.fn(),
      }),
      useMotionValue: (initial: number) => ({
        get: () => initial,
        set: vi.fn(),
        onChange: vi.fn(),
      }),
      useSpring: (initial: number) => ({
        get: () => initial,
        set: vi.fn(),
      }),
      useTransform: () => ({
        get: () => 0,
      }),
    }
  })
}

/**
 * Generate a random ID for testing
 */
export const generateTestId = (prefix = 'test') =>
  `${prefix}-${Math.random().toString(36).substr(2, 9)}`

/**
 * Create a delay promise for testing async behavior
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Type guard to check if a value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null
}
