import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { InvoiceNumberPreview } from './InvoiceNumberPreview'

describe('InvoiceNumberPreview', () => {
  const mockOnAccept = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the next invoice number', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText('RE-2026-003')).toBeInTheDocument()
  })

  it('auto-detects year-based pattern', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText(/based on pattern RE-YYYY-NNN/i)).toBeInTheDocument()
  })

  it('auto-detects sequential pattern', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="INV-042"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText(/based on pattern INV-NNN/i)).toBeInTheDocument()
  })

  it('uses custom pattern when provided', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        pattern="RE-YYYY-SEQ"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText(/based on pattern RE-YYYY-SEQ/i)).toBeInTheDocument()
  })

  it('calls onAccept when "Use this number" button is clicked', async () => {
    const { user } = render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
      />
    )

    await user.click(screen.getByTestId('invoice-number-accept'))
    expect(mockOnAccept).toHaveBeenCalledTimes(1)
  })

  it('shows "Applied" state when accepted', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
        accepted
      />
    )
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.getByTestId('invoice-number-accept')).toBeDisabled()
  })

  it('shows "Use this number" when not accepted', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
        accepted={false}
      />
    )
    expect(screen.getByText('Use this number')).toBeInTheDocument()
    expect(screen.getByTestId('invoice-number-accept')).not.toBeDisabled()
  })

  it('renders nothing when nextNumber is empty', () => {
    const { container } = render(
      <InvoiceNumberPreview
        nextNumber=""
        onAccept={mockOnAccept}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('has correct aria label for accessibility', () => {
    render(
      <InvoiceNumberPreview
        nextNumber="RE-2026-003"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Next invoice number: RE-2026-003'
    )
  })
})
