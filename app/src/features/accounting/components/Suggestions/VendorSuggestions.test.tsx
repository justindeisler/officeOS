import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { VendorSuggestions } from './VendorSuggestions'
import type { VendorSuggestion } from '../../api/suggestions'

const mockVendors: VendorSuggestion[] = [
  { vendor: 'Deutsche Telekom', count: 12, lastAmount: 49.99 },
  { vendor: 'Amazon Web Services', count: 8, lastAmount: 129.0 },
  { vendor: 'Adobe', count: 5, lastAmount: 59.49 },
]

describe('VendorSuggestions', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders vendor input field', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )
    expect(screen.getByTestId('vendor-input')).toBeInTheDocument()
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument()
  })

  it('renders the suggestions trigger button when vendors are available', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )
    expect(screen.getByTestId('vendor-suggestions-trigger')).toBeInTheDocument()
  })

  it('does not render suggestions trigger when no vendors', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={[]}
      />
    )
    expect(screen.queryByTestId('vendor-suggestions-trigger')).not.toBeInTheDocument()
  })

  it('shows the selected vendor value in input', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        selectedVendor="Deutsche Telekom"
        vendors={mockVendors}
      />
    )
    expect(screen.getByTestId('vendor-input')).toHaveValue('Deutsche Telekom')
  })

  it('calls onSelect when input value changes', async () => {
    const { user } = render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )

    const input = screen.getByTestId('vendor-input')
    await user.clear(input)
    await user.type(input, 'New Vendor')

    // onSelect should have been called for each character typed
    expect(mockOnSelect).toHaveBeenCalled()
  })

  it('renders error message when error is provided', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
        error="Vendor is required"
      />
    )
    expect(screen.getByText('Vendor is required')).toBeInTheDocument()
  })

  it('marks input as invalid when error is provided', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
        error="Vendor is required"
      />
    )
    expect(screen.getByTestId('vendor-input')).toHaveAttribute('aria-invalid', 'true')
  })

  it('supports custom label text', () => {
    render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
        label="Supplier"
      />
    )
    expect(screen.getByText('Supplier')).toBeInTheDocument()
  })

  it('opens dropdown when trigger button is clicked', async () => {
    const { user } = render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )

    await user.click(screen.getByTestId('vendor-suggestions-trigger'))

    // The popover should open and show vendor options
    expect(screen.getByText('Recent Vendors')).toBeInTheDocument()
  })

  it('shows vendor names with frequency badges in dropdown', async () => {
    const { user } = render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )

    await user.click(screen.getByTestId('vendor-suggestions-trigger'))

    expect(screen.getByText('Deutsche Telekom')).toBeInTheDocument()
    expect(screen.getByText('12×')).toBeInTheDocument()
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument()
    expect(screen.getByText('8×')).toBeInTheDocument()
  })

  it('shows last amount for vendors in dropdown', async () => {
    const { user } = render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )

    await user.click(screen.getByTestId('vendor-suggestions-trigger'))

    // Amounts formatted as German currency
    expect(screen.getByText('49,99 €')).toBeInTheDocument()
    expect(screen.getByText('129,00 €')).toBeInTheDocument()
  })

  it('calls onSelect and closes dropdown when a vendor is selected', async () => {
    const { user } = render(
      <VendorSuggestions
        onSelect={mockOnSelect}
        vendors={mockVendors}
      />
    )

    await user.click(screen.getByTestId('vendor-suggestions-trigger'))
    await user.click(screen.getByTestId('vendor-option-Deutsche Telekom'))

    expect(mockOnSelect).toHaveBeenCalledWith('Deutsche Telekom')
  })
})
