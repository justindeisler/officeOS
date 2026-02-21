import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { EInvoiceValidationResultDialog } from './EInvoiceValidationResult'
import type { EInvoiceValidationResult } from '@/lib/api'

describe('EInvoiceValidationResultDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    invoiceNumber: 'RE-2024-001',
  }

  it('renders nothing when result is null', () => {
    render(<EInvoiceValidationResultDialog {...defaultProps} result={null} />)
    expect(screen.queryByText('EN 16931 Validierung')).not.toBeInTheDocument()
  })

  it('shows validation passed for valid result', () => {
    const result: EInvoiceValidationResult = {
      invoiceId: 'inv-1',
      format: 'zugferd',
      valid: true,
      errors: [],
      warnings: [],
    }
    render(<EInvoiceValidationResultDialog {...defaultProps} result={result} />)
    expect(screen.getByText('Validierung bestanden')).toBeInTheDocument()
    expect(screen.getByText('ZUGFeRD')).toBeInTheDocument()
  })

  it('shows validation failed for invalid result', () => {
    const result: EInvoiceValidationResult = {
      invoiceId: 'inv-1',
      format: 'xrechnung-ubl',
      valid: false,
      errors: ['Missing buyer reference', 'Invalid Leitweg-ID'],
      warnings: ['Optional field missing'],
    }
    render(<EInvoiceValidationResultDialog {...defaultProps} result={result} />)
    expect(screen.getByText('Validierung fehlgeschlagen')).toBeInTheDocument()
    expect(screen.getByText('Missing buyer reference')).toBeInTheDocument()
    expect(screen.getByText('Invalid Leitweg-ID')).toBeInTheDocument()
    expect(screen.getByText('Optional field missing')).toBeInTheDocument()
  })

  it('shows invoice number in description', () => {
    const result: EInvoiceValidationResult = {
      invoiceId: 'inv-1',
      format: 'zugferd',
      valid: true,
      errors: [],
      warnings: [],
    }
    render(<EInvoiceValidationResultDialog {...defaultProps} result={result} />)
    expect(screen.getByText(/RE-2024-001/)).toBeInTheDocument()
  })

  it('shows error count', () => {
    const result: EInvoiceValidationResult = {
      invoiceId: 'inv-1',
      format: 'zugferd',
      valid: false,
      errors: ['Error 1', 'Error 2'],
      warnings: [],
    }
    render(<EInvoiceValidationResultDialog {...defaultProps} result={result} />)
    expect(screen.getByText(/Fehler \(2\)/)).toBeInTheDocument()
  })

  it('shows warning count', () => {
    const result: EInvoiceValidationResult = {
      invoiceId: 'inv-1',
      format: 'zugferd',
      valid: true,
      errors: [],
      warnings: ['Warning 1'],
    }
    render(<EInvoiceValidationResultDialog {...defaultProps} result={result} />)
    expect(screen.getByText(/Warnungen \(1\)/)).toBeInTheDocument()
  })
})
