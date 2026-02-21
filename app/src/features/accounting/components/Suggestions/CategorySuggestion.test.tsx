import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { CategorySuggestion } from './CategorySuggestion'

describe('CategorySuggestion', () => {
  const mockOnAccept = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the suggestion with category label', () => {
    render(
      <CategorySuggestion
        category="telecom"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText('Telekommunikation')).toBeInTheDocument()
    expect(screen.getByText(/suggested/i)).toBeInTheDocument()
  })

  it('shows confidence percentage when provided', () => {
    render(
      <CategorySuggestion
        category="software"
        confidence={0.95}
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText(/95% match/)).toBeInTheDocument()
  })

  it('does not show confidence when not provided', () => {
    render(
      <CategorySuggestion
        category="software"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.queryByText(/match/)).not.toBeInTheDocument()
  })

  it('calls onAccept when Apply button is clicked', async () => {
    const { user } = render(
      <CategorySuggestion
        category="telecom"
        confidence={0.9}
        onAccept={mockOnAccept}
      />
    )

    await user.click(screen.getByTestId('category-suggestion-accept'))
    expect(mockOnAccept).toHaveBeenCalledTimes(1)
  })

  it('renders dismiss button when onDismiss is provided', () => {
    render(
      <CategorySuggestion
        category="software"
        onAccept={mockOnAccept}
        onDismiss={mockOnDismiss}
      />
    )
    expect(screen.getByTestId('category-suggestion-dismiss')).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const { user } = render(
      <CategorySuggestion
        category="software"
        onAccept={mockOnAccept}
        onDismiss={mockOnDismiss}
      />
    )

    await user.click(screen.getByTestId('category-suggestion-dismiss'))
    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(
      <CategorySuggestion
        category="software"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.queryByTestId('category-suggestion-dismiss')).not.toBeInTheDocument()
  })

  it('falls back to raw category key for unknown categories', () => {
    render(
      <CategorySuggestion
        category="unknown_category"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText('unknown_category')).toBeInTheDocument()
  })

  it('has correct aria label for accessibility', () => {
    render(
      <CategorySuggestion
        category="telecom"
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Suggested category: Telekommunikation'
    )
  })

  it('rounds confidence to nearest integer', () => {
    render(
      <CategorySuggestion
        category="software"
        confidence={0.876}
        onAccept={mockOnAccept}
      />
    )
    expect(screen.getByText(/88% match/)).toBeInTheDocument()
  })
})
