import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@/test/utils'
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

  it('"Zentrale" is a collapsible parent with subnav items', async () => {
    const { user } = render(<AppLayout />)
    // Click the Zentrale trigger to expand subnav
    const items = screen.getAllByText('Zentrale')
    const trigger = items[0].closest('button')!
    await user.click(trigger)
    // After expanding, Agent Space and Office should be visible
    const agentSpaceItems = screen.getAllByText('Agent Space')
    expect(agentSpaceItems.length).toBeGreaterThanOrEqual(1)
    const officeItems = screen.getAllByText('Office')
    expect(officeItems.length).toBeGreaterThanOrEqual(1)
  })

  it('"Zentrale" has an SVG icon', () => {
    render(<AppLayout />)
    const items = screen.getAllByText('Zentrale')
    // Zentrale is now a collapsible trigger (button), not a link
    const trigger = items[0].closest('button')
    expect(trigger).toBeTruthy()
    const svg = trigger?.querySelector('svg')
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

  it('Agent Space is under Zentrale with correct route', async () => {
    const { user } = render(<AppLayout />)
    // Expand Zentrale
    const items = screen.getAllByText('Zentrale')
    const trigger = items[0].closest('button')!
    await user.click(trigger)
    // Agent Space links should point to /centrale/agent-space
    const agentSpaceItems = screen.getAllByText('Agent Space')
    const link = agentSpaceItems[0].closest('a')
    expect(link).toHaveAttribute('href', '/centrale/agent-space')
  })
})
