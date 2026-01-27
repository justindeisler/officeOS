/**
 * DATEV Export Types
 *
 * TypeScript interfaces for DATEV-compliant data export.
 * Supports both CSV (Buchungsstapel) and XML (LedgerImport v6) formats.
 */

import type { VatRate } from './index'

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

/** Supported German Standard Chart of Accounts */
export type ChartOfAccounts = 'SKR03' | 'SKR04'

/** DATEV BU-Schlüssel (VAT code) */
export type DatevVatCode = 0 | 2 | 3

/** Debit/Credit indicator */
export type DebitCredit = 'S' | 'H' // S=Soll (Debit), H=Haben (Credit)

// ============================================================================
// DATEV RECORD (21-field Buchungsstapel format)
// ============================================================================

/**
 * DATEV Buchungsstapel record (CSV format v10.0+)
 * Contains all 21 standard fields required for DATEV import
 */
export interface DatevRecord {
  /** 1. Umsatz - Transaction amount (without sign) */
  amount: number

  /** 2. Soll/Haben-Kennzeichen - S=Debit, H=Credit */
  debitCredit: DebitCredit

  /** 3. WKZ Umsatz - Currency code (always EUR) */
  currency: string

  /** 4. Kurs - Exchange rate (empty for EUR) */
  exchangeRate: string

  /** 5. Basis-Umsatz - Base amount (same as amount for EUR) */
  baseAmount: number

  /** 6. Konto - Account number (e.g., 8400 for income) */
  account: number

  /** 7. Gegenkonto - Counter account (e.g., 1200 for bank) */
  counterAccount: number

  /** 8. BU-Schlüssel - VAT code (0=exempt, 2=7%, 3=19%) */
  vatCode: DatevVatCode

  /** 9. Belegdatum - Document date (DDMM format) */
  documentDate: string

  /** 10. Belegfeld 1 - Document reference (e.g., invoice number) */
  documentRef1: string

  /** 11. Belegfeld 2 - Additional reference */
  documentRef2: string

  /** 12. Skonto - Discount amount */
  discount: number

  /** 13. Buchungstext - Booking description */
  description: string

  /** 14. Postensperre - Blocking indicator (0=not blocked) */
  blocked: number

  /** 15. Diverse Adressnummer - Customer/vendor number */
  addressNumber: string

  /** 16. Geschäftspartnerbank - Partner bank code */
  partnerBank: string

  /** 17. Sachverhalt - Business case code */
  businessCase: string

  /** 18. Zinssperre - Interest blocking (0=not blocked) */
  interestBlocked: number

  /** 19. Beleglink - Document link/path */
  documentLink: string

  /** 20. Beleginfo - Art 1 - Document info type */
  documentInfoType: string

  /** 21. Beleginfo - Inhalt 1 - Document info content */
  documentInfoContent: string
}

// ============================================================================
// EXPORT OPTIONS
// ============================================================================

/** Period type for export selection */
export type ExportPeriod = 'month' | 'quarter' | 'year' | 'custom'

/** Export format */
export type ExportFormat = 'csv' | 'xml'

/**
 * Options for DATEV export
 */
export interface DatevExportOptions {
  /** Start date of export period */
  startDate: Date

  /** End date of export period */
  endDate: Date

  /** Chart of accounts to use */
  chartOfAccounts: ChartOfAccounts

  /** Export format */
  format: ExportFormat

  /** DATEV consultant number (Beraternummer) */
  consultantNumber?: string

  /** DATEV client number (Mandantennummer) */
  clientNumber?: string

  /** Include income transactions */
  includeIncome?: boolean

  /** Include expense transactions */
  includeExpenses?: boolean

  /** Include asset depreciation */
  includeDepreciation?: boolean
}

/**
 * Default DATEV record with all fields initialized
 */
export function createEmptyDatevRecord(): DatevRecord {
  return {
    amount: 0,
    debitCredit: 'S',
    currency: 'EUR',
    exchangeRate: '',
    baseAmount: 0,
    account: 0,
    counterAccount: 1200, // Default bank account
    vatCode: 0,
    documentDate: '',
    documentRef1: '',
    documentRef2: '',
    discount: 0,
    description: '',
    blocked: 0,
    addressNumber: '',
    partnerBank: '',
    businessCase: '',
    interestBlocked: 0,
    documentLink: '',
    documentInfoType: '',
    documentInfoContent: '',
  }
}

// ============================================================================
// SKR ACCOUNT MAPPING
// ============================================================================

/**
 * SKR account definition
 */
export interface SkrAccount {
  /** Account number */
  number: number

  /** Account name (German) */
  name: string

  /** Account description */
  description?: string

  /** Whether this is an income account */
  isIncome: boolean

  /** Default VAT rate for this account */
  defaultVatRate?: VatRate
}

/**
 * Mapping from EÜR category to SKR account
 */
export interface EuerToSkrMapping {
  /** EÜR category key */
  euerCategory: string

  /** EÜR line number */
  euerLine: number

  /** SKR03 account number */
  skr03Account: number

  /** SKR04 account number */
  skr04Account: number

  /** Default VAT rate */
  defaultVatRate: VatRate

  /** Is this an income category */
  isIncome: boolean
}

// ============================================================================
// EXPORT RESULT
// ============================================================================

/**
 * Result of DATEV export generation
 */
export interface DatevExportResult {
  /** Generated records */
  records: DatevRecord[]

  /** Total count of records */
  recordCount: number

  /** Start date of period */
  startDate: Date

  /** End date of period */
  endDate: Date

  /** Chart of accounts used */
  chartOfAccounts: ChartOfAccounts

  /** Format generated */
  format: ExportFormat

  /** Validation errors if any */
  errors: string[]

  /** Validation warnings if any */
  warnings: string[]
}

/**
 * Preview information before export
 */
export interface DatevExportPreview {
  /** Number of income records */
  incomeCount: number

  /** Number of expense records */
  expenseCount: number

  /** Number of depreciation records */
  depreciationCount: number

  /** Total records to export */
  totalCount: number

  /** Total income amount */
  totalIncome: number

  /** Total expense amount */
  totalExpenses: number

  /** Date range */
  startDate: Date
  endDate: Date
}
