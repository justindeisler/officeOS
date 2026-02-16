/**
 * OCR Service
 *
 * Integrates with Azure Document Intelligence (prebuilt-invoice model)
 * to extract structured data from invoice PDFs and images.
 *
 * Features:
 * - Azure Form Recognizer integration
 * - German number/date format parsing
 * - Confidence scoring
 * - Response mapping (Azure fields → PA expense fields)
 */

import { createLogger } from "../logger.js";

const log = createLogger("ocr-service");

// ============================================================================
// Types
// ============================================================================

export interface ExtractedField<T = string> {
  value: T;
  confidence: number;
}

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  confidence: number;
}

export interface OcrExtractionResult {
  vendor: ExtractedField | null;
  invoiceNumber: ExtractedField | null;
  invoiceDate: ExtractedField | null;
  netAmount: ExtractedField<number> | null;
  vatRate: ExtractedField<number> | null;
  vatAmount: ExtractedField<number> | null;
  grossAmount: ExtractedField<number> | null;
  currency: ExtractedField | null;
  lineItems: ExtractedLineItem[];
  suggestedCategory: string | null;
  suggestedDescription: string | null;
  processingTimeMs: number;
  rawText: string;
  rawResponse: string;
  provider: "azure_form_recognizer" | "tesseract" | "manual";
  isCreditNote: boolean;
}

// ============================================================================
// German Number/Date Parsing Utilities
// ============================================================================

/**
 * Parse a German-formatted number string to a number.
 * German format: 1.234,56 → 1234.56
 */
export function parseGermanNumber(str: string): number | null {
  if (!str || typeof str !== "string") return null;

  // Clean up: remove currency symbols, spaces, etc
  let cleaned = str.replace(/[€$£\s]/g, "").trim();

  if (!cleaned) return null;

  // Check if it's already a standard decimal number (no comma, or only a dot)
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned);
  }

  // German format: period as thousands separator, comma as decimal
  // Remove all periods (thousands separators)
  cleaned = cleaned.replace(/\./g, "");
  // Replace comma with dot (decimal separator)
  cleaned = cleaned.replace(",", ".");

  const result = parseFloat(cleaned);
  return isNaN(result) ? null : result;
}

/**
 * Parse a German date string (DD.MM.YYYY) to ISO date string (YYYY-MM-DD)
 */
export function parseGermanDate(str: string): string | null {
  if (!str || typeof str !== "string") return null;

  const cleaned = str.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // DD.MM.YYYY
  const match1 = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match1) {
    const [, day, month, year] = match1;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // DD/MM/YYYY
  const match2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // German month names
  const germanMonths: Record<string, string> = {
    januar: "01", februar: "02", märz: "03", april: "04",
    mai: "05", juni: "06", juli: "07", august: "08",
    september: "09", oktober: "10", november: "11", dezember: "12",
  };

  const match3 = cleaned.match(/^(\d{1,2})\.\s*(\w+)\s+(\d{4})$/i);
  if (match3) {
    const [, day, monthName, year] = match3;
    const month = germanMonths[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Detect the VAT rate from amounts.
 */
export function detectVatRate(net: number, vat: number): number {
  if (net <= 0 || vat < 0) return 19; // Default
  const rate = Math.round((vat / net) * 100);
  // Map to standard German VAT rates
  if (rate >= 18 && rate <= 20) return 19;
  if (rate >= 6 && rate <= 8) return 7;
  if (rate === 0) return 0;
  return rate; // Non-standard rate
}

/**
 * Validate amount consistency: net + VAT ≈ gross
 */
export function validateAmounts(net: number, vat: number, gross: number): boolean {
  const calculated = Math.round((net + vat) * 100) / 100;
  const difference = Math.abs(calculated - gross);
  return difference <= 0.021; // Allow ~2 cent rounding difference (with floating point tolerance)
}

// ============================================================================
// Azure API Integration
// ============================================================================

interface AzureCredentials {
  endpoint: string;
  apiKey: string;
}

let cachedCredentials: AzureCredentials | null = null;

/**
 * Load Azure credentials from encrypted config
 */
async function getAzureCredentials(): Promise<AzureCredentials> {
  if (cachedCredentials) return cachedCredentials;

  // Try environment variables first
  if (process.env.AZURE_ENDPOINT && process.env.AZURE_API_KEY) {
    cachedCredentials = {
      endpoint: process.env.AZURE_ENDPOINT,
      apiKey: process.env.AZURE_API_KEY,
    };
    return cachedCredentials;
  }

  // Load from encrypted config via credential_manager
  try {
    const { execSync } = await import("child_process");
    const configPath = join(process.env.HOME || "", "clawd/config/azure-ocr.conf");
    const endpoint = execSync(
      `python3 ~/clawd/scripts/credential_manager.py get "${configPath}" AZURE_ENDPOINT`,
      { encoding: "utf-8" }
    ).trim();
    const apiKey = execSync(
      `python3 ~/clawd/scripts/credential_manager.py get "${configPath}" AZURE_API_KEY`,
      { encoding: "utf-8" }
    ).trim();

    cachedCredentials = { endpoint, apiKey };
    return cachedCredentials;
  } catch (err) {
    log.error({ err }, "Failed to load Azure credentials");
    throw new Error("Azure OCR credentials not configured");
  }
}

// Import join for credential path
import { join } from "path";

/**
 * Call Azure Document Intelligence prebuilt-invoice model
 */
async function analyzeWithAzure(buffer: Buffer, mimeType: string): Promise<unknown> {
  const creds = await getAzureCredentials();
  const analyzeUrl = `${creds.endpoint}documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`;

  log.info({ endpoint: creds.endpoint, mimeType, size: buffer.length }, "Sending to Azure");

  // Start the analysis
  const startResponse = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType === "application/pdf" ? "application/pdf" : mimeType,
      "Ocp-Apim-Subscription-Key": creds.apiKey,
    },
    body: buffer as unknown as BodyInit,
  });

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    throw new Error(`Azure API error ${startResponse.status}: ${errorText}`);
  }

  // Get the operation location for polling
  const operationLocation = startResponse.headers.get("operation-location");
  if (!operationLocation) {
    throw new Error("No operation-location header in Azure response");
  }

  // Poll for results
  const maxAttempts = 30;
  const pollInterval = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const pollResponse = await fetch(operationLocation, {
      headers: {
        "Ocp-Apim-Subscription-Key": creds.apiKey,
      },
    });

    if (!pollResponse.ok) {
      throw new Error(`Azure poll error ${pollResponse.status}`);
    }

    const result = await pollResponse.json() as { status: string; analyzeResult?: unknown; error?: unknown };

    if (result.status === "succeeded") {
      return result.analyzeResult;
    } else if (result.status === "failed") {
      throw new Error(`Azure analysis failed: ${JSON.stringify(result.error)}`);
    }
    // "running" - continue polling
  }

  throw new Error("Azure analysis timed out");
}

/**
 * Map Azure Document Intelligence response to our extraction format
 */
function mapAzureResponse(analyzeResult: unknown): Partial<OcrExtractionResult> {
  const result = analyzeResult as {
    documents?: Array<{
      fields?: Record<string, {
        type?: string;
        valueString?: string;
        valueNumber?: number;
        valueDate?: string;
        valueCurrencyAmount?: { amount?: number; currencyCode?: string };
        valueArray?: Array<{
          type?: string;
          valueObject?: Record<string, {
            type?: string;
            valueString?: string;
            valueNumber?: number;
            valueCurrencyAmount?: { amount?: number };
            content?: string;
            confidence?: number;
          }>;
        }>;
        content?: string;
        confidence?: number;
      }>;
    }>;
    content?: string;
  };

  const doc = result.documents?.[0];
  if (!doc?.fields) {
    return { rawText: result.content || "" };
  }

  const fields = doc.fields;

  // Extract vendor
  const vendorField = fields["VendorName"];
  const vendor = vendorField
    ? { value: vendorField.valueString || vendorField.content || "", confidence: vendorField.confidence || 0 }
    : null;

  // Extract invoice number
  const invoiceIdField = fields["InvoiceId"];
  const invoiceNumber = invoiceIdField
    ? { value: invoiceIdField.valueString || invoiceIdField.content || "", confidence: invoiceIdField.confidence || 0 }
    : null;

  // Extract invoice date
  const dateField = fields["InvoiceDate"];
  let invoiceDate: ExtractedField | null = null;
  if (dateField) {
    const dateVal = dateField.valueDate || dateField.valueString || dateField.content || "";
    const parsed = parseGermanDate(dateVal) || dateVal;
    invoiceDate = { value: parsed, confidence: dateField.confidence || 0 };
  }

  // Extract amounts
  const totalField = fields["InvoiceTotal"];
  let grossAmount: ExtractedField<number> | null = null;
  if (totalField) {
    const amount = totalField.valueCurrencyAmount?.amount ?? totalField.valueNumber ?? parseGermanNumber(totalField.content || "");
    if (amount !== null && amount !== undefined) {
      grossAmount = { value: Math.round(amount * 100) / 100, confidence: totalField.confidence || 0 };
    }
  }

  const subtotalField = fields["SubTotal"];
  let netAmount: ExtractedField<number> | null = null;
  if (subtotalField) {
    const amount = subtotalField.valueCurrencyAmount?.amount ?? subtotalField.valueNumber ?? parseGermanNumber(subtotalField.content || "");
    if (amount !== null && amount !== undefined) {
      netAmount = { value: Math.round(amount * 100) / 100, confidence: subtotalField.confidence || 0 };
    }
  }

  const taxField = fields["TotalTax"];
  let vatAmount: ExtractedField<number> | null = null;
  if (taxField) {
    const amount = taxField.valueCurrencyAmount?.amount ?? taxField.valueNumber ?? parseGermanNumber(taxField.content || "");
    if (amount !== null && amount !== undefined) {
      vatAmount = { value: Math.round(amount * 100) / 100, confidence: taxField.confidence || 0 };
    }
  }

  // Detect VAT rate
  let vatRate: ExtractedField<number> | null = null;
  if (netAmount && vatAmount) {
    const rate = detectVatRate(netAmount.value, vatAmount.value);
    vatRate = { value: rate, confidence: Math.min(netAmount.confidence, vatAmount.confidence) };
  }

  // If we have gross but no net, reverse-calculate
  if (grossAmount && !netAmount && vatRate) {
    const net = Math.round((grossAmount.value / (1 + vatRate.value / 100)) * 100) / 100;
    netAmount = { value: net, confidence: grossAmount.confidence * 0.9 };
    if (!vatAmount) {
      vatAmount = { value: Math.round((grossAmount.value - net) * 100) / 100, confidence: grossAmount.confidence * 0.9 };
    }
  }

  // If we have net but no gross, calculate forward
  if (netAmount && !grossAmount && vatRate) {
    const vat = vatAmount?.value ?? Math.round(netAmount.value * (vatRate.value / 100) * 100) / 100;
    grossAmount = { value: Math.round((netAmount.value + vat) * 100) / 100, confidence: netAmount.confidence * 0.9 };
  }

  // Extract currency
  const currencyField = fields["InvoiceTotal"]?.valueCurrencyAmount?.currencyCode;
  const currency = currencyField
    ? { value: currencyField, confidence: 0.99 }
    : { value: "EUR", confidence: 0.7 };

  // Extract line items
  const lineItems: ExtractedLineItem[] = [];
  const itemsField = fields["Items"];
  if (itemsField?.valueArray) {
    for (const item of itemsField.valueArray) {
      if (item.valueObject) {
        const desc = item.valueObject["Description"];
        const qty = item.valueObject["Quantity"];
        const price = item.valueObject["UnitPrice"];
        const amt = item.valueObject["Amount"];

        lineItems.push({
          description: desc?.valueString || desc?.content || "",
          quantity: qty?.valueNumber ?? null,
          unitPrice: price?.valueCurrencyAmount?.amount ?? price?.valueNumber ?? parseGermanNumber(price?.content || "") ?? null,
          amount: amt?.valueCurrencyAmount?.amount ?? amt?.valueNumber ?? parseGermanNumber(amt?.content || "") ?? null,
          confidence: Math.min(
            desc?.confidence ?? 0,
            amt?.confidence ?? 0
          ),
        });
      }
    }
  }

  // Detect credit note
  const rawText = result.content || "";
  const isCreditNote = /gutschrift|credit\s*note|storno/i.test(rawText);

  return {
    vendor,
    invoiceNumber,
    invoiceDate,
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    currency,
    lineItems,
    rawText,
    isCreditNote,
  };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Extract invoice data from a file buffer using Azure Document Intelligence.
 */
export async function extractInvoiceData(
  buffer: Buffer,
  mimeType: string
): Promise<OcrExtractionResult> {
  const startTime = Date.now();

  try {
    const azureResult = await analyzeWithAzure(buffer, mimeType);
    const mapped = mapAzureResponse(azureResult);

    const processingTimeMs = Date.now() - startTime;

    // Build suggested description
    let suggestedDescription: string | null = null;
    if (mapped.lineItems && mapped.lineItems.length > 0) {
      suggestedDescription = mapped.lineItems
        .filter(li => li.description)
        .map(li => li.description)
        .slice(0, 3)
        .join(", ");
    }
    if (suggestedDescription && mapped.vendor?.value) {
      suggestedDescription += ` - ${mapped.vendor.value}`;
    }

    const result: OcrExtractionResult = {
      vendor: mapped.vendor || null,
      invoiceNumber: mapped.invoiceNumber || null,
      invoiceDate: mapped.invoiceDate || null,
      netAmount: mapped.netAmount || null,
      vatRate: mapped.vatRate || null,
      vatAmount: mapped.vatAmount || null,
      grossAmount: mapped.grossAmount || null,
      currency: mapped.currency || null,
      lineItems: mapped.lineItems || [],
      suggestedCategory: null, // Will be set by vendor mapping
      suggestedDescription,
      processingTimeMs,
      rawText: mapped.rawText || "",
      rawResponse: JSON.stringify(azureResult),
      provider: "azure_form_recognizer",
      isCreditNote: mapped.isCreditNote || false,
    };

    log.info(
      {
        vendor: result.vendor?.value,
        gross: result.grossAmount?.value,
        processingTimeMs,
        fieldsFound: Object.entries(result)
          .filter(([k, v]) => v !== null && k !== "rawText" && k !== "rawResponse")
          .length,
      },
      "Invoice data extracted"
    );

    return result;
  } catch (err) {
    const processingTimeMs = Date.now() - startTime;
    log.error({ err, processingTimeMs }, "OCR extraction failed");

    return {
      vendor: null,
      invoiceNumber: null,
      invoiceDate: null,
      netAmount: null,
      vatRate: null,
      vatAmount: null,
      grossAmount: null,
      currency: null,
      lineItems: [],
      suggestedCategory: null,
      suggestedDescription: null,
      processingTimeMs,
      rawText: "",
      rawResponse: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      provider: "azure_form_recognizer",
      isCreditNote: false,
    };
  }
}
