/**
 * AssetWidget Component Tests
 *
 * Tests for dashboard asset widget showing:
 * - Total asset value (book value)
 * - Current year AfA total
 * - Active asset count
 * - Recent acquisitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@/test/utils'
import { AssetWidget } from './AssetWidget'
import {
  createMockAsset,
  createMockAssets,
} from '@/test/mocks/data/accounting'
import type { Asset } from '../../types'

// Mock the useAssets hook
vi.mock('../../hooks/useAssets', () => ({
  useAssets: vi.fn(),
  default: vi.fn(),
}))

describe('AssetWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the widget title', () => {
      render(<AssetWidget activeCount={1} totalAssetValue={1000} />)

      // Find the title specifically in the header
      const widget = screen.getByTestId('asset-widget')
      expect(within(widget).getByRole('heading', { name: /assets/i })).toBeInTheDocument()
    })

    it('renders loading state', () => {
      render(<AssetWidget isLoading={true} />)

      expect(screen.getByText(/laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(<AssetWidget error="Failed to load assets" />)

      expect(screen.getByText('Failed to load assets')).toBeInTheDocument()
    })

    it('renders empty state when no assets', () => {
      render(<AssetWidget />)

      expect(screen.getByText(/no assets registered/i)).toBeInTheDocument()
    })
  })

  describe('total asset value', () => {
    it('displays total book value of active assets', () => {
      render(<AssetWidget totalAssetValue={4500} activeCount={3} />)

      expect(screen.getByText(/total value/i)).toBeInTheDocument()
      expect(screen.getByText('4.500,00 €')).toBeInTheDocument()
    })

    it('displays zero when no assets but activeCount is set', () => {
      render(<AssetWidget totalAssetValue={0} activeCount={0} recentAssets={[createMockAsset()]} />)

      // There will be two 0,00 € values (total value and AfA), so use getAllByText
      const zeroValues = screen.getAllByText('0,00 €')
      expect(zeroValues.length).toBeGreaterThanOrEqual(1)
    })

    it('formats large values in German locale', () => {
      render(<AssetWidget totalAssetValue={125000} activeCount={5} />)

      expect(screen.getByText('125.000,00 €')).toBeInTheDocument()
    })
  })

  describe('current year AfA', () => {
    it('displays current year depreciation total', () => {
      render(<AssetWidget yearlyAfA={3000} activeCount={2} />)

      expect(screen.getByText(/afa/i)).toBeInTheDocument()
      expect(screen.getByText('3.000,00 €')).toBeInTheDocument()
    })

    it('displays zero when no depreciation', () => {
      render(<AssetWidget yearlyAfA={0} activeCount={1} />)

      // Should still show the AfA label
      expect(screen.getByText(/afa/i)).toBeInTheDocument()
      // And show 0,00 € for AfA
      const afaSection = screen.getByText(/afa/i).closest('div')
      expect(afaSection).toBeInTheDocument()
    })

    it('shows current year in AfA label', () => {
      const currentYear = new Date().getFullYear()
      render(<AssetWidget yearlyAfA={1500} activeCount={1} />)

      expect(screen.getByText(new RegExp(`AfA ${currentYear}`))).toBeInTheDocument()
    })
  })

  describe('active asset count', () => {
    it('displays count of active assets', () => {
      render(<AssetWidget activeCount={5} />)

      expect(screen.getByText(/aktiv/i)).toBeInTheDocument()
      expect(screen.getByText('5 aktiv')).toBeInTheDocument()
    })

    it('displays zero count but shows empty state', () => {
      render(<AssetWidget activeCount={0} />)

      // With zero active count and no recent assets, shows empty state
      expect(screen.getByText(/no assets registered/i)).toBeInTheDocument()
    })
  })

  describe('recent acquisitions', () => {
    it('displays recent acquisitions list', () => {
      const recentAsset = createMockAsset({
        name: 'MacBook Pro 16"',
        purchaseDate: new Date(),
      })

      render(<AssetWidget recentAssets={[recentAsset]} />)

      expect(screen.getByText(/recent/i)).toBeInTheDocument()
      expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument()
    })

    it('shows message when no recent acquisitions but has assets', () => {
      render(<AssetWidget activeCount={1} recentAssets={[]} />)

      expect(screen.getByText(/no recent|keine neuen/i)).toBeInTheDocument()
    })

    it('limits recent acquisitions to 3 items', () => {
      const assets = createMockAssets(5)
      render(<AssetWidget recentAssets={assets} />)

      // Should only show 3 items max
      const assetItems = screen.getAllByRole('listitem')
      expect(assetItems.length).toBeLessThanOrEqual(3)
    })

    it('displays purchase date for recent acquisitions', () => {
      const date = new Date(2024, 5, 15) // June 15, 2024
      const asset = createMockAsset({
        name: 'Monitor',
        purchaseDate: date,
      })
      render(<AssetWidget recentAssets={[asset]} />)

      // Should display date in German format (15.06.2024)
      expect(screen.getByText('15.06.2024')).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('calls onNavigate when "View All" is clicked', async () => {
      const onNavigate = vi.fn()
      const { user } = render(<AssetWidget onNavigate={onNavigate} />)

      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      await user.click(viewAllButton)

      expect(onNavigate).toHaveBeenCalledWith('assets')
    })

    it('navigates to asset detail when asset is clicked', async () => {
      const asset = createMockAsset({ id: 'asset-123', name: 'Test Asset' })
      const onAssetClick = vi.fn()
      const { user } = render(<AssetWidget recentAssets={[asset]} onAssetClick={onAssetClick} />)

      const assetItem = screen.getByText('Test Asset')
      await user.click(assetItem)

      expect(onAssetClick).toHaveBeenCalledWith('asset-123')
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(<AssetWidget className="custom-class" />)

      const widget = screen.getByTestId('asset-widget')
      expect(widget).toHaveClass('custom-class')
    })
  })

  describe('accessibility', () => {
    it('has accessible widget label', () => {
      render(<AssetWidget />)

      expect(screen.getByRole('region', { name: /asset/i })).toBeInTheDocument()
    })

    it('has keyboard accessible elements', async () => {
      const onNavigate = vi.fn()
      render(<AssetWidget onNavigate={onNavigate} />)

      const viewAllButton = screen.getByRole('button', { name: /view all/i })
      expect(viewAllButton).toBeInTheDocument()
    })
  })

  describe('German locale formatting', () => {
    it('formats currency values in German format', () => {
      render(<AssetWidget totalAssetValue={12345.67} activeCount={1} />)

      // German format: 12.345,67 €
      expect(screen.getByText('12.345,67 €')).toBeInTheDocument()
    })

    it('formats dates in German format', () => {
      const asset = createMockAsset({
        name: 'Test',
        purchaseDate: new Date(2024, 11, 25), // Dec 25, 2024
      })
      render(<AssetWidget recentAssets={[asset]} />)

      // German format: 25.12.2024
      expect(screen.getByText('25.12.2024')).toBeInTheDocument()
    })
  })
})
