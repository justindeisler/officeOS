/**
 * E-Rechnung Data Types
 * 
 * Based on EN 16931 (European Standard for Electronic Invoicing)
 * Supports ZUGFeRD 2.1 (CII) and X-Rechnung 3.0 (UBL 2.1)
 */

export type EInvoiceFormat = 'zugferd' | 'xrechnung-ubl' | 'xrechnung-cii';

export interface EInvoiceParty {
  name: string;                    // BT-27 / BT-44
  tradingName?: string;            // BT-28 / BT-45
  street: string;                  // BT-35 / BT-50
  city: string;                    // BT-37 / BT-52
  postalCode: string;              // BT-38 / BT-53
  countryCode: string;             // BT-40 / BT-55 (ISO 3166-1 alpha-2)
  vatId?: string;                  // BT-31 / BT-48
  taxNumber?: string;              // BT-32
  email?: string;                  // BT-43 / BT-58
  phone?: string;                  // BT-42
}

export interface EInvoicePaymentInfo {
  iban?: string;                   // BT-84
  bic?: string;                    // BT-86
  bankName?: string;               // BT-85
  paymentReference?: string;       // BT-83
  paymentMeansCode?: string;       // BT-81 (30=bank transfer, 58=SEPA)
}

export interface EInvoiceLineItem {
  id: string;                      // BT-126
  description: string;             // BT-153
  quantity: number;                // BT-129
  unitCode: string;                // BT-130 (UN/ECE Recommendation 20)
  unitPrice: number;               // BT-146
  lineTotal: number;               // BT-131
  vatRate: number;                 // BT-152
  vatCategoryCode: string;         // BT-151 (S=standard, Z=zero, E=exempt)
}

export interface EInvoiceData {
  // Invoice identification
  invoiceNumber: string;           // BT-1
  invoiceDate: string;             // BT-2 (YYYY-MM-DD)
  dueDate: string;                 // BT-9
  invoiceTypeCode: string;         // BT-3 (380=invoice, 381=credit note)
  currencyCode: string;            // BT-5 (ISO 4217)
  buyerReference?: string;         // BT-10
  
  // Parties
  seller: EInvoiceParty;           // BG-4
  buyer: EInvoiceParty;            // BG-7
  
  // Payment
  payment?: EInvoicePaymentInfo;   // BG-16/17
  
  // Line items
  items: EInvoiceLineItem[];       // BG-25
  
  // Totals
  subtotal: number;                // BT-109
  vatTotal: number;                // BT-110
  total: number;                   // BT-112
  amountDue: number;               // BT-115
  
  // VAT breakdown
  vatBreakdown: Array<{
    categoryCode: string;          // BT-118
    rate: number;                  // BT-119
    taxableAmount: number;         // BT-116
    taxAmount: number;             // BT-117
  }>;
  
  // Notes
  notes?: string;                  // BT-22
  
  // Profile
  leitwegId?: string;              // Leitweg-ID for X-Rechnung to public sector
}

/**
 * Map common unit names to UN/ECE Recommendation 20 unit codes
 */
export const UNIT_CODE_MAP: Record<string, string> = {
  'hours': 'HUR',
  'hour': 'HUR',
  'Stunden': 'HUR',
  'days': 'DAY',
  'day': 'DAY',
  'Tage': 'DAY',
  'pieces': 'C62',
  'piece': 'C62',
  'Stück': 'C62',
  'months': 'MON',
  'month': 'MON',
  'Monate': 'MON',
  'flat': 'C62',
  'pauschal': 'C62',
  'items': 'C62',
};

/**
 * Get the UN/ECE unit code for a given unit string
 */
export function getUnitCode(unit: string): string {
  return UNIT_CODE_MAP[unit.toLowerCase()] || UNIT_CODE_MAP[unit] || 'C62';
}

/**
 * Get VAT category code based on rate
 */
export function getVatCategoryCode(rate: number): string {
  if (rate === 0) return 'Z'; // Zero-rated
  return 'S'; // Standard rated
}
