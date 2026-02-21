# Phase 1 Frontend Gap Analysis

**Date:** 2026-02-22
**Analyst:** James (Subagent)
**Scope:** Phase 1 (Legal Compliance) — Frontend components vs backend implementation
**Status:** Phase 1 backend is **COMPLETE**; frontend is **~20% covered**

---

## Executive Summary

The Phase 1 backend is fully implemented with 863 tests passing across GoBD, E-Rechnung, ELSTER, and DATEV v2. However, the **frontend has almost no Phase 1-specific UI components**. Out of the 10 new components listed in the implementation plan, **0 have been built**. The existing DATEV export dialog is a pre-Phase 1 client-side implementation that hasn't been updated to use the new server-side API.

### Coverage Summary

| Feature Area | Backend | Frontend | Gap |
|:---|:---:|:---:|:---:|
| **GoBD Compliance** | ✅ 100% | ❌ 0% | 5 components missing |
| **E-Rechnung** | ✅ 100% | ❌ 0% | 4 components missing |
| **ELSTER** | ✅ 100% | ❌ 0% | 3 components missing |
| **DATEV v2** | ✅ 100% | ⚠️ 40% | Needs server-side migration |
| **Overall** | ✅ 100% | ❌ ~10% | **~14 components / enhancements needed** |

**Estimated total effort:** 55–75 hours (7–10 working days)

---

## Detailed Gap Analysis

### 1. GoBD Compliance UI

#### 1.1 AuditLog Component ❌ MISSING
**Priority:** HIGH
**Effort:** 6–8 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `GET /api/audit/:entityType/:entityId` — returns full change history |
| Backend API | ✅ `GET /api/audit/search` — search with filters |
| Frontend component | ❌ No `AuditLog.tsx` exists |
| Frontend API client | ❌ No audit API calls in `app/src/lib/api.ts` or `app/src/features/accounting/api/` |
| Frontend hook | ❌ No `useAuditLog` hook |

**What needs to be built:**
- `AuditLog.tsx` — Change history viewer (table with entity_type, action, field, old→new values, timestamp, user)
- Should be embeddable in detail views for income, expenses, invoices, assets
- Filter by date range, action type
- Could be a shared component used across all record detail views
- Frontend API client functions for audit endpoints
- `useAuditLog(entityType, entityId)` hook

**Design notes:**
- Timeline/accordion view showing changes chronologically
- Color-coded actions: green=create, yellow=update, red=delete, blue=lock
- Expandable rows showing old→new value diffs

---

#### 1.2 PeriodLockManager Component ❌ MISSING
**Priority:** CRITICAL
**Effort:** 8–10 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `POST /api/audit/periods/:key/lock` — lock a period |
| Backend API | ✅ `DELETE /api/audit/periods/:key/lock` — unlock a period |
| Backend API | ✅ `GET /api/audit/periods` — list all periods with lock status |
| Backend middleware | ✅ Write operations check period locks before allowing changes |
| Frontend component | ❌ No `PeriodLockManager.tsx` exists |
| Frontend API client | ❌ No period lock API calls |

**What needs to be built:**
- `PeriodLockManager.tsx` — Full period management UI
  - Grid/calendar view showing months, quarters, years
  - Lock/unlock buttons with confirmation dialog
  - Reason field when locking (e.g., "USt-VA filed")
  - Color-coded: green=open, red=locked, gray=future
- Integration into ReportsPage as a new tab or section
- Frontend API client functions
- `usePeriodLocks()` hook

**Design notes:**
- Visual grid: months in rows, quarters highlighted
- Lock icon with tooltip showing who locked and when
- Unlock requires explicit confirmation ("This will allow modification of financial records in this period")

---

#### 1.3 Lock Status Indicators ❌ MISSING
**Priority:** HIGH
**Effort:** 4–5 hours

| Aspect | Status |
|:---|:---|
| Backend enforcement | ✅ All write operations check period locks |
| Frontend indicators in forms/lists | ❌ No lock indicators anywhere |

**What needs to be built:**
- Lock icon/badge in `IncomeList.tsx`, `ExpenseList.tsx`, `InvoiceList.tsx`
- Disabled edit/delete buttons for records in locked periods
- Warning banner when viewing a record in a locked period
- Toast notification when a save attempt is blocked by period lock
- Utility function: `isRecordLocked(date: string)` using cached period lock data

**Components to modify:**
- `IncomeList.tsx` — Add lock column/icon
- `ExpenseList.tsx` — Add lock column/icon
- `InvoiceList.tsx` — Add lock column/icon
- `IncomeForm.tsx` / `ExpenseForm.tsx` / `InvoiceForm.tsx` — Disable when locked
- `AssetForm.tsx` — Disable when locked

---

#### 1.4 VerfahrensdokuViewer Component ❌ MISSING
**Priority:** MEDIUM
**Effort:** 3–4 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `GET /api/audit/documentation` — returns full Verfahrensdokumentation JSON |
| Frontend component | ❌ No viewer exists |

**What needs to be built:**
- `VerfahrensdokuViewer.tsx` — Read-only document renderer
  - Renders hierarchical sections from the JSON structure
  - Print-friendly layout
  - PDF export button
- Accessible from Settings or Reports page
- `useVerfahrensdokumentation()` hook

**Design notes:**
- Clean, document-style layout (similar to InvoicePreview)
- Table of contents sidebar
- Collapsible sections
- Print button using `window.print()` with print CSS

---

### 2. E-Rechnung UI

#### 2.1 E-Rechnung Export Buttons in InvoicePreview ❌ MISSING
**Priority:** CRITICAL
**Effort:** 5–6 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `POST /api/invoices/:id/einvoice` — generate ZUGFeRD/X-Rechnung XML |
| Backend API | ✅ `GET /api/invoices/:id/einvoice` — download as ZUGFeRD/X-Rechnung |
| Backend API | ✅ `GET /api/invoices/:id/einvoice/validate` — validate against EN 16931 |
| Frontend buttons | ❌ InvoicePreview only has Print + PDF download |
| Frontend API client | ❌ No einvoice API calls in frontend |

**Current InvoicePreview action bar:**
```tsx
<Button>Drucken</Button>
<Button>PDF herunterladen</Button>
```

**What needs to be built:**
- Add "E-Rechnung" dropdown button to InvoicePreview action bar:
  - "ZUGFeRD herunterladen" — downloads ZUGFeRD PDF+XML
  - "X-Rechnung herunterladen" — downloads X-Rechnung XML
  - "EN 16931 validieren" — runs validation, shows result
- `api.downloadEInvoice(invoiceId, format)` frontend API call
- `api.validateEInvoice(invoiceId, format)` frontend API call
- Validation result popover/dialog showing pass/fail with details

**Components to modify:**
- `InvoicePreview.tsx` — Add E-Rechnung buttons to action bar

---

#### 2.2 E-Rechnung Format Selector in InvoiceForm ❌ MISSING
**Priority:** HIGH
**Effort:** 3–4 hours

| Aspect | Status |
|:---|:---|
| Backend DB | ✅ `einvoice_format` column exists on invoices table |
| Backend DB | ✅ `leitweg_id` column exists on invoices table |
| Backend DB | ✅ `buyer_reference` column exists on invoices table |
| Frontend form field | ❌ InvoiceForm has no E-Rechnung fields |

**What needs to be built:**
- Add to `InvoiceForm.tsx`:
  - E-Rechnung format selector: None / ZUGFeRD / X-Rechnung
  - Conditional "Leitweg-ID" field (shown when X-Rechnung selected)
  - Conditional "Buyer Reference" field
- Update `NewInvoice` type to include `einvoice_format`, `leitweg_id`, `buyer_reference`

**Design notes:**
- Section header "E-Rechnung (optional)"
- Radio buttons or select for format
- Info tooltip: "ZUGFeRD = PDF + embedded XML, X-Rechnung = Pure XML (for public sector)"

---

#### 2.3 EN 16931 Validation UI ❌ MISSING
**Priority:** MEDIUM
**Effort:** 3–4 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `GET /api/invoices/:id/einvoice/validate` with 15+ business rules |
| Frontend display | ❌ No validation result UI |

**What needs to be built:**
- Validation result component (can be a dialog or inline panel)
- Shows: pass/fail status, list of rule violations with severity
- Used by the InvoicePreview E-Rechnung export flow
- Pre-validates before download; blocks download if critical errors

---

#### 2.4 EInvoiceXmlViewer Component ❌ MISSING (LOW priority)
**Priority:** LOW
**Effort:** 4–5 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ Generates complete XML |
| Frontend viewer | ❌ No XML viewer |

**What needs to be built:**
- `EInvoiceXmlViewer.tsx` — Syntax-highlighted XML viewer
- Could use a lightweight code viewer (Prism.js or similar)
- Toggle between raw XML and "human-readable" parsed view
- Useful for debugging and verification

---

### 3. ELSTER UI

#### 3.1 ELSTER Export Button for USt-VA ❌ MISSING
**Priority:** CRITICAL
**Effort:** 6–8 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `POST /api/tax/elster/ust-va` — calculates and generates XML |
| Backend API | ✅ Supports test mode and production mode |
| Backend API | ✅ Creates submission records with status tracking |
| Frontend button | ❌ UstVoranmeldungList only has "Drucken" and "Als gemeldet markieren" |
| Frontend submission tracking | ❌ No submission history |

**Current UstVoranmeldungList buttons:**
```tsx
<Button>Drucken</Button>
<Button>Als gemeldet markieren</Button>  // Only marks status, no actual ELSTER export
```

**What needs to be built:**
- Add "ELSTER Export" button to UstVoranmeldungList
- `ElsterSubmissionWizard.tsx` — Multi-step wizard:
  1. **Review:** Show Kennzahlen (Kz81, Kz86, Kz66, Kz83) with explanations
  2. **Validate:** Run pre-submission validation, show warnings/errors
  3. **Generate XML:** Download ELSTER-compatible XML file
  4. **Confirm:** Mark as submitted with transfer ticket (manual entry for now)
- Frontend API calls: `api.generateUstVaElster(year, quarter)`
- Update the "Als gemeldet markieren" flow to integrate with ELSTER submission

**Components to modify/create:**
- `UstVoranmeldungList.tsx` — Add ELSTER button
- New `ElsterSubmissionWizard.tsx`
- New `ElsterHistoryList.tsx` — Past submissions with statuses

---

#### 3.2 ZM Export UI ❌ MISSING
**Priority:** HIGH
**Effort:** 5–6 hours

| Aspect | Status |
|:---|:---|
| Backend API | ✅ `POST /api/tax/elster/zm` — calculates ZM and generates XML |
| Backend data | ✅ Aggregates EU B2B transactions by VAT ID |
| Frontend component | ❌ No ZM UI anywhere |
| ReportsPage tab | ❌ No ZM tab in Reports |

**What needs to be built:**
- `ZmReportView.tsx` — Zusammenfassende Meldung viewer
  - Show EU client VAT IDs with quarterly totals
  - ELSTER XML generation button
  - Validation display
- Add "ZM" tab to ReportsPage
- Frontend API: `api.generateZm(year, quarter)`

---

#### 3.3 ELSTER Submission History ❌ MISSING
**Priority:** MEDIUM
**Effort:** 4–5 hours

| Aspect | Status |
|:---|:---|
| Backend DB | ✅ `elster_submissions` table with status tracking |
| Backend API | ✅ `GET /api/tax/elster/submissions` — list past submissions |
| Frontend component | ❌ No submission history viewer |

**What needs to be built:**
- `ElsterHistoryList.tsx` — List of all past ELSTER submissions
  - Columns: Type, Period, Status, Submitted At, Transfer Ticket
  - Status badges: draft/validated/submitted/accepted/rejected
  - Download XML button per submission
- Accessible from ReportsPage or as sub-view of USt-VA/ZM

---

### 4. DATEV Export

#### 4.1 DatevExportDialog — Server-Side Migration ⚠️ PARTIAL
**Priority:** HIGH
**Effort:** 4–5 hours

| Aspect | Status |
|:---|:---|
| Backend API (v2) | ✅ `POST /api/exports/datev/generate` — server-side CSV/XML |
| Backend API (v2) | ✅ `GET /api/exports/datev/preview` — preview |
| Frontend dialog | ⚠️ Exists (`DatevExportDialog.tsx`) but uses **client-side** generation |
| Frontend utils | ⚠️ `datev-csv.ts`, `datev-xml.ts`, `datev-mapping.ts` — all client-side |
| Frontend settings | ✅ `DatevSettings.tsx` exists with all config options |

**Current state:** The `DatevExportDialog.tsx` generates DATEV CSV/XML entirely in the browser using `datev-csv.ts` and `datev-xml.ts`. The new server-side `datevExportService.ts` with proper SKR03/SKR04 mappings and counter accounts is not used.

**What needs to be done:**
- Modify `DatevExportDialog.tsx` to call server-side API instead of client-side generation
- Replace `generateDatevCsv()` / `generateDatevXml()` calls with `api.generateDatevExport(options)`
- Keep `DatevSettings.tsx` as-is (config options are compatible)
- Server-side export handles encoding, counter accounts, and proper account mappings
- Add validation display from server response
- Can optionally keep client-side as fallback for offline/Tauri mode

---

## Summary: Components Needed

### New Components (10)

| # | Component | Priority | Effort | Location |
|:---|:---|:---:|:---:|:---|
| 1 | `AuditLog.tsx` | HIGH | 6–8h | `components/GoBD/` |
| 2 | `PeriodLockManager.tsx` | CRITICAL | 8–10h | `components/GoBD/` |
| 3 | `VerfahrensdokuViewer.tsx` | MEDIUM | 3–4h | `components/GoBD/` |
| 4 | `EInvoiceFormatToggle.tsx` | HIGH | 3–4h | `components/Invoices/` |
| 5 | `EInvoiceValidationResult.tsx` | MEDIUM | 3–4h | `components/Invoices/` |
| 6 | `EInvoiceXmlViewer.tsx` | LOW | 4–5h | `components/Invoices/` |
| 7 | `ElsterSubmissionWizard.tsx` | CRITICAL | 6–8h | `components/Reports/` |
| 8 | `ZmReportView.tsx` | HIGH | 5–6h | `components/Reports/` |
| 9 | `ElsterHistoryList.tsx` | MEDIUM | 4–5h | `components/Reports/` |
| 10 | `usePeriodLocks.ts` (hook) | HIGH | 2h | `hooks/` |

### Existing Components to Modify (7)

| # | Component | Change | Priority | Effort |
|:---|:---|:---|:---:|:---:|
| 1 | `InvoicePreview.tsx` | Add E-Rechnung export buttons | CRITICAL | 3–4h |
| 2 | `InvoiceForm.tsx` | Add E-Rechnung format selector fields | HIGH | 2–3h |
| 3 | `UstVoranmeldungList.tsx` | Add ELSTER export button | CRITICAL | 2–3h |
| 4 | `DatevExportDialog.tsx` | Migrate to server-side API | HIGH | 4–5h |
| 5 | `IncomeList.tsx` / `ExpenseList.tsx` / `InvoiceList.tsx` | Lock status indicators | HIGH | 4–5h |
| 6 | `ReportsPage.tsx` | Add ZM tab, ELSTER history tab | HIGH | 2h |
| 7 | `app/src/lib/api.ts` | Add all Phase 1 API client functions | HIGH | 3–4h |

### Supporting Work

| # | Item | Effort |
|:---|:---|:---:|
| 1 | Frontend API client (`api.ts`) — audit, period lock, einvoice, elster, datev v2 | 3–4h |
| 2 | Custom hooks — `useAuditLog`, `usePeriodLocks`, `useElsterSubmissions` | 3–4h |
| 3 | TypeScript types — audit entries, period locks, elster submissions, e-invoice validation | 2h |

---

## Recommended Implementation Order

### Sprint 1: Critical Path (3–4 days, ~24h)
> Focus: Enable legally-required workflows users currently can't access

1. **Frontend API client** — Add all Phase 1 API calls to `api.ts` (3–4h)
2. **InvoicePreview E-Rechnung buttons** — Users need to export e-invoices (3–4h)
3. **UstVoranmeldung ELSTER export** — ELSTER XML generation + download (6–8h)
4. **PeriodLockManager** — Lock periods after filing (8–10h)

### Sprint 2: High Priority (2–3 days, ~18h)
> Focus: Complete the essential UIs

5. **Lock status indicators** — Show lock state in lists/forms (4–5h)
6. **InvoiceForm E-Rechnung fields** — Format selector + Leitweg-ID (2–3h)
7. **ZM Report view** — EU B2B reporting UI (5–6h)
8. **DatevExportDialog server-side migration** — Use new backend API (4–5h)

### Sprint 3: Medium Priority (2 days, ~14h)
> Focus: Audit trail visibility and history

9. **AuditLog component** — Change history viewer (6–8h)
10. **ElsterHistoryList** — Past submission tracking (4–5h)
11. **ReportsPage updates** — New tabs for ZM, ELSTER history (2h)

### Sprint 4: Polish (1 day, ~8h)
> Focus: Nice-to-haves

12. **VerfahrensdokuViewer** — GoBD process documentation display (3–4h)
13. **EInvoiceValidationResult** — Validation result display (3–4h)
14. **EInvoiceXmlViewer** — XML content viewer (4–5h, can defer)

---

## Total Effort Estimate

| Sprint | Focus | Hours | Days |
|:---|:---|:---:|:---:|
| Sprint 1 | Critical path | 20–26h | 3–4 |
| Sprint 2 | High priority | 15–19h | 2–3 |
| Sprint 3 | Medium priority | 12–15h | 2 |
| Sprint 4 | Polish | 7–9h | 1 |
| **Total** | | **54–69h** | **8–10** |

---

## Technical Notes

### Backend API Endpoints Available (not yet consumed by frontend)

```
# GoBD / Audit
GET    /api/audit/:entityType/:entityId    — Audit trail for a record
GET    /api/audit/search                   — Search audit log
GET    /api/audit/periods                  — List period locks
POST   /api/audit/periods/:key/lock        — Lock a period
DELETE /api/audit/periods/:key/lock        — Unlock a period
GET    /api/audit/documentation            — Verfahrensdokumentation

# E-Rechnung
POST   /api/invoices/:id/einvoice          — Generate E-Rechnung XML
GET    /api/invoices/:id/einvoice          — Download E-Rechnung
GET    /api/invoices/:id/einvoice/validate — Validate EN 16931
POST   /api/invoices/parse-einvoice        — Parse incoming E-Rechnung

# ELSTER
POST   /api/tax/elster/ust-va             — Generate USt-VA XML
POST   /api/tax/elster/zm                 — Generate ZM XML
GET    /api/tax/elster/submissions         — List submissions

# DATEV v2 (Server-Side)
GET    /api/exports/datev/preview          — Preview export
POST   /api/exports/datev/generate         — Generate DATEV file
```

### Frontend Architecture Patterns to Follow
- Use existing `useXxx` hook pattern (see `useUstVoranmeldung.ts`, `useDatevExport.ts`)
- Follow existing component structure: component + test + index export
- Use shadcn/ui components (Button, Dialog, Table, Badge, Tabs, Select)
- German labels for all user-facing text
- Error handling via `getErrorMessage()` utility

---

## Risk Assessment

| Risk | Impact | Mitigation |
|:---|:---|:---|
| Users cannot generate legally-required E-Rechnungen | HIGH — Legal non-compliance | Sprint 1 priority |
| No ELSTER export means manual XML workflow | MEDIUM — Inconvenient but data exists | Sprint 1 priority |
| No period locking means records can be modified after filing | HIGH — GoBD violation | Sprint 1 priority |
| DATEV export uses outdated client-side generation | LOW — Still functional, just missing v2 features | Sprint 2 |
| No audit log viewer means users can't verify GoBD trail | MEDIUM — Trail exists but invisible | Sprint 3 |
