/**
 * TaxForecast Component Tests
 *
 * Tests for the tax forecast display component showing VAT projections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { TaxForecast } from './TaxForecast'
import type { TaxForecast as TaxForecastType } from '../../types/reports'

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockForecast = (
  overrides: Partial<TaxForecastType> = {}
): TaxForecastType => ({
  period: '2024-Q2',
  year: 2024,
  quarter: 2,
  projectedIncome: 18000,
  projectedExpenses: 5500,
  projectedUmsatzsteuer: 3420,
  projectedVorsteuer: 1045,
  estimatedZahllast: 2375,
  confidence: 'high',
  dueDate: new Date('2024-07-10'),
  hasDauerfrist: false,
  dataPointsUsed: 6,
  projectionRange: { low: 2137.5, high: 2612.5 },
  ...overrides,
})

const createLowConfidenceForecast = (): TaxForecastType =>
  createMockForecast({
    confidence: 'low',
    dataPointsUsed: 2,
    projectionRange: { low: 1662.5, high: 3087.5 },
  })

const createMediumConfidenceForecast = (): TaxForecastType =>
  createMockForecast({
    confidence: 'medium',
    dataPointsUsed: 4,
    projectionRange: { low: 1900, high: 2850 },
  })

const createRefundForecast = (): TaxForecastType =>
  createMockForecast({
    projectedIncome: 5000,
    projectedExpenses: 15000,
    projectedUmsatzsteuer: 950,
    projectedVorsteuer: 2850,
    estimatedZahllast: -1900,
    projectionRange: { low: -2090, high: -1710 },
  })

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('TaxForecast', () => {
  describe('rendering', () => {
    it('renders the forecast period', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText('2024-Q2')).toBeInTheDocument()
    })

    it('renders the estimated Zahllast amount', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      // Should show €2.375 (German formatting)
      expect(screen.getByText(/2\.375/)).toBeInTheDocument()
    })

    it('renders projected income and expenses', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText(/18\.000/)).toBeInTheDocument() // Income
      expect(screen.getByText(/5\.500/)).toBeInTheDocument() // Expenses
    })

    it('renders USt and Vorsteuer breakdown', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText(/3\.420/)).toBeInTheDocument() // USt
      expect(screen.getByText(/1\.045/)).toBeInTheDocument() // Vorsteuer
    })

    it('renders due date', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText(/10\.07\.2024|10.07.2024|Jul 10/i)).toBeInTheDocument()
    })

    it('renders projection range', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      // Should show range values
      expect(screen.getByText(/2\.137|2\.138/)).toBeInTheDocument()
      expect(screen.getByText(/2\.612|2\.613/)).toBeInTheDocument()
    })
  })

  describe('confidence indicators', () => {
    it('renders high confidence badge', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText(/high/i)).toBeInTheDocument()
    })

    it('renders medium confidence badge', () => {
      render(<TaxForecast forecast={createMediumConfidenceForecast()} />)

      expect(screen.getByText(/medium/i)).toBeInTheDocument()
    })

    it('renders low confidence badge', () => {
      render(<TaxForecast forecast={createLowConfidenceForecast()} />)

      expect(screen.getByText(/low/i)).toBeInTheDocument()
    })

    it('shows data points used', () => {
      render(<TaxForecast forecast={createMockForecast()} />)

      expect(screen.getByText(/6 months of data/)).toBeInTheDocument()
    })
  })

  describe('refund scenario', () => {
    it('indicates refund when Zahllast is negative', () => {
      render(<TaxForecast forecast={createRefundForecast()} />)

      // Should indicate this is a refund
      expect(screen.getByText(/refund|erstattung/i)).toBeInTheDocument()
    })

    it('shows negative amount correctly', () => {
      render(<TaxForecast forecast={createRefundForecast()} />)

      expect(screen.getByText(/-.*1\.900|1\.900.*-/)).toBeInTheDocument()
    })
  })

  describe('Dauerfrist indicator', () => {
    it('does not show Dauerfrist when false', () => {
      render(<TaxForecast forecast={createMockForecast({ hasDauerfrist: false })} />)

      expect(screen.queryByText(/dauerfrist/i)).not.toBeInTheDocument()
    })

    it('shows Dauerfrist badge when true', () => {
      render(<TaxForecast forecast={createMockForecast({ hasDauerfrist: true })} />)

      expect(screen.getByText(/dauerfrist/i)).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <TaxForecast forecast={createMockForecast()} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders as compact variant', () => {
      render(<TaxForecast forecast={createMockForecast()} variant="compact" />)

      // Should still show key information
      expect(screen.getByText('2024-Q2')).toBeInTheDocument()
      expect(screen.getByText(/2\.375/)).toBeInTheDocument()
    })
  })
})
