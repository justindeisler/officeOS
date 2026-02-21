/**
 * SuSa (Summen- und Saldenliste) Calculation Service
 *
 * Generates a trial balance by mapping income/expense categories
 * to SKR03 account numbers. This is the standard format expected
 * by German tax advisors for account-level overview.
 *
 * SKR03 = Standardkontenrahmen 03 (most common chart of accounts for
 * small businesses and freelancers in Germany).
 */

import type Database from 'better-sqlite3';
import type { SuSaReport, SuSaAccount } from '../types/reports.js';

// ============================================================================
// SKR03 Account Mapping
// ============================================================================

/**
 * Maps income/expense categories to SKR03 account numbers.
 * These are the standard accounts used for Einnahmenüberschussrechnung (EÜR).
 */
export const SKR03_ACCOUNTS: Record<string, { number: string; name: string; type: 'income' | 'expense' }> = {
  // Income accounts (Erlöskonten)
  'services':        { number: '8400', name: 'Erlöse 19% USt', type: 'income' },
  'products':        { number: '8400', name: 'Erlöse 19% USt', type: 'income' },
  'consulting':      { number: '8400', name: 'Erlöse 19% USt', type: 'income' },
  'license':         { number: '8400', name: 'Erlöse 19% USt', type: 'income' },
  'services_7':      { number: '8300', name: 'Erlöse 7% USt', type: 'income' },
  'services_0':      { number: '8100', name: 'Steuerfreie Erlöse', type: 'income' },
  'reverse_charge':  { number: '8336', name: 'Erlöse Reverse Charge §13b', type: 'income' },

  // Expense accounts (Aufwandskonten)
  'software':        { number: '4964', name: 'Aufwand für Software & Lizenzen', type: 'expense' },
  'hosting':         { number: '4964', name: 'Aufwand für Software & Lizenzen', type: 'expense' },
  'telecom':         { number: '4920', name: 'Telefon / Internet', type: 'expense' },
  'hardware':        { number: '4980', name: 'Sonstige betriebliche Aufwendungen', type: 'expense' },
  'office_supplies': { number: '4930', name: 'Büromaterial', type: 'expense' },
  'travel':          { number: '4660', name: 'Reisekosten', type: 'expense' },
  'training':        { number: '4945', name: 'Fortbildungskosten', type: 'expense' },
  'books':           { number: '4940', name: 'Fachliteratur / Zeitschriften', type: 'expense' },
  'insurance':       { number: '4360', name: 'Versicherungen', type: 'expense' },
  'bank_fees':       { number: '4970', name: 'Nebenkosten des Geldverkehrs', type: 'expense' },
  'legal':           { number: '4950', name: 'Rechts- und Beratungskosten', type: 'expense' },
  'marketing':       { number: '4610', name: 'Werbekosten', type: 'expense' },
  'fremdleistungen': { number: '4580', name: 'Fremdleistungen', type: 'expense' },
  'depreciation':    { number: '4830', name: 'Abschreibungen auf Sachanlagen', type: 'expense' },
  'homeoffice':      { number: '4288', name: 'Aufwand häusliches Arbeitszimmer', type: 'expense' },
  'other':           { number: '4980', name: 'Sonstige betriebliche Aufwendungen', type: 'expense' },

  // Special accounts
  'vorsteuer':       { number: '1576', name: 'Abziehbare Vorsteuer 19%', type: 'expense' },
  'umsatzsteuer':    { number: '1776', name: 'Umsatzsteuer 19%', type: 'income' },
  'ust_erstattung':  { number: '1545', name: 'USt-Erstattung Finanzamt', type: 'income' },
};

// ============================================================================
// Database Row Types
// ============================================================================

interface IncomeAggRow {
  euer_category: string | null;
  vat_rate: number;
  total_net: number;
  total_vat: number;
}

interface ExpenseAggRow {
  category: string;
  total_net: number;
  total_vat: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a Summen- und Saldenliste (trial balance) for a given year.
 *
 * Groups income/expenses by category, maps to SKR03 accounts,
 * and calculates debit/credit balances.
 */
export function generateSuSa(db: Database.Database, year: number): SuSaReport {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Aggregate income by category and VAT rate
  const incomeRows = db.prepare(
    `SELECT euer_category, vat_rate,
            SUM(net_amount) as total_net,
            SUM(vat_amount) as total_vat
     FROM income
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     GROUP BY euer_category, vat_rate`
  ).all(startDate, endDate) as IncomeAggRow[];

  // Aggregate expenses by category
  const expenseRows = db.prepare(
    `SELECT category,
            SUM(net_amount * (COALESCE(deductible_percent, 100) / 100.0)) as total_net,
            SUM(vat_amount * (COALESCE(deductible_percent, 100) / 100.0)) as total_vat
     FROM expenses
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     GROUP BY category`
  ).all(startDate, endDate) as ExpenseAggRow[];

  // Build account map: account_number -> accumulated values
  const accountMap = new Map<string, SuSaAccount>();

  const getOrCreateAccount = (number: string, name: string): SuSaAccount => {
    let account = accountMap.get(number);
    if (!account) {
      account = { account_number: number, account_name: name, debit: 0, credit: 0, balance: 0 };
      accountMap.set(number, account);
    }
    return account;
  };

  // Process income → credit side (Haben)
  let totalOutputVat = 0;
  for (const row of incomeRows) {
    const category = row.euer_category || 'services';
    let accountKey = category;

    // Map by VAT rate for income
    if (row.vat_rate === 7) {
      accountKey = 'services_7';
    } else if (row.vat_rate === 0) {
      accountKey = 'services_0';
    }

    const mapping = SKR03_ACCOUNTS[accountKey] || SKR03_ACCOUNTS['services']!;
    const account = getOrCreateAccount(mapping.number, mapping.name);
    account.credit = round(account.credit + row.total_net);

    totalOutputVat += row.total_vat;
  }

  // Add output VAT account (Umsatzsteuer)
  if (totalOutputVat > 0) {
    const ustMapping = SKR03_ACCOUNTS['umsatzsteuer']!;
    const ustAccount = getOrCreateAccount(ustMapping.number, ustMapping.name);
    ustAccount.credit = round(ustAccount.credit + totalOutputVat);
  }

  // Process expenses → debit side (Soll)
  let totalInputVat = 0;
  for (const row of expenseRows) {
    const mapping = SKR03_ACCOUNTS[row.category] || SKR03_ACCOUNTS['other']!;
    const account = getOrCreateAccount(mapping.number, mapping.name);
    account.debit = round(account.debit + row.total_net);

    totalInputVat += row.total_vat;
  }

  // Add input VAT account (Vorsteuer)
  if (totalInputVat > 0) {
    const vstMapping = SKR03_ACCOUNTS['vorsteuer']!;
    const vstAccount = getOrCreateAccount(vstMapping.number, vstMapping.name);
    vstAccount.debit = round(vstAccount.debit + totalInputVat);
  }

  // Calculate balances and sort by account number
  const accounts = Array.from(accountMap.values()).map(account => ({
    ...account,
    balance: round(account.debit - account.credit),
  }));

  accounts.sort((a, b) => a.account_number.localeCompare(b.account_number));

  return {
    year,
    accounts,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
