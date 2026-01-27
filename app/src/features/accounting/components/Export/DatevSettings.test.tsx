/**
 * DatevSettings Component Tests
 *
 * Tests for the DATEV export settings panel.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatevSettings } from './DatevSettings'
import { useDatevExport } from '../../hooks/useDatevExport'
import { renderHook } from '@testing-library/react'

// ============================================================================
// TEST SETUP
// ============================================================================

function renderWithHook() {
  const { result } = renderHook(() => useDatevExport())
  const { rerender } = render(<DatevSettings exportState={result.current} />)

  return { result, rerender: () => rerender(<DatevSettings exportState={result.current} />) }
}

// ============================================================================
// TESTS
// ============================================================================

describe('DatevSettings', () => {
  describe('rendering', () => {
    it('should render period type selector', () => {
      renderWithHook()
      expect(screen.getByLabelText(/zeitraumtyp/i)).toBeInTheDocument()
    })

    it('should render year selector', () => {
      renderWithHook()
      expect(screen.getByLabelText(/jahr/i)).toBeInTheDocument()
    })

    it('should render chart of accounts selector', () => {
      renderWithHook()
      expect(screen.getByLabelText(/kontenrahmen/i)).toBeInTheDocument()
    })

    it('should render format selector', () => {
      renderWithHook()
      expect(screen.getByLabelText(/exportformat/i)).toBeInTheDocument()
    })

    it('should render consultant number input', () => {
      renderWithHook()
      expect(screen.getByLabelText(/beraternummer/i)).toBeInTheDocument()
    })

    it('should render client number input', () => {
      renderWithHook()
      expect(screen.getByLabelText(/mandantennummer/i)).toBeInTheDocument()
    })

    it('should render transaction type checkboxes', () => {
      renderWithHook()
      expect(screen.getByLabelText(/einnahmen/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ausgaben/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/abschreibungen/i)).toBeInTheDocument()
    })
  })

  describe('period type selection', () => {
    it('should show quarter selector when period type is quarter', () => {
      const { result } = renderHook(() => useDatevExport({ periodType: 'quarter' }))
      render(<DatevSettings exportState={result.current} />)

      expect(screen.getByLabelText(/quartal/i)).toBeInTheDocument()
    })

    it('should show month selector when period type is month', () => {
      const { result } = renderHook(() => useDatevExport({ periodType: 'month' }))
      render(<DatevSettings exportState={result.current} />)

      expect(screen.getByLabelText(/monat/i)).toBeInTheDocument()
    })

    it('should show date inputs when period type is custom', () => {
      const { result } = renderHook(() => useDatevExport({ periodType: 'custom' }))
      render(<DatevSettings exportState={result.current} />)

      expect(screen.getByLabelText(/von/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/bis/i)).toBeInTheDocument()
    })
  })

  describe('default values', () => {
    it('should have SKR03 as default chart of accounts', () => {
      renderWithHook()
      const select = screen.getByLabelText(/kontenrahmen/i) as HTMLSelectElement
      expect(select.value).toBe('SKR03')
    })

    it('should have CSV as default format', () => {
      renderWithHook()
      const select = screen.getByLabelText(/exportformat/i) as HTMLSelectElement
      expect(select.value).toBe('csv')
    })

    it('should have all transaction types checked by default', () => {
      renderWithHook()
      expect(screen.getByLabelText(/einnahmen/i)).toBeChecked()
      expect(screen.getByLabelText(/ausgaben/i)).toBeChecked()
      expect(screen.getByLabelText(/abschreibungen/i)).toBeChecked()
    })
  })

  describe('accessibility', () => {
    it('should have form role', () => {
      renderWithHook()
      expect(screen.getByRole('form')).toBeInTheDocument()
    })

    it('should have aria-label on form', () => {
      renderWithHook()
      expect(
        screen.getByRole('form', { name: /datev export einstellungen/i })
      ).toBeInTheDocument()
    })

    it('should have fieldset groups', () => {
      renderWithHook()
      // Fieldsets are rendered as groups in the accessibility tree
      const groups = screen.getAllByRole('group')
      expect(groups.length).toBeGreaterThanOrEqual(3) // Zeitraum, Format, Metadaten, Zu exportieren
    })
  })

  describe('validation errors', () => {
    it('should display validation errors when present', () => {
      const { result } = renderHook(() =>
        useDatevExport({
          periodType: 'custom',
          customStartDate: null,
          customEndDate: null,
        })
      )
      render(<DatevSettings exportState={result.current} />)

      expect(
        screen.getByText(/start date is required for custom period/i)
      ).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('should disable all inputs when disabled prop is true', () => {
      const { result } = renderHook(() => useDatevExport())
      render(<DatevSettings exportState={result.current} disabled={true} />)

      const periodTypeSelect = screen.getByLabelText(/zeitraumtyp/i)
      expect(periodTypeSelect).toBeDisabled()
    })
  })

  describe('select options', () => {
    it('should have SKR03 and SKR04 chart options', () => {
      renderWithHook()
      const select = screen.getByLabelText(/kontenrahmen/i)

      expect(select).toContainHTML('SKR03')
      expect(select).toContainHTML('SKR04')
    })

    it('should have CSV and XML format options', () => {
      renderWithHook()
      const select = screen.getByLabelText(/exportformat/i)

      expect(select).toContainHTML('CSV')
      expect(select).toContainHTML('XML')
    })

    it('should have quarter options', () => {
      const { result } = renderHook(() => useDatevExport({ periodType: 'quarter' }))
      render(<DatevSettings exportState={result.current} />)

      const select = screen.getByLabelText(/quartal/i)
      expect(select).toContainHTML('Q1')
      expect(select).toContainHTML('Q4')
    })
  })
})
