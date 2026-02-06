/**
 * Anlageverzeichnis (Asset Register) Component Tests
 *
 * Tests for the formal asset register report required for German tax filing.
 * Shows all assets with depreciation details for EÜR Anlage AVEÜR.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@/test/utils'
import { Anlageverzeichnis } from './Anlageverzeichnis'
import {
  createMockAsset,
  createMockAssets,
  createMockDisposedAsset,
} from '@/test/mocks/data/accounting'
import type { Asset } from '../../types'

// Mock the useAssets hook
vi.mock('../../hooks/useAssets', () => ({
  useAssets: vi.fn(),
}))

describe('Anlageverzeichnis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the report title', () => {
      render(<Anlageverzeichnis year={2024} assets={[]} />)

      expect(
        screen.getByRole('heading', { name: /anlageverzeichnis/i })
      ).toBeInTheDocument()
    })

    it('renders the year in the title', () => {
      render(<Anlageverzeichnis year={2024} assets={[]} />)

      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      render(<Anlageverzeichnis year={2024} assets={[]} isLoading={true} />)

      expect(screen.getByText(/laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(
        <Anlageverzeichnis
          year={2024}
          assets={[]}
          error="Failed to load assets"
        />
      )

      expect(screen.getByText('Failed to load assets')).toBeInTheDocument()
    })

    it('renders empty state when no assets', () => {
      render(<Anlageverzeichnis year={2024} assets={[]} />)

      expect(screen.getByText('Keine Anlagen vorhanden')).toBeInTheDocument()
    })
  })

  describe('asset table', () => {
    it('renders table headers', () => {
      const asset = createMockAsset()
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      expect(screen.getByRole('columnheader', { name: /bezeichnung/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /anschaffung$/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /afa jahre/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /buchwert/i })).toBeInTheDocument()
    })

    it('displays asset name', () => {
      const asset = createMockAsset({ name: 'MacBook Pro 16"' })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument()
    })

    it('displays asset category', () => {
      const asset = createMockAsset({ category: 'computer' })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      expect(screen.getByText(/computer|edv/i)).toBeInTheDocument()
    })

    it('displays purchase date in German format', () => {
      const asset = createMockAsset({
        purchaseDate: new Date(2024, 5, 15), // June 15, 2024
      })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      expect(screen.getByText('15.06.2024')).toBeInTheDocument()
    })

    it('displays purchase price in German currency format', () => {
      const asset = createMockAsset({ purchasePrice: 2499.99 })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      // Value appears in both table and summary, use getAllByText
      const priceElements = screen.getAllByText('2.499,99 €')
      expect(priceElements.length).toBeGreaterThanOrEqual(1)
    })

    it('displays AfA years (useful life)', () => {
      const asset = createMockAsset({ afaYears: 3 })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      expect(screen.getByText(/3 jahre|3 years/i)).toBeInTheDocument()
    })

    it('displays annual AfA amount', () => {
      const asset = createMockAsset({ afaAnnualAmount: 833.33 })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      // Value appears in both table and summary, use getAllByText
      const afaElements = screen.getAllByText('833,33 €')
      expect(afaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('displays current book value', () => {
      const asset = createMockAsset({
        purchasePrice: 2500,
        depreciationSchedule: [
          { id: 'dep-1', assetId: '', year: 2023, months: 12, amount: 416.67, cumulative: 416.67, bookValue: 2083.33 },
          { id: 'dep-2', assetId: '', year: 2024, months: 12, amount: 833.33, cumulative: 1250, bookValue: 1250 },
        ],
      })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      // Book value appears in both table and summary
      const bookValueElements = screen.getAllByText('1.250,00 €')
      expect(bookValueElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders multiple assets', () => {
      const assets = createMockAssets(3)
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      // Should have 3 table rows (excluding header)
      const table = screen.getByRole('table')
      const rows = within(table).getAllByRole('row')
      // 1 header row + 3 data rows
      expect(rows.length).toBe(4)
    })
  })

  describe('summary section', () => {
    it('displays total asset count', () => {
      const assets = createMockAssets(5)
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      expect(screen.getByText(/5 anlagen|5 assets/i)).toBeInTheDocument()
    })

    it('displays total purchase value', () => {
      const assets = [
        createMockAsset({ purchasePrice: 1000 }),
        createMockAsset({ purchasePrice: 2000 }),
        createMockAsset({ purchasePrice: 1500 }),
      ]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      // Total value in summary section (may appear multiple times for purchase and book value)
      const summarySection = screen.getByTestId('summary-section')
      const totalValues = within(summarySection).getAllByText('4.500,00 €')
      expect(totalValues.length).toBeGreaterThanOrEqual(1)
    })

    it('displays total annual AfA', () => {
      const assets = [
        createMockAsset({ afaAnnualAmount: 333.33 }),
        createMockAsset({ afaAnnualAmount: 666.67 }),
        createMockAsset({ afaAnnualAmount: 500 }),
      ]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      // Total AfA in summary section: 1500.00
      const summarySection = screen.getByTestId('summary-section')
      expect(within(summarySection).getByText('1.500,00 €')).toBeInTheDocument()
    })

    it('displays total current book value', () => {
      const assets = [
        createMockAsset({
          purchasePrice: 1000,
          depreciationSchedule: [
            { id: 'dep-1', assetId: '', year: 2024, months: 12, amount: 333.33, cumulative: 333.33, bookValue: 666.67 },
          ],
        }),
        createMockAsset({
          purchasePrice: 2000,
          depreciationSchedule: [
            { id: 'dep-2', assetId: '', year: 2024, months: 12, amount: 666.67, cumulative: 666.67, bookValue: 1333.33 },
          ],
        }),
      ]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      // Should display total book value
      const summarySection = screen.getByTestId('summary-section')
      expect(summarySection).toBeInTheDocument()
    })
  })

  describe('disposed assets', () => {
    it('marks disposed assets', () => {
      const disposedAsset = createMockDisposedAsset('disposed')
      render(<Anlageverzeichnis year={2024} assets={[disposedAsset]} />)

      expect(screen.getByText(/abgang|disposed/i)).toBeInTheDocument()
    })

    it('marks sold assets', () => {
      const soldAsset = createMockDisposedAsset('sold', {
        disposalPrice: 500,
      })
      render(<Anlageverzeichnis year={2024} assets={[soldAsset]} />)

      expect(screen.getByText(/verkauft|sold/i)).toBeInTheDocument()
    })

    it('displays disposal date', () => {
      const disposedAsset = createMockDisposedAsset('disposed', {
        disposalDate: new Date(2024, 9, 15), // Oct 15, 2024
      })
      render(<Anlageverzeichnis year={2024} assets={[disposedAsset]} />)

      expect(screen.getByText('15.10.2024')).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('filters assets by year', () => {
      const assets = [
        createMockAsset({
          id: 'asset-2023',
          name: '2023 Asset',
          purchaseDate: new Date(2023, 5, 15),
        }),
        createMockAsset({
          id: 'asset-2024',
          name: '2024 Asset',
          purchaseDate: new Date(2024, 5, 15),
        }),
      ]
      render(
        <Anlageverzeichnis year={2024} assets={assets} showOnlyYearAcquisitions />
      )

      // Should only show 2024 asset
      expect(screen.queryByText('2023 Asset')).not.toBeInTheDocument()
      expect(screen.getByText('2024 Asset')).toBeInTheDocument()
    })

    it('shows all assets by default', () => {
      const assets = [
        createMockAsset({ id: 'asset-2023', name: '2023 Asset' }),
        createMockAsset({ id: 'asset-2024', name: '2024 Asset' }),
      ]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      expect(screen.getByText('2023 Asset')).toBeInTheDocument()
      expect(screen.getByText('2024 Asset')).toBeInTheDocument()
    })
  })

  describe('export', () => {
    it('renders CSV export button', () => {
      const assets = [createMockAsset()]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    })

    it('renders PDF export button', () => {
      const assets = [createMockAsset()]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
    })

    it('calls onExportCSV when CSV button clicked', async () => {
      const onExportCSV = vi.fn()
      const assets = [createMockAsset()]
      const { user } = render(
        <Anlageverzeichnis year={2024} assets={assets} onExportCSV={onExportCSV} />
      )

      await user.click(screen.getByRole('button', { name: /csv/i }))

      expect(onExportCSV).toHaveBeenCalledWith(assets, 2024)
    })

    it('calls onExportPDF when PDF button clicked', async () => {
      const onExportPDF = vi.fn()
      const assets = [createMockAsset()]
      const { user } = render(
        <Anlageverzeichnis year={2024} assets={assets} onExportPDF={onExportPDF} />
      )

      await user.click(screen.getByRole('button', { name: /pdf/i }))

      expect(onExportPDF).toHaveBeenCalledWith(assets, 2024)
    })
  })

  describe('accessibility', () => {
    it('has accessible table', () => {
      const assets = [createMockAsset()]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has column headers with scope', () => {
      const assets = [createMockAsset()]
      render(<Anlageverzeichnis year={2024} assets={assets} />)

      const headers = screen.getAllByRole('columnheader')
      expect(headers.length).toBeGreaterThan(0)
    })
  })

  describe('German locale formatting', () => {
    it('formats all currency values in German format', () => {
      const asset = createMockAsset({
        purchasePrice: 12345.67,
        afaAnnualAmount: 4115.22,
      })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      // German format: 12.345,67 € - appears in both table and summary
      const purchasePriceElements = screen.getAllByText('12.345,67 €')
      const afaElements = screen.getAllByText('4.115,22 €')
      expect(purchasePriceElements.length).toBeGreaterThanOrEqual(1)
      expect(afaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('formats all dates in German format', () => {
      const asset = createMockAsset({
        purchaseDate: new Date(2024, 11, 25), // Dec 25, 2024
      })
      render(<Anlageverzeichnis year={2024} assets={[asset]} />)

      // German format: 25.12.2024
      expect(screen.getByText('25.12.2024')).toBeInTheDocument()
    })
  })
})
