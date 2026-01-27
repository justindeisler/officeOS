import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { ExpenseForm } from './ExpenseForm'
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
        <ExpenseForm
          expense={expense}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/edit expense/i)).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(<ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vat rate/i)).toBeInTheDocument()
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

      // Check for some expense categories (German labels)
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

  describe('pre-filling', () => {
    it('pre-fills form when editing existing expense', () => {
      const expense = createMockExpense({
        vendor: 'Adobe Systems',
        description: 'Creative Cloud Subscription',
        netAmount: 500,
        vatRate: 19,
      })

      render(
        <ExpenseForm
          expense={expense}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/vendor/i)).toHaveValue('Adobe Systems')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Creative Cloud Subscription')
      expect(screen.getByLabelText(/net amount/i)).toHaveValue(500)
      expect(screen.getByLabelText(/vat rate/i)).toHaveValue('19')
    })

    it('pre-fills recurring settings when editing recurring expense', () => {
      const expense = createMockRecurringExpense('monthly', {
        vendor: 'Spotify',
        description: 'Music Subscription',
      })

      render(
        <ExpenseForm
          expense={expense}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Recurring toggle should be checked
      expect(screen.getByLabelText(/recurring/i)).toBeChecked()
      // Frequency selector should be visible and set to monthly
      expect(screen.getByLabelText(/frequency/i)).toHaveValue('monthly')
    })
  })

  describe('VAT calculation', () => {
    it('calculates Vorsteuer amount automatically', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      // Vorsteuer at 19% = 190.00 € (German currency format)
      await waitFor(() => {
        expect(screen.getByText('190,00 €')).toBeInTheDocument()
      })
    })

    it('updates calculation when VAT rate changes', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      const vatSelect = screen.getByLabelText(/vat rate/i)
      await user.selectOptions(vatSelect, '7')

      // Vorsteuer at 7% = 70.00 €
      await waitFor(() => {
        expect(screen.getByText('70,00 €')).toBeInTheDocument()
      })
    })

    it('shows gross amount', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      // Gross at 19% = 1190.00 €
      await waitFor(() => {
        expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
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

    it('shows error for invalid net amount', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '0')

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

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '100')

      const deductibleInput = screen.getByLabelText(/deductible/i)
      await user.clear(deductibleInput)
      await user.type(deductibleInput, '150')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        // Match various possible Zod error formats
        expect(screen.getByText(/must be between 0 and 100|at most 100|less than or equal to 100|100/i)).toBeInTheDocument()
      })
    })
  })

  describe('GWG detection', () => {
    it('shows GWG indicator for amounts between €250-800', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
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

      const netInput = screen.getByLabelText(/net amount/i)
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

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1500')

      await waitFor(() => {
        expect(screen.getByText(/asset|depreciation|afa/i)).toBeInTheDocument()
      })
    })
  })

  describe('recurring expense', () => {
    it('shows frequency selector when recurring is enabled', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Initially, frequency selector should not be visible
      expect(screen.queryByLabelText(/frequency/i)).not.toBeInTheDocument()

      // Enable recurring
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)

      // Frequency selector should now be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })
    })

    it('hides frequency selector when recurring is disabled', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Enable recurring
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)

      // Frequency selector should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })

      // Disable recurring
      await user.click(recurringToggle)

      // Frequency selector should be hidden
      await waitFor(() => {
        expect(screen.queryByLabelText(/frequency/i)).not.toBeInTheDocument()
      })
    })

    it('provides monthly, quarterly, yearly frequency options', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Enable recurring
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)

      await waitFor(() => {
        const frequencySelect = screen.getByLabelText(/frequency/i)
        expect(frequencySelect).toBeInTheDocument()
      })

      expect(screen.getByRole('option', { name: /monthly/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /quarterly/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /yearly/i })).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('calls onSubmit with form data for new expense', async () => {
      const { user } = render(
        <ExpenseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill the form
      const dateInput = screen.getByLabelText(/date/i)
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-15')

      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test Vendor')

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test Expense')

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      // Submit
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

    it('calls onSubmit with updated data for existing expense', async () => {
      const expense = createMockExpense({
        vendor: 'Original Vendor',
        description: 'Original Description',
        netAmount: 500,
      })

      const { user } = render(
        <ExpenseForm
          expense={expense}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Update vendor
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.clear(vendorInput)
      await user.type(vendorInput, 'Updated Vendor')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            vendor: 'Updated Vendor',
          })
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

      // Fill required fields
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Netflix')

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Streaming Subscription')

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '15')

      // Enable recurring and set frequency
      const recurringToggle = screen.getByLabelText(/recurring/i)
      await user.click(recurringToggle)

      await waitFor(() => {
        expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument()
      })

      const frequencySelect = screen.getByLabelText(/frequency/i)
      await user.selectOptions(frequencySelect, 'monthly')

      // Submit
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

      // Fill minimum required fields
      const vendorInput = screen.getByLabelText(/vendor/i)
      await user.type(vendorInput, 'Test')

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '100')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      // Button should show loading state (disabled)
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Cleanup - resolve the pending promise
      resolveSubmit!()
    })
  })
})
