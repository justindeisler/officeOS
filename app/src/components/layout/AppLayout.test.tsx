import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { AppLayout } from './AppLayout'

// Mock stores used by AppLayout
vi.mock('@/stores/captureStore', () => ({
  useUnprocessedCount: () => 0,
}))

vi.mock('@/stores/settingsStore', () => ({
  useUserName: () => 'Test User',
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = { logout: vi.fn() }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/stores/projectStore', () => ({
  useActiveProjects: () => [],
}))

describe('AppLayout Navigation', () => {
  // Note: AppLayout renders sidebar twice (mobile drawer + desktop sidebar),
  // so we use getAllBy* and check the first match for attribute assertions.

  it('renders the "Zentrale" navigation item', () => {
    render(<AppLayout />)
    const items = screen.getAllByText('Zentrale')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('"Zentrale" links to the /office route', () => {
    render(<AppLayout />)
    const items = screen.getAllByText('Zentrale')
    const link = items[0].closest('a')
    expect(link).toHaveAttribute('href', '/office')
  })

  it('"Zentrale" has an SVG icon', () => {
    render(<AppLayout />)
    const items = screen.getAllByText('Zentrale')
    const link = items[0].closest('a')
    expect(link).toBeTruthy()
    const svg = link?.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('does not have a nav item called "The Office"', () => {
    render(<AppLayout />)
    expect(screen.queryAllByText('The Office')).toHaveLength(0)
  })

  it('"Zentrale" appears alongside other core nav items', () => {
    render(<AppLayout />)
    // These appear in both mobile and desktop sidebars, so use getAllBy
    expect(screen.getAllByText('Zentrale').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tasks').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1)
  })
})
