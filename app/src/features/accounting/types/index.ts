/**
 * TypeScript Interfaces for Accounting Feature
 *
 * Comprehensive type definitions for German freelancer accounting:
 * - Income & Expense tracking with VAT
 * - Invoice generation
 * - Asset management with depreciation (AfA)
 * - Tax reports (USt-Voranmeldung, EÜR)
 */

// ============================================================================
// VAT TYPES
// ============================================================================

/** Valid German VAT rates */
export type VatRate = 0 | 7 | 19;

/** Invoice status */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

/** Asset status */
export type AssetStatus = 'active' | 'disposed' | 'sold';

/** AfA depreciation method */
export type AfaMethod = 'linear' | 'immediate' | 'pool';

/** Asset category for AfA-Tabelle lookup */
export type AssetCategory = 'computer' | 'furniture' | 'equipment' | 'software' | 'phone';

/** Recurring frequency for expenses */
export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

/** EÜR entry type */
export type EuerType = 'income' | 'expense';

/** Payment methods */
export type PaymentMethod = 'bank_transfer' | 'paypal' | 'credit_card' | 'cash' | 'other';

// ============================================================================
// CLIENT
// ============================================================================

export interface Client {
  id: string;
  name: string;
  address?: string;
  vatId?: string; // USt-IdNr
  email?: string;
  createdAt: Date;
}

export interface NewClient {
  name: string;
  address?: string;
  vatId?: string;
  email?: string;
}

// ============================================================================
// INCOME
// ============================================================================

export interface Income {
  id: string;
  date: Date; // Zufluss-Datum (cash basis)
  clientId?: string;
  invoiceId?: string;
  description: string;
  netAmount: number;
  vatRate: VatRate;
  vatAmount: number;
  grossAmount: number;
  euerLine: number;
  euerCategory: string;
  paymentMethod?: PaymentMethod;
  bankReference?: string;
  ustPeriod?: string; // e.g., "2024-Q1"
  ustReported: boolean;
  createdAt: Date;
}

export interface NewIncome {
  date: Date;
  clientId?: string;
  invoiceId?: string;
  description: string;
  netAmount: number;
  vatRate: VatRate;
  euerLine?: number;
  euerCategory?: string;
  paymentMethod?: PaymentMethod;
  bankReference?: string;
  ustPeriod?: string;
}

// ============================================================================
// EXPENSE
// ============================================================================

export interface Expense {
  id: string;
  date: Date; // Abfluss-Datum (cash basis)
  vendor: string;
  description: string;
  netAmount: number;
  vatRate: VatRate;
  vatAmount: number; // Vorsteuer
  grossAmount: number;
  euerLine: number;
  euerCategory: string;
  deductiblePercent: number;
  paymentMethod?: PaymentMethod;
  receiptPath?: string;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  ustPeriod?: string;
  vorsteuerClaimed: boolean;
  isGwg: boolean;
  assetId?: string;
  createdAt: Date;
}

export interface NewExpense {
  date: Date;
  vendor: string;
  description: string;
  netAmount: number;
  vatRate: VatRate;
  euerLine: number;
  euerCategory: string;
  deductiblePercent?: number;
  paymentMethod?: PaymentMethod;
  receiptPath?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  ustPeriod?: string;
  assetId?: string;
}

// ============================================================================
// INVOICE
// ============================================================================

export interface Invoice {
  id: string;
  invoiceNumber: string; // RE-2024-001
  invoiceDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  clientId?: string;
  projectId?: string;
  subtotal: number;
  vatRate: VatRate;
  vatAmount: number;
  total: number;
  paymentDate?: Date;
  paymentMethod?: PaymentMethod;
  notes?: string;
  items: InvoiceItem[];
  createdAt: Date;
}

export interface NewInvoice {
  invoiceDate: Date;
  dueDate: Date;
  clientId?: string;
  projectId?: string;
  vatRate: VatRate;
  notes?: string;
  items: NewInvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface NewInvoiceItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

// ============================================================================
// ASSET & DEPRECIATION
// ============================================================================

export interface Asset {
  id: string;
  name: string;
  description?: string;
  purchaseDate: Date;
  vendor?: string;
  purchasePrice: number; // Netto
  vatPaid: number;
  grossPrice: number;
  afaMethod: AfaMethod;
  afaYears: number;
  afaStartDate: Date;
  afaAnnualAmount: number;
  status: AssetStatus;
  disposalDate?: Date;
  disposalPrice?: number;
  disposalReason?: string;
  euerLine: number;
  euerCategory: string;
  category: AssetCategory;
  inventoryNumber?: string;
  location?: string;
  billPath?: string; // Path to attached bill/invoice PDF
  depreciationSchedule: DepreciationEntry[];
  createdAt: Date;
}

export interface NewAsset {
  name: string;
  description?: string;
  purchaseDate: Date;
  vendor?: string;
  purchasePrice: number;
  vatRate: VatRate;
  afaYears: number;
  afaMethod?: AfaMethod;
  category: AssetCategory;
  inventoryNumber?: string;
  location?: string;
  billPath?: string; // Path to attached bill/invoice PDF
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  year: number;
  months: number;
  amount: number;
  cumulative: number;
  bookValue: number;
}

// ============================================================================
// EÜR CATEGORIES
// ============================================================================

export interface EuerCategory {
  id: string;
  lineNumber: number;
  name: string;
  description?: string;
  type: EuerType;
  vorsteuerEligible: boolean;
}

// ============================================================================
// TAX REPORTS
// ============================================================================

/** Quarterly VAT declaration (USt-Voranmeldung) */
export interface UstVoranmeldung {
  period: string; // "2024-Q1"
  year: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: Date;
  endDate: Date;
  umsatzsteuer19: number; // Output VAT at 19%
  umsatzsteuer7: number; // Output VAT at 7%
  totalUmsatzsteuer: number;
  vorsteuer: number; // Input VAT
  zahllast: number; // Positive = owe, Negative = refund
  status: 'draft' | 'filed';
  filedDate?: Date;
}

/** Annual profit calculation (EÜR Report) */
export interface EuerReport {
  year: number;
  income: Record<number, number>; // Line number -> amount
  expenses: Record<number, number>; // Line number -> amount
  totalIncome: number;
  totalExpenses: number;
  gewinn: number; // Profit
}

// ============================================================================
// GERMAN TAX CONSTANTS
// ============================================================================

/** EÜR Line Numbers */
export const EUER_LINES = {
  // Income
  BETRIEBSEINNAHMEN: 14, // Standard taxable business income
  ENTNAHME_VERKAUF: 16, // Gains from asset sales (Veräußerungsgewinne)
  UST_ERSTATTUNG: 18, // VAT refunds from tax office

  // Expenses
  FREMDLEISTUNGEN: 25, // Subcontractors, freelancers
  VORSTEUER: 27, // Input VAT on purchases
  GEZAHLTE_UST: 28, // Output VAT paid to tax office
  AFA: 30, // Depreciation of movable assets
  ARBEITSZIMMER: 33, // Home office costs
  SONSTIGE: 34, // Other fully deductible business expenses
  ANLAGENABGANG_VERLUST: 35, // Losses from asset disposals (Restbuchwert)
} as const;

/** Expense Categories (subcategories of Line 34) */
export const EXPENSE_CATEGORIES = {
  software: { label: 'Software & Lizenzen', vorsteuer: true },
  telecom: { label: 'Telekommunikation', vorsteuer: true },
  hosting: { label: 'Hosting & Domains', vorsteuer: true },
  travel: { label: 'Reisekosten', vorsteuer: true },
  insurance: { label: 'Versicherungen', vorsteuer: false },
  bank_fees: { label: 'Kontoführung', vorsteuer: false },
  training: { label: 'Fortbildung', vorsteuer: true },
  books: { label: 'Fachliteratur', vorsteuer: true }, // 7% VAT
  office_supplies: { label: 'Büromaterial', vorsteuer: true },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

/** AfA useful life in years (AfA-Tabelle) */
export const AFA_YEARS: Record<AssetCategory, number> = {
  computer: 3, // Computer, Notebook, Monitor, Printer
  phone: 5, // Mobile Phone
  furniture: 13, // Desk, Chair, Shelf
  equipment: 5, // General equipment
  software: 3, // Software > €1,000
};

/** GWG Thresholds (Geringwertige Wirtschaftsgüter) */
export const GWG_THRESHOLDS = {
  SOFORTABSCHREIBUNG: 250, // Immediate write-off
  GWG_MAX: 800, // GWG: Choice of immediate or regular AfA
  POOL_MAX: 1000, // Pool method (5 years) or regular AfA
} as const;

/** Homeoffice-Pauschale (annual) */
export const HOMEOFFICE_PAUSCHALE = 1260;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Form state for income/expense forms */
export interface TransactionFormState {
  date: string;
  description: string;
  netAmount: string;
  vatRate: VatRate;
  euerCategory: string;
  paymentMethod?: PaymentMethod;
}

/** Filter options for transaction lists */
export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  ustReported?: boolean;
}

/** Summary stats for dashboard */
export interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  pendingInvoices: number;
  pendingAmount: number;
  currentQuarterVat: number;
}

// ============================================================================
// REPORT & ANALYTICS TYPES
// ============================================================================

export * from './reports';
