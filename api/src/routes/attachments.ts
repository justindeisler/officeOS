/**
 * Attachments & Invoice OCR API Routes
 *
 * Handles file uploads, OCR processing, attachment retrieval,
 * and vendor mapping CRUD operations.
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import {
  validateFile,
  saveFile,
  getFile,
  deleteFile,
  convertHeicToJpeg,
  computeChecksum,
  MAX_FILE_SIZE,
} from "../services/fileStorageService.js";
import { extractInvoiceData } from "../services/ocrService.js";
import {
  lookupVendor,
  saveVendorMapping,
  getAllVendorMappings,
  deleteVendorMapping,
  checkDuplicateUpload,
} from "../services/vendorMappingService.js";
import { createLogger } from "../logger.js";

const log = createLogger("attachments-route");

const router = Router();

// ============================================================================
// Multer configuration — memory storage (we handle writing ourselves)
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// ============================================================================
// Database Row Types
// ============================================================================

interface AttachmentRow {
  id: string;
  expense_id: string | null;
  original_filename: string;
  stored_filename: string;
  stored_path: string;
  file_size: number;
  mime_type: string;
  thumbnail_path: string | null;
  checksum: string | null;
  uploaded_at: string;
  created_at: string;
}

interface OcrExtractionRow {
  id: string;
  attachment_id: string;
  expense_id: string | null;
  provider: string;
  status: string;
  vendor_name: string | null;
  vendor_confidence: number | null;
  invoice_number: string | null;
  invoice_number_confidence: number | null;
  invoice_date: string | null;
  invoice_date_confidence: number | null;
  net_amount: number | null;
  net_amount_confidence: number | null;
  vat_rate: number | null;
  vat_rate_confidence: number | null;
  vat_amount: number | null;
  vat_amount_confidence: number | null;
  gross_amount: number | null;
  gross_amount_confidence: number | null;
  currency: string | null;
  currency_confidence: number | null;
  raw_text: string | null;
  raw_response: string | null;
  line_items: string | null;
  processing_time_ms: number | null;
  error_message: string | null;
  is_credit_note: number;
  created_at: string;
}

// ============================================================================
// Upload & Process Invoice
// ============================================================================

/**
 * POST /api/expenses/upload-invoice
 *
 * Upload an invoice file (PDF or image), validate it, store it,
 * run OCR extraction, and return the results.
 */
router.post(
  "/upload-invoice",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      throw new ValidationError("No file uploaded");
    }

    log.info(
      { filename: file.originalname, size: file.size, mimetype: file.mimetype },
      "Processing invoice upload"
    );

    let buffer = file.buffer;
    let mimeType = file.mimetype;

    // Validate file
    const validation = await validateFile(buffer, file.originalname, mimeType);
    if (!validation.valid) {
      throw new ValidationError(validation.error || "Invalid file");
    }

    // Use detected MIME type (more reliable than client-provided)
    mimeType = validation.mimeType || mimeType;

    // Convert HEIC to JPEG
    if (mimeType === "image/heic" || mimeType === "image/heif") {
      const converted = await convertHeicToJpeg(buffer);
      buffer = converted.buffer;
      mimeType = converted.mimeType;
    }

    // Check for duplicates
    const checksum = computeChecksum(buffer);
    const duplicate = checkDuplicateUpload(checksum);

    // Save file to disk
    const stored = await saveFile(buffer, file.originalname, mimeType);

    // Create attachment record in DB
    const db = getDb();
    const now = getCurrentTimestamp();

    db.prepare(
      `INSERT INTO attachments (id, expense_id, original_filename, stored_filename, stored_path, file_size, mime_type, thumbnail_path, checksum, uploaded_at, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      stored.id,
      stored.originalFilename,
      stored.storedFilename,
      stored.storedPath,
      stored.fileSize,
      mimeType,
      stored.thumbnailPath,
      stored.checksum,
      now,
      now
    );

    // Run OCR extraction
    const extraction = await extractInvoiceData(buffer, mimeType);

    // Apply vendor mapping
    let vendorSuggestion = null;
    if (extraction.vendor?.value) {
      vendorSuggestion = lookupVendor(extraction.vendor.value);
    }

    // Save OCR extraction to DB
    const extractionId = generateId();
    const ocrStatus = extraction.vendor || extraction.grossAmount ? "completed" : "failed";

    db.prepare(
      `INSERT INTO ocr_extractions (
        id, attachment_id, expense_id, provider, status,
        vendor_name, vendor_confidence,
        invoice_number, invoice_number_confidence,
        invoice_date, invoice_date_confidence,
        net_amount, net_amount_confidence,
        vat_rate, vat_rate_confidence,
        vat_amount, vat_amount_confidence,
        gross_amount, gross_amount_confidence,
        currency, currency_confidence,
        raw_text, raw_response, line_items,
        processing_time_ms, error_message, is_credit_note,
        created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      extractionId,
      stored.id,
      extraction.provider,
      ocrStatus,
      extraction.vendor?.value || null,
      extraction.vendor?.confidence || null,
      extraction.invoiceNumber?.value || null,
      extraction.invoiceNumber?.confidence || null,
      extraction.invoiceDate?.value || null,
      extraction.invoiceDate?.confidence || null,
      extraction.netAmount?.value || null,
      extraction.netAmount?.confidence || null,
      extraction.vatRate?.value || null,
      extraction.vatRate?.confidence || null,
      extraction.vatAmount?.value || null,
      extraction.vatAmount?.confidence || null,
      extraction.grossAmount?.value || null,
      extraction.grossAmount?.confidence || null,
      extraction.currency?.value || null,
      extraction.currency?.confidence || null,
      extraction.rawText || null,
      extraction.rawResponse || null,
      extraction.lineItems.length > 0 ? JSON.stringify(extraction.lineItems) : null,
      extraction.processingTimeMs,
      ocrStatus === "failed" ? "Could not extract data from document" : null,
      extraction.isCreditNote ? 1 : 0,
      now
    );

    // Build response
    const response: Record<string, unknown> = {
      attachment_id: stored.id,
      extraction_id: extractionId,
      file_url: `/api/attachments/${stored.id}/file`,
      thumbnail_url: stored.thumbnailPath
        ? `/api/attachments/${stored.id}/thumbnail`
        : null,
      duplicate: duplicate
        ? {
            existing_expense_id: duplicate.expenseId,
            existing_date: duplicate.date,
          }
        : null,
      extraction: {
        status: ocrStatus,
        vendor: extraction.vendor
          ? {
              value: vendorSuggestion?.displayName || extraction.vendor.value,
              confidence: vendorSuggestion
                ? Math.max(extraction.vendor.confidence, vendorSuggestion.confidence)
                : extraction.vendor.confidence,
              raw_ocr_value: extraction.vendor.value,
            }
          : null,
        invoice_number: extraction.invoiceNumber,
        invoice_date: extraction.invoiceDate,
        net_amount: extraction.netAmount,
        vat_rate: extraction.vatRate,
        vat_amount: extraction.vatAmount,
        gross_amount: extraction.grossAmount,
        currency: extraction.currency,
        line_items: extraction.lineItems,
        suggested_category:
          vendorSuggestion?.category || extraction.suggestedCategory,
        suggested_description: extraction.suggestedDescription,
        is_credit_note: extraction.isCreditNote,
        processing_time_ms: extraction.processingTimeMs,
      },
    };

    res.json(response);
  })
);

// ============================================================================
// Attachment File Serving
// ============================================================================

/**
 * GET /api/attachments/:id/file
 *
 * Serve the original uploaded file.
 */
router.get(
  "/:id/file",
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const attachment = db
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(req.params.id) as AttachmentRow | undefined;

    if (!attachment) {
      throw new NotFoundError("Attachment", req.params.id);
    }

    const file = getFile(attachment.stored_path);
    if (!file) {
      throw new NotFoundError("Attachment file (not found on disk)");
    }

    const download = req.query.download === "true";
    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("Content-Length", file.size);

    if (download) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${attachment.original_filename}"`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${attachment.original_filename}"`
      );
    }

    file.stream.pipe(res);
  })
);

/**
 * GET /api/attachments/:id/thumbnail
 *
 * Serve the thumbnail image for an attachment.
 */
router.get(
  "/:id/thumbnail",
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const attachment = db
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(req.params.id) as AttachmentRow | undefined;

    if (!attachment) {
      throw new NotFoundError("Attachment", req.params.id);
    }

    if (!attachment.thumbnail_path) {
      throw new NotFoundError("Thumbnail (no thumbnail available for this attachment)");
    }

    const file = getFile(attachment.thumbnail_path);
    if (!file) {
      throw new NotFoundError("Thumbnail file (not found on disk)");
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", file.size);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    file.stream.pipe(res);
  })
);

/**
 * GET /api/attachments/:id
 *
 * Get attachment metadata.
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const attachment = db
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(req.params.id) as AttachmentRow | undefined;

    if (!attachment) {
      throw new NotFoundError("Attachment", req.params.id);
    }

    res.json({
      id: attachment.id,
      expense_id: attachment.expense_id,
      original_filename: attachment.original_filename,
      file_size: attachment.file_size,
      mime_type: attachment.mime_type,
      has_thumbnail: !!attachment.thumbnail_path,
      file_url: `/api/attachments/${attachment.id}/file`,
      thumbnail_url: attachment.thumbnail_path
        ? `/api/attachments/${attachment.id}/thumbnail`
        : null,
      uploaded_at: attachment.uploaded_at,
    });
  })
);

/**
 * DELETE /api/attachments/:id
 *
 * Delete an attachment and its files.
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const attachment = db
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .get(req.params.id) as AttachmentRow | undefined;

    if (!attachment) {
      throw new NotFoundError("Attachment", req.params.id);
    }

    // Delete files from disk
    deleteFile(attachment.stored_path, attachment.thumbnail_path);

    // Delete from database (cascades to ocr_extractions)
    db.prepare("DELETE FROM attachments WHERE id = ?").run(req.params.id);

    // Clear attachment_id on any linked expense
    if (attachment.expense_id) {
      db.prepare(
        "UPDATE expenses SET attachment_id = NULL WHERE id = ?"
      ).run(attachment.expense_id);
    }

    res.json({ success: true, message: "Attachment deleted" });
  })
);

// ============================================================================
// Vendor Mappings
// ============================================================================

/**
 * GET /api/vendor-mappings
 */
router.get(
  "/vendor-mappings",
  asyncHandler(async (_req: Request, res: Response) => {
    // This is actually mounted as a separate router, but handling here for simplicity
    const mappings = getAllVendorMappings();
    res.json(mappings);
  })
);

export default router;
