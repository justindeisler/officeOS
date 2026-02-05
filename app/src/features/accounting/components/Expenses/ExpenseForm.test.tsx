import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { ExpenseForm, calculateFromNet, calculateFromGross } from './ExpenseForm'
import { createMockExpense, createMockRecurringExpense } from '@/test/mocks/data/accounting'

describe('ExpenseForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders form title for new expense', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      expect(screen.getByText(/add expense/i)).toBeInTheDocument()
    })

    it('renders form title for editing expense', () => {
      const expense = createMockExpense()
      render(
        <ExpenseForm expense={expense} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      expect(screen.getByText(/edit expense/i)).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/net amount \(€\)/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vat rate/i)).toBeInTheDocument()
    })

    it('renders net/gross toggle with net selected by default', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      const netButton = screen.getByRole('radio', { name: /net amount/i })
      const grossButton = screen.getByRole('radio', { name: /gross amount/i })
      expect(netButton).toHaveAttribute('aria-checked', 'true')
      expect(grossButton).toHaveAttribute('aria-checked', 'false')
    })

    it('renders VAT rate options', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      const vatSelect = screen.getByLabelText(/vat rate/i)
      expect(vatSelect).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '19%' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '7%' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '0%' })).toBeInTheDocument()
    })

    it('renders submit and cancel buttons', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('renders EÜR category selector with expense categories', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      const categorySelect = screen.getByLabelText(/category/i)
      expect(categorySelect).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /software/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /telekommunikation/i })).toBeInTheDocument()
    })

    it('renders deductible percentage field', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      expect(screen.getByLabelText(/deductible/i)).toBeInTheDocument()
    })

    it('renders recurring expense toggle', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)
      expect(screen.getByLabelText(/recurring/i)).toBeInTheDocument()
    })
  })

  describe('net/gross toggle', () => {
    it('switches to gross mode when gross button clicked', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const grossButton = screen.getByRole('radio', { name: /gross amount/i })
      await user.click(grossButton)
      expect(grossButton).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('radio', { name: /net amount/i })).toHaveAttribute('aria-checked', 'false')
    })

    it('changes input label when toggling to gross mode', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      // Default: Net Amount label
      expect(screen.getByLabelText(/net amount \(€\)/i)).toBeInTheDocument()
      // Switch to gross
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      expect(screen.getByLabelText(/gross amount \(€\)/i)).toBeInTheDocument()
    })

    it('converts amount when switching from net to gross', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const amountInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(amountInput)
      await user.type(amountInput, '100')
      // Switch to gross - should show 119 (100 + 19% VAT)
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      const grossInput = screen.getByLabelText(/gross amount \(€\)/i)
      expect(grossInput).toHaveValue(119)
    })

    it('converts amount when switching from gross to net', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      // Switch to gross first
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      const amountInput = screen.getByLabelText(/gross amount \(€\)/i)
      await user.clear(amountInput)
      await user.type(amountInput, '119')
      // Switch back to net - should show 100
      await user.click(screen.getByRole('radio', { name: /net amount/i }))
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      expect(netInput).toHaveValue(100)
    })
  })

  describe('pre-filling', () => {
    it('pre-fills form when editing existing expense', () => {
      const expense = createMockExpense({
        vendor: 'Adobe Systems',
        description: 'Creative Cloud Subscription',
        netAmount: 500,
        vatRate: 19,
      })
      render(
        <ExpenseForm expense={expense} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      expect(screen.getByLabelText(/vendor/i)).toHaveValue('Adobe Systems')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Creative Cloud Subscription')
      expect(screen.getByLabelText(/net amount \(€\)/i)).toHaveValue(500)
      expect(screen.getByLabelText(/vat rate/i)).toHaveValue('19')
    })

    it('pre-fills recurring settings when editing recurring expense', () => {
      const expense = createMockRecurringExpense('monthly', {
        vendor: 'Spotify',
        description: 'Music Subscription',
      })
      render(
        <ExpenseForm expense={expense} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      expect(screen.getByLabelText(/recurring/i)).toBeChecked()
      expect(screen.getByLabelText(/frequency/i)).toHaveValue('monthly')
    })
  })

  describe('VAT calculation', () => {
    it('calculates Vorsteuer amount automatically (net mode)', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')
      await waitFor(() => {
        expect(screen.getByText('190,00 €')).toBeInTheDocument()
      })
    })

    it('reverse-calculates net from gross amount', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      const grossInput = screen.getByLabelText(/gross amount \(€\)/i)
      await user.clear(grossInput)
      await user.type(grossInput, '119')
      await waitFor(() => {
        expect(screen.getByText('100,00 €')).toBeInTheDocument()
        expect(screen.getByText('19,00 €')).toBeInTheDocument()
      })
    })

    it('updates calculation when VAT rate changes', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')
      const vatSelect = screen.getByLabelText(/vat rate/i)
      await user.selectOptions(vatSelect, '7')
      await waitFor(() => {
        expect(screen.getByText('70,00 €')).toBeInTheDocument()
      })
    })

    it('shows gross amount', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')
      await waitFor(() => {
        expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
      })
    })

    it('handles 0% VAT rate correctly', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '500')
      const vatSelect = screen.getByLabelText(/vat rate/i)
      await user.selectOptions(vatSelect, '0')
      // 0% VAT: vat = 0
      await waitFor(() => {
        expect(screen.getByText('0,00 €')).toBeInTheDocument()
      })
    })
  })

  describe('validation', () => {
    it('shows error for empty vendor', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText(/vendor is required/i)).toBeInTheDocument()
      })
    })

    it('shows error for empty description', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText(/description is required/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid amount', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')
      const amountInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(amountInput)
      await user.type(amountInput, '0')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText(/must be positive|greater than 0/i)).toBeInTheDocument()
      })
    })

    it('validates deductible percentage is 0-100', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '100')
      const deductibleInput = screen.getByLabelText(/deductible/i)
      await user.clear(deductibleInput)
      await user.type(deductibleInput, '150')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText(/must be between 0 and 100|at most 100|less than or equal to 100|100/i)).toBeInTheDocument()
      })
    })
  })

  describe('GWG detection', () => {
    it('shows GWG indicator for amounts between €250-800', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '500')
      await waitFor(() => {
        expect(screen.getByText(/gwg/i)).toBeInTheDocument()
      })
    })

    it('does not show GWG indicator for amounts below €250', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '200')
      await waitFor(() => {
        expect(screen.queryByText(/gwg/i)).not.toBeInTheDocument()
      })
    })

    it('shows asset warning for amounts above €800', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '1500')
      await waitFor(() => {
        expect(screen.getByText(/asset|depreciation|afa/i)).toBeInTheDocument()
      })
    })

    it('detects GWG correctly in gross mode', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      const grossInput = screen.getByLabelText(/gross amount \(€\)/i)
      await user.clear(grossInput)
      // 595 gross @ 19% = 500 net (GWG range)
      await user.type(grossInput, '595')
      await waitFor(() => {
        expect(screen.getByText(/gwg/i)).toBeInTheDocument()
      })
    })
  })

  describe('recurring expense', () => {
    it('shows frequency selector when recurring is enabled', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      expect(screen.queryByLabelText(/frequency/i)).not.toBeInTheDocument()
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })
    })

    it('hides frequency selector when recurring is disabled', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })
      await user.click(recurringToggle)
      await waitFor(() => {
        expect(screen.queryByLabelText(/frequency/i)).not.toBeInTheDocument()
      })
    })

    it('provides monthly, quarterly, yearly frequency options', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })
      expect(screen.getByRole('option', { name: /monthly/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /quarterly/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /yearly/i })).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('calls onSubmit with net amount in net mode', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const dateInput = screen.getByLabelText(/date/i)
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-15')
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test Expense')
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            vendor: 'Test Vendor',
            description: 'Test Expense',
            netAmount: 1000,
            vatRate: 19,
          })
        )
      })
    })

    it('calls onSubmit with calculated net amount in gross mode', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      // Switch to gross mode
      await user.click(screen.getByRole('radio', { name: /gross amount/i }))
      const dateInput = screen.getByLabelText(/date/i)
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-15')
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test Expense')
      const grossInput = screen.getByLabelText(/gross amount \(€\)/i)
      await user.clear(grossInput)
      await user.type(grossInput, '119')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            vendor: 'Test Vendor',
            description: 'Test Expense',
            netAmount: 100, // 119 / 1.19 = 100
            vatRate: 19,
          })
        )
      })
    })

    it('calls onSubmit with updated data for existing expense', async () => {
      const expense = createMockExpense({
        vendor: 'Original Vendor',
        description: 'Original Description',
        netAmount: 500,
      })
      const { user } = render(
        <ExpenseForm expense={expense} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.clear(vendorInput)
      await user.type(vendorInput, 'Updated Vendor')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ vendor: 'Updated Vendor' })
        )
      })
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('includes recurring data in submission', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Netflix')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Streaming Subscription')
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '15')
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })
      const frequencySelect = screen.getByLabelText(/frequency/i)
      await user.selectOptions(frequencySelect, 'monthly')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            isRecurring: true,
            recurringFrequency: 'monthly',
          })
        )
      })
    })
  })

  describe('loading state', () => {
    it('disables form during submission', async () => {
      let resolveSubmit: () => void
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve })
      )
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test')
      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')
      const netInput = screen.getByLabelText(/net amount \(€\)/i)
      await user.clear(netInput)
      await user.type(netInput, '100')
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
      resolveSubmit!()
    })
  })
})

// ============================================================================
// Unit tests for VAT calculation utilities
// ============================================================================

describe('calculateFromNet', () => {
  it('calculates correctly at 19%', () => {
    const result = calculateFromNet(100, 19)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(19)
    expect(result.gross).toBe(119)
  })

  it('calculates correctly at 7%', () => {
    const result = calculateFromNet(100, 7)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(7)
    expect(result.gross).toBe(107)
  })

  it('calculates correctly at 0%', () => {
    const result = calculateFromNet(100, 0)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(0)
    expect(result.gross).toBe(100)
  })

  it('handles small amounts without rounding errors', () => {
    const result = calculateFromNet(0.01, 19)
    expect(result.net).toBe(0.01)
    expect(result.vat).toBe(0)
    expect(result.gross).toBe(0.01)
  })

  it('rounds to 2 decimal places', () => {
    const result = calculateFromNet(33.33, 19)
    expect(result.vat).toBe(6.33)
    expect(result.gross).toBe(39.66)
  })
})

describe('calculateFromGross', () => {
  it('reverse-calculates correctly at 19%', () => {
    const result = calculateFromGross(119, 19)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(19)
    expect(result.gross).toBe(119)
  })

  it('reverse-calculates correctly at 7%', () => {
    const result = calculateFromGross(107, 7)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(7)
    expect(result.gross).toBe(107)
  })

  it('reverse-calculates correctly at 0%', () => {
    const result = calculateFromGross(100, 0)
    expect(result.net).toBe(100)
    expect(result.vat).toBe(0)
    expect(result.gross).toBe(100)
  })

  it('handles small amounts', () => {
    const result = calculateFromGross(0.01, 19)
    expect(result.net).toBe(0.01)
    expect(result.vat).toBe(0)
    expect(result.gross).toBe(0.01)
  })

  it('rounds to 2 decimal places', () => {
    const result = calculateFromGross(39.66, 19)
    expect(result.net).toBe(33.33)
    expect(result.vat).toBe(6.33)
  })

  it('net + vat equals gross for various amounts', () => {
    const amounts = [1, 10, 50, 99.99, 119, 1000, 12345.67]
    const rates = [0, 7, 19]

    for (const amount of amounts) {
      for (const rate of rates) {
        const result = calculateFromGross(amount, rate)
        // Allow tiny floating point rounding (max 1 cent)
        expect(Math.abs(result.net + result.vat - result.gross)).toBeLessThanOrEqual(0.01)
      }
    }
  })
})
