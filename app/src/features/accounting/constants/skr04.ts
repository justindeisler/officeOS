/**
 * SKR04 Chart of Accounts (Standardkontenrahmen 04)
 *
 * Alternative German standard chart of accounts, often used by
 * industrial and manufacturing companies.
 *
 * Account number ranges:
 * - 0xxx: Fixed assets
 * - 1xxx: Financial assets
 * - 2xxx: Inventories
 * - 3xxx: Receivables
 * - 4xxx: Revenue/Income
 * - 5xxx: Materials
 * - 6xxx: Operating expenses
 * - 7xxx: Other expenses
 */

import type { SkrAccount, EuerToSkrMapping } from '../types/datev'
import type { VatRate } from '../types'

// ============================================================================
// SKR04 ACCOUNT DEFINITIONS
// ============================================================================

/**
 * SKR04 account catalog
 * Key is the account number as string for easy lookup
 */
export const SKR04_ACCOUNTS: Record<string, SkrAccount> = {
  // Financial accounts
  '1800': {
    number: 1800,
    name: 'Bank',
    description: 'Bankkonten',
    isIncome: false,
  },
  '1460': {
    number: 1460,
    name: 'Vorsteuer 7%',
    description: 'Abziehbare Vorsteuer 7%',
    isIncome: false,
    defaultVatRate: 7,
  },
  '1406': {
    number: 1406,
    name: 'Vorsteuer 19%',
    description: 'Abziehbare Vorsteuer 19%',
    isIncome: false,
    defaultVatRate: 19,
  },
  '3806': {
    number: 3806,
    name: 'Umsatzsteuer 19%',
    description: 'Umsatzsteuer 19%',
    isIncome: false,
    defaultVatRate: 19,
  },
  '3801': {
    number: 3801,
    name: 'Umsatzsteuer 7%',
    description: 'Umsatzsteuer 7%',
    isIncome: false,
    defaultVatRate: 7,
  },

  // Revenue accounts (4xxx in SKR04)
  '4300': {
    number: 4300,
    name: 'Erlöse 7%',
    description: 'Erlöse 7% USt',
    isIncome: true,
    defaultVatRate: 7,
  },
  '4400': {
    number: 4400,
    name: 'Erlöse 19%',
    description: 'Erlöse 19% USt',
    isIncome: true,
    defaultVatRate: 19,
  },
  '4120': {
    number: 4120,
    name: 'Erlöse steuerfrei',
    description: 'Steuerfreie Erlöse',
    isIncome: true,
    defaultVatRate: 0,
  },
  '4600': {
    number: 4600,
    name: 'Veräußerungserlöse',
    description: 'Erlöse aus Anlagenverkäufen',
    isIncome: true,
    defaultVatRate: 19,
  },
  '4955': {
    number: 4955,
    name: 'USt-Erstattung',
    description: 'Umsatzsteuer-Erstattungen vom Finanzamt',
    isIncome: true,
    defaultVatRate: 0,
  },

  // Material costs (5xxx)
  '5900': {
    number: 5900,
    name: 'Fremdleistungen',
    description: 'Fremdleistungen (Subunternehmer)',
    isIncome: false,
    defaultVatRate: 19,
  },

  // Operating expenses (6xxx)
  '6220': {
    number: 6220,
    name: 'AfA bewegliche WG',
    description: 'Abschreibungen auf bewegliche Wirtschaftsgüter',
    isIncome: false,
    defaultVatRate: 0,
  },
  '6310': {
    number: 6310,
    name: 'Arbeitszimmer',
    description: 'Aufwendungen häusliches Arbeitszimmer',
    isIncome: false,
    defaultVatRate: 0,
  },
  '6400': {
    number: 6400,
    name: 'Versicherungen',
    description: 'Versicherungen (außer KFZ)',
    isIncome: false,
    defaultVatRate: 0,
  },
  '6650': {
    number: 6650,
    name: 'Reisekosten',
    description: 'Reisekosten Unternehmer',
    isIncome: false,
    defaultVatRate: 19,
  },
  '6805': {
    number: 6805,
    name: 'Telekommunikation',
    description: 'Telefon und Internet',
    isIncome: false,
    defaultVatRate: 19,
  },
  '6815': {
    number: 6815,
    name: 'Software/IT',
    description: 'EDV-Kosten, Software, Lizenzen, Bürobedarf',
    isIncome: false,
    defaultVatRate: 19,
  },
  '6820': {
    number: 6820,
    name: 'Fortbildung',
    description: 'Fortbildungskosten',
    isIncome: false,
    defaultVatRate: 19,
  },
  '6821': {
    number: 6821,
    name: 'Fachliteratur',
    description: 'Zeitschriften, Bücher, Fachliteratur',
    isIncome: false,
    defaultVatRate: 7,
  },
  '6855': {
    number: 6855,
    name: 'Kontoführung',
    description: 'Nebenkosten des Geldverkehrs',
    isIncome: false,
    defaultVatRate: 0,
  },
  '6890': {
    number: 6890,
    name: 'Sonstige Kosten',
    description: 'Sonstige betriebliche Aufwendungen',
    isIncome: false,
    defaultVatRate: 19,
  },
}

// ============================================================================
// EÜR TO SKR04 MAPPINGS
// ============================================================================

/**
 * Mapping from EÜR categories to SKR04 accounts
 */
export const EUER_TO_SKR04_MAPPINGS: EuerToSkrMapping[] = [
  // Income categories
  {
    euerCategory: 'services',
    euerLine: 14,
    skr03Account: 8400,
    skr04Account: 4400,
    defaultVatRate: 19,
    isIncome: true,
  },
  {
    euerCategory: 'services_7',
    euerLine: 14,
    skr03Account: 8300,
    skr04Account: 4300,
    defaultVatRate: 7,
    isIncome: true,
  },
  {
    euerCategory: 'services_exempt',
    euerLine: 14,
    skr03Account: 8120,
    skr04Account: 4120,
    defaultVatRate: 0,
    isIncome: true,
  },
  {
    euerCategory: 'asset_sale',
    euerLine: 16,
    skr03Account: 8600,
    skr04Account: 4600,
    defaultVatRate: 19,
    isIncome: true,
  },
  {
    euerCategory: 'ust_refund',
    euerLine: 18,
    skr03Account: 8955,
    skr04Account: 4955,
    defaultVatRate: 0,
    isIncome: true,
  },

  // Expense categories
  {
    euerCategory: 'subcontractor',
    euerLine: 25,
    skr03Account: 3100,
    skr04Account: 5900,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'software',
    euerLine: 34,
    skr03Account: 4964,
    skr04Account: 6815,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'telecom',
    euerLine: 34,
    skr03Account: 4920,
    skr04Account: 6805,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'hosting',
    euerLine: 34,
    skr03Account: 4964,
    skr04Account: 6815,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'travel',
    euerLine: 34,
    skr03Account: 4670,
    skr04Account: 6650,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'insurance',
    euerLine: 34,
    skr03Account: 4360,
    skr04Account: 6400,
    defaultVatRate: 0,
    isIncome: false,
  },
  {
    euerCategory: 'bank_fees',
    euerLine: 34,
    skr03Account: 4970,
    skr04Account: 6855,
    defaultVatRate: 0,
    isIncome: false,
  },
  {
    euerCategory: 'training',
    euerLine: 34,
    skr03Account: 4945,
    skr04Account: 6820,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'books',
    euerLine: 34,
    skr03Account: 4940,
    skr04Account: 6821,
    defaultVatRate: 7,
    isIncome: false,
  },
  {
    euerCategory: 'office_supplies',
    euerLine: 34,
    skr03Account: 4930,
    skr04Account: 6815,
    defaultVatRate: 19,
    isIncome: false,
  },
  {
    euerCategory: 'home_office',
    euerLine: 33,
    skr03Account: 4288,
    skr04Account: 6310,
    defaultVatRate: 0,
    isIncome: false,
  },
  {
    euerCategory: 'depreciation',
    euerLine: 30,
    skr03Account: 4830,
    skr04Account: 6220,
    defaultVatRate: 0,
    isIncome: false,
  },
  {
    euerCategory: 'afa',
    euerLine: 30,
    skr03Account: 4830,
    skr04Account: 6220,
    defaultVatRate: 0,
    isIncome: false,
  },
  {
    euerCategory: 'other',
    euerLine: 34,
    skr03Account: 4980,
    skr04Account: 6890,
    defaultVatRate: 19,
    isIncome: false,
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get SKR04 account by number
 */
export function getSkr04Account(accountNumber: number): SkrAccount | undefined {
  return SKR04_ACCOUNTS[String(accountNumber)]
}

/**
 * Get SKR04 account number for an EÜR category
 */
export function getSkr04AccountForCategory(
  euerCategory: string,
  vatRate?: VatRate
): number {
  // Special handling for services based on VAT rate
  if (euerCategory === 'services') {
    if (vatRate === 7) return 4300
    if (vatRate === 0) return 4120
    return 4400 // Default 19%
  }

  const mapping = EUER_TO_SKR04_MAPPINGS.find(
    (m) => m.euerCategory === euerCategory
  )
  return mapping?.skr04Account ?? 6890 // Default to other expenses
}

/**
 * Get all income account numbers
 */
export function getSkr04IncomeAccounts(): number[] {
  return Object.values(SKR04_ACCOUNTS)
    .filter((acc) => acc.isIncome)
    .map((acc) => acc.number)
}

/**
 * Get all expense account numbers
 */
export function getSkr04ExpenseAccounts(): number[] {
  return Object.values(SKR04_ACCOUNTS)
    .filter((acc) => !acc.isIncome)
    .map((acc) => acc.number)
}

/**
 * Standard counter accounts for SKR04
 */
export const SKR04_COUNTER_ACCOUNTS = {
  BANK: 1800,
  CASH: 1600,
  TRANSIT: 1460,
} as const
