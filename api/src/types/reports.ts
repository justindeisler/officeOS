/**
 * BWA & SUSA Report Types
 *
 * Type definitions for Betriebswirtschaftliche Auswertung (BWA)
 * and Summen- und Saldenliste (SuSa) reports.
 *
 * BWA = Monthly P&L overview (the most requested report by tax advisors)
 * SuSa = Trial balance with account-level debit/credit totals
 */

// ============================================================================
// BWA (Betriebswirtschaftliche Auswertung)
// ============================================================================

export interface MonthlyAggregate {
  year: number;
  month: number;
  income: {
    total: number;
    by_category: Record<string, number>;
    by_vat_rate: Record<number, number>;
  };
  expenses: {
    total: number;
    by_category: Record<string, number>;
    by_euer_line: Record<number, number>;
  };
  profit: number;
  vat_liability: number;
}

export interface BWAReport {
  year: number;
  months: MonthlyAggregate[];
  totals: {
    income: number;
    expenses: number;
    profit: number;
    profit_margin_percent: number;
  };
}

// ============================================================================
// SuSa (Summen- und Saldenliste)
// ============================================================================

export interface SuSaAccount {
  account_number: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface SuSaReport {
  year: number;
  accounts: SuSaAccount[];
}

// ============================================================================
// Profitability Reports
// ============================================================================

export interface ClientProfitability {
  client_id: string;
  client_name: string;
  income: number;
  expenses: number;
  profit: number;
  profit_margin_percent: number;
}

export interface CategoryProfitability {
  category: string;
  category_name: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface ProfitabilityByClientReport {
  year: number;
  clients: ClientProfitability[];
  unassigned: {
    income: number;
    expenses: number;
    profit: number;
  };
}

export interface ProfitabilityByCategoryReport {
  year: number;
  income_categories: Array<{
    category: string;
    total: number;
  }>;
  expense_categories: Array<{
    category: string;
    category_name: string;
    total: number;
  }>;
}
