/**
 * EÜR Line Constants
 *
 * CANONICAL SOURCE: app/src/features/accounting/types/index.ts
 *
 * These values MUST match the frontend EUER_LINES definition exactly.
 * When updating line numbers, update the frontend first, then sync here.
 *
 * Line numbers reference the official German EÜR form (Anlage EÜR).
 */

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

/** Homeoffice-Pauschale (annual) — €1,260 per year */
export const HOMEOFFICE_PAUSCHALE = 1260;

export type EuerLineKey = keyof typeof EUER_LINES;
export type EuerLineNumber = (typeof EUER_LINES)[EuerLineKey];
