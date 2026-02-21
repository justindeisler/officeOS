import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { ZmReportView } from './ZmReportView'

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    generateZmElster: vi.fn(),
  },
}))

describe('ZmReportView', () => {
  it('renders the title', () => {
    render(<ZmReportView />)
    expect(screen.getByText('Zusammenfassende Meldung (ZM)')).toBeInTheDocument()
  })

  it('renders year and quarter selectors', () => {
    render(<ZmReportView />)
    expect(screen.getByText('Jahr:')).toBeInTheDocument()
    expect(screen.getByText('Quartal:')).toBeInTheDocument()
  })

  it('renders the calculate button', () => {
    render(<ZmReportView />)
    expect(screen.getByRole('button', { name: /ZM berechnen/ })).toBeInTheDocument()
  })

  it('shows initial empty state', () => {
    render(<ZmReportView />)
    expect(screen.getByText(/Wählen Sie Jahr und Quartal/)).toBeInTheDocument()
  })
})
