/**
 * Common Vendor Rules — Hard-coded category mappings for well-known vendors
 *
 * Used as a fallback when no historical data is available for auto-categorization.
 * Focused on German business vendors commonly encountered in freelance accounting.
 */

export interface VendorRule {
  pattern: RegExp;
  category: string;
  label: string; // Human-readable label for the match reason
}

export const VENDOR_RULES: VendorRule[] = [
  // Telecom
  { pattern: /telekom|vodafone|o2|1&1|congstar|klarmobil|sipgate|eplus/i, category: 'telecom', label: 'Telekommunikation' },

  // Hosting & Cloud
  { pattern: /aws|amazon web services|azure|digitalocean|hetzner|strato|ionos|netlify|vercel|cloudflare|ovh|linode/i, category: 'hosting', label: 'Hosting & Cloud' },

  // Software & Licenses
  { pattern: /github|jetbrains|adobe|atlassian|microsoft|google workspace|slack|notion|figma|zoom|dropbox|1password|openai|anthropic/i, category: 'software', label: 'Software & Lizenzen' },

  // Travel
  { pattern: /deutsche bahn|db fernverkehr|db regio|lufthansa|eurowings|ryanair|flixbus|sixt|europcar|booking\.com|airbnb|miles & more/i, category: 'travel', label: 'Reisekosten' },

  // Insurance
  { pattern: /allianz|axa|ergo|huk.?coburg|generali|zurich|signal iduna|debeka|r\+v|continentale/i, category: 'insurance', label: 'Versicherungen' },

  // Office Supplies
  { pattern: /amazon(?!\s*web)|otto|mediamarkt|saturn|pearl|viking|staples|büroprofi/i, category: 'office_supplies', label: 'Büromaterial' },

  // Hardware
  { pattern: /apple|dell|lenovo|hp inc|hewlett.?packard|logitech|samsung electronics|asus|acer/i, category: 'hardware', label: 'Hardware & Technik' },

  // Marketing
  { pattern: /google ads|facebook ads|meta platforms|linkedin ads|mailchimp|sendinblue|hubspot/i, category: 'marketing', label: 'Marketing & Werbung' },

  // Training / Education
  { pattern: /udemy|coursera|pluralsight|linkedin learning|egghead|masterclass|skillshare/i, category: 'training', label: 'Fortbildung' },

  // Books
  { pattern: /thalia|hugendubel|oreilly|packt|manning|springer|amazon kindle/i, category: 'books', label: 'Fachliteratur' },

  // Legal / Consulting
  { pattern: /steuerberater|rechtsanwalt|notar|kanzlei|tax|datev/i, category: 'legal', label: 'Rechts- & Beratung' },

  // Bank Fees
  { pattern: /sparkasse|volksbank|commerzbank|deutsche bank|ing.?diba|n26|comdirect|dkb|targobank|postbank|kontof[üu]hrung/i, category: 'bank_fees', label: 'Kontoführung' },

  // Freelance / Subcontractors
  { pattern: /fiverr|upwork|toptal|freelancer\.com/i, category: 'fremdleistungen', label: 'Fremdleistungen' },
];

/**
 * Match a vendor name against the hard-coded rules.
 * Returns the first matching rule, or undefined if no match.
 */
export function matchVendorRule(vendor: string): VendorRule | undefined {
  if (!vendor) return undefined;
  return VENDOR_RULES.find(rule => rule.pattern.test(vendor));
}
