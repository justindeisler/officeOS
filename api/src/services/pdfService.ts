/**
 * PDF Generation Service
 *
 * Uses Puppeteer and Handlebars to generate professional invoice PDFs
 * from the invoice HTML template.
 */

import puppeteer, { type Browser } from "puppeteer";
import Handlebars from "handlebars";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getDb } from "../database.js";
import { createLogger } from "../logger.js";

const log = createLogger("pdf-service");

const __dirname = dirname(fileURLToPath(import.meta.url));

// Determine if we're running from dist or src
const isDistBuild = __dirname.includes("/dist/");
const srcRoot = isDistBuild
  ? join(__dirname, "../../src")  // From dist/services -> src
  : join(__dirname, "..");         // From src/services -> src

// Invoice storage directory (always relative to project root)
const projectRoot = isDistBuild ? join(__dirname, "../..") : join(__dirname, "../../");
const INVOICE_STORAGE_DIR = join(projectRoot, "storage/invoices");

// Ensure storage directory exists
if (!existsSync(INVOICE_STORAGE_DIR)) {
  mkdirSync(INVOICE_STORAGE_DIR, { recursive: true });
}

// Load and compile the invoice template once
const templatePath = join(srcRoot, "templates/invoice.html");
const templateSource = readFileSync(templatePath, "utf-8");
const invoiceTemplate = Handlebars.compile(templateSource);

// Reusable browser instance for performance
let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserInstance;
}

/**
 * Close the browser instance (for cleanup)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Seller configuration - can be extended to load from config/database
 */
export interface SellerInfo {
  name: string;
  title: string;
  address: {
    street: string;
    zip: string;
    city: string;
    country?: string;
  };
  email: string;
  phone?: string;
  vatId?: string;
  taxId?: string;
  bank: {
    name: string;
    iban: string;
    bic: string;
  };
}

/**
 * Client information for the invoice
 */
export interface ClientInfo {
  name: string;
  company?: string;
  address?: {
    street: string;
    zip: string;
    city: string;
    country?: string;
  };
  vatId?: string;
  email?: string;
}

/**
 * Invoice line item
 */
export interface InvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

/**
 * Invoice data for PDF generation
 */
export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  client: ClientInfo;
  items: InvoiceItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  paymentDate?: Date;
}

/**
 * Business profile as stored in settings
 */
interface BusinessProfile {
  fullName: string;
  jobTitle: string;
  email: string;
  phone?: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatId?: string;
  taxId?: string;
  bankAccountHolder: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
}

/**
 * Format IBAN with spaces for display
 */
function formatIban(iban: string): string {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Get seller info from database settings
 * Falls back to environment variables and placeholder values
 */
export function getDefaultSeller(): SellerInfo {
  // Try to load from database first
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("businessProfile") as { value: string } | undefined;
    
    if (row?.value) {
      const profile: BusinessProfile = JSON.parse(row.value);
      
      // Only use database values if profile has required fields
      if (profile.fullName && profile.email && profile.street && profile.bankIban) {
        log.debug("Using business profile from database");
        return {
          name: profile.fullName,
          title: profile.jobTitle || "",
          address: {
            street: profile.street,
            zip: profile.postalCode,
            city: profile.city,
            country: profile.country,
          },
          email: profile.email,
          phone: profile.phone,
          vatId: profile.vatId,
          taxId: profile.taxId,
          bank: {
            name: profile.bankName,
            iban: formatIban(profile.bankIban),
            bic: profile.bankBic,
          },
        };
      }
    }
  } catch (error) {
    log.warn({ err: error }, "Could not load business profile from database");
  }

  // Fall back to environment variables or placeholder values
  log.debug("Using fallback seller configuration");
  return {
    name: process.env.SELLER_NAME || "Justin Deisler",
    title: process.env.SELLER_TITLE || "Full-Stack Developer",
    address: {
      street: process.env.SELLER_STREET || "Musterstraße 123",
      zip: process.env.SELLER_ZIP || "12345",
      city: process.env.SELLER_CITY || "Musterstadt",
    },
    email: process.env.SELLER_EMAIL || "kontakt@justin-deisler.com",
    vatId: process.env.SELLER_VAT_ID || "DE123456789",
    taxId: process.env.SELLER_TAX_ID || "123/456/78901",
    bank: {
      name: process.env.SELLER_BANK_NAME || "Musterbank",
      iban: process.env.SELLER_BANK_IBAN || "DE12 3456 7890 1234 5678 90",
      bic: process.env.SELLER_BANK_BIC || "MUSTDEFFXXX",
    },
  };
}

/**
 * Format currency in German locale
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Format date in German locale
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Get unit label in German
 */
function getUnitLabel(unit: string): string {
  const unitLabels: Record<string, string> = {
    hours: "Std.",
    hour: "Std.",
    hrs: "Std.",
    days: "Tage",
    day: "Tag",
    pieces: "Stk.",
    piece: "Stk.",
    pcs: "Stk.",
    units: "Einh.",
    unit: "Einh.",
    pauschal: "pauschal",
    flat: "pauschal",
  };
  return unitLabels[unit.toLowerCase()] || unit;
}

/**
 * Get status label in German
 */
function getStatusLabel(status: InvoiceData["status"]): string {
  const labels: Record<InvoiceData["status"], string> = {
    draft: "Entwurf",
    sent: "Versendet",
    paid: "Bezahlt",
    overdue: "Überfällig",
    cancelled: "Storniert",
  };
  return labels[status];
}

/**
 * Get status CSS class
 */
function getStatusClass(status: InvoiceData["status"]): string {
  return status;
}

/**
 * Prepare template data from invoice data
 */
function prepareTemplateData(
  invoice: InvoiceData,
  seller: SellerInfo = getDefaultSeller()
): Record<string, unknown> {
  return {
    // Seller info
    seller,

    // Client info
    client: invoice.client,

    // Invoice metadata
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: formatDate(invoice.invoiceDate),
    serviceDate: formatDate(invoice.invoiceDate), // Could be separate field
    dueDate: formatDate(invoice.dueDate),
    status: invoice.status,
    statusLabel: getStatusLabel(invoice.status),
    statusClass: getStatusClass(invoice.status),
    isPaid: invoice.status === "paid",

    // Line items with formatting
    items: invoice.items.map((item) => ({
      ...item,
      unitLabel: getUnitLabel(item.unit),
      unitPriceFormatted: formatCurrency(item.unitPrice),
      amountFormatted: formatCurrency(item.amount),
    })),

    // Totals
    subtotalFormatted: formatCurrency(invoice.subtotal),
    vatRate: invoice.vatRate,
    vatAmountFormatted: formatCurrency(invoice.vatAmount),
    totalFormatted: formatCurrency(invoice.total),

    // Notes
    notes: invoice.notes,
  };
}

/**
 * Generate PDF buffer from invoice data
 */
export async function generateInvoicePdfBuffer(
  invoice: InvoiceData,
  seller?: SellerInfo
): Promise<Buffer> {
  log.info({ invoiceNumber: invoice.invoiceNumber }, "Generating PDF");

  // Prepare template data
  const templateData = prepareTemplateData(invoice, seller);

  // Render HTML
  const html = invoiceTemplate(templateData);
  log.debug({ htmlLength: html.length }, "HTML template rendered");

  // Generate PDF using Puppeteer
  let browser: Browser | null = null;
  let page = null;

  try {
    browser = await getBrowser();
    log.debug("Browser instance obtained");

    page = await browser.newPage();
    log.debug("New page created");

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    log.debug("Content set on page");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "10mm",
        bottom: "20mm",
        left: "10mm",
      },
      displayHeaderFooter: false,
    });

    log.info({ invoiceNumber: invoice.invoiceNumber, sizeBytes: pdfBuffer.length }, "PDF generated");
    return Buffer.from(pdfBuffer);
  } catch (error) {
    log.error({ err: error, invoiceNumber: invoice.invoiceNumber }, "Error generating PDF");
    throw error;
  } finally {
    if (page) {
      await page.close().catch((e: Error) => log.error({ err: e }, "Error closing page"));
    }
  }
}

/**
 * Generate and save invoice PDF to storage
 * Returns the file path relative to storage directory
 */
export async function generateInvoicePdf(
  invoice: InvoiceData,
  seller?: SellerInfo
): Promise<string> {
  // Generate PDF buffer
  const pdfBuffer = await generateInvoicePdfBuffer(invoice, seller);

  // Create year/month subdirectory
  const year = invoice.invoiceDate.getFullYear().toString();
  const month = (invoice.invoiceDate.getMonth() + 1).toString().padStart(2, "0");
  const subDir = join(INVOICE_STORAGE_DIR, year, month);

  if (!existsSync(subDir)) {
    mkdirSync(subDir, { recursive: true });
  }

  // Generate filename
  const filename = `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`;
  const filePath = join(subDir, filename);

  // Write file
  const { writeFileSync } = await import("fs");
  writeFileSync(filePath, pdfBuffer);

  // Return relative path from storage root
  return join(year, month, filename);
}

/**
 * Get the full path to a stored invoice PDF
 */
export function getInvoicePdfPath(relativePath: string): string {
  return join(INVOICE_STORAGE_DIR, relativePath);
}

/**
 * Check if an invoice PDF exists
 */
export function invoicePdfExists(relativePath: string): boolean {
  return existsSync(getInvoicePdfPath(relativePath));
}

/**
 * Delete an invoice PDF
 */
export async function deleteInvoicePdf(relativePath: string): Promise<boolean> {
  const fullPath = getInvoicePdfPath(relativePath);
  if (existsSync(fullPath)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(fullPath);
    return true;
  }
  return false;
}

// Cleanup browser on process exit
process.on("exit", () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
