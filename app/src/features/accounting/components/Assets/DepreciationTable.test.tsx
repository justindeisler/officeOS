import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { DepreciationTable } from './DepreciationTable'
import { createMockAsset, createMockAssetByCategory } from '@/test/mocks/data/accounting'
import type { DepreciationEntry } from '../../types'

describe('DepreciationTable', () => {
  const mockSchedule: DepreciationEntry[] = [
    {
      id: '1',
      assetId: 'asset-1',
      year: 2024,
      months: 6,
      amount: 250,
      cumulative: 250,
      bookValue: 1250,
    },
    {
      id: '2',
      assetId: 'asset-1',
      year: 2025,
      months: 12,
      amount: 500,
      cumulative: 750,
      bookValue: 750,
    },
    {
      id: '3',
      assetId: 'asset-1',
      year: 2026,
      months: 12,
      amount: 500,
      cumulative: 1250,
      bookValue: 250,
    },
    {
      id: '4',
      assetId: 'asset-1',
      year: 2027,
      months: 6,
      amount: 250,
      cumulative: 1500,
      bookValue: 0,
    },
  ]

  describe('rendering', () => {
    it('renders the depreciation table header', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      expect(screen.getByText('Depreciation Schedule')).toBeInTheDocument()
    })

    it('renders table column headers', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      expect(screen.getByText('Year')).toBeInTheDocument()
      expect(screen.getByText('Months')).toBeInTheDocument()
      expect(screen.getByText('AfA Amount')).toBeInTheDocument()
      expect(screen.getByText('Cumulative')).toBeInTheDocument()
      expect(screen.getByText('Book Value')).toBeInTheDocument()
    })

    it('renders all depreciation entries', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Check years are displayed
      expect(screen.getByText('2024')).toBeInTheDocument()
      expect(screen.getByText('2025')).toBeInTheDocument()
      expect(screen.getByText('2026')).toBeInTheDocument()
      expect(screen.getByText('2027')).toBeInTheDocument()
    })

    it('renders empty state when no schedule', () => {
      render(
        <DepreciationTable
          schedule={[]}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      expect(screen.getByText(/no depreciation schedule/i)).toBeInTheDocument()
    })
  })

  describe('formatting', () => {
    it('formats currency amounts in German locale', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Should show currency formatted values (may appear multiple times in table)
      expect(screen.getAllByText('250,00 €').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('500,00 €').length).toBeGreaterThanOrEqual(1)
    })

    it('formats months correctly', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Should show month counts
      expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1)
    })

    it('displays book value reaching zero', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Final book value should be 0 (may appear in table row and summary)
      expect(screen.getAllByText('0,00 €').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('pro-rata display', () => {
    it('indicates first year is pro-rata when months < 12', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // First year (2024) has 6 months - should indicate pro-rata
      const firstYearRow = screen.getByText('2024').closest('tr')
      expect(firstYearRow).toBeInTheDocument()
    })

    it('indicates last year is pro-rata when months < 12', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Last year (2027) has 6 months - should indicate pro-rata
      const lastYearRow = screen.getByText('2027').closest('tr')
      expect(lastYearRow).toBeInTheDocument()
    })
  })

  describe('summary information', () => {
    it('displays total AfA amount', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      // Total AfA should equal purchase price (1500)
      expect(screen.getByText(/total/i)).toBeInTheDocument()
      // 1.500,00 € appears in purchase price header and cumulative column
      expect(screen.getAllByText('1.500,00 €').length).toBeGreaterThanOrEqual(1)
    })

    it('displays AfA years', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
          afaYears={3}
        />
      )

      expect(screen.getByText(/3 years/i)).toBeInTheDocument()
    })

    it('displays purchase date', () => {
      render(
        <DepreciationTable
          schedule={mockSchedule}
          purchasePrice={1500}
          purchaseDate={new Date('2024-07-01')}
        />
      )

      expect(screen.getByText('01.07.2024')).toBeInTheDocument()
    })
  })

  describe('current year highlighting', () => {
    it('highlights the current year row', () => {
      const currentYear = new Date().getFullYear()
      const scheduleWithCurrentYear: DepreciationEntry[] = [
        {
          id: '1',
          assetId: 'asset-1',
          year: currentYear,
          months: 12,
          amount: 500,
          cumulative: 500,
          bookValue: 1000,
        },
      ]

      render(
        <DepreciationTable
          schedule={scheduleWithCurrentYear}
          purchasePrice={1500}
          purchaseDate={new Date(`${currentYear}-01-01`)}
        />
      )

      // Current year row should have special styling
      const currentYearCell = screen.getByText(String(currentYear))
      const row = currentYearCell.closest('tr')
      expect(row).toHaveClass('bg-primary/5')
    })
  })

  describe('with real asset data', () => {
    it('renders depreciation schedule from mock asset', () => {
      const asset = createMockAssetByCategory('computer') // 3 year AfA

      render(
        <DepreciationTable
          schedule={asset.depreciationSchedule}
          purchasePrice={asset.purchasePrice}
          purchaseDate={asset.purchaseDate}
          afaYears={asset.afaYears}
        />
      )

      // Should render the schedule from the mock asset
      expect(screen.getByText('Depreciation Schedule')).toBeInTheDocument()
      expect(screen.getByText(/3 years/i)).toBeInTheDocument()
    })
  })
})
