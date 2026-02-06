import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { IncomeForm } from './IncomeForm'
import { createMockIncome } from '@/test/mocks/data/accounting'
import type { Income, NewIncome } from '../../types'

describe('IncomeForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders form title for new income', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/add income/i)).toBeInTheDocument()
    })

    it('renders form title for editing income', () => {
      const income = createMockIncome()
      render(
        <IncomeForm
          income={income}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/edit income/i)).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/net amount/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vat rate/i)).toBeInTheDocument()
    })

    it('renders VAT rate options', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const vatSelect = screen.getByLabelText(/vat rate/i)
      expect(vatSelect).toBeInTheDocument()

      // Check for VAT rate options
      expect(screen.getByRole('option', { name: '19%' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '7%' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '0%' })).toBeInTheDocument()
    })

    it('renders submit and cancel buttons', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('pre-filling', () => {
    it('pre-fills form when editing existing income', () => {
      const income = createMockIncome({
        description: 'Consulting Project',
        netAmount: 5000,
        vatRate: 19,
      })

      render(
        <IncomeForm
          income={income}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/description/i)).toHaveValue('Consulting Project')
      expect(screen.getByLabelText(/net amount/i)).toHaveValue(5000)
      expect(screen.getByLabelText(/vat rate/i)).toHaveValue('19')
    })
  })

  describe('VAT calculation', () => {
    it('calculates VAT amount automatically', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      // VAT at 19% = 190.00 € (German currency format)
      await waitFor(() => {
        expect(screen.getByText('190,00 €')).toBeInTheDocument()
      })
    })

    it('updates calculation when VAT rate changes', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      const vatSelect = screen.getByLabelText(/vat rate/i)
      await user.selectOptions(vatSelect, '7')

      // VAT at 7% = 70.00 €
      await waitFor(() => {
        expect(screen.getByText('70,00 €')).toBeInTheDocument()
      })
    })

    it('shows gross amount', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
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
    it('shows error for empty description', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/description is required/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid net amount', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test')

      // Leave net amount as 0 (default) - 0 is not positive
      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '0')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        // Zod validation message for .positive() - "Amount must be positive"
        expect(screen.getByText(/must be positive|greater than 0/i)).toBeInTheDocument()
      })
    })

    it('shows error for missing date', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const dateInput = screen.getByLabelText(/date/i)
      await user.clear(dateInput)

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/date is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('submission', () => {
    it('calls onSubmit with form data for new income', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill the form
      const dateInput = screen.getByLabelText(/date/i)
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-15')

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Test Income')

      const netInput = screen.getByLabelText(/net amount/i)
      await user.clear(netInput)
      await user.type(netInput, '1000')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test Income',
            netAmount: 1000,
            vatRate: 19,
          })
        )
      })
    })

    it('calls onSubmit with updated data for existing income', async () => {
      const income = createMockIncome({
        description: 'Original Description',
        netAmount: 500,
      })

      const { user } = render(
        <IncomeForm
          income={income}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Update description
      const descInput = screen.getByLabelText(/description/i)
      await user.clear(descInput)
      await user.type(descInput, 'Updated Description')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Updated Description',
          })
        )
      })
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('EÜR category', () => {
    it('renders EÜR category selector', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    })

    it('defaults to services category', () => {
      render(<IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const categorySelect = screen.getByLabelText(/category/i)
      expect(categorySelect).toHaveValue('services')
    })
  })

  describe('loading state', () => {
    it('disables form during submission', async () => {
      let resolveSubmit: (value?: unknown) => void
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve })
      )

      const { user } = render(
        <IncomeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill minimum required fields (date already has default value)
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
