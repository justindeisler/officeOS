import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { ElsterSubmissionWizard } from './ElsterSubmissionWizard'

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    validateUstVaElster: vi.fn(),
    generateUstVaElster: vi.fn(),
    updateElsterSubmissionStatus: vi.fn(),
  },
}))

describe('ElsterSubmissionWizard', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    year: 2024,
    quarter: 1 as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog title', () => {
    render(<ElsterSubmissionWizard {...defaultProps} />)
    expect(screen.getByText('ELSTER USt-VA Export')).toBeInTheDocument()
  })

  it('shows period label', () => {
    render(<ElsterSubmissionWizard {...defaultProps} />)
    expect(screen.getAllByText(/Q1 2024/).length).toBeGreaterThan(0)
  })

  it('renders wizard step tabs', () => {
    render(<ElsterSubmissionWizard {...defaultProps} />)
    expect(screen.getByText('Prüfen')).toBeInTheDocument()
    expect(screen.getByText('Validieren')).toBeInTheDocument()
    expect(screen.getByText('Generieren')).toBeInTheDocument()
    expect(screen.getByText('Bestätigen')).toBeInTheDocument()
  })

  it('shows "Daten prüfen" button on review step', () => {
    render(<ElsterSubmissionWizard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Daten prüfen/ })).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(<ElsterSubmissionWizard {...defaultProps} open={false} />)
    expect(screen.queryByText('ELSTER USt-VA Export')).not.toBeInTheDocument()
  })

  it('renders with Q3 2025', () => {
    render(<ElsterSubmissionWizard {...defaultProps} year={2025} quarter={3} />)
    expect(screen.getAllByText(/Q3 2025/).length).toBeGreaterThan(0)
  })
})
