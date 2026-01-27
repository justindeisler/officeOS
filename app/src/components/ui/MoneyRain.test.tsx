import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@/test/utils'
import { MoneyRain } from './MoneyRain'

describe('MoneyRain', () => {
  beforeEach(() => {
    // Default to no reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders money icons when active', () => {
    render(<MoneyRain isActive={true} iconCount={5} />)

    // Should render multiple money emojis
    const moneyIcons = screen.getAllByText('💸')
    expect(moneyIcons).toHaveLength(5)
  })

  it('does not render when inactive', () => {
    render(<MoneyRain isActive={false} />)

    // Should not render any money icons
    expect(screen.queryByText('💸')).not.toBeInTheDocument()
  })

  it('uses default icon count of 20', () => {
    render(<MoneyRain isActive={true} />)

    const moneyIcons = screen.getAllByText('💸')
    expect(moneyIcons).toHaveLength(20)
  })

  it('calls onComplete after animation finishes', async () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<MoneyRain isActive={true} onComplete={onComplete} />)

    // Fast-forward past animation duration (3500ms)
    await act(async () => {
      vi.advanceTimersByTime(3500)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not render when reduced motion is preferred', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(<MoneyRain isActive={true} />)

    // Should not render any money icons
    expect(screen.queryByText('💸')).not.toBeInTheDocument()
  })

  it('has proper aria-hidden attribute for accessibility', () => {
    render(<MoneyRain isActive={true} iconCount={5} />)

    // The container should be hidden from screen readers
    // Use getAllByText and check the first one's container
    const moneyIcons = screen.getAllByText('💸')
    const container = moneyIcons[0].closest('div[aria-hidden="true"]')
    expect(container).toBeInTheDocument()
  })

  it('has pointer-events-none to not block interaction', () => {
    render(<MoneyRain isActive={true} iconCount={5} />)

    // Use getAllByText and check the first one's container
    const moneyIcons = screen.getAllByText('💸')
    const container = moneyIcons[0].closest('.pointer-events-none')
    expect(container).toBeInTheDocument()
  })
})
