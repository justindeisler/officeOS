/**
 * AfaSummary Component Tests
 *
 * Tests for the annual depreciation summary report showing:
 * - Year-by-year depreciation schedule
 * - Per-asset AfA amounts
 * - Total AfA for the year
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@/test/utils'
import { AfaSummary } from './AfaSummary'
import {
  createMockAsset,
  createMockAssets,
} from '@/test/mocks/data/accounting'
import type { Asset } from '../../types'

describe('AfaSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the report title', () => {
      render(<AfaSummary year={2024} assets={[]} />)

      expect(
        screen.getByRole('heading', { name: /afa|abschreibung/i })
      ).toBeInTheDocument()
    })

    it('renders the year in the title', () => {
      render(<AfaSummary year={2024} assets={[]} />)

      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      render(<AfaSummary year={2024} assets={[]} isLoading={true} />)

      expect(screen.getByText(/laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(
        <AfaSummary year={2024} assets={[]} error="Failed to load data" />
      )

      expect(screen.getByText('Failed to load data')).toBeInTheDocument()
    })

    it('renders empty state when no assets', () => {
      render(<AfaSummary year={2024} assets={[]} />)

      expect(screen.getByText('Keine Abschreibungen vorhanden')).toBeInTheDocument()
    })
  })

  describe('summary section', () => {
    it('displays total AfA for the year', () => {
      const assets = [
        createMockAsset({ afaAnnualAmount: 500 }),
        createMockAsset({ afaAnnualAmount: 750 }),
        createMockAsset({ afaAnnualAmount: 250 }),
      ]
      render(<AfaSummary year={2024} assets={assets} />)

      // Total: 1500
      const summarySection = screen.getByTestId('afa-summary-totals')
      expect(within(summarySection).getByText('1.500,00 €')).toBeInTheDocument()
    })

    it('displays number of assets with depreciation', () => {
      const assets = createMockAssets(3)
      render(<AfaSummary year={2024} assets={assets} />)

      expect(screen.getByText('3 Anlagen')).toBeInTheDocument()
    })

    it('displays average AfA per asset', () => {
      const assets = [
        createMockAsset({ afaAnnualAmount: 300 }),
        createMockAsset({ afaAnnualAmount: 600 }),
        createMockAsset({ afaAnnualAmount: 600 }),
      ]
      render(<AfaSummary year={2024} assets={assets} />)

      // Average: 500
      expect(screen.getByText('500,00 €')).toBeInTheDocument()
    })
  })

  describe('depreciation table', () => {
    it('renders table headers', () => {
      const asset = createMockAsset()
      render(<AfaSummary year={2024} assets={[asset]} />)

      expect(screen.getByRole('columnheader', { name: /anlage|asset/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /afa|depreciation/i })).toBeInTheDocument()
    })

    it('displays asset name', () => {
      const asset = createMockAsset({ name: 'Office Desk' })
      render(<AfaSummary year={2024} assets={[asset]} />)

      expect(screen.getByText('Office Desk')).toBeInTheDocument()
    })

    it('displays annual AfA amount', () => {
      const asset = createMockAsset({ afaAnnualAmount: 1250 })
      render(<AfaSummary year={2024} assets={[asset]} />)

      // AfA amount appears in table and possibly summary
      const afaElements = screen.getAllByText('1.250,00 €')
      expect(afaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('displays percentage of total', () => {
      const assets = [
        createMockAsset({ afaAnnualAmount: 500 }),
        createMockAsset({ afaAnnualAmount: 500 }),
      ]
      render(<AfaSummary year={2024} assets={assets} />)

      // Each asset is 50% of total - German format uses space before %
      const percentElements = screen.getAllByText(/50\s*%/)
      expect(percentElements.length).toBeGreaterThanOrEqual(1)
    })

    it('displays remaining years', () => {
      const asset = createMockAsset({
        afaYears: 3,
        purchaseDate: new Date(2024, 0, 1),
        afaStartDate: new Date(2024, 0, 1),
      })
      render(<AfaSummary year={2024} assets={[asset]} />)

      // Should show remaining years
      expect(screen.getByText(/2 jahre|2 years/i)).toBeInTheDocument()
    })

    it('sorts assets by AfA amount descending', () => {
      const assets = [
        createMockAsset({ id: 'a', name: 'Small', afaAnnualAmount: 100 }),
        createMockAsset({ id: 'b', name: 'Large', afaAnnualAmount: 1000 }),
        createMockAsset({ id: 'c', name: 'Medium', afaAnnualAmount: 500 }),
      ]
      render(<AfaSummary year={2024} assets={assets} />)

      // Get all table rows
      const table = screen.getByRole('table')
      const rows = within(table).getAllByRole('row')
      // First data row should be Large (highest AfA)
      expect(within(rows[1]).getByText('Large')).toBeInTheDocument()
    })
  })

  describe('category breakdown', () => {
    it('groups depreciation by category', () => {
      const assets = [
        createMockAsset({ category: 'computer', afaAnnualAmount: 500 }),
        createMockAsset({ category: 'computer', afaAnnualAmount: 500 }),
        createMockAsset({ category: 'furniture', afaAnnualAmount: 200 }),
      ]
      render(<AfaSummary year={2024} assets={assets} showCategoryBreakdown />)

      // Category names appear multiple times - use getAllByText
      const computerElements = screen.getAllByText(/EDV\/Computer/)
      const furnitureElements = screen.getAllByText(/Büromöbel/)
      expect(computerElements.length).toBeGreaterThanOrEqual(1)
      expect(furnitureElements.length).toBeGreaterThanOrEqual(1)
    })

    it('displays category totals', () => {
      const assets = [
        createMockAsset({ category: 'computer', afaAnnualAmount: 500 }),
        createMockAsset({ category: 'computer', afaAnnualAmount: 500 }),
      ]
      render(<AfaSummary year={2024} assets={assets} showCategoryBreakdown />)

      // Computer category total: 1000 - appears multiple times
      const totalElements = screen.getAllByText('1.000,00 €')
      expect(totalElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('yearly comparison', () => {
    it('displays multi-year comparison when enabled', () => {
      const assets = [
        createMockAsset({
          depreciationSchedule: [
            { id: 'dep-1', assetId: '', year: 2023, months: 12, amount: 500, cumulative: 500, bookValue: 2000 },
            { id: 'dep-2', assetId: '', year: 2024, months: 12, amount: 500, cumulative: 1000, bookValue: 1500 },
            { id: 'dep-3', assetId: '', year: 2025, months: 12, amount: 500, cumulative: 1500, bookValue: 1000 },
          ],
        }),
      ]
      render(<AfaSummary year={2024} assets={assets} showYearlyComparison />)

      // Should show previous and next years
      expect(screen.getByText('2023')).toBeInTheDocument()
      expect(screen.getByText('2024')).toBeInTheDocument()
      expect(screen.getByText('2025')).toBeInTheDocument()
    })
  })

  describe('export', () => {
    it('renders CSV export button', () => {
      const assets = [createMockAsset()]
      render(<AfaSummary year={2024} assets={assets} />)

      expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    })

    it('calls onExportCSV when clicked', async () => {
      const onExportCSV = vi.fn()
      const assets = [createMockAsset()]
      const { user } = render(
        <AfaSummary year={2024} assets={assets} onExportCSV={onExportCSV} />
      )

      await user.click(screen.getByRole('button', { name: /csv/i }))

      expect(onExportCSV).toHaveBeenCalledWith(assets, 2024)
    })
  })

  describe('German locale formatting', () => {
    it('formats currency in German format', () => {
      const asset = createMockAsset({ afaAnnualAmount: 12345.67 })
      render(<AfaSummary year={2024} assets={[asset]} />)

      // German format: 12.345,67 €
      const formattedElements = screen.getAllByText('12.345,67 €')
      expect(formattedElements.length).toBeGreaterThanOrEqual(1)
    })

    it('uses German category names', () => {
      const asset = createMockAsset({ category: 'computer' })
      render(<AfaSummary year={2024} assets={[asset]} showCategoryBreakdown />)

      // Category name appears in table and breakdown section
      const categoryElements = screen.getAllByText(/EDV\/Computer/)
      expect(categoryElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      const assets = [createMockAsset()]
      render(<AfaSummary year={2024} assets={assets} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has properly labeled summary cards', () => {
      const assets = [createMockAsset()]
      render(<AfaSummary year={2024} assets={assets} />)

      expect(screen.getByTestId('afa-summary-totals')).toBeInTheDocument()
    })
  })
})
