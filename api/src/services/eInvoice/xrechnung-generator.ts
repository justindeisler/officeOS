/**
 * X-Rechnung XML Generator (UBL 2.1 syntax)
 * 
 * Generates X-Rechnung 3.0 compliant XML using UBL 2.1 Invoice.
 * 
 * Specification identifier (BT-24):
 *   urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0
 * 
 * Reference: https://xeinkauf.de/xrechnung/
 */

import type { EInvoiceData, EInvoiceLineItem, EInvoiceParty, EInvoicePaymentInfo } from './types.js';

/**
 * Generate X-Rechnung UBL 2.1 XML
 */
export function generateXRechnungXml(data: EInvoiceData): string {
  const lines: string[] = [];
  
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
  lines.push('  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
  lines.push('  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');
  
  // BT-24: Specification identifier
  lines.push('  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>');
  
  // BT-23: Business process type
  lines.push('  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>');
  
  // BT-1: Invoice number
  lines.push(`  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>`);
  
  // BT-2: Invoice issue date
  lines.push(`  <cbc:IssueDate>${data.invoiceDate}</cbc:IssueDate>`);
  
  // BT-9: Payment due date
  lines.push(`  <cbc:DueDate>${data.dueDate}</cbc:DueDate>`);
  
  // BT-3: Invoice type code
  lines.push(`  <cbc:InvoiceTypeCode>${data.invoiceTypeCode}</cbc:InvoiceTypeCode>`);
  
  // BT-22: Note
  if (data.notes) {
    lines.push(`  <cbc:Note>${escapeXml(data.notes)}</cbc:Note>`);
  }
  
  // BT-5: Currency
  lines.push(`  <cbc:DocumentCurrencyCode>${data.currencyCode}</cbc:DocumentCurrencyCode>`);
  
  // BT-10: Buyer reference (mandatory for X-Rechnung)
  if (data.buyerReference || data.leitwegId) {
    lines.push(`  <cbc:BuyerReference>${escapeXml(data.buyerReference || data.leitwegId || 'n/a')}</cbc:BuyerReference>`);
  }
  
  // BG-4: Seller (AccountingSupplierParty)
  lines.push('  <cac:AccountingSupplierParty>');
  lines.push(generateUblParty(data.seller));
  lines.push('  </cac:AccountingSupplierParty>');
  
  // BG-7: Buyer (AccountingCustomerParty)
  lines.push('  <cac:AccountingCustomerParty>');
  lines.push(generateUblParty(data.buyer));
  lines.push('  </cac:AccountingCustomerParty>');
  
  // Payment Means (BG-16)
  if (data.payment) {
    lines.push(generateUblPaymentMeans(data.payment, data.invoiceNumber));
  }
  
  // Payment Terms (BT-20)
  lines.push('  <cac:PaymentTerms>');
  lines.push(`    <cbc:Note>Zahlbar bis ${data.dueDate}</cbc:Note>`);
  lines.push('  </cac:PaymentTerms>');
  
  // VAT Breakdown (BG-23)
  for (const vat of data.vatBreakdown) {
    lines.push('  <cac:TaxTotal>');
    lines.push(`    <cbc:TaxAmount currencyID="${data.currencyCode}">${formatAmount(vat.taxAmount)}</cbc:TaxAmount>`);
    lines.push('    <cac:TaxSubtotal>');
    lines.push(`      <cbc:TaxableAmount currencyID="${data.currencyCode}">${formatAmount(vat.taxableAmount)}</cbc:TaxableAmount>`);
    lines.push(`      <cbc:TaxAmount currencyID="${data.currencyCode}">${formatAmount(vat.taxAmount)}</cbc:TaxAmount>`);
    lines.push('      <cac:TaxCategory>');
    lines.push(`        <cbc:ID>${vat.categoryCode}</cbc:ID>`);
    lines.push(`        <cbc:Percent>${formatAmount(vat.rate)}</cbc:Percent>`);
    lines.push('        <cac:TaxScheme>');
    lines.push('          <cbc:ID>VAT</cbc:ID>');
    lines.push('        </cac:TaxScheme>');
    lines.push('      </cac:TaxCategory>');
    lines.push('    </cac:TaxSubtotal>');
    lines.push('  </cac:TaxTotal>');
  }
  
  // Monetary Totals (BG-22)
  lines.push('  <cac:LegalMonetaryTotal>');
  lines.push(`    <cbc:LineExtensionAmount currencyID="${data.currencyCode}">${formatAmount(data.subtotal)}</cbc:LineExtensionAmount>`);
  lines.push(`    <cbc:TaxExclusiveAmount currencyID="${data.currencyCode}">${formatAmount(data.subtotal)}</cbc:TaxExclusiveAmount>`);
  lines.push(`    <cbc:TaxInclusiveAmount currencyID="${data.currencyCode}">${formatAmount(data.total)}</cbc:TaxInclusiveAmount>`);
  lines.push(`    <cbc:PayableAmount currencyID="${data.currencyCode}">${formatAmount(data.amountDue)}</cbc:PayableAmount>`);
  lines.push('  </cac:LegalMonetaryTotal>');
  
  // Line Items (BG-25)
  for (let i = 0; i < data.items.length; i++) {
    lines.push(generateUblLineItem(data.items[i], i + 1, data.currencyCode));
  }
  
  lines.push('</ubl:Invoice>');
  
  return lines.join('\n');
}

function generateUblParty(party: EInvoiceParty): string {
  const lines: string[] = [];
  
  lines.push('    <cac:Party>');
  
  // Endpoint (required for Peppol/X-Rechnung)
  if (party.email) {
    lines.push('      <cbc:EndpointID schemeID="EM">' + escapeXml(party.email) + '</cbc:EndpointID>');
  }
  
  // Party name
  lines.push('      <cac:PartyName>');
  lines.push(`        <cbc:Name>${escapeXml(party.tradingName || party.name)}</cbc:Name>`);
  lines.push('      </cac:PartyName>');
  
  // Address
  lines.push('      <cac:PostalAddress>');
  lines.push(`        <cbc:StreetName>${escapeXml(party.street)}</cbc:StreetName>`);
  lines.push(`        <cbc:CityName>${escapeXml(party.city)}</cbc:CityName>`);
  lines.push(`        <cbc:PostalZone>${escapeXml(party.postalCode)}</cbc:PostalZone>`);
  lines.push('        <cac:Country>');
  lines.push(`          <cbc:IdentificationCode>${party.countryCode}</cbc:IdentificationCode>`);
  lines.push('        </cac:Country>');
  lines.push('      </cac:PostalAddress>');
  
  // Tax scheme
  if (party.vatId) {
    lines.push('      <cac:PartyTaxScheme>');
    lines.push(`        <cbc:CompanyID>${escapeXml(party.vatId)}</cbc:CompanyID>`);
    lines.push('        <cac:TaxScheme>');
    lines.push('          <cbc:ID>VAT</cbc:ID>');
    lines.push('        </cac:TaxScheme>');
    lines.push('      </cac:PartyTaxScheme>');
  }
  
  // Legal entity
  lines.push('      <cac:PartyLegalEntity>');
  lines.push(`        <cbc:RegistrationName>${escapeXml(party.name)}</cbc:RegistrationName>`);
  lines.push('      </cac:PartyLegalEntity>');
  
  // Contact
  if (party.email || party.phone) {
    lines.push('      <cac:Contact>');
    if (party.phone) {
      lines.push(`        <cbc:Telephone>${escapeXml(party.phone)}</cbc:Telephone>`);
    }
    if (party.email) {
      lines.push(`        <cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail>`);
    }
    lines.push('      </cac:Contact>');
  }
  
  lines.push('    </cac:Party>');
  
  return lines.join('\n');
}

function generateUblPaymentMeans(payment: EInvoicePaymentInfo, invoiceNumber: string): string {
  const lines: string[] = [];
  
  lines.push('  <cac:PaymentMeans>');
  lines.push(`    <cbc:PaymentMeansCode>${payment.paymentMeansCode || '58'}</cbc:PaymentMeansCode>`);
  lines.push(`    <cbc:PaymentID>${escapeXml(payment.paymentReference || invoiceNumber)}</cbc:PaymentID>`);
  
  if (payment.iban) {
    lines.push('    <cac:PayeeFinancialAccount>');
    lines.push(`      <cbc:ID>${escapeXml(payment.iban)}</cbc:ID>`);
    if (payment.bankName) {
      lines.push(`      <cbc:Name>${escapeXml(payment.bankName)}</cbc:Name>`);
    }
    if (payment.bic) {
      lines.push('      <cac:FinancialInstitutionBranch>');
      lines.push(`        <cbc:ID>${escapeXml(payment.bic)}</cbc:ID>`);
      lines.push('      </cac:FinancialInstitutionBranch>');
    }
    lines.push('    </cac:PayeeFinancialAccount>');
  }
  
  lines.push('  </cac:PaymentMeans>');
  
  return lines.join('\n');
}

function generateUblLineItem(item: EInvoiceLineItem, lineNumber: number, currency: string): string {
  const lines: string[] = [];
  
  lines.push('  <cac:InvoiceLine>');
  lines.push(`    <cbc:ID>${lineNumber}</cbc:ID>`);
  lines.push(`    <cbc:InvoicedQuantity unitCode="${item.unitCode}">${formatAmount(item.quantity)}</cbc:InvoicedQuantity>`);
  lines.push(`    <cbc:LineExtensionAmount currencyID="${currency}">${formatAmount(item.lineTotal)}</cbc:LineExtensionAmount>`);
  
  // Item
  lines.push('    <cac:Item>');
  lines.push(`      <cbc:Name>${escapeXml(item.description)}</cbc:Name>`);
  lines.push('      <cac:ClassifiedTaxCategory>');
  lines.push(`        <cbc:ID>${item.vatCategoryCode}</cbc:ID>`);
  lines.push(`        <cbc:Percent>${formatAmount(item.vatRate)}</cbc:Percent>`);
  lines.push('        <cac:TaxScheme>');
  lines.push('          <cbc:ID>VAT</cbc:ID>');
  lines.push('        </cac:TaxScheme>');
  lines.push('      </cac:ClassifiedTaxCategory>');
  lines.push('    </cac:Item>');
  
  // Price
  lines.push('    <cac:Price>');
  lines.push(`      <cbc:PriceAmount currencyID="${currency}">${formatAmount(item.unitPrice)}</cbc:PriceAmount>`);
  lines.push('    </cac:Price>');
  
  lines.push('  </cac:InvoiceLine>');
  
  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function formatAmount(n: number): string {
  return n.toFixed(2);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
