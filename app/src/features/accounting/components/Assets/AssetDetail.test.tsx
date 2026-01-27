import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { AssetDetail } from './AssetDetail'
import {
  createMockAsset,
  createMockAssetByCategory,
  createMockDisposedAsset,
} from '@/test/mocks/data/accounting'

describe('AssetDetail', () => {
  const mockOnEdit = vi.fn()
  const mockOnDispose = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders asset name as title', () => {
      const asset = createMockAsset({ name: 'MacBook Pro 16"' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument()
    })

    it('renders back button', () => {
      const asset = createMockAsset()
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('renders edit button', () => {
      const asset = createMockAsset()
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('renders dispose button for active assets', () => {
      const asset = createMockAsset({ status: 'active' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByRole('button', { name: /dispose/i })).toBeInTheDocument()
    })

    it('does not render dispose button for disposed assets', () => {
      const asset = createMockDisposedAsset('disposed')
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.queryByRole('button', { name: /dispose/i })).not.toBeInTheDocument()
    })
  })

  describe('asset information', () => {
    it('displays purchase price', () => {
      const asset = createMockAsset({ purchasePrice: 2500 })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Price appears in multiple places (Net Price, Original Value, etc.)
      expect(screen.getAllByText('2.500,00 €').length).toBeGreaterThanOrEqual(1)
    })

    it('displays purchase date in German format', () => {
      const asset = createMockAsset({ purchaseDate: new Date('2024-03-15') })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Date may appear in multiple places (purchase info, depreciation table)
      expect(screen.getAllByText('15.03.2024').length).toBeGreaterThanOrEqual(1)
    })

    it('displays vendor when available', () => {
      const asset = createMockAsset({ vendor: 'Apple' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('Apple')).toBeInTheDocument()
    })

    it('displays category', () => {
      const asset = createMockAssetByCategory('computer')
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText(/computer/i)).toBeInTheDocument()
    })

    it('displays status badge', () => {
      const asset = createMockAsset({ status: 'active' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('displays location when available', () => {
      const asset = createMockAsset({ location: 'Home Office' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('Home Office')).toBeInTheDocument()
    })

    it('displays inventory number when available', () => {
      const asset = createMockAsset({ inventoryNumber: 'INV-001' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('INV-001')).toBeInTheDocument()
    })

    it('displays description when available', () => {
      const asset = createMockAsset({ description: 'Development laptop' })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('Development laptop')).toBeInTheDocument()
    })
  })

  describe('depreciation information', () => {
    it('displays AfA years', () => {
      const asset = createMockAssetByCategory('computer') // 3 years
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // AfA years appears in summary and depreciation table
      expect(screen.getAllByText(/3 years/i).length).toBeGreaterThanOrEqual(1)
    })

    it('displays annual AfA amount', () => {
      const asset = createMockAsset({
        purchasePrice: 3000,
        afaAnnualAmount: 1000,
      })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText(/1\.000.*year/i)).toBeInTheDocument()
    })

    it('displays depreciation schedule', () => {
      const asset = createMockAsset()
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText(/depreciation schedule/i)).toBeInTheDocument()
    })

    it('displays current book value', () => {
      const asset = createMockAsset({
        purchasePrice: 1500,
        depreciationSchedule: [
          {
            id: '1',
            assetId: 'test',
            year: 2024,
            months: 12,
            amount: 500,
            cumulative: 500,
            bookValue: 1000,
          },
        ],
      })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Current book value label should be displayed (appears in multiple places)
      expect(screen.getAllByText(/book value/i).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('VAT information', () => {
    it('displays VAT paid', () => {
      const asset = createMockAsset({ vatPaid: 285 })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('285,00 €')).toBeInTheDocument()
    })

    it('displays gross price', () => {
      const asset = createMockAsset({ grossPrice: 1785 })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('1.785,00 €')).toBeInTheDocument()
    })
  })

  describe('disposed asset information', () => {
    it('displays disposal date for disposed assets', () => {
      const asset = createMockDisposedAsset('disposed', {
        disposalDate: new Date('2024-06-15'),
      })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      expect(screen.getByText('15.06.2024')).toBeInTheDocument()
    })

    it('displays disposal price for sold assets', () => {
      const asset = createMockDisposedAsset('sold', {
        disposalPrice: 500,
      })
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Sale price may appear in multiple places
      expect(screen.getAllByText('500,00 €').length).toBeGreaterThanOrEqual(1)
    })

    it('shows disposed status badge', () => {
      const asset = createMockDisposedAsset('disposed')
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Status appears in badge and disposal info section
      expect(screen.getAllByText('Disposed').length).toBeGreaterThanOrEqual(1)
    })

    it('shows sold status badge', () => {
      const asset = createMockDisposedAsset('sold')
      render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      // Status appears in badge and disposal info section
      expect(screen.getAllByText('Sold').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('interactions', () => {
    it('calls onBack when back button clicked', async () => {
      const asset = createMockAsset()
      const { user } = render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      await user.click(screen.getByRole('button', { name: /back/i }))

      expect(mockOnBack).toHaveBeenCalled()
    })

    it('calls onEdit when edit button clicked', async () => {
      const asset = createMockAsset()
      const { user } = render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(mockOnEdit).toHaveBeenCalledWith(asset)
    })

    it('calls onDispose when dispose button clicked', async () => {
      const asset = createMockAsset({ status: 'active' })
      const { user } = render(
        <AssetDetail
          asset={asset}
          onEdit={mockOnEdit}
          onDispose={mockOnDispose}
          onBack={mockOnBack}
        />
      )

      await user.click(screen.getByRole('button', { name: /dispose/i }))

      expect(mockOnDispose).toHaveBeenCalledWith(asset)
    })
  })
})
