# PRD: Invoice OCR & Auto-Expense

> **Status:** Draft
> **Author:** James (AI Assistant)
> **Created:** 2025-07-24
> **Target User:** German freelancer (Einzelunternehmen, EÜR)
> **App:** Personal Assistant (TypeScript, React, Express API, SQLite)

---

## Table of Contents

1. [Problem Statement & User Story](#1-problem-statement--user-story)
2. [Functional Requirements](#2-functional-requirements)
3. [Technical Architecture](#3-technical-architecture)
4. [Data Model](#4-data-model)
5. [UX Flow](#5-ux-flow)
6. [Edge Cases & Error Handling](#6-edge-cases--error-handling)
7. [Security Considerations](#7-security-considerations)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Phases](#9-implementation-phases)
10. [Success Metrics](#10-success-metrics)

---

## 1. Problem Statement & User Story

### Problem

Currently, adding an expense in the Personal Assistant app requires manual entry of every field: date, vendor, description, amount, VAT rate, and category. For a freelancer processing 20–50 invoices/receipts per month, this is tedious and error-prone. The existing `receiptPath` field on expenses is a plain text string with no upload mechanism — users must manually specify a filesystem path. There is no way to:

- Upload an invoice file through the UI
- Extract structured data from a PDF or photo
- Attach the original document to the expense for audit/reference

This friction leads to delayed bookkeeping, data entry errors, and a disconnection between expense records and their source documents.

### User Stories

**Primary:**
> As a German freelancer, I want to photograph or upload an invoice and have the system automatically extract the vendor, date, amounts, and VAT so that I can create an expense record in seconds instead of minutes.

**Secondary:**
> As a freelancer preparing my EÜR or USt-Voranmeldung, I want every expense to have its original invoice attached so I can quickly reference or download it during tax reviews.

> As a mobile user, I want to snap a photo of a paper receipt while on the go and have it processed when I'm back at my desk, so I never lose a receipt.

### Target Persona

- **Name:** Justin (German freelancer, IT/consulting)
- **Pain point:** Monthly bookkeeping takes 2–3 hours of manual data entry
- **Expectation:** Upload a file → review extracted data → confirm → done in under 30 seconds per invoice
- **Language context:** Receives invoices in both German and English
- **Device usage:** Desktop for bulk processing, mobile for quick receipt captures

---

## 2. Functional Requirements

### 2.1 File Upload

| Requirement | Details |
|---|---|
| **FR-1** | Accept PDF files up to 10 MB |
| **FR-2** | Accept image files (JPEG, PNG, WebP, HEIC) up to 10 MB |
| **FR-3** | Support drag-and-drop upload on desktop |
| **FR-4** | Support camera capture on mobile (via `<input accept="image/*" capture="environment">`) |
| **FR-5** | Show upload progress indicator |
| **FR-6** | Allow multiple file uploads in sequence (one at a time processing) |
| **FR-7** | Validate file type and size client-side before upload |

### 2.2 OCR & Data Extraction

| Requirement | Details |
|---|---|
| **FR-8** | Extract vendor/company name from invoice |
| **FR-9** | Extract invoice date (Rechnungsdatum) |
| **FR-10** | Extract total gross amount (Brutto) |
| **FR-11** | Extract net amount (Netto) and VAT amount (MwSt/USt) |
| **FR-12** | Detect VAT rate (0%, 7%, 19%) |
| **FR-13** | Extract invoice number (Rechnungsnummer) |
| **FR-14** | Extract line items where possible (description, quantity, unit price) |
| **FR-15** | Support German-language invoices (Rechnung, Betrag, MwSt, Netto, Brutto) |
| **FR-16** | Support English-language invoices |
| **FR-17** | Return confidence scores for each extracted field |
| **FR-18** | Complete extraction within 10 seconds for typical invoices |

### 2.3 Review & Validation

| Requirement | Details |
|---|---|
| **FR-19** | Display extracted data in the ExpenseForm pre-populated |
| **FR-20** | Show the original document alongside the form (split view on desktop) |
| **FR-21** | Highlight low-confidence fields visually (amber/warning styling) |
| **FR-22** | Allow manual correction of any extracted field before saving |
| **FR-23** | Auto-suggest EÜR category based on vendor name (vendor→category mapping) |
| **FR-24** | Validate extracted amounts: net + VAT = gross (flag mismatches) |
| **FR-25** | Pre-select VAT rate from extracted data, defaulting to 19% if ambiguous |

### 2.4 Storage & Attachment

| Requirement | Details |
|---|---|
| **FR-26** | Store uploaded file on the server filesystem in an organized directory structure |
| **FR-27** | Link file to expense record via the existing `receipt_path` field + new attachment metadata |
| **FR-28** | Support downloading the attached file from the expense detail view |
| **FR-29** | Support inline PDF viewing in the browser |
| **FR-30** | Store OCR extraction metadata (raw text, confidence scores, processing time) |
| **FR-31** | Preserve original filename in metadata |
| **FR-32** | Generate unique storage filenames to prevent collisions |

### 2.5 Vendor Intelligence

| Requirement | Details |
|---|---|
| **FR-33** | Maintain a vendor alias/mapping table (e.g., "AMZN MKTP DE" → "Amazon") |
| **FR-34** | Learn from user corrections: if user changes vendor name, offer to remember the mapping |
| **FR-35** | Auto-suggest category based on previous expenses from same vendor |

---

## 3. Technical Architecture

### 3.1 OCR Service Selection

#### Evaluation Matrix

| Criteria | Tesseract (self-hosted) | Google Cloud Vision | AWS Textract | Azure Form Recognizer |
|---|---|---|---|---|
| **Cost** | Free (CPU cost only) | $1.50/1000 pages | $1.50/1000 pages | $1/1000 pages (prebuilt invoice) |
| **German accuracy** | Fair (60–75%) | Excellent (95%+) | Very Good (90%+) | Excellent (95%+), invoice-specific model |
| **Invoice-specific models** | ❌ None | ❌ Generic OCR | ✅ Analyze Expense | ✅ Prebuilt Invoice Model |
| **Structured extraction** | ❌ Raw text only | ⚠️ Text + bounding boxes | ✅ Key-value pairs | ✅ Fields: vendor, date, amounts, items |
| **Setup complexity** | High (need post-processing) | Low (API call) | Low (API call) | Low (API call) |
| **Offline capable** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Latency** | 2–5s (local) | 1–3s | 1–3s | 1–3s |
| **Multi-page PDF** | ⚠️ Manual handling | ✅ Native | ✅ Native | ✅ Native |
| **Privacy** | ✅ Data stays local | ⚠️ Data sent to Google | ⚠️ Data sent to AWS | ⚠️ Data sent to Azure |

#### Recommendation: Hybrid Approach (Primary: Azure Form Recognizer, Fallback: Tesseract)

**Primary — Azure Form Recognizer (Prebuilt Invoice Model):**

Azure is the strongest choice for this specific use case because:

1. **Invoice-specific model**: The prebuilt invoice model extracts structured fields (vendor name, invoice date, due date, line items, subtotal, tax, total) without any custom training. This eliminates 80% of the post-processing logic needed with generic OCR.

2. **Excellent German support**: Azure's invoice model is explicitly trained on German invoices (Rechnungen), understanding terms like "Rechnungsnummer," "Nettobetrag," "MwSt," "Brutto," and German date/number formats (DD.MM.YYYY, comma as decimal separator).

3. **Cost-effective at scale**: At ~$1 per 1,000 pages with the prebuilt model, processing 50 invoices/month costs approximately $0.60/year. Even with the free tier (500 pages/month), the typical freelancer usage is covered at no cost.

4. **Structured output**: Returns typed fields with confidence scores, reducing the need for regex-based parsing of raw OCR text.

**Fallback — Tesseract (local):**

For situations where cloud processing is unavailable or for simple receipts where full invoice parsing isn't needed, a local Tesseract instance provides basic text extraction. This also addresses data privacy concerns for sensitive documents.

#### Cost Estimate (Azure Form Recognizer)

| Usage Level | Pages/Month | Monthly Cost | Annual Cost |
|---|---|---|---|
| Light (freelancer) | 20–50 | Free (free tier) | $0 |
| Medium | 100–500 | Free (free tier) | $0 |
| Heavy | 500–1,000 | ~$0.50 | ~$6 |

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend                               │
│                                                                   │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │ Upload Zone  │→ │ OCR Review Panel  │→ │  ExpenseForm     │  │
│  │ (drag/drop,  │  │ (doc preview +    │  │  (pre-filled,    │  │
│  │  camera)     │  │  extracted data)  │  │   editable)      │  │
│  └──────────────┘  └───────────────────┘  └──────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ multipart/form-data
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express API Server                           │
│                                                                   │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ POST /expenses/  │  │ OCR Service     │  │ File Storage   │  │
│  │   upload-invoice │→ │ (Azure Form     │→ │ Service        │  │
│  │                  │  │  Recognizer)    │  │ (local fs)     │  │
│  └──────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                   │
│  ┌──────────────────┐  ┌─────────────────┐                      │
│  │ POST /expenses   │  │ Vendor          │                      │
│  │ (existing, now   │  │ Intelligence    │                      │
│  │  with receipt_id)│  │ Service         │                      │
│  └──────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLite Database                    File System                  │
│  ┌──────────┐ ┌──────────────┐     ~/.local/share/com.personal- │
│  │ expenses │ │ attachments  │      assistant.app/uploads/       │
│  │          │ │              │       ├── 2025/                   │
│  │          │ │              │       │   ├── 07/                 │
│  │          │ │              │       │   │   ├── <uuid>.pdf      │
│  │          │ │              │       │   │   └── <uuid>.jpg      │
│  └──────────┘ └──────────────┘       ...                         │
│  ┌──────────────────┐                                            │
│  │ vendor_mappings  │                                            │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 API Design

#### Upload & Process Invoice

```
POST /api/expenses/upload-invoice
Content-Type: multipart/form-data

Body:
  file: <binary>  (PDF or image)

Response 200:
{
  "attachment_id": "uuid",
  "file_url": "/api/attachments/uuid/file",
  "thumbnail_url": "/api/attachments/uuid/thumbnail",  // for images
  "extraction": {
    "vendor": { "value": "Hetzner Online GmbH", "confidence": 0.97 },
    "invoice_number": { "value": "R-2025-12345", "confidence": 0.95 },
    "invoice_date": { "value": "2025-07-15", "confidence": 0.98 },
    "net_amount": { "value": 42.02, "confidence": 0.96 },
    "vat_rate": { "value": 19, "confidence": 0.94 },
    "vat_amount": { "value": 7.98, "confidence": 0.96 },
    "gross_amount": { "value": 50.00, "confidence": 0.99 },
    "currency": { "value": "EUR", "confidence": 0.99 },
    "line_items": [
      {
        "description": "Cloud Server CX21",
        "quantity": 1,
        "unit_price": 42.02,
        "amount": 42.02,
        "confidence": 0.88
      }
    ],
    "suggested_category": "hosting",
    "suggested_description": "Cloud Server CX21 - Hetzner",
    "processing_time_ms": 2340,
    "raw_text": "..."
  }
}

Response 400: { "error": "Invalid file type. Accepted: PDF, JPEG, PNG, WebP, HEIC" }
Response 413: { "error": "File too large. Maximum size: 10 MB" }
Response 422: { "error": "OCR processing failed", "details": "..." }
```

#### Get Attachment File

```
GET /api/attachments/:id/file
Query: ?download=true  (optional, forces download vs inline)

Response: Binary file stream with appropriate Content-Type
```

#### Get Attachment Thumbnail

```
GET /api/attachments/:id/thumbnail

Response: JPEG thumbnail (max 400px wide) for image attachments
          First-page render for PDF attachments
```

#### Confirm & Create Expense (modified existing endpoint)

```
POST /api/expenses
Content-Type: application/json

Body:
{
  "date": "2025-07-15",
  "vendor": "Hetzner Online GmbH",
  "description": "Cloud Server CX21",
  "category": "hosting",
  "net_amount": 42.02,
  "vat_rate": 19,
  "euer_category": "hosting",
  "payment_method": "bank_transfer",
  "attachment_id": "uuid-of-uploaded-file",     // NEW: links to attachment
  "ocr_extraction_id": "uuid-of-extraction"      // NEW: links to extraction metadata
}
```

#### Vendor Mappings

```
GET /api/vendor-mappings
Response: [{ "id": "uuid", "ocr_name": "AMZN MKTP DE", "display_name": "Amazon", "default_category": "software" }]

POST /api/vendor-mappings
Body: { "ocr_name": "AMZN MKTP DE", "display_name": "Amazon", "default_category": "software" }

DELETE /api/vendor-mappings/:id
```

### 3.4 File Storage Strategy

**Location:** `~/.local/share/com.personal-assistant.app/uploads/`

**Directory structure:**
```
uploads/
├── 2025/
│   ├── 07/
│   │   ├── a1b2c3d4-invoice.pdf
│   │   ├── e5f6g7h8-receipt.jpg
│   │   └── thumbnails/
│   │       ├── a1b2c3d4-thumb.jpg
│   │       └── e5f6g7h8-thumb.jpg
│   └── 08/
│       └── ...
└── 2026/
    └── ...
```

**Naming convention:** `<uuid>-<sanitized-original-name>.<ext>`

**Rationale for local filesystem (vs cloud storage):**
- This is a self-hosted, single-user app running on a personal server
- No CDN or multi-region access needed
- Keeps data under user control (GDPR/privacy)
- Backups handled by existing server backup strategy
- Simpler architecture, no additional cloud dependencies

---

## 4. Data Model

### 4.1 New Table: `attachments`

```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,          -- full path on disk
  file_size INTEGER NOT NULL,         -- bytes
  mime_type TEXT NOT NULL,            -- e.g., 'application/pdf', 'image/jpeg'
  thumbnail_path TEXT,                -- path to generated thumbnail
  checksum TEXT,                      -- SHA-256 hash for integrity
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachments_expense_id ON attachments(expense_id);
```

### 4.2 New Table: `ocr_extractions`

```sql
CREATE TABLE ocr_extractions (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,              -- 'azure_form_recognizer' | 'tesseract'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'failed'
  
  -- Extracted fields (nullable — not all fields may be found)
  vendor_name TEXT,
  vendor_confidence REAL,
  invoice_number TEXT,
  invoice_number_confidence REAL,
  invoice_date TEXT,                   -- ISO 8601
  invoice_date_confidence REAL,
  net_amount REAL,
  net_amount_confidence REAL,
  vat_rate REAL,
  vat_rate_confidence REAL,
  vat_amount REAL,
  vat_amount_confidence REAL,
  gross_amount REAL,
  gross_amount_confidence REAL,
  currency TEXT DEFAULT 'EUR',
  currency_confidence REAL,
  
  -- Raw data for debugging/reprocessing
  raw_text TEXT,                       -- Full OCR text output
  raw_response TEXT,                   -- Full API response (JSON)
  line_items TEXT,                     -- JSON array of extracted line items
  
  -- Processing metadata
  processing_time_ms INTEGER,
  error_message TEXT,                  -- If status = 'failed'
  
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ocr_extractions_attachment_id ON ocr_extractions(attachment_id);
CREATE INDEX idx_ocr_extractions_expense_id ON ocr_extractions(expense_id);
```

### 4.3 New Table: `vendor_mappings`

```sql
CREATE TABLE vendor_mappings (
  id TEXT PRIMARY KEY,
  ocr_name TEXT NOT NULL UNIQUE,       -- What OCR typically returns
  display_name TEXT NOT NULL,          -- Cleaned/canonical vendor name
  default_category TEXT,               -- Auto-suggest this EÜR category
  default_vat_rate INTEGER,            -- Auto-suggest this VAT rate
  use_count INTEGER DEFAULT 0,         -- How often this mapping was used
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vendor_mappings_ocr_name ON vendor_mappings(ocr_name);
```

### 4.4 Migration: Update `expenses` Table

```sql
-- Add attachment reference to expenses
-- (receipt_path is kept for backward compatibility but attachment_id is preferred)
ALTER TABLE expenses ADD COLUMN attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_attachment_id ON expenses(attachment_id);
```

### 4.5 Entity Relationship

```
expenses 1 ←──── 0..1 attachments
                         │
                         │ 1
                         ▼
                    0..1 ocr_extractions

vendor_mappings (standalone lookup table)
```

---

## 5. UX Flow

### 5.1 Primary Flow: Upload → Review → Save

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Upload                                              │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │  ┌───────────────────────────────────────┐  │             │
│  │  │         📄 Drop invoice here          │  │             │
│  │  │      or click to browse files         │  │             │
│  │  │                                       │  │             │
│  │  │    PDF, JPEG, PNG · Max 10 MB         │  │             │
│  │  └───────────────────────────────────────┘  │             │
│  │                                               │             │
│  │  📷 Take Photo (mobile only)                  │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
│  User drops a PDF or taps camera → file uploads              │
│  Loading spinner: "Processing invoice..."                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Review Extracted Data                               │
│                                                               │
│  ┌──────────────────────┬──────────────────────────────┐     │
│  │  Document Preview    │  Extracted Fields             │     │
│  │                      │                                │     │
│  │  ┌────────────────┐  │  Vendor: [Hetzner Online   ] │     │
│  │  │                │  │  Date:   [2025-07-15       ] │     │
│  │  │  (PDF/image    │  │  Net:    [42.02           €] │     │
│  │  │   rendered     │  │  VAT:    [19% ▼] → 7.98 €   │     │
│  │  │   inline)      │  │  Gross:  [50.00           €] │     │
│  │  │                │  │  Inv.#:  [R-2025-12345     ] │     │
│  │  │                │  │                                │     │
│  │  │                │  │  ⚠ Low confidence on vendor   │     │
│  │  │                │  │    name (72%). Please verify.  │     │
│  │  │                │  │                                │     │
│  │  └────────────────┘  │  Category: [Hosting ▼       ] │     │
│  │                      │  Deductible: [100        %]  │     │
│  │  ◀ ▶ (page nav      │                                │     │
│  │   for multi-page)    │  [Cancel]  [Save Expense →]  │     │
│  └──────────────────────┴──────────────────────────────┘     │
└─────────────────────┬───────────────────────────────────────┘
                      │ User reviews, corrects if needed,
                      │ clicks "Save Expense"
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Confirmation                                        │
│                                                               │
│  ✅ Expense saved successfully!                               │
│                                                               │
│  Hetzner Online GmbH · €50.00 (brutto) · 15.07.2025         │
│  📎 invoice-hetzner-2025-07.pdf attached                     │
│                                                               │
│  [Upload Another]  [View Expense]                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile Flow

On mobile devices (< 768px viewport):

1. **Upload:** Full-width upload zone + prominent "📷 Take Photo" button using native camera
2. **Review:** Stacked layout (document preview on top, scrollable form below)
3. **Document preview:** Collapsible/expandable with pinch-to-zoom
4. **Quick-save:** Sticky bottom bar with "Save" button always visible

### 5.3 Integration Points in Existing UI

**Entry points for the OCR upload flow:**

1. **ExpensesPage** — New "📷 Scan Invoice" button alongside existing "Add Expense" button
2. **ExpenseForm** — Enhanced receipt field: replace text input with file upload component
3. **ExpenseList** — Receipt icon/badge on expenses that have attachments, clickable to view

**Existing `receipt_path` field migration:**
- The current text input for `receiptPath` in `ExpenseForm.tsx` will be replaced by an upload component
- Existing expenses with `receipt_path` values continue to work via the current `GET /:id/receipt` endpoint
- New uploads populate both `receipt_path` (for backward compat) and `attachment_id`

### 5.4 Wireframe: Upload Trigger States

```
┌────────────────────────────────────┐
│  Receipt / Invoice                  │
│                                      │
│  [IDLE]                              │
│  ┌──────────────────────────────┐   │
│  │  📎 Attach invoice or receipt │   │
│  │  Drop file here or browse    │   │
│  └──────────────────────────────┘   │
│                                      │
│  [UPLOADING]                         │
│  ┌──────────────────────────────┐   │
│  │  📤 Uploading... 67%          │   │
│  │  ████████████░░░░░░░░        │   │
│  └──────────────────────────────┘   │
│                                      │
│  [PROCESSING]                        │
│  ┌──────────────────────────────┐   │
│  │  🔍 Extracting data...        │   │
│  │  ◌ Reading invoice fields     │   │
│  └──────────────────────────────┘   │
│                                      │
│  [ATTACHED]                          │
│  ┌──────────────────────────────┐   │
│  │  📄 invoice-hetzner.pdf       │   │
│  │  2.4 MB · Uploaded just now   │   │
│  │  [View] [Replace] [Remove]    │   │
│  └──────────────────────────────┘   │
└────────────────────────────────────┘
```

---

## 6. Edge Cases & Error Handling

### 6.1 OCR Extraction Failures

| Scenario | Handling |
|---|---|
| **OCR returns no data** | Show warning "Could not extract data from this document." Open blank ExpenseForm with file attached. User enters data manually. |
| **Partial extraction** (e.g., vendor found but no amounts) | Pre-fill available fields. Highlight missing required fields. Show "Some fields could not be extracted" notice. |
| **Low confidence** (any field < 70%) | Highlight field with amber warning icon and tooltip: "Low confidence — please verify." |
| **Amount mismatch** (net + VAT ≠ gross) | Show calculated vs extracted values. Let user choose which to keep. Auto-recalculate on change. |
| **OCR service timeout** (> 30s) | Retry once automatically. If still fails, offer: "Processing is taking longer than expected. [Retry] or [Enter manually]" |
| **OCR service unavailable** | Fall back to Tesseract local processing. If that also fails, allow manual entry with file attachment only. |
| **Non-invoice document** (e.g., random photo) | Show extracted text if any. Note: "This doesn't appear to be an invoice. You can still attach it and fill in details manually." |

### 6.2 File Handling Edge Cases

| Scenario | Handling |
|---|---|
| **Multi-page PDF** | Process first page for extraction (most invoices have key data on page 1). Store full PDF. Show page navigation in preview. |
| **Rotated/skewed image** | Azure Form Recognizer handles auto-rotation. For Tesseract fallback, apply deskewing via `sharp`. |
| **HEIC images** (iPhone) | Convert to JPEG server-side using `sharp` before processing. Store both original and converted. |
| **Corrupted PDF** | Validate PDF structure on upload. Return 422 with "File appears to be corrupted. Please try a different file." |
| **Password-protected PDF** | Detect on upload. Return 422 with "This PDF is password-protected. Please provide an unprotected version." |
| **Duplicate upload** | Compare SHA-256 checksum against existing attachments. Warn: "This file appears to have been uploaded before (linked to expense from DD.MM.YYYY). Upload anyway?" |
| **Scanned PDF** (image-based, no text layer) | Detected automatically. Route through OCR pipeline (same as image). |
| **Handwritten receipts** | OCR will attempt extraction but confidence will be low. Fall back to manual entry with file attached. |

### 6.3 Data Edge Cases

| Scenario | Handling |
|---|---|
| **Non-EUR currency** | Extract and display currency. Show warning: "Non-EUR invoice. Please enter the EUR equivalent manually." |
| **Multiple VAT rates on one invoice** (e.g., 7% for books + 19% for supplies) | Extract the dominant rate. Show line items with individual rates. Suggest creating separate expense entries per VAT rate. |
| **Credit note (Gutschrift)** | Detect negative amounts or "Gutschrift" keyword. Alert user: "This appears to be a credit note. Create as negative expense?" |
| **Invoice in unusual format** (e.g., proforma, quote) | Detect keywords like "Angebot," "Proforma." Warn: "This may not be a final invoice." |
| **Very old date** (> 1 year ago) | Warn: "The invoice date is over a year ago. Is this correct?" |

---

## 7. Security Considerations

### 7.1 File Validation

| Check | Implementation |
|---|---|
| **MIME type validation** | Check both `Content-Type` header AND file magic bytes (not just extension) |
| **File extension whitelist** | `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic` only |
| **File size limit** | 10 MB max, enforced both client-side and server-side |
| **Filename sanitization** | Strip path traversal (`../`), special characters; generate UUID-based storage name |
| **PDF structure validation** | Parse PDF header to verify it's a valid PDF (not a renamed executable) |
| **Image validation** | Verify image can be decoded by `sharp` before storage |
| **Antivirus consideration** | For self-hosted single-user app, not required. Note: if multi-user in future, add ClamAV scan. |

### 7.2 Storage Security

| Concern | Mitigation |
|---|---|
| **Path traversal** | All file paths constructed server-side from UUID + date. User input never used in paths. |
| **File permissions** | Upload directory: `750` (owner rwx, group rx). Files: `640` (owner rw, group r). |
| **Access control** | Files served only through API endpoints, not directly via static file serving. Requires valid API authentication. |
| **Backup inclusion** | Upload directory must be included in existing backup routine. |

### 7.3 API Security

| Concern | Mitigation |
|---|---|
| **Rate limiting** | Max 10 uploads per minute (prevent abuse/accidental loops) |
| **Authentication** | All upload/attachment endpoints require existing JWT auth |
| **Request size** | Express body parser limit set to 12 MB (10 MB file + overhead) |
| **OCR API keys** | Stored encrypted using existing `credential_manager.py` at `~/clawd/config/azure-ocr.conf` |

### 7.4 Data Privacy

| Concern | Mitigation |
|---|---|
| **Invoices contain PII** | Data processed via Azure is covered by their DPA. Raw responses stored locally only. |
| **OCR text storage** | Raw text stored in DB for reprocessing capability. Can be purged after expense is confirmed. |
| **GDPR compliance** | All data stored locally on user's own server. Cloud processing can be disabled (Tesseract fallback). |

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Module | Tests | Coverage Target |
|---|---|---|
| **OCR Parser** | Parse Azure response → structured fields | 95% |
| | Handle missing/null fields gracefully | |
| | Confidence score thresholds | |
| | German number format parsing (1.234,56) | |
| | German date format parsing (15.07.2025) | |
| **File Validator** | MIME type detection (magic bytes) | 95% |
| | File size limits | |
| | Filename sanitization | |
| | PDF structure validation | |
| | Reject invalid/dangerous files | |
| **Amount Calculator** | Net + VAT = Gross validation | 100% |
| | Reverse-calculate net from gross | |
| | Handle rounding edge cases | |
| **Vendor Mapper** | Exact match lookup | 90% |
| | Fuzzy matching | |
| | Category suggestion | |

### 8.2 Integration Tests

| Flow | Tests |
|---|---|
| **Upload pipeline** | Upload PDF → stored on disk → attachment record created → OCR triggered → extraction saved |
| **Full expense creation** | Upload → extract → create expense with attachment link → verify all fields saved |
| **Receipt retrieval** | Upload file → create expense → GET receipt → verify file served correctly |
| **Error recovery** | OCR fails → attachment still saved → user can retry OCR or enter manually |
| **Backward compat** | Existing expenses with `receipt_path` still serve receipts via old endpoint |

### 8.3 Test Fixtures

Create a set of test invoices:

| Fixture | Description | Purpose |
|---|---|---|
| `test-invoice-de-standard.pdf` | Typical German invoice (Hetzner-style) | Happy path, all fields |
| `test-invoice-de-small-receipt.jpg` | Small paper receipt photo | Mobile capture, image OCR |
| `test-invoice-en-saas.pdf` | English SaaS invoice (e.g., GitHub) | English language support |
| `test-invoice-de-multiple-vat.pdf` | Invoice with 7% + 19% items | Multiple VAT rate handling |
| `test-invoice-de-credit-note.pdf` | Gutschrift | Credit note detection |
| `test-receipt-blurry.jpg` | Low-quality photo | OCR failure handling |
| `test-invoice-multipage.pdf` | 3-page invoice | Multi-page handling |
| `test-not-invoice.pdf` | Random document | Non-invoice detection |
| `test-corrupted.pdf` | Invalid PDF bytes | Error handling |

### 8.4 E2E Tests (Playwright)

| Test | Steps |
|---|---|
| **Desktop upload flow** | Navigate to expenses → click "Scan Invoice" → drop PDF → verify extraction → confirm → verify expense in list |
| **Mobile camera flow** | Open on mobile viewport → tap camera → mock file selection → verify responsive layout → save |
| **Manual correction** | Upload → extraction has wrong vendor → correct vendor → save → verify correction persisted |
| **Retry on failure** | Mock OCR failure → verify error UI → click retry → mock success → verify extraction |
| **View attached receipt** | Create expense with attachment → open expense → click receipt → verify PDF viewer opens |

### 8.5 Manual Testing Checklist

- [ ] Upload 10 real German invoices from different vendors
- [ ] Upload 5 English invoices (GitHub, AWS, Stripe, etc.)
- [ ] Photograph 5 paper receipts with phone camera
- [ ] Test with invoice PDFs > 5 MB
- [ ] Test with a scanned (image-based) PDF
- [ ] Test with an iPhone HEIC photo
- [ ] Verify all attachments survive server restart
- [ ] Verify backup includes upload directory
- [ ] Test offline fallback (disconnect Azure endpoint)

---

## 9. Implementation Phases

### Phase 1: File Upload & Storage (1–2 days)

**Goal:** Users can attach files to expenses; files are stored and retrievable.

**Tasks:**
- [ ] Create `attachments` table migration
- [ ] Implement `FileStorageService` (save, retrieve, delete, thumbnail generation)
- [ ] Add `POST /api/expenses/upload-invoice` endpoint (upload only, no OCR yet)
- [ ] Add `GET /api/attachments/:id/file` endpoint
- [ ] Add `GET /api/attachments/:id/thumbnail` endpoint
- [ ] Update `POST /api/expenses` to accept `attachment_id`
- [ ] Update `ExpenseForm.tsx`: replace text `receiptPath` input with file upload component
- [ ] Add file validation (MIME type, size, structure)
- [ ] Write unit tests for FileStorageService
- [ ] Write integration tests for upload endpoints

**Deliverable:** Users can upload files and attach them to expenses. No OCR yet — just storage and retrieval.

### Phase 2: OCR Integration (2–3 days)

**Goal:** Uploaded invoices are automatically processed to extract structured data.

**Tasks:**
- [ ] Set up Azure Form Recognizer account + API key
- [ ] Create `ocr_extractions` table migration
- [ ] Implement `OcrService` with Azure Form Recognizer integration
- [ ] Implement response parser (Azure response → typed extraction result)
- [ ] Add German number/date format handling
- [ ] Add confidence score processing
- [ ] Integrate OCR into upload endpoint (upload → process → return extraction)
- [ ] Implement Tesseract fallback for when Azure is unavailable
- [ ] Write unit tests for OCR parser
- [ ] Write integration tests for full upload→extract pipeline
- [ ] Test with fixture invoices

**Deliverable:** Upload returns extracted structured data alongside the stored file.

### Phase 3: Review UI & Auto-Population (2–3 days)

**Goal:** Users see extracted data, review it in a split-view, and save with one click.

**Tasks:**
- [ ] Build `InvoiceReviewPanel` component (document preview + extracted fields)
- [ ] Build `DocumentPreview` component (PDF viewer with pdf.js, image viewer with zoom)
- [ ] Integrate with `ExpenseForm`: pre-populate from extraction data
- [ ] Add confidence indicators (amber highlights, tooltips)
- [ ] Add amount validation display (net + VAT = gross check)
- [ ] Build mobile-responsive layout (stacked view)
- [ ] Add "Scan Invoice" entry point on ExpensesPage
- [ ] Wire up full flow: upload → review → confirm → save expense
- [ ] Write E2E tests (Playwright)

**Deliverable:** Complete working flow from upload to saved expense with attached receipt.

### Phase 4: Vendor Intelligence & Polish (1–2 days)

**Goal:** Smart vendor name normalization, category suggestions, and UX polish.

**Tasks:**
- [ ] Create `vendor_mappings` table migration
- [ ] Implement `VendorMappingService` (lookup, fuzzy match, learn from corrections)
- [ ] Add vendor mapping API endpoints
- [ ] Integrate vendor suggestions into review UI
- [ ] Add "Remember this vendor name?" prompt on corrections
- [ ] Add duplicate detection (checksum comparison)
- [ ] Add page navigation for multi-page PDFs
- [ ] Add loading/processing animations
- [ ] Handle credit notes (Gutschrift) detection
- [ ] Performance optimization (thumbnail generation, lazy loading)
- [ ] Update ExpenseList to show attachment badges

**Deliverable:** Polished feature with smart vendor handling and comprehensive edge case coverage.

### Phase 5: Tesseract Fallback & Offline Mode (1 day, optional)

**Goal:** Robust offline capability via local OCR.

**Tasks:**
- [ ] Install and configure Tesseract with German language pack (`deu`)
- [ ] Implement Tesseract processing pipeline
- [ ] Build text parser for Tesseract raw output (regex-based field extraction)
- [ ] Add setting to prefer local processing over cloud
- [ ] Add automatic fallback logic (Azure timeout → Tesseract)

**Deliverable:** App works fully offline for OCR, with reduced accuracy.

### Total Estimated Timeline: 7–11 days

---

## 10. Success Metrics

### Quantitative

| Metric | Target | Measurement |
|---|---|---|
| **Extraction accuracy** | ≥ 90% of fields correct without manual correction | Track corrections: `(auto-filled − modified) / auto-filled` |
| **Vendor accuracy** | ≥ 85% correct vendor name on first extraction | Compare extracted vs saved vendor |
| **Amount accuracy** | ≥ 95% correct gross amount | Compare extracted vs saved amounts |
| **VAT rate accuracy** | ≥ 90% correct VAT rate detection | Compare extracted vs saved VAT |
| **Processing time** | < 5 seconds (p95) from upload to extraction display | Log `processing_time_ms` in `ocr_extractions` |
| **Time savings** | < 30 seconds per expense (vs ~2 min manual) | User feedback / session timing |
| **Upload success rate** | ≥ 99% of valid files successfully stored | Track upload failures |
| **OCR success rate** | ≥ 95% of uploads return some extraction data | Track `status = 'completed'` vs `'failed'` in `ocr_extractions` |

### Qualitative

| Metric | Target |
|---|---|
| **User satisfaction** | "I actually enjoy doing my bookkeeping now" |
| **Trust in extraction** | User confidently saves without checking every field after first few uses |
| **Mobile usability** | Paper receipt → expense in < 60 seconds on phone |
| **Audit readiness** | Every expense has its source document attached and downloadable |

### Tracking Implementation

Add to the `ocr_extractions` table:
- `fields_modified TEXT` — JSON recording which fields the user changed after extraction
- `was_fully_automatic INTEGER` — 1 if user saved without any modifications

Query for accuracy metrics:
```sql
-- Overall field accuracy rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN was_fully_automatic = 1 THEN 1 ELSE 0 END) as no_corrections,
  ROUND(100.0 * SUM(CASE WHEN was_fully_automatic = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy_pct
FROM ocr_extractions
WHERE status = 'completed';

-- Most frequently corrected fields
SELECT
  json_each.value as field_name,
  COUNT(*) as correction_count
FROM ocr_extractions, json_each(fields_modified)
WHERE fields_modified IS NOT NULL
GROUP BY json_each.value
ORDER BY correction_count DESC;
```

---

## Appendix A: Azure Form Recognizer Setup

### Account Setup
1. Create Azure account (free tier available)
2. Create "Document Intelligence" resource (formerly Form Recognizer)
3. Use **prebuilt-invoice** model (no training needed)
4. Store API key in `~/clawd/config/azure-ocr.conf` (encrypted via credential_manager)

### API Integration
```typescript
// Minimal Azure Form Recognizer integration example
import DocumentIntelligence from "@azure-rest/ai-document-intelligence";

const client = DocumentIntelligence(endpoint, { key: apiKey });

const result = await client
  .path("/documentModels/prebuilt-invoice:analyze")
  .post({
    contentType: "application/octet-stream",
    body: fileBuffer,
  });
```

### Key Fields Returned by prebuilt-invoice
| Azure Field | Maps To | Notes |
|---|---|---|
| `VendorName` | `vendor` | |
| `InvoiceDate` | `date` | |
| `InvoiceId` | `invoice_number` | |
| `SubTotal` | `net_amount` | Pre-tax amount |
| `TotalTax` | `vat_amount` | |
| `InvoiceTotal` | `gross_amount` | |
| `Items[].Description` | Line item descriptions | |
| `Items[].Amount` | Line item amounts | |

---

## Appendix B: German Invoice Field Keywords

For Tesseract fallback parsing and supplementary extraction logic:

| Field | German Keywords | Regex Patterns |
|---|---|---|
| Invoice number | Rechnungsnummer, Rechnungs-Nr., Re.-Nr., Beleg-Nr. | `(?:Rechnungs?(?:nummer\|[\s-]*Nr\.?))\s*[:\s]*(\S+)` |
| Date | Rechnungsdatum, Datum, Belegdatum | `(\d{1,2}[./]\d{1,2}[./]\d{2,4})` |
| Net amount | Nettobetrag, Netto, Zwischensumme | `(?:Netto\|Zwischensumme).*?(\d{1,3}(?:\.\d{3})*,\d{2})` |
| VAT amount | MwSt, USt, Umsatzsteuer, Mehrwertsteuer | `(?:MwSt\|USt\|Mehrwertsteuer).*?(\d{1,3}(?:\.\d{3})*,\d{2})` |
| Gross amount | Brutto, Gesamtbetrag, Rechnungsbetrag, Endbetrag | `(?:Brutto\|Gesamt\|Endbetrag).*?(\d{1,3}(?:\.\d{3})*,\d{2})` |
| VAT rate | MwSt, USt | `(\d{1,2})\s*%` |
| IBAN | IBAN | `[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,2}` |

### German Number Format
- Thousands separator: `.` (period)
- Decimal separator: `,` (comma)
- Example: `1.234,56` = 1234.56

### German Date Formats
- `15.07.2025` (most common)
- `15. Juli 2025`
- `15/07/2025` (less common)

---

## Appendix C: Dependencies

### New npm packages (API)

| Package | Purpose | Size |
|---|---|---|
| `@azure-rest/ai-document-intelligence` | Azure Form Recognizer SDK | ~200KB |
| `multer` | File upload middleware for Express | ~50KB |
| `sharp` | Image processing (thumbnails, HEIC conversion, deskewing) | ~7MB (includes native bindings) |
| `pdf-parse` | PDF text extraction + validation | ~15KB |
| `file-type` | Detect file type from magic bytes | ~50KB |

### New npm packages (Frontend)

| Package | Purpose | Size |
|---|---|---|
| `react-pdf` (or `pdfjs-dist`) | PDF rendering in browser | ~300KB |
| `react-dropzone` | Drag-and-drop file upload | ~10KB |

### System dependencies (for Tesseract fallback)

```bash
sudo apt-get install tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng
```

---

## Appendix D: Future Enhancements (Out of Scope)

These are not part of the current PRD but worth noting for future consideration:

1. **Batch upload** — Upload multiple invoices at once, process in parallel, review sequentially
2. **Email integration** — Auto-import invoices from email attachments (many German SaaS services email invoices as PDF)
3. **Recurring invoice detection** — Detect when the same vendor sends a monthly invoice and auto-create recurring expenses
4. **Bank statement matching** — Cross-reference extracted invoice amounts with bank transactions
5. **Custom OCR training** — Fine-tune Azure model on user's specific vendor formats for higher accuracy
6. **Invoice approval workflow** — For multi-user scenarios (accountant reviews freelancer's uploads)
7. **Full-text search** — Search expenses by OCR raw text (find "server hosting" across all receipts)
8. **Auto-categorization ML** — Train a classifier on the user's historical category choices
