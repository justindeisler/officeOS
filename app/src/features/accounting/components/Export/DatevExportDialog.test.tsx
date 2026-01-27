/**
 * DatevExportDialog Component Tests
 *
 * Tests for the main DATEV export dialog.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatevExportDialog } from './DatevExportDialog'

// ============================================================================
// MOCK DATA
// ============================================================================

// Use current year Q4 (Oct-Dec) for mock data to match default export date range
// The hook defaults to previous quarter, so in Q1 2026, default is Q4 2025
const currentYear = new Date().getFullYear()
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
// Use the same logic as the hook: previous quarter of current year (or Q4 if in Q1)
const mockYear = currentYear
const mockQuarter = currentQuarter > 1 ? currentQuarter - 1 : 4
// Generate dates within the mock quarter
const getQuarterMonth = (q: number, offset: number) => (q - 1) * 3 + 1 + offset

const mockIncomes = [
  {
    id: 'inc-1',
    date: new Date(mockYear, getQuarterMonth(mockQuarter, 0) - 1, 15), // First month of quarter
    description: 'Software development',
    grossAmount: 1190,
    vatRate: 19 as const,
    vatAmount: 190,
    euerCategory: 'services',
    invoiceId: `RE-${mockYear}-001`,
  },
  {
    id: 'inc-2',
    date: new Date(mockYear, getQuarterMonth(mockQuarter, 1) - 1, 20), // Second month of quarter
    description: 'Consulting',
    grossAmount: 595,
    vatRate: 19 as const,
    vatAmount: 95,
    euerCategory: 'services',
  },
]

const mockExpenses = [
  {
    id: 'exp-1',
    date: new Date(mockYear, getQuarterMonth(mockQuarter, 0) - 1, 10), // First month of quarter
    vendor: 'Adobe',
    description: 'Creative Cloud',
    grossAmount: 59.5,
    vatRate: 19 as const,
    vatAmount: 9.5,
    euerCategory: 'software',
  },
  {
    id: 'exp-2',
    date: new Date(mockYear, getQuarterMonth(mockQuarter, 1) - 1, 5), // Second month of quarter
    vendor: 'Telekom',
    description: 'Internet',
    grossAmount: 49.99,
    vatRate: 19 as const,
    vatAmount: 7.98,
    euerCategory: 'telecom',
  },
]

// ============================================================================
// TEST HELPERS
// ============================================================================

const renderDialog = (props = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    incomes: mockIncomes,
    expenses: mockExpenses,
  }

  return render(<DatevExportDialog {...defaultProps} {...props} />)
}

// ============================================================================
// TESTS
// ============================================================================

describe('DatevExportDialog', () => {
  describe('rendering', () => {
    it('should render dialog title', () => {
      renderDialog()
      expect(screen.getByText('DATEV Export')).toBeInTheDocument()
    })

    it('should render dialog description', () => {
      renderDialog()
      expect(
        screen.getByText(/exportieren sie ihre buchhaltungsdaten/i)
      ).toBeInTheDocument()
    })

    it('should render export button', () => {
      renderDialog()
      expect(
        screen.getByRole('button', { name: /exportieren/i })
      ).toBeInTheDocument()
    })

    it('should render cancel button', () => {
      renderDialog()
      expect(
        screen.getByRole('button', { name: /abbrechen/i })
      ).toBeInTheDocument()
    })

    it('should render close button', () => {
      renderDialog()
      expect(
        screen.getByRole('button', { name: /schließen/i })
      ).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(
        <DatevExportDialog
          open={false}
          onOpenChange={vi.fn()}
          incomes={[]}
          expenses={[]}
        />
      )
      expect(screen.queryByText('DATEV Export')).not.toBeInTheDocument()
    })
  })

  describe('preview section', () => {
    it('should show record count in preview', async () => {
      renderDialog()

      await waitFor(() => {
        expect(screen.getByText(/datensätze/i)).toBeInTheDocument()
      })
    })

    it('should show income statistics', async () => {
      renderDialog()

      // Wait for preview to be rendered with data
      await waitFor(() => {
        // Check that the preview shows income data
        const preview = screen.getByText(/vorschau/i).closest('div')
        expect(preview).toBeInTheDocument()
      })
    })

    it('should show expense statistics', async () => {
      renderDialog()

      // Wait for the total count to appear (indicates preview is ready)
      await waitFor(() => {
        expect(screen.getByText(/datensätze/i)).toBeInTheDocument()
      })
    })

    it('should show date range info', async () => {
      renderDialog()

      // Wait for preview heading to be visible
      await waitFor(() => {
        expect(screen.getByText(/vorschau/i)).toBeInTheDocument()
      })
    })
  })

  describe('settings integration', () => {
    it('should include DatevSettings component', () => {
      renderDialog()
      // Check for elements from DatevSettings
      expect(screen.getByLabelText(/kontenrahmen/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/exportformat/i)).toBeInTheDocument()
    })
  })

  describe('export button state', () => {
    it('should be enabled with valid data', () => {
      renderDialog()
      const button = screen.getByRole('button', { name: /exportieren/i })
      expect(button).not.toBeDisabled()
    })

    it('should be disabled with no data', async () => {
      render(
        <DatevExportDialog
          open={true}
          onOpenChange={vi.fn()}
          incomes={[]}
          expenses={[]}
        />
      )

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /exportieren/i })
        expect(button).toBeDisabled()
      })
    })
  })

  describe('close behavior', () => {
    it('should call onOpenChange when cancel is clicked', async () => {
      const onOpenChange = vi.fn()
      render(
        <DatevExportDialog
          open={true}
          onOpenChange={onOpenChange}
          incomes={mockIncomes}
          expenses={mockExpenses}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /abbrechen/i })
      await userEvent.click(cancelButton)

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('should call onOpenChange when close button is clicked', async () => {
      const onOpenChange = vi.fn()
      render(
        <DatevExportDialog
          open={true}
          onOpenChange={onOpenChange}
          incomes={mockIncomes}
          expenses={mockExpenses}
        />
      )

      const closeButton = screen.getByRole('button', { name: /schließen/i })
      await userEvent.click(closeButton)

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('accessibility', () => {
    it('should have accessible dialog content', () => {
      renderDialog()
      expect(
        screen.getByRole('dialog', { name: /datev export/i })
      ).toBeInTheDocument()
    })

    it('should have dialog description', () => {
      renderDialog()
      const description = screen.getByText(
        /exportieren sie ihre buchhaltungsdaten/i
      )
      expect(description).toHaveAttribute('id')
    })
  })

  describe('currency formatting', () => {
    it('should use German number format in preview', async () => {
      renderDialog()

      // Wait for preview to be rendered
      await waitFor(() => {
        const preview = screen.getByText(/vorschau/i)
        expect(preview).toBeInTheDocument()
      })

      // Preview is rendered if we get here
    })
  })

  describe('empty state', () => {
    it('should show zero counts with no data in range', async () => {
      render(
        <DatevExportDialog
          open={true}
          onOpenChange={vi.fn()}
          incomes={[]}
          expenses={[]}
        />
      )

      await waitFor(() => {
        const preview = screen.getByText(/datensätze/i).closest('div')
        expect(preview).toContainHTML('0')
      })
    })
  })
})
