# Phase 0: Critical Bug Fixes — Summary

**Completed:** 2026-02-21
**Commits:** 8
**Tests:** 723 passing (23 test files), up from 710

---

## Changes Made

### 1. ✅ Pro-Rata-Temporis Depreciation (HIGH) — `6145974`
**Files:** `api/src/routes/assets.ts`, `api/src/routes/__tests__/assets-depreciation.test.ts`, `api/src/routes/__tests__/assets.test.ts`

- `generateDepreciationSchedule()` now prorates the first year based on purchase month
- Month of acquisition counts as full month (German tax law: `13 - startMonth` = months in first year)
- Assets not purchased in January get an extra year in their schedule
- Final year absorbs the complementary remaining months
- 8 new pro-rata-specific tests added, all existing tests updated

**Example:** Asset purchased October 1 with 3-year life → 4 rows: 3/12, 12/12, 12/12, 9/12

### 2. ✅ Backend/Frontend Category Unification (HIGH) — `9765f12`
**Files:** `api/src/constants/expense-categories.ts` (new), `api/src/routes/expenses.ts`, `app/src/features/accounting/types/index.ts`, `api/migrations/007-normalize-expense-categories.sql`

- Created `expense-categories.ts` as single source of truth
- 16 unified categories with correct EÜR line numbers and Vorsteuer eligibility
- Legacy category IDs auto-normalized on create: `office→office_supplies`, `communication→telecom`, `education→training`
- Migration 007 normalizes existing database records
- All categories now map to correct EÜR lines (line 34 for most, not line 27)

### 3. ✅ Vorsteuer Calculation Fix (HIGH) — `5fcecb6`
**Files:** `api/src/routes/reports.ts`, `api/src/routes/__tests__/vat.test.ts`

- Vorsteuer now respects category `vorsteuer` eligibility flag
- Insurance and bank_fees expenses (vorsteuer=false) no longer reduce Zahllast
- Respects `deductible_percent` (e.g., 70% deductible business meals → only 70% of VAT claimable)
- 5 new Vorsteuer eligibility tests added

### 4. ✅ EÜR Line 16 & 35 Display (MEDIUM) — `f011b5a`
**Files:** `app/src/features/accounting/components/Reports/EuerReportView.tsx`

- Added `ENTNAHME_VERKAUF` (line 16 — Veräußerungsgewinne) to LINE_LABELS
- Added `ANLAGENABGANG_VERLUST` (line 35 — Losses from asset disposals) to LINE_LABELS
- Both lines now visible in the EÜR report table

### 5. ✅ GWG Automation (MEDIUM) — `2453232`
**Files:** `api/src/routes/assets.ts`, `api/src/routes/__tests__/assets-depreciation.test.ts`

- Assets ≤€250 net: forced to 1-year Sofortabschreibung
- Assets ≤€800 net: flagged as GWG with `is_gwg` response flag
- Auto-creates expense entry for immediate write-off (category='depreciation', euer_line=30, is_gwg=1)
- Response includes `gwg_expense_id` for traceability
- 3 new GWG tests added

### 6. ✅ Declining Balance Cap (MEDIUM) — included in `6145974`
**Files:** `api/src/routes/assets.ts`

- Declining balance rate capped at 25% per German law (`Math.min(2/usefulLifeYears, 0.25)`)
- Auto-switches to linear depreciation when linear gives higher amount
- Schedule totals always equal depreciable amount

### 7. ✅ Homeoffice Opt-In (MEDIUM) — `b244670`
**Files:** `api/src/routes/reports.ts`, multiple test files

- Homeoffice-Pauschale (€1,260) now only added when `homeoffice_enabled` setting is `true`
- Default is OFF (conservative — don't claim what's not enabled)
- Still skipped when explicit Arbeitszimmer expenses exist (previous behavior)
- 15+ tests updated across 3 test files

### 8. ✅ Missing Asset DB Fields (MEDIUM) — `481cd3b`
**Files:** `api/migrations/008-asset-extended-fields.sql`, `api/src/routes/assets.ts`, `api/src/schemas/index.ts`, `api/src/test/setup.ts`

New database columns:
- `vendor` — asset vendor/supplier
- `vat_paid` — VAT amount paid (auto-calculated as 19% if not provided)
- `gross_price` — gross purchase price (auto-calculated)
- `inventory_number` — internal inventory tracking
- `location` — physical location of asset
- `bill_path` — path to attached invoice/receipt
- `euer_line` — EÜR line number (default 30)
- `euer_category` — EÜR category (default 'depreciation')
- `afa_start_date` — depreciation start date (defaults to purchase_date)

### 9. ✅ Minor Fixes (LOW) — `0828fef`
**Files:** `api/src/routes/assets.ts`, `api/src/constants/expense-categories.ts`, `app/src/features/accounting/utils/datev-mapping.ts`

- **AfA-Tabelle validation:** New `GET /api/assets/afa-tabelle` endpoint with standard useful life years per category. Validates category + useful_life combo and warns on deviation.
- **DATEV counter accounts:** `getCounterAccount()` now maps payment methods: `bank_transfer→1200`, `cash→1000`, `paypal→1360`, `credit_card→1361` (SKR03). Previously always used 1200 (Bank).
- **AFA_STANDARD_YEARS** constant with official German AfA-Tabelle values

---

## Database Migrations

| # | File | Description |
|---|------|-------------|
| 007 | `007-normalize-expense-categories.sql` | Normalize legacy category IDs, fix EÜR line numbers |
| 008 | `008-asset-extended-fields.sql` | Add 9 new columns to assets table, backfill defaults |

---

## Test Coverage

| Metric | Before | After |
|--------|--------|-------|
| Test files | 23 | 23 |
| Total tests | 710 | 723 |
| Passing | 710 | 723 |
| New tests added | — | 13+ |

---

## Remaining Items (Deferred to Later Phases)

- **Receipt management** (L3): Link attachments bidirectionally — requires broader schema changes
- **VAT forecast** (L4): Projected quarterly VAT on dashboard — best with banking data (Phase 2)
- **Frontend GWG UI**: Badge/toggle for GWG threshold display in AssetForm
- **Data migration execution**: Migrations 007/008 need to be run on production database
