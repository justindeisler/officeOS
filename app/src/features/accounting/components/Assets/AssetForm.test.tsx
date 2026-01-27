import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { AssetForm } from './AssetForm'
import { createMockAsset, createMockAssetByCategory } from '@/test/mocks/data/accounting'
import type { NewAsset, AssetCategory } from '../../types'
import { AFA_YEARS } from '../../types'

describe('AssetForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the form with create title when no asset provided', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/add asset/i)).toBeInTheDocument()
    })

    it('renders the form with edit title when asset provided', () => {
      const asset = createMockAsset()
      render(<AssetForm asset={asset} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/edit asset/i)).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/purchase date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/purchase price/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vat rate/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
    })

    it('renders optional fields', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
      // Inventory number shows auto-generate message in create mode
      expect(screen.getByText(/auto-generated on save/i)).toBeInTheDocument()
    })

    it('renders save and cancel buttons', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('form defaults', () => {
    it('defaults to current date for purchase date', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const dateInput = screen.getByLabelText(/purchase date/i) as HTMLInputElement
      const today = new Date().toISOString().split('T')[0]
      expect(dateInput.value).toBe(today)
    })

    it('defaults to 19% VAT rate', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Radix Select displays the selected value text
      expect(screen.getByRole('combobox', { name: /vat rate/i })).toHaveTextContent('19%')
    })

    it('defaults to computer category', () => {
      render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Radix Select displays the selected value text
      expect(screen.getByRole('combobox', { name: /category/i })).toHaveTextContent(/computer/i)
    })
  })

  describe('editing mode', () => {
    it('populates form fields with asset data', () => {
      const asset = createMockAsset({
        name: 'MacBook Pro 16"',
        description: 'Development laptop',
        vendor: 'Apple',
        purchasePrice: 2500,
        category: 'computer',
        location: 'Home Office',
        inventoryNumber: 'INV-001',
      })

      render(<AssetForm asset={asset} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/name/i)).toHaveValue('MacBook Pro 16"')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Development laptop')
      expect(screen.getByLabelText(/vendor/i)).toHaveValue('Apple')
      expect(screen.getByLabelText(/purchase price/i)).toHaveValue(2500)
      expect(screen.getByLabelText(/location/i)).toHaveValue('Home Office')
      // Inventory number is displayed as read-only text in edit mode
      expect(screen.getByText('INV-001')).toBeInTheDocument()
    })
  })

  describe('category and AfA years', () => {
    it('shows all asset categories', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      expect(categorySelect).toBeInTheDocument()

      // Open the dropdown to see all options
      await user.click(categorySelect)

      // Check all options are available (Radix uses role="option")
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /computer/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /phone/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /furniture/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /equipment/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /software/i })).toBeInTheDocument()
      })
    })

    it('auto-updates AfA years when category changes', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Set a price > €800 to see regular AfA (not immediate write-off)
      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '2000')

      // Default computer = 3 years - check the depreciation period text
      await waitFor(() => {
        expect(screen.getByText(/depreciation period: 3 years/i)).toBeInTheDocument()
      })

      // Change to furniture = 13 years via Radix Select
      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      await user.click(categorySelect)
      await user.click(screen.getByRole('option', { name: /furniture/i }))

      await waitFor(() => {
        expect(screen.getByText(/depreciation period: 13 years/i)).toBeInTheDocument()
      })
    })

    it('shows correct AfA years for each category', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Set a price > €800 to see regular AfA
      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '2000')

      // Test computer category (default)
      await waitFor(() => {
        expect(screen.getByText(/depreciation period: 3 years/i)).toBeInTheDocument()
      })

      // Test phone category
      const categorySelect = screen.getByRole('combobox', { name: /category/i })
      await user.click(categorySelect)
      await user.click(screen.getByRole('option', { name: /phone/i }))
      await waitFor(() => {
        expect(screen.getByText(/depreciation period: 5 years/i)).toBeInTheDocument()
      })
    })
  })

  describe('VAT calculation', () => {
    it('calculates VAT amount automatically', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '1000')

      // 19% VAT = 190
      await waitFor(() => {
        expect(screen.getByText('190,00 €')).toBeInTheDocument()
      })
    })

    it('calculates gross amount automatically', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '1000')

      // Gross = 1000 + 190 = 1190
      await waitFor(() => {
        expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
      })
    })

    it('recalculates when VAT rate changes', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '1000')

      // Change VAT rate via Radix Select
      const vatSelect = screen.getByRole('combobox', { name: /vat rate/i })
      await user.click(vatSelect)
      await user.click(screen.getByRole('option', { name: /7%/i }))

      // 7% VAT = 70, Gross = 1070
      await waitFor(() => {
        expect(screen.getByText('70,00 €')).toBeInTheDocument()
        expect(screen.getByText('1.070,00 €')).toBeInTheDocument()
      })
    })
  })

  describe('GWG detection', () => {
    it('shows immediate write-off for amounts ≤ €250', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '200')

      await waitFor(() => {
        // Badge shows "Immediate Write-off"
        const writeOffElements = screen.getAllByText(/immediate write-off/i)
        expect(writeOffElements.length).toBeGreaterThanOrEqual(1)
        // Check for description mentioning €250 and full expense
        expect(screen.getByText(/≤€250.*Full expense/i)).toBeInTheDocument()
      })
    })

    it('shows immediate write-off (GWG) for amounts €250-€800', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '500')

      await waitFor(() => {
        // Badge shows "Immediate Write-off"
        const writeOffElements = screen.getAllByText(/immediate write-off/i)
        expect(writeOffElements.length).toBeGreaterThanOrEqual(1)
        // Check for GWG description
        expect(screen.getByText(/≤€800 \(GWG\)/i)).toBeInTheDocument()
      })
    })

    it('shows pool method option for amounts €800-€1000', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '900')

      await waitFor(() => {
        expect(screen.getByText(/pool method/i)).toBeInTheDocument()
      })
    })

    it('shows regular AfA for amounts > €1000', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const priceInput = screen.getByLabelText(/purchase price/i)
      await user.clear(priceInput)
      await user.type(priceInput, '1500')

      await waitFor(() => {
        expect(screen.getByText(/regular afa/i)).toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('calls onSubmit with form data', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText(/name/i), 'MacBook Pro')
      await user.type(screen.getByLabelText(/vendor/i), 'Apple')
      await user.clear(screen.getByLabelText(/purchase price/i))
      await user.type(screen.getByLabelText(/purchase price/i), '2500')

      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'MacBook Pro',
            vendor: 'Apple',
            purchasePrice: 2500,
            category: 'computer',
            vatRate: 19,
          })
        )
      })
    })

    it('calls onCancel when cancel button clicked', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('shows loading state during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText(/name/i), 'Test Asset')
      await user.clear(screen.getByLabelText(/purchase price/i))
      await user.type(screen.getByLabelText(/purchase price/i), '1000')

      await user.click(screen.getByRole('button', { name: /save/i }))

      // Button should be disabled during submission
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    })
  })

  describe('validation', () => {
    it('shows error when name is empty', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      })
    })

    it('shows error when purchase price is zero', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText(/name/i), 'Test Asset')
      await user.clear(screen.getByLabelText(/purchase price/i))
      await user.type(screen.getByLabelText(/purchase price/i), '0')

      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument()
      })
    })

    it('does not allow negative purchase price', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText(/name/i), 'Test Asset')

      // Input type=number with min=0 prevents negative values in most browsers
      // Just verify the input has the min attribute
      const priceInput = screen.getByLabelText(/purchase price/i)
      expect(priceInput).toHaveAttribute('min', '0')
    })
  })

  describe('annual AfA amount display', () => {
    it('shows annual depreciation amount', async () => {
      const { user } = render(<AssetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.clear(screen.getByLabelText(/purchase price/i))
      await user.type(screen.getByLabelText(/purchase price/i), '3000')

      // Computer (3 years) = 3000/3 = 1000/year
      await waitFor(() => {
        expect(screen.getByText(/1\.000.*\/year/i)).toBeInTheDocument()
      })
    })
  })
})
