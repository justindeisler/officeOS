/**
 * Banking Service
 *
 * Handles bank account management, transaction syncing (FinAPI integration),
 * and auto-matching of transactions to invoices/expenses/income.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';

const log = createLogger('banking-service');

// ============================================================================
// Types
// ============================================================================

export interface BankAccount {
  id: string;
  provider: string;
  provider_account_id: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  account_name: string | null;
  account_type: string;
  balance: number;
  balance_date: string | null;
  currency: string;
  sync_status: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
  connection_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  account_id: string;
  provider_transaction_id: string | null;
  amount: number;
  currency: string;
  booking_date: string;
  value_date: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  counterpart_bic: string | null;
  purpose: string | null;
  bank_reference: string | null;
  type: string | null;
  match_status: string;
  match_confidence: number | null;
  matched_invoice_id: string | null;
  matched_expense_id: string | null;
  matched_income_id: string | null;
  match_rule_id: string | null;
  category: string | null;
  vat_rate: number | null;
  booking_description: string | null;
  is_duplicate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  transaction_id: string;
  match_type: 'invoice' | 'expense' | 'income' | 'rule';
  matched_id: string;
  confidence: number;
  reason: string;
}

export interface AutoMatchSummary {
  total_processed: number;
  matched: number;
  unmatched: number;
  matches: MatchResult[];
}

// ============================================================================
// Auto-Matching Algorithm
// ============================================================================

/**
 * Run auto-matching on unmatched transactions.
 * 
 * Strategy (in priority order):
 * 1. Exact amount match to open invoices (95% confidence)
 * 2. Vendor mapping from previous matches (80% confidence)
 * 3. Purpose text pattern matching (60% confidence)
 * 4. User-defined booking rules
 */
export function autoMatchTransactions(db: Database.Database): AutoMatchSummary {
  const unmatched = db.prepare(
    `SELECT * FROM bank_transactions 
     WHERE match_status = 'unmatched' AND is_duplicate = 0
     ORDER BY booking_date DESC`
  ).all() as BankTransaction[];

  const matches: MatchResult[] = [];
  let matchedCount = 0;

  for (const tx of unmatched) {
    const result = matchSingleTransaction(db, tx);
    if (result) {
      matches.push(result);
      matchedCount++;
    }
  }

  return {
    total_processed: unmatched.length,
    matched: matchedCount,
    unmatched: unmatched.length - matchedCount,
    matches,
  };
}

/**
 * Try to match a single transaction using all strategies.
 */
export function matchSingleTransaction(
  db: Database.Database,
  tx: BankTransaction
): MatchResult | null {
  // Strategy 1: Exact amount match to open invoices (credit transactions only)
  if (tx.amount > 0) {
    const invoiceMatch = matchByInvoiceAmount(db, tx);
    if (invoiceMatch) return invoiceMatch;
  }

  // Strategy 2: Vendor mapping from previous matches
  if (tx.counterpart_name) {
    const vendorMatch = matchByVendorMapping(db, tx);
    if (vendorMatch) return vendorMatch;
  }

  // Strategy 3: Purpose text pattern matching
  if (tx.purpose) {
    const purposeMatch = matchByPurposeText(db, tx);
    if (purposeMatch) return purposeMatch;
  }

  // Strategy 4: User-defined booking rules
  const ruleMatch = matchByBookingRules(db, tx);
  if (ruleMatch) return ruleMatch;

  return null;
}

/**
 * Strategy 1: Match incoming payments to open invoices by exact amount.
 */
function matchByInvoiceAmount(db: Database.Database, tx: BankTransaction): MatchResult | null {
  // Find open invoices matching the exact gross amount
  const invoices = db.prepare(
    `SELECT id, invoice_number, total, client_id FROM invoices 
     WHERE status IN ('sent', 'overdue') 
     AND total = ?
     ORDER BY due_date ASC`
  ).all(Math.round(tx.amount * 100) / 100) as Array<{
    id: string; invoice_number: string; total: number; client_id: string | null;
  }>;

  if (invoices.length === 1) {
    // Single match — high confidence
    const invoice = invoices[0];
    applyMatch(db, tx.id, 'invoice', invoice.id, 0.95);
    return {
      transaction_id: tx.id,
      match_type: 'invoice',
      matched_id: invoice.id,
      confidence: 0.95,
      reason: `Exact amount match: ${tx.amount}€ → Invoice ${invoice.invoice_number}`,
    };
  }

  if (invoices.length > 1 && tx.counterpart_name) {
    // Multiple invoices with same amount — try to narrow by counterpart name
    for (const inv of invoices) {
      if (inv.client_id) {
        const client = db.prepare('SELECT name, company FROM clients WHERE id = ?').get(inv.client_id) as {
          name: string; company: string | null;
        } | undefined;
        if (client && tx.counterpart_name) {
          const counterpartLower = tx.counterpart_name.toLowerCase();
          if (
            counterpartLower.includes(client.name.toLowerCase()) ||
            (client.company && counterpartLower.includes(client.company.toLowerCase()))
          ) {
            applyMatch(db, tx.id, 'invoice', inv.id, 0.90);
            return {
              transaction_id: tx.id,
              match_type: 'invoice',
              matched_id: inv.id,
              confidence: 0.90,
              reason: `Amount + client match: ${tx.amount}€, ${tx.counterpart_name} → Invoice ${inv.invoice_number}`,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Strategy 2: Match by historical vendor mappings.
 */
function matchByVendorMapping(db: Database.Database, tx: BankTransaction): MatchResult | null {
  if (!tx.counterpart_name) return null;

  const mapping = db.prepare(
    `SELECT mapped_vendor_name, confidence FROM vendor_bank_mappings 
     WHERE bank_counterpart_name = ? 
     ORDER BY match_count DESC LIMIT 1`
  ).get(tx.counterpart_name) as { mapped_vendor_name: string; confidence: number } | undefined;

  if (!mapping) return null;

  // Find recent expense/income with this vendor to get category
  const recentExpense = db.prepare(
    `SELECT id, category, vat_rate FROM expenses 
     WHERE vendor = ? AND (is_deleted IS NULL OR is_deleted = 0)
     ORDER BY date DESC LIMIT 1`
  ).get(mapping.mapped_vendor_name) as { id: string; category: string; vat_rate: number } | undefined;

  if (recentExpense && tx.amount < 0) {
    // Apply category from previous expense
    db.prepare(
      `UPDATE bank_transactions 
       SET match_status = 'auto_matched', match_confidence = ?, 
           category = ?, vat_rate = ?,
           booking_description = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(0.80, recentExpense.category, recentExpense.vat_rate, 
      `${mapping.mapped_vendor_name} (auto-matched)`, tx.id);

    // Update mapping stats
    db.prepare(
      `UPDATE vendor_bank_mappings SET match_count = match_count + 1, updated_at = datetime('now') 
       WHERE bank_counterpart_name = ?`
    ).run(tx.counterpart_name);

    return {
      transaction_id: tx.id,
      match_type: 'expense',
      matched_id: recentExpense.id,
      confidence: 0.80,
      reason: `Vendor mapping: "${tx.counterpart_name}" → ${mapping.mapped_vendor_name}`,
    };
  }

  return null;
}

/**
 * Strategy 3: Match by purpose text (Verwendungszweck) patterns.
 */
function matchByPurposeText(db: Database.Database, tx: BankTransaction): MatchResult | null {
  if (!tx.purpose) return null;

  // Look for invoice number patterns in purpose text
  const invoiceNumberMatch = tx.purpose.match(/RE-\d{4}-\d{3}/i);
  if (invoiceNumberMatch) {
    const invoice = db.prepare(
      `SELECT id, invoice_number, total FROM invoices 
       WHERE invoice_number = ? AND status IN ('sent', 'overdue')`
    ).get(invoiceNumberMatch[0].toUpperCase()) as {
      id: string; invoice_number: string; total: number;
    } | undefined;

    if (invoice) {
      applyMatch(db, tx.id, 'invoice', invoice.id, 0.85);
      return {
        transaction_id: tx.id,
        match_type: 'invoice',
        matched_id: invoice.id,
        confidence: 0.85,
        reason: `Invoice number in purpose: "${invoiceNumberMatch[0]}" → Invoice ${invoice.invoice_number}`,
      };
    }
  }

  return null;
}

/**
 * Strategy 4: Match by user-defined booking rules.
 */
function matchByBookingRules(db: Database.Database, tx: BankTransaction): MatchResult | null {
  const rules = db.prepare(
    `SELECT * FROM booking_rules WHERE is_active = 1 ORDER BY priority ASC`
  ).all() as Array<{
    id: string;
    name: string;
    condition_direction: string | null;
    condition_counterpart_pattern: string | null;
    condition_purpose_pattern: string | null;
    condition_amount_min: number | null;
    condition_amount_max: number | null;
    condition_iban_pattern: string | null;
    action_category: string | null;
    action_vat_rate: number | null;
    action_description_template: string | null;
    action_auto_confirm: number;
    action_match_type: string | null;
  }>;

  for (const rule of rules) {
    if (evaluateRule(rule, tx)) {
      // Apply rule actions
      const description = renderDescriptionTemplate(
        rule.action_description_template,
        tx
      );

      const matchStatus = rule.action_auto_confirm ? 'booked' : 'auto_matched';

      db.prepare(
        `UPDATE bank_transactions 
         SET match_status = ?, match_confidence = 0.70,
             match_rule_id = ?, category = ?, vat_rate = ?,
             booking_description = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(matchStatus, rule.id, rule.action_category, rule.action_vat_rate, description, tx.id);

      // Update rule stats
      db.prepare(
        `UPDATE booking_rules SET match_count = match_count + 1, last_matched_at = datetime('now') WHERE id = ?`
      ).run(rule.id);

      return {
        transaction_id: tx.id,
        match_type: 'rule' as const,
        matched_id: rule.id,
        confidence: 0.70,
        reason: `Booking rule: "${rule.name}"`,
      };
    }
  }

  return null;
}

/**
 * Evaluate if a booking rule matches a transaction.
 * All non-null conditions must match (AND logic).
 */
function evaluateRule(
  rule: {
    condition_direction: string | null;
    condition_counterpart_pattern: string | null;
    condition_purpose_pattern: string | null;
    condition_amount_min: number | null;
    condition_amount_max: number | null;
    condition_iban_pattern: string | null;
  },
  tx: BankTransaction
): boolean {
  // Direction check
  if (rule.condition_direction) {
    if (rule.condition_direction === 'credit' && tx.amount <= 0) return false;
    if (rule.condition_direction === 'debit' && tx.amount >= 0) return false;
  }

  // Counterpart name pattern (case-insensitive substring match)
  if (rule.condition_counterpart_pattern) {
    if (!tx.counterpart_name) return false;
    if (!tx.counterpart_name.toLowerCase().includes(rule.condition_counterpart_pattern.toLowerCase())) {
      return false;
    }
  }

  // Purpose pattern (case-insensitive substring match)
  if (rule.condition_purpose_pattern) {
    if (!tx.purpose) return false;
    if (!tx.purpose.toLowerCase().includes(rule.condition_purpose_pattern.toLowerCase())) {
      return false;
    }
  }

  // Amount range (absolute value)
  const absAmount = Math.abs(tx.amount);
  if (rule.condition_amount_min !== null && absAmount < rule.condition_amount_min) return false;
  if (rule.condition_amount_max !== null && absAmount > rule.condition_amount_max) return false;

  // IBAN pattern
  if (rule.condition_iban_pattern) {
    if (!tx.counterpart_iban) return false;
    if (!tx.counterpart_iban.includes(rule.condition_iban_pattern)) return false;
  }

  return true;
}

/**
 * Render a description template with transaction data.
 */
function renderDescriptionTemplate(
  template: string | null,
  tx: BankTransaction
): string {
  if (!template) return tx.counterpart_name || tx.purpose || 'Bank transaction';

  return template
    .replace(/{counterpart}/g, tx.counterpart_name || '')
    .replace(/{purpose}/g, tx.purpose || '')
    .replace(/{amount}/g, Math.abs(tx.amount).toFixed(2))
    .replace(/{date}/g, tx.booking_date);
}

/**
 * Apply a match to a transaction (update its match status and linked entity).
 */
function applyMatch(
  db: Database.Database,
  transactionId: string,
  matchType: 'invoice' | 'expense' | 'income',
  matchedId: string,
  confidence: number
): void {
  const field = matchType === 'invoice'
    ? 'matched_invoice_id'
    : matchType === 'expense'
      ? 'matched_expense_id'
      : 'matched_income_id';

  db.prepare(
    `UPDATE bank_transactions 
     SET match_status = 'auto_matched', match_confidence = ?,
         ${field} = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(confidence, matchedId, transactionId);
}

/**
 * Create an expense record from a bank transaction.
 */
export function createExpenseFromTransaction(
  db: Database.Database,
  transactionId: string,
  overrides: {
    category: string;
    description?: string;
    vat_rate?: number;
  }
): string {
  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(transactionId) as BankTransaction | undefined;
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (tx.amount >= 0) throw new Error('Cannot create expense from credit transaction');

  const expenseId = crypto.randomUUID();
  const now = new Date().toISOString();
  const netAmount = Math.abs(tx.amount) / (1 + (overrides.vat_rate ?? 19) / 100);
  const vatAmount = Math.abs(tx.amount) - netAmount;

  db.prepare(
    `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    expenseId,
    tx.booking_date,
    tx.counterpart_name || null,
    overrides.description || tx.purpose || 'Bank transaction',
    overrides.category,
    Math.round(netAmount * 100) / 100,
    overrides.vat_rate ?? 19,
    Math.round(vatAmount * 100) / 100,
    Math.abs(tx.amount),
    now
  );

  // Link transaction to expense
  db.prepare(
    `UPDATE bank_transactions 
     SET match_status = 'booked', matched_expense_id = ?, 
         category = ?, vat_rate = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(expenseId, overrides.category, overrides.vat_rate ?? 19, transactionId);

  // Create vendor mapping for future matching
  if (tx.counterpart_name) {
    db.prepare(
      `INSERT OR REPLACE INTO vendor_bank_mappings (id, bank_counterpart_name, mapped_vendor_name, confidence, match_count, updated_at)
       VALUES (?, ?, ?, 1.0, 1, datetime('now'))`
    ).run(crypto.randomUUID(), tx.counterpart_name, tx.counterpart_name);
  }

  return expenseId;
}

/**
 * Create an income record from a bank transaction.
 */
export function createIncomeFromTransaction(
  db: Database.Database,
  transactionId: string,
  overrides: {
    description?: string;
    vat_rate?: number;
    client_id?: string;
  }
): string {
  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(transactionId) as BankTransaction | undefined;
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (tx.amount <= 0) throw new Error('Cannot create income from debit transaction');

  const incomeId = crypto.randomUUID();
  const now = new Date().toISOString();
  const vatRate = overrides.vat_rate ?? 19;
  const netAmount = tx.amount / (1 + vatRate / 100);
  const vatAmount = tx.amount - netAmount;

  db.prepare(
    `INSERT INTO income (id, date, client_id, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 14, 'services', ?)`
  ).run(
    incomeId,
    tx.booking_date,
    overrides.client_id || null,
    overrides.description || tx.purpose || 'Bank transaction income',
    Math.round(netAmount * 100) / 100,
    vatRate,
    Math.round(vatAmount * 100) / 100,
    tx.amount,
    now
  );

  // Link transaction to income
  db.prepare(
    `UPDATE bank_transactions 
     SET match_status = 'booked', matched_income_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(incomeId, transactionId);

  return incomeId;
}

/**
 * Confirm an invoice match: mark invoice as paid and create income.
 */
export function confirmInvoiceMatch(
  db: Database.Database,
  transactionId: string,
  invoiceId: string
): void {
  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(transactionId) as BankTransaction | undefined;
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as {
    id: string; invoice_number: string; status: string; subtotal: number;
    vat_rate: number; vat_amount: number; total: number; client_id: string | null;
  } | undefined;
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  // Mark invoice as paid
  db.prepare(
    `UPDATE invoices SET status = 'paid', payment_date = ?, payment_method = 'bank_transfer' WHERE id = ?`
  ).run(tx.booking_date, invoiceId);

  // Create income record
  const incomeId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO income (id, date, client_id, invoice_id, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 14, 'services', ?)`
  ).run(
    incomeId,
    tx.booking_date,
    invoice.client_id,
    invoiceId,
    `Payment for Invoice #${invoice.invoice_number}`,
    invoice.subtotal,
    invoice.vat_rate,
    invoice.vat_amount,
    invoice.total,
    now
  );

  // Update transaction
  db.prepare(
    `UPDATE bank_transactions 
     SET match_status = 'booked', matched_invoice_id = ?, matched_income_id = ?,
         match_confidence = 1.0, updated_at = datetime('now')
     WHERE id = ?`
  ).run(invoiceId, incomeId, transactionId);
}

/**
 * Generate SEPA XML for batch payments.
 */
export function generateSepaXml(
  db: Database.Database,
  payments: Array<{
    recipient_name: string;
    recipient_iban: string;
    recipient_bic?: string;
    amount: number;
    purpose: string;
    end_to_end_id?: string;
  }>,
  debtor: {
    name: string;
    iban: string;
    bic: string;
  }
): string {
  const msgId = `SEPA-${Date.now()}`;
  const creationDate = new Date().toISOString().replace(/\.\d{3}Z/, 'Z');
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(debtor.name)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(msgId)}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${new Date().toISOString().split('T')[0]}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(debtor.name)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${debtor.iban.replace(/\s/g, '')}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${debtor.bic}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>`;

  for (const payment of payments) {
    const e2eId = payment.end_to_end_id || `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(e2eId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${payment.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>${payment.recipient_bic ? `
            <BIC>${payment.recipient_bic}</BIC>` : `
            <Othr><Id>NOTPROVIDED</Id></Othr>`}
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(payment.recipient_name)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${payment.recipient_iban.replace(/\s/g, '')}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(payment.purpose)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
  }

  xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
