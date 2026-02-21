/**
 * ZUGFeRD 2.1 / Factur-X XML Generator
 * 
 * Generates Cross Industry Invoice (CII) XML according to:
 * - UN/CEFACT Cross Industry Invoice D16B
 * - ZUGFeRD 2.1 COMFORT profile
 * - EN 16931 compliant
 * 
 * Profile identifier:
 *   urn:factur-x.eu:1p0:comfort
 */

import type { EInvoiceData, EInvoiceLineItem, EInvoiceParty, EInvoicePaymentInfo } from './types.js';

/**
 * Generate ZUGFeRD 2.1 CII XML
 */
export function generateZugferdXml(data: EInvoiceData): string {
  const lines: string[] = [];
  
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"');
  lines.push('  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"');
  lines.push('  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"');
  lines.push('  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">');
  
  // Exchange Document Context
  lines.push('  <rsm:ExchangedDocumentContext>');
  lines.push('    <ram:GuidelineSpecifiedDocumentContextParameter>');
  lines.push('      <ram:ID>urn:factur-x.eu:1p0:comfort</ram:ID>');
  lines.push('    </ram:GuidelineSpecifiedDocumentContextParameter>');
  lines.push('  </rsm:ExchangedDocumentContext>');
  
  // Exchanged Document (BT-1, BT-2, BT-3)
  lines.push('  <rsm:ExchangedDocument>');
  lines.push(`    <ram:ID>${escapeXml(data.invoiceNumber)}</ram:ID>`);
  lines.push(`    <ram:TypeCode>${data.invoiceTypeCode}</ram:TypeCode>`);
  lines.push('    <ram:IssueDateTime>');
  lines.push(`      <udt:DateTimeString format="102">${formatDate102(data.invoiceDate)}</udt:DateTimeString>`);
  lines.push('    </ram:IssueDateTime>');
  if (data.notes) {
    lines.push('    <ram:IncludedNote>');
    lines.push(`      <ram:Content>${escapeXml(data.notes)}</ram:Content>`);
    lines.push('    </ram:IncludedNote>');
  }
  lines.push('  </rsm:ExchangedDocument>');
  
  // Supply Chain Trade Transaction
  lines.push('  <rsm:SupplyChainTradeTransaction>');
  
  // Line Items (BG-25)
  for (let i = 0; i < data.items.length; i++) {
    lines.push(generateLineItem(data.items[i], i + 1));
  }
  
  // Header Trade Agreement (Seller + Buyer)
  lines.push('    <ram:ApplicableHeaderTradeAgreement>');
  if (data.buyerReference) {
    lines.push(`      <ram:BuyerReference>${escapeXml(data.buyerReference)}</ram:BuyerReference>`);
  }
  lines.push(generateParty('ram:SellerTradeParty', data.seller));
  lines.push(generateParty('ram:BuyerTradeParty', data.buyer));
  lines.push('    </ram:ApplicableHeaderTradeAgreement>');
  
  // Header Trade Delivery
  lines.push('    <ram:ApplicableHeaderTradeDelivery/>');
  
  // Header Trade Settlement
  lines.push('    <ram:ApplicableHeaderTradeSettlement>');
  lines.push(`      <ram:InvoiceCurrencyCode>${data.currencyCode}</ram:InvoiceCurrencyCode>`);
  
  // Payment Means
  if (data.payment) {
    lines.push(generatePaymentMeans(data.payment));
  }
  
  // VAT Breakdown (BG-23)
  for (const vat of data.vatBreakdown) {
    lines.push('      <ram:ApplicableTradeTax>');
    lines.push(`        <ram:CalculatedAmount>${formatAmount(vat.taxAmount)}</ram:CalculatedAmount>`);
    lines.push('        <ram:TypeCode>VAT</ram:TypeCode>');
    lines.push(`        <ram:BasisAmount>${formatAmount(vat.taxableAmount)}</ram:BasisAmount>`);
    lines.push(`        <ram:CategoryCode>${vat.categoryCode}</ram:CategoryCode>`);
    lines.push(`        <ram:RateApplicablePercent>${formatAmount(vat.rate)}</ram:RateApplicablePercent>`);
    lines.push('      </ram:ApplicableTradeTax>');
  }
  
  // Payment Terms (BT-9 Due Date)
  lines.push('      <ram:SpecifiedTradePaymentTerms>');
  lines.push('        <ram:DueDateDateTime>');
  lines.push(`          <udt:DateTimeString format="102">${formatDate102(data.dueDate)}</udt:DateTimeString>`);
  lines.push('        </ram:DueDateDateTime>');
  lines.push('      </ram:SpecifiedTradePaymentTerms>');
  
  // Monetary Summation (BG-22)
  lines.push('      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  lines.push(`        <ram:LineTotalAmount>${formatAmount(data.subtotal)}</ram:LineTotalAmount>`);
  lines.push(`        <ram:TaxBasisTotalAmount>${formatAmount(data.subtotal)}</ram:TaxBasisTotalAmount>`);
  lines.push(`        <ram:TaxTotalAmount currencyID="${data.currencyCode}">${formatAmount(data.vatTotal)}</ram:TaxTotalAmount>`);
  lines.push(`        <ram:GrandTotalAmount>${formatAmount(data.total)}</ram:GrandTotalAmount>`);
  lines.push(`        <ram:DuePayableAmount>${formatAmount(data.amountDue)}</ram:DuePayableAmount>`);
  lines.push('      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  
  lines.push('    </ram:ApplicableHeaderTradeSettlement>');
  lines.push('  </rsm:SupplyChainTradeTransaction>');
  lines.push('</rsm:CrossIndustryInvoice>');
  
  return lines.join('\n');
}

function generateLineItem(item: EInvoiceLineItem, lineNumber: number): string {
  const lines: string[] = [];
  
  lines.push('    <ram:IncludedSupplyChainTradeLineItem>');
  lines.push('      <ram:AssociatedDocumentLineDocument>');
  lines.push(`        <ram:LineID>${lineNumber}</ram:LineID>`);
  lines.push('      </ram:AssociatedDocumentLineDocument>');
  
  // Product
  lines.push('      <ram:SpecifiedTradeProduct>');
  lines.push(`        <ram:Name>${escapeXml(item.description)}</ram:Name>`);
  lines.push('      </ram:SpecifiedTradeProduct>');
  
  // Agreement (Price)
  lines.push('      <ram:SpecifiedLineTradeAgreement>');
  lines.push('        <ram:NetPriceProductTradePrice>');
  lines.push(`          <ram:ChargeAmount>${formatAmount(item.unitPrice)}</ram:ChargeAmount>`);
  lines.push('        </ram:NetPriceProductTradePrice>');
  lines.push('      </ram:SpecifiedLineTradeAgreement>');
  
  // Delivery (Quantity)
  lines.push('      <ram:SpecifiedLineTradeDelivery>');
  lines.push(`        <ram:BilledQuantity unitCode="${item.unitCode}">${formatAmount(item.quantity)}</ram:BilledQuantity>`);
  lines.push('      </ram:SpecifiedLineTradeDelivery>');
  
  // Settlement (Tax + Total)
  lines.push('      <ram:SpecifiedLineTradeSettlement>');
  lines.push('        <ram:ApplicableTradeTax>');
  lines.push('          <ram:TypeCode>VAT</ram:TypeCode>');
  lines.push(`          <ram:CategoryCode>${item.vatCategoryCode}</ram:CategoryCode>`);
  lines.push(`          <ram:RateApplicablePercent>${formatAmount(item.vatRate)}</ram:RateApplicablePercent>`);
  lines.push('        </ram:ApplicableTradeTax>');
  lines.push('        <ram:SpecifiedTradeSettlementLineMonetarySummation>');
  lines.push(`          <ram:LineTotalAmount>${formatAmount(item.lineTotal)}</ram:LineTotalAmount>`);
  lines.push('        </ram:SpecifiedTradeSettlementLineMonetarySummation>');
  lines.push('      </ram:SpecifiedLineTradeSettlement>');
  
  lines.push('    </ram:IncludedSupplyChainTradeLineItem>');
  
  return lines.join('\n');
}

function generateParty(tagName: string, party: EInvoiceParty): string {
  const lines: string[] = [];
  
  lines.push(`      <${tagName}>`);
  if (party.tradingName) {
    lines.push(`        <ram:Name>${escapeXml(party.tradingName)}</ram:Name>`);
  } else {
    lines.push(`        <ram:Name>${escapeXml(party.name)}</ram:Name>`);
  }
  
  // Tax registration
  if (party.taxNumber) {
    lines.push('        <ram:SpecifiedTaxRegistration>');
    lines.push(`          <ram:ID schemeID="FC">${escapeXml(party.taxNumber)}</ram:ID>`);
    lines.push('        </ram:SpecifiedTaxRegistration>');
  }
  if (party.vatId) {
    lines.push('        <ram:SpecifiedTaxRegistration>');
    lines.push(`          <ram:ID schemeID="VA">${escapeXml(party.vatId)}</ram:ID>`);
    lines.push('        </ram:SpecifiedTaxRegistration>');
  }
  
  // Address
  lines.push('        <ram:PostalTradeAddress>');
  lines.push(`          <ram:PostcodeCode>${escapeXml(party.postalCode)}</ram:PostcodeCode>`);
  lines.push(`          <ram:LineOne>${escapeXml(party.street)}</ram:LineOne>`);
  lines.push(`          <ram:CityName>${escapeXml(party.city)}</ram:CityName>`);
  lines.push(`          <ram:CountryID>${party.countryCode}</ram:CountryID>`);
  lines.push('        </ram:PostalTradeAddress>');
  
  // Contact
  if (party.email || party.phone) {
    lines.push('        <ram:URIUniversalCommunication>');
    if (party.email) {
      lines.push(`          <ram:URIID schemeID="EM">${escapeXml(party.email)}</ram:URIID>`);
    }
    lines.push('        </ram:URIUniversalCommunication>');
  }
  
  lines.push(`      </${tagName}>`);
  
  return lines.join('\n');
}

function generatePaymentMeans(payment: EInvoicePaymentInfo): string {
  const lines: string[] = [];
  
  lines.push('      <ram:SpecifiedTradeSettlementPaymentMeans>');
  lines.push(`        <ram:TypeCode>${payment.paymentMeansCode || '58'}</ram:TypeCode>`);
  
  if (payment.paymentReference) {
    lines.push(`        <ram:Information>${escapeXml(payment.paymentReference)}</ram:Information>`);
  }
  
  if (payment.iban) {
    lines.push('        <ram:PayeePartyCreditorFinancialAccount>');
    lines.push(`          <ram:IBANID>${escapeXml(payment.iban)}</ram:IBANID>`);
    if (payment.bankName) {
      lines.push(`          <ram:AccountName>${escapeXml(payment.bankName)}</ram:AccountName>`);
    }
    lines.push('        </ram:PayeePartyCreditorFinancialAccount>');
    
    if (payment.bic) {
      lines.push('        <ram:PayeeSpecifiedCreditorFinancialInstitution>');
      lines.push(`          <ram:BICID>${escapeXml(payment.bic)}</ram:BICID>`);
      lines.push('        </ram:PayeeSpecifiedCreditorFinancialInstitution>');
    }
  }
  
  lines.push('      </ram:SpecifiedTradeSettlementPaymentMeans>');
  
  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format date as YYYYMMDD (format 102 per UN/EDIFACT)
 */
function formatDate102(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Format a number with 2 decimal places
 */
function formatAmount(n: number): string {
  return n.toFixed(2);
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
