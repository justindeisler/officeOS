/**
 * SKR03 Chart of Accounts (Standardkontenrahmen 03)
 *
 * The most commonly used German standard chart of accounts for
 * small and medium-sized businesses.
 *
 * Account number ranges:
 * - 0xxx: Fixed assets and financial investments
 * - 1xxx: Financial accounts (bank, cash)
 * - 2xxx: Liabilities and provisions
 * - 3xxx: Materials and goods
 * - 4xxx: Operating expenses
 * - 8xxx: Revenue/Income
 * - 9xxx: Statistical accounts
 */

import type { SkrAccount, EuerToSkrMapping } from '../types/datev'
import type { VatRate } from '../types'

// ============================================================================
// SKR03 ACCOUNT DEFINITIONS
// ============================================================================

/**
 * SKR03 account catalog
 * Key is the account number as string for easy lookup
 */
export const SKR03_ACCOUNTS: Record<string, SkrAccount> = {
  // Financial accounts
  '1200': {
    number: 1200,
    name: 'Bank',
    description: 'Bankkonten',
    isIncome: false,
  },
  '1360': {
    number: 1360,
    name: 'Geldtransit',
    description: 'Geldtransitkonto',
    isIncome: false,
  },
  '1571': {
    number: 1571,
    name: 'Vorsteuer 7%',
    description: 'Abziehbare Vorsteuer 7%',
    isIncome: false,
    defaultVatRate: 7,
  },
  '1576': {
    number: 1576,
    name: 'Vorsteuer 19%',
    description: 'Abziehbare Vorsteuer 19%',
    isIncome: false,
    defaultVatRate: 19,
  },
  '1776': {
    number: 1776,
    name: 'Umsatzsteuer 19%',
    description: 'Umsatzsteuer 19%',
    isIncome: false,
    defaultVatRate: 19,
  },
  '1771': {
    number: 1771,
    name: 'Umsatzsteuer 7%',
    description: 'Umsatzsteuer 7%',
    isIncome: false,
    defaultVatRate: 7,
  },

  // Materials and goods (Subcontractor costs)
  '3100': {
    number: 3100,
    name: 'Fremdleistungen',
    description: 'Fremdleistungen (Subunternehmer)',
    isIncome: false,
    defaultVatRate: 19,
  },

  // Operating expenses
  '4288': {
    number: 4288,
    name: 'Arbeitszimmer',
    description: 'Aufwendungen häusliches Arbeitszimmer',
    isIncome: false,
    defaultVatRate: 0,
  },
  '4360': {
    number: 4360,
    name: 'Versicherungen',
    description: 'Versicherungen (außer KFZ)',
    isIncome: false,
    defaultVatRate: 0,
  },
  '4670': {
    number: 4670,
    name: 'Reisekosten',
    description: 'Reisekosten Unternehmer',
    isIncome: false,
    defaultVatRate: 19,
  },
  '4830': {
    number: 4830,
    name: 'AfA bewegliche WG',
    description: 'Abschreibungen auf bewegliche Wirtschaftsgüter',
    isIncome: false,
    defaultVatRate: 0,
  },
  '4920': {
    number: 4920,
    name: 'Telekommunikation',
    description: 'Telefon und Internet',
    isIncome: false,
    defaultVatRate: 19,
  },
  '4930': {
    number: 4930,
    name: 'Bürobedarf',
    description: 'Bürobedarf',
    isIncome: false,
    defaultVatRate: 19,
  },
  '4940': {
    number: 4940,
    name: 'Fachliteratur',
    description: 'Zeitschriften, Bücher, Fachliteratur',
    isIncome: false,
    defaultVatRate: 7,
  },
  '4945': {
    number: 4945,
    name: 'Fortbildung',
    description: 'Fortbildungskosten',
    isIncome: false,
    defaultVatRate: 19,
  },
  '4964': {
    number: 4964,
    name: 'Software/IT',
    description: 'EDV-Kosten, Software, Lizenzen',
    isIncome: false,
    defaultVatRate: 19,
  },
  '4970': {
    number: 4970,
    name: 'Kontoführung',
    description: 'Nebenkosten des Geldverkehrs',
    isIncome: false,
    defaultVatRate: 0,
  },
  '4980': {
    number: 4980,
    name: 'Sonstige Kosten',
    description: 'Sonstige betriebliche Aufwendungen',
    isIncome: false,
    defaultVatRate: 19,
  },

  // Revenue accounts
  '8300': {
    number: 8300,
    name: 'Erlöse 7%',
    description: 'Erlöse 7% USt',
    isIncome: true,
    defaultVatRate: 7,
  },
  '8400': {
    number: 8400,
    name: 'Erlöse 19%',
    description: 'Erlöse 19% USt',
    isIncome: true,
    defaultVatRate: 19,
  },
  '8120': {
    number: 8120,
    name: 'Erlöse steuerfrei',
    description: 'Steuerfreie Erlöse',
    isIncome: true,
    defaultVatRate: 0,
  },
  '8600': {
    number: 8600,
    name: 'Veräußerungserlöse',
    description: 'Erlöse aus Anlagenverkäufen',
    isIncome: true,
    defaultVatRate: 19,
  },
  '8955': {
    number: 8955,
    name: 'USt-Erstattung',
    description: 'Umsatzsteuer-Erstattungen vom Finanzamt',
    isIncome: true,
    defaultVatRate: 0,
  },
}

// ============================================================================
// EÜR TO SKR03 MAPPINGS
// ============================================================================

/**
 * Mapping from EÜR categories to SKR03 accounts
 * Based on EUER_LINES and EXPENSE_CATEGORIES from types/index.ts
 */
export const EUER_TO_SKR03_MAPPINGS: EuerToSkrMapping[] = [
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
 * Get SKR03 account by number
 */
export function getSkr03Account(accountNumber: number): SkrAccount | undefined {
  return SKR03_ACCOUNTS[String(accountNumber)]
}

/**
 * Get SKR03 account number for an EÜR category
 */
export function getSkr03AccountForCategory(
  euerCategory: string,
  vatRate?: VatRate
): number {
  // Special handling for services based on VAT rate
  if (euerCategory === 'services') {
    if (vatRate === 7) return 8300
    if (vatRate === 0) return 8120
    return 8400 // Default 19%
  }

  const mapping = EUER_TO_SKR03_MAPPINGS.find(
    (m) => m.euerCategory === euerCategory
  )
  return mapping?.skr03Account ?? 4980 // Default to other expenses
}

/**
 * Get all income account numbers
 */
export function getSkr03IncomeAccounts(): number[] {
  return Object.values(SKR03_ACCOUNTS)
    .filter((acc) => acc.isIncome)
    .map((acc) => acc.number)
}

/**
 * Get all expense account numbers
 */
export function getSkr03ExpenseAccounts(): number[] {
  return Object.values(SKR03_ACCOUNTS)
    .filter((acc) => !acc.isIncome)
    .map((acc) => acc.number)
}

/**
 * Standard counter accounts
 */
export const SKR03_COUNTER_ACCOUNTS = {
  BANK: 1200,
  CASH: 1000,
  TRANSIT: 1360,
} as const
