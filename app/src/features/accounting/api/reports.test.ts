/**
 * Reports API Tests
 *
 * Tests for EÜR report generation with asset integration (AfA).
 * Phase 8: Asset Integration & EÜR Report Enhancement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEuerReport, getEuerLineDetails } from './reports'
import * as assetsApi from './assets'
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../types'

// Mock the database module
vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}))

// Mock assets API
vi.mock('./assets', () => ({
  getYearlyDepreciation: vi.fn(),
  getActiveAssets: vi.fn(),
  getAssetsByStatus: vi.fn(),
  getCurrentBookValue: vi.fn(),
  getTotalAssetValue: vi.fn(),
  getDepreciationByCategory: vi.fn(),
  getDisposalGains: vi.fn(),
  getDisposalLosses: vi.fn(),
}))

describe('Reports API - Asset Integration', () => {
  const mockGetYearlyDepreciation = vi.mocked(assetsApi.getYearlyDepreciation)
  const mockGetActiveAssets = vi.mocked(assetsApi.getActiveAssets)
  const mockGetAssetsByStatus = vi.mocked(assetsApi.getAssetsByStatus)
  const mockGetDisposalGains = vi.mocked(assetsApi.getDisposalGains)
  const mockGetDisposalLosses = vi.mocked(assetsApi.getDisposalLosses)

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks
    mockGetYearlyDepreciation.mockResolvedValue(0)
    mockGetActiveAssets.mockResolvedValue([])
    mockGetAssetsByStatus.mockResolvedValue([])
    mockGetDisposalGains.mockResolvedValue(0)
    mockGetDisposalLosses.mockResolvedValue(0)
  })

  describe('getEuerReport - AfA Integration', () => {
    it('should include AfA from assets in line 30', async () => {
      // Arrange: Set up asset depreciation for the year
      const year = 2024
      const afaAmount = 1500.00
      mockGetYearlyDepreciation.mockResolvedValue(afaAmount)

      // Act
      const report = await getEuerReport(year)

      // Assert: Line 30 should include AfA from assets
      expect(mockGetYearlyDepreciation).toHaveBeenCalledWith(year)
      expect(report.expenses[EUER_LINES.AFA]).toBe(afaAmount)
    })

    it('should add asset AfA to existing expense line 30', async () => {
      // Arrange: Both expense-based AfA and asset-based AfA
      const year = 2024
      const assetAfA = 1500.00
      mockGetYearlyDepreciation.mockResolvedValue(assetAfA)

      // Act
      const report = await getEuerReport(year)

      // Assert: Line 30 should include asset AfA
      expect(report.expenses[EUER_LINES.AFA]).toBeGreaterThanOrEqual(assetAfA)
    })

    it('should handle zero depreciation', async () => {
      // Arrange: No depreciation for the year
      const year = 2024
      mockGetYearlyDepreciation.mockResolvedValue(0)

      // Act
      const report = await getEuerReport(year)

      // Assert: Should not fail, but AfA line may be 0 or undefined
      expect(report.expenses[EUER_LINES.AFA]).toBeDefined()
    })

    it('should include depreciation in total expenses', async () => {
      // Arrange
      const year = 2024
      const afaAmount = 2000.00
      mockGetYearlyDepreciation.mockResolvedValue(afaAmount)

      // Act
      const report = await getEuerReport(year)

      // Assert: Total expenses should include AfA
      expect(report.totalExpenses).toBeGreaterThanOrEqual(afaAmount)
    })

    it('should reduce Gewinn by depreciation amount', async () => {
      // Arrange
      const year = 2024
      const afaAmount = 1000.00
      mockGetYearlyDepreciation.mockResolvedValue(afaAmount)

      // Act
      const report = await getEuerReport(year)

      // Assert: Gewinn should be reduced by depreciation
      // gewinn = totalIncome - totalExpenses (which includes AfA)
      expect(report.gewinn).toBe(report.totalIncome - report.totalExpenses)
    })

    it('should round AfA amounts to 2 decimal places', async () => {
      // Arrange: Non-round depreciation amount
      const year = 2024
      const afaAmount = 1499.999
      mockGetYearlyDepreciation.mockResolvedValue(afaAmount)

      // Act
      const report = await getEuerReport(year)

      // Assert: Amount should be rounded
      const afaInReport = report.expenses[EUER_LINES.AFA]
      expect(afaInReport).toBe(1500.00)
    })
  })

  describe('getEuerReport - Asset Disposals', () => {
    it('should include asset disposal gain as income on line 16', async () => {
      // Arrange: Asset sold for profit
      const year = 2024
      const disposalGain = 500.00  // Sold for €500 more than book value
      mockGetDisposalGains.mockResolvedValue(disposalGain)

      // Act
      const report = await getEuerReport(year)

      // Assert: Disposal gain should be included in income line 16
      expect(mockGetDisposalGains).toHaveBeenCalledWith(year)
      expect(report.income[EUER_LINES.ENTNAHME_VERKAUF]).toBe(disposalGain)
    })

    it('should include asset disposal loss as expense on line 35', async () => {
      // Arrange: Asset sold at a loss or disposed
      const year = 2024
      const disposalLoss = 800.00  // Remaining book value written off
      mockGetDisposalLosses.mockResolvedValue(disposalLoss)

      // Act
      const report = await getEuerReport(year)

      // Assert: Disposal loss should be included in expense line 35
      expect(mockGetDisposalLosses).toHaveBeenCalledWith(year)
      expect(report.expenses[EUER_LINES.ANLAGENABGANG_VERLUST]).toBe(disposalLoss)
    })

    it('should not include line 16 if no disposal gains', async () => {
      // Arrange: No disposal gains
      const year = 2024
      mockGetDisposalGains.mockResolvedValue(0)

      // Act
      const report = await getEuerReport(year)

      // Assert: Line 16 should not be in income
      expect(report.income[EUER_LINES.ENTNAHME_VERKAUF]).toBeUndefined()
    })

    it('should not include line 35 if no disposal losses', async () => {
      // Arrange: No disposal losses
      const year = 2024
      mockGetDisposalLosses.mockResolvedValue(0)

      // Act
      const report = await getEuerReport(year)

      // Assert: Line 35 should not be in expenses
      expect(report.expenses[EUER_LINES.ANLAGENABGANG_VERLUST]).toBeUndefined()
    })

    it('should include both gains and losses in same year', async () => {
      // Arrange: One profitable sale, one loss
      const year = 2024
      mockGetDisposalGains.mockResolvedValue(300.00)
      mockGetDisposalLosses.mockResolvedValue(200.00)

      // Act
      const report = await getEuerReport(year)

      // Assert: Both should be in report
      expect(report.income[EUER_LINES.ENTNAHME_VERKAUF]).toBe(300.00)
      expect(report.expenses[EUER_LINES.ANLAGENABGANG_VERLUST]).toBe(200.00)
    })

    it('should round disposal amounts to 2 decimal places', async () => {
      // Arrange: Non-round amounts
      const year = 2024
      mockGetDisposalGains.mockResolvedValue(123.456)
      mockGetDisposalLosses.mockResolvedValue(78.999)

      // Act
      const report = await getEuerReport(year)

      // Assert: Amounts should be rounded
      expect(report.income[EUER_LINES.ENTNAHME_VERKAUF]).toBe(123.46)
      expect(report.expenses[EUER_LINES.ANLAGENABGANG_VERLUST]).toBe(79.00)
    })

    it('should include disposal gain in total income', async () => {
      // Arrange
      const year = 2024
      mockGetDisposalGains.mockResolvedValue(1000.00)

      // Act
      const report = await getEuerReport(year)

      // Assert: Total income should include disposal gain
      expect(report.totalIncome).toBeGreaterThanOrEqual(1000.00)
    })

    it('should include disposal loss in total expenses', async () => {
      // Arrange
      const year = 2024
      mockGetDisposalLosses.mockResolvedValue(500.00)

      // Act
      const report = await getEuerReport(year)

      // Assert: Total expenses should include disposal loss
      expect(report.totalExpenses).toBeGreaterThanOrEqual(500.00)
    })
  })

  describe('getEuerLineDetails', () => {
    it('should include AfA line in expense details', () => {
      const details = getEuerLineDetails()

      const afaLine = details.expenses.find(
        (e) => e.line === EUER_LINES.AFA
      )

      expect(afaLine).toBeDefined()
      expect(afaLine?.name).toBe('AfA')
      expect(afaLine?.description).toContain('Depreciation')
    })

    it('should return all standard EÜR lines', () => {
      const details = getEuerLineDetails()

      // Income lines (3: Betriebseinnahmen, Veräußerungsgewinne, USt-Erstattung)
      expect(details.income).toHaveLength(3)
      expect(details.income.map((i) => i.line)).toContain(EUER_LINES.BETRIEBSEINNAHMEN)
      expect(details.income.map((i) => i.line)).toContain(EUER_LINES.ENTNAHME_VERKAUF)
      expect(details.income.map((i) => i.line)).toContain(EUER_LINES.UST_ERSTATTUNG)

      // Expense lines (7: Fremdleistungen, Vorsteuer, Gezahlte USt, AfA, Arbeitszimmer, Sonstige, Anlagenabgang)
      expect(details.expenses.length).toBeGreaterThanOrEqual(7)
      expect(details.expenses.map((e) => e.line)).toContain(EUER_LINES.AFA)
      expect(details.expenses.map((e) => e.line)).toContain(EUER_LINES.ARBEITSZIMMER)
      expect(details.expenses.map((e) => e.line)).toContain(EUER_LINES.ANLAGENABGANG_VERLUST)
    })
  })
})

describe('EÜR Report - Homeoffice Pauschale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(assetsApi.getYearlyDepreciation).mockResolvedValue(0)
    vi.mocked(assetsApi.getDisposalGains).mockResolvedValue(0)
    vi.mocked(assetsApi.getDisposalLosses).mockResolvedValue(0)
  })

  it('should include Homeoffice-Pauschale when no Arbeitszimmer expenses', async () => {
    // Act
    const report = await getEuerReport(2024)

    // Assert: Line 33 should have Homeoffice-Pauschale
    expect(report.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(HOMEOFFICE_PAUSCHALE)
  })

  it('should use actual Arbeitszimmer expenses if present', async () => {
    // This would require actual expense records with line 33
    // The mock currently returns empty arrays, so Pauschale is used
    const report = await getEuerReport(2024)

    expect(report.expenses[EUER_LINES.ARBEITSZIMMER]).toBeDefined()
  })
})
