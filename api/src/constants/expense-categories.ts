/**
 * Expense Categories — Single Source of Truth
 *
 * Shared between backend and frontend. Backend uses this for validation,
 * EÜR line assignment, and Vorsteuer eligibility. Frontend uses the
 * EXPENSE_CATEGORIES constant from app/src/features/accounting/types/index.ts
 * which MUST be kept in sync with this.
 *
 * When adding/removing categories, update both files.
 */

export interface ExpenseCategory {
  id: string;
  name: string;
  euer_line: number;
  vorsteuer: boolean;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'software',        name: 'Software & Lizenzen',     euer_line: 34, vorsteuer: true },
  { id: 'hosting',         name: 'Hosting & Domains',       euer_line: 34, vorsteuer: true },
  { id: 'telecom',         name: 'Telekommunikation',       euer_line: 34, vorsteuer: true },
  { id: 'hardware',        name: 'Hardware & Technik',      euer_line: 34, vorsteuer: true },
  { id: 'office_supplies', name: 'Büromaterial',             euer_line: 34, vorsteuer: true },
  { id: 'travel',          name: 'Reisekosten',             euer_line: 34, vorsteuer: true },
  { id: 'training',        name: 'Fortbildung',             euer_line: 34, vorsteuer: true },
  { id: 'books',           name: 'Fachliteratur',           euer_line: 34, vorsteuer: true },
  { id: 'insurance',       name: 'Versicherungen',          euer_line: 34, vorsteuer: false },
  { id: 'bank_fees',       name: 'Kontoführung',            euer_line: 34, vorsteuer: false },
  { id: 'legal',           name: 'Rechts- & Beratung',      euer_line: 34, vorsteuer: true },
  { id: 'marketing',       name: 'Marketing & Werbung',     euer_line: 34, vorsteuer: true },
  { id: 'fremdleistungen', name: 'Fremdleistungen',         euer_line: 25, vorsteuer: true },
  { id: 'depreciation',    name: 'Abschreibungen (AfA)',    euer_line: 30, vorsteuer: false },
  { id: 'homeoffice',      name: 'Arbeitszimmer',           euer_line: 33, vorsteuer: false },
  { id: 'other',           name: 'Sonstige Kosten',         euer_line: 34, vorsteuer: true },
];

/** Map from category ID to category info for quick lookup */
export const EXPENSE_CATEGORY_MAP = new Map(
  EXPENSE_CATEGORIES.map(c => [c.id, c])
);

/** Valid category IDs */
export const VALID_CATEGORY_IDS = EXPENSE_CATEGORIES.map(c => c.id);

/** Legacy category ID mapping for migration */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'communication': 'telecom',
  'education': 'training',
  'office': 'office_supplies',
};
