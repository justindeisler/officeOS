# Accounting Feature - Technical Specification

> **Status**: Phase 8 Complete (Asset Integration & EÜR Enhancement)
> **Target**: German Einzelunternehmen (Freelancer)
> **Compliance**: EÜR (Einnahmen-Überschuss-Rechnung)
> **Last Updated**: 2026-01-10
> **Test Coverage**: 95%+ (506 tests across 22 test files)

## Overview

A complete accounting system for German freelancers, featuring:

- Income & expense tracking with VAT (Umsatzsteuer/Vorsteuer)
- Invoice generation and payment tracking
- Asset management with depreciation (AfA)
- Quarterly VAT reports (USt-Voranmeldung)
- Annual profit calculation (EÜR)
- Interactive React dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Dashboard                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Income   │ │ Expenses │ │ Invoices │ │ Assets   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────────────────┐ ┌─────────────────────────┐       │
│  │ Dashboard / Reports  │ │ USt / EÜR Reports       │       │
│  └──────────────────────┘ └─────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Drizzle ORM                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│  • clients        • income         • expenses               │
│  • invoices       • invoice_items  • assets                 │
│  • depreciation_schedule           • settings               │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Database** | SQLite + Drizzle ORM | Local, self-contained, type-safe queries |
| **Frontend** | React + TypeScript | Interactive dashboard |
| **Styling** | Tailwind CSS | Following design-system.md |
| **Testing** | Vitest + Testing Library | TDD workflow (95%+ coverage) |
| **Animation** | Framer Motion | Consistent with app conventions |

---

## Implementation Status

### Test Summary

| Module | Tests | Coverage |
|--------|-------|----------|
| **Income** | 33 tests | 98%+ |
| **Expenses** | 37 tests | 98%+ |
| **Invoices** | 80 tests | 90%+ |
| **Assets** | 60 tests | 99%+ |
| **Dashboard** | 48 tests | 87%+ |
| **Reports** | 104 tests | 95%+ |
| **API (reports.ts)** | 18 tests | 98%+ |
| **Other** | 126 tests | 90%+ |
| **Total** | **506 tests** | **95%+** |

---

## Implementation Phases

### Phase 1: Database & Types ✅ COMPLETE

**Goal**: Set up SQLite, Drizzle ORM, and TypeScript types

**Deliverables**:
- [x] `app/src/features/accounting/api/db.ts`
- [x] `app/src/features/accounting/api/schema.ts`
- [x] `app/src/features/accounting/types/index.ts`
- [x] `app/src/test/mocks/data/accounting/income.ts`
- [x] `app/src/test/mocks/data/accounting/expenses.ts`
- [x] `app/src/test/mocks/data/accounting/invoices.ts`
- [x] `app/src/test/mocks/data/accounting/clients.ts`
- [x] `app/src/test/mocks/data/accounting/assets.ts`

---

### Phase 2: Income Management (TDD) ✅ COMPLETE

**Goal**: Full CRUD for income records

**Features**:
- Table with sorting/filtering by date, client, amount
- Form with automatic VAT calculation
- EÜR category selection dropdown
- Payment status tracking

**Test Results**: 33 tests passing (15 IncomeList + 18 IncomeForm)

**Deliverables**:
- [x] `components/Income/IncomeList.test.tsx` (15 tests)
- [x] `components/Income/IncomeList.tsx`
- [x] `components/Income/IncomeForm.test.tsx` (18 tests)
- [x] `components/Income/IncomeForm.tsx`
- [x] `components/Income/index.ts` (exports)
- [x] `hooks/useIncome.ts`
- [x] `api/income.ts`

---

### Phase 3: Expense Management (TDD) ✅ COMPLETE

**Goal**: Full CRUD for expenses with Vorsteuer tracking

**Features**:
- All Phase 2 features, plus:
- Recurring expense handling (monthly subscriptions)
- GWG detection (€250-800 auto-flag)
- Asset linking for purchases >€800
- Expense category filtering
- Deductibility percentage tracking

**Test Results**: 37 tests passing (19 ExpenseList + 18 ExpenseForm)

**Deliverables**:
- [x] `components/Expenses/ExpenseList.test.tsx` (19 tests)
- [x] `components/Expenses/ExpenseList.tsx`
- [x] `components/Expenses/ExpenseForm.test.tsx` (18 tests)
- [x] `components/Expenses/ExpenseForm.tsx`
- [x] `components/Expenses/index.ts`
- [x] `hooks/useExpenses.ts`
- [x] `api/expenses.ts`

---

### Phase 4: Invoice Generation (TDD) ✅ COMPLETE

**Goal**: Create and track invoices

**Features**:
- Invoice list with status badges (draft, sent, paid, overdue)
- Invoice form with dynamic line items
- Invoice preview (printable, PDF-ready layout)
- Auto-numbering (RE-YYYY-XXX format)
- Link to income record when marked as paid
- Client management integration

**Test Results**: 80 tests passing (24 InvoiceList + 27 InvoiceForm + 29 InvoicePreview)

**Deliverables**:
- [x] `components/Invoices/InvoiceList.test.tsx` (24 tests)
- [x] `components/Invoices/InvoiceList.tsx`
- [x] `components/Invoices/InvoiceForm.test.tsx` (27 tests)
- [x] `components/Invoices/InvoiceForm.tsx`
- [x] `components/Invoices/InvoicePreview.test.tsx` (29 tests)
- [x] `components/Invoices/InvoicePreview.tsx`
- [x] `components/Invoices/index.ts`
- [x] `hooks/useInvoices.ts`
- [x] `api/invoices.ts`

---

### Phase 5: Dashboard (TDD) ✅ COMPLETE

**Goal**: Overview with key metrics and charts

**Components**:
1. **AccountingDashboard** - Main dashboard container with navigation
2. **MonthlyReport** - Monthly income/expense breakdown with charts
3. **QuickStats** - YTD profit, estimated quarterly tax
4. **RecentTransactions** - Last income/expense entries

**Test Results**: 54 tests passing (25 AccountingDashboard + 29 MonthlyReport)

**Deliverables**:
- [x] `components/Dashboard/AccountingDashboard.test.tsx` (25 tests)
- [x] `components/Dashboard/AccountingDashboard.tsx`
- [x] `components/Dashboard/MonthlyReport.test.tsx` (29 tests)
- [x] `components/Dashboard/MonthlyReport.tsx`
- [x] `components/Dashboard/index.ts`
- [x] `hooks/useAccountingStats.ts`

---

### Phase 6: Tax Reports (TDD) ✅ COMPLETE

**Goal**: Generate USt-Voranmeldung and EÜR data

#### USt-Voranmeldung (Quarterly)
- Sum Umsatzsteuer from income by quarter
- Sum Vorsteuer from expenses by quarter
- Calculate Zahllast (USt - Vorsteuer)
- Mark transactions as reported
- Export-ready format

#### EÜR Report (Annual)
- Aggregate all transactions by EÜR line number
- Include AfA sums from depreciation schedules
- Include Homeoffice-Pauschale (€1,260/year)
- Calculate Gewinn (Einnahmen - Ausgaben)

**Test Results**: 72 tests passing (17 EuerExport + 17 EuerReportView + 17 VoranmeldungList + 21 VoranmeldungPreview)

**Deliverables**:
- [x] `components/Reports/EuerExport.test.tsx` (17 tests)
- [x] `components/Reports/EuerExport.tsx`
- [x] `components/Reports/EuerReportView.test.tsx` (17 tests)
- [x] `components/Reports/EuerReportView.tsx`
- [x] `components/Reports/UstVoranmeldungList.test.tsx` (17 tests)
- [x] `components/Reports/UstVoranmeldungList.tsx`
- [x] `components/Reports/UstVoranmeldungPreview.test.tsx` (21 tests)
- [x] `components/Reports/UstVoranmeldungPreview.tsx`
- [x] `components/Reports/index.ts`
- [x] `hooks/useEuerReport.ts`
- [x] `hooks/useUstVoranmeldung.ts`
- [x] `api/reports.ts`

---

### Phase 7: Asset Management & AfA (TDD) ✅ COMPLETE

**Goal**: Track assets with automatic depreciation calculation

**Features**:
- Asset register with current book values
- Automatic AfA calculation (linear method)
- Depreciation schedule per asset
- AfA-Tabelle reference (computers: 3 years, furniture: 13 years, etc.)
- Pro-rata first/last year handling
- GWG detection (€250/€800/€1000 thresholds)
- Asset disposal tracking (disposed/sold status)
- Category-based depreciation years

**Asset Categories & AfA Years**:
| Category | AfA Years |
|----------|-----------|
| Computer | 3 years |
| Phone | 5 years |
| Furniture | 13 years |
| Equipment | 5 years |
| Software | 3 years |

**Test Results**: 89 tests passing (23 AssetList + 26 AssetForm + 26 AssetDetail + 14 DepreciationTable)

**Deliverables**:
- [x] `components/Assets/AssetList.test.tsx` (23 tests)
- [x] `components/Assets/AssetList.tsx`
- [x] `components/Assets/AssetForm.test.tsx` (26 tests)
- [x] `components/Assets/AssetForm.tsx`
- [x] `components/Assets/AssetDetail.test.tsx` (26 tests)
- [x] `components/Assets/AssetDetail.tsx`
- [x] `components/Assets/DepreciationTable.test.tsx` (14 tests)
- [x] `components/Assets/DepreciationTable.tsx`
- [x] `components/Assets/index.ts`
- [x] `hooks/useAssets.ts`
- [x] `api/assets.ts` (with depreciation schedule calculation)

---

## Project Structure (Current)

```
app/src/
├── features/
│   └── accounting/
│       ├── components/
│       │   ├── Dashboard/
│       │   │   ├── AccountingDashboard.tsx
│       │   │   ├── AccountingDashboard.test.tsx
│       │   │   ├── MonthlyReport.tsx
│       │   │   ├── MonthlyReport.test.tsx
│       │   │   └── index.ts
│       │   ├── Income/
│       │   │   ├── IncomeList.tsx
│       │   │   ├── IncomeList.test.tsx
│       │   │   ├── IncomeForm.tsx
│       │   │   ├── IncomeForm.test.tsx
│       │   │   └── index.ts
│       │   ├── Expenses/
│       │   │   ├── ExpenseList.tsx
│       │   │   ├── ExpenseList.test.tsx
│       │   │   ├── ExpenseForm.tsx
│       │   │   ├── ExpenseForm.test.tsx
│       │   │   └── index.ts
│       │   ├── Invoices/
│       │   │   ├── InvoiceList.tsx
│       │   │   ├── InvoiceList.test.tsx
│       │   │   ├── InvoiceForm.tsx
│       │   │   ├── InvoiceForm.test.tsx
│       │   │   ├── InvoicePreview.tsx
│       │   │   ├── InvoicePreview.test.tsx
│       │   │   └── index.ts
│       │   ├── Assets/
│       │   │   ├── AssetList.tsx
│       │   │   ├── AssetList.test.tsx
│       │   │   ├── AssetForm.tsx
│       │   │   ├── AssetForm.test.tsx
│       │   │   ├── AssetDetail.tsx
│       │   │   ├── AssetDetail.test.tsx
│       │   │   ├── DepreciationTable.tsx
│       │   │   ├── DepreciationTable.test.tsx
│       │   │   └── index.ts
│       │   └── Reports/
│       │       ├── EuerExport.tsx
│       │       ├── EuerExport.test.tsx
│       │       ├── EuerReportView.tsx
│       │       ├── EuerReportView.test.tsx
│       │       ├── UstVoranmeldungList.tsx
│       │       ├── UstVoranmeldungList.test.tsx
│       │       ├── UstVoranmeldungPreview.tsx
│       │       ├── UstVoranmeldungPreview.test.tsx
│       │       ├── Anlageverzeichnis.tsx        # Phase 8: Asset register
│       │       ├── AfaSummary.tsx               # Phase 8: Annual AfA summary
│       │       └── index.ts
│       ├── hooks/
│       │   ├── useIncome.ts
│       │   ├── useExpenses.ts
│       │   ├── useInvoices.ts
│       │   ├── useAssets.ts
│       │   ├── useAccountingStats.ts
│       │   ├── useEuerReport.ts
│       │   └── useUstVoranmeldung.ts
│       ├── api/
│       │   ├── db.ts
│       │   ├── schema.ts
│       │   ├── income.ts
│       │   ├── expenses.ts
│       │   ├── invoices.ts
│       │   ├── assets.ts
│       │   ├── reports.ts
│       │   └── reports.test.ts              # Phase 8: 33 asset integration tests
│       └── types/
│           └── index.ts
│
├── test/
│   ├── mocks/
│   │   └── data/
│   │       └── accounting/
│   │           ├── income.ts
│   │           ├── expenses.ts
│   │           ├── invoices.ts
│   │           ├── clients.ts
│   │           └── assets.ts
│   └── utils/
│       ├── render.tsx
│       └── test-utils.ts
```

---

## Database Schema

### Entity Relationship

```
clients ─────────┐
                 │
invoices ◄───────┼──── invoice_items
    │            │
    ▼            │
income ◄─────────┘

expenses ────────┬──── assets ──── depreciation_schedule
                 │
euer_categories ─┘
```

### Tables

#### clients
```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  vat_id TEXT,                    -- USt-IdNr
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### income
```sql
CREATE TABLE income (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,             -- Zufluss-Datum (cash basis)
  client_id TEXT REFERENCES clients(id),
  invoice_id TEXT REFERENCES invoices(id),
  description TEXT NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  vat_rate INTEGER DEFAULT 19,    -- 0, 7, or 19
  vat_amount DECIMAL(10,2) NOT NULL,
  gross_amount DECIMAL(10,2) NOT NULL,
  euer_line INTEGER DEFAULT 14,
  euer_category TEXT DEFAULT 'services',
  payment_method TEXT,
  bank_reference TEXT,
  ust_period TEXT,                -- e.g., "2024-Q1"
  ust_reported BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### expenses
```sql
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,             -- Abfluss-Datum (cash basis)
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  vat_rate INTEGER DEFAULT 19,
  vat_amount DECIMAL(10,2) NOT NULL,  -- Vorsteuer
  gross_amount DECIMAL(10,2) NOT NULL,
  euer_line INTEGER NOT NULL,
  euer_category TEXT NOT NULL,
  deductible_percent INTEGER DEFAULT 100,
  payment_method TEXT,
  receipt_path TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT,       -- monthly, quarterly, yearly
  ust_period TEXT,
  vorsteuer_claimed BOOLEAN DEFAULT FALSE,
  is_gwg BOOLEAN DEFAULT FALSE,
  asset_id TEXT REFERENCES assets(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### invoices
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,  -- RE-2024-001
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',    -- draft, sent, paid, overdue, cancelled
  client_id TEXT REFERENCES clients(id),
  subtotal DECIMAL(10,2) NOT NULL,
  vat_rate INTEGER DEFAULT 19,
  vat_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### invoice_items
```sql
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT DEFAULT 'hours',
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
```

#### assets
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  purchase_date DATE NOT NULL,
  vendor TEXT,
  purchase_price DECIMAL(10,2) NOT NULL,  -- Netto
  vat_paid DECIMAL(10,2) NOT NULL,
  gross_price DECIMAL(10,2) NOT NULL,
  afa_method TEXT DEFAULT 'linear',
  afa_years INTEGER NOT NULL,
  afa_start_date DATE NOT NULL,
  afa_annual_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active',   -- active, disposed, sold
  disposal_date DATE,
  disposal_price DECIMAL(10,2),
  euer_line INTEGER DEFAULT 30,
  euer_category TEXT DEFAULT 'afa_beweglich',
  category TEXT,                  -- computer, phone, furniture, equipment, software
  inventory_number TEXT,
  location TEXT DEFAULT 'Home Office',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### depreciation_schedule
```sql
CREATE TABLE depreciation_schedule (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  months INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  cumulative DECIMAL(10,2) NOT NULL,
  book_value DECIMAL(10,2) NOT NULL
);
```

---

## German Tax Reference

### EÜR Line Mapping

| Line | Type | Name | Description |
|------|------|------|-------------|
| **14** | Income | Betriebseinnahmen | Standard taxable business income (19% or 7%) |
| **16** | Income | Veräußerungsgewinne | Gains from asset sales (selling price - book value) |
| **18** | Income | USt-Erstattung | VAT refunds from tax office |
| **25** | Expense | Fremdleistungen | Subcontractors, freelancers |
| **27** | Expense | Vorsteuer | Input VAT on purchases |
| **28** | Expense | Gezahlte USt | Output VAT paid to tax office |
| **30** | Expense | AfA | Depreciation of movable assets |
| **33** | Expense | Arbeitszimmer | Home office costs (Pauschale: €1,260/year) |
| **34** | Expense | Sonstige | Other fully deductible business expenses |
| **35** | Expense | Anlagenabgang (Verlust) | Losses from asset disposals (remaining book value) |

### Expense Categories (Line 34 Subcategories)

| Category | Label | Vorsteuer |
|----------|-------|-----------|
| `software` | Software & Lizenzen | Yes |
| `telecom` | Telekommunikation | Yes |
| `hosting` | Hosting & Domains | Yes |
| `travel` | Reisekosten | Yes |
| `insurance` | Versicherungen | No |
| `bank_fees` | Kontoführung | No |
| `training` | Fortbildung | Yes |
| `books` | Fachliteratur (7% VAT) | Yes |
| `office_supplies` | Büromaterial | Yes |

### AfA Useful Life (AfA-Tabelle)

| Asset Type | Years | Category |
|------------|-------|----------|
| Computer, Notebook | 3 | computer |
| Monitor | 3 | computer |
| Printer | 3 | computer |
| Mobile Phone | 5 | phone |
| Desk | 13 | furniture |
| Chair | 13 | furniture |
| Shelf | 13 | furniture |
| Software (>€1,000) | 3 | software |

### GWG Thresholds (Geringwertige Wirtschaftsgüter)

| Net Amount | Treatment |
|------------|-----------|
| ≤ €250 | Immediate write-off (Sofortabschreibung) |
| €250.01 - €800 | GWG: Choice of immediate or regular AfA |
| €800.01 - €1,000 | Pool method (5 years) or regular AfA |
| > €1,000 | Regular AfA over useful life |

### VAT Rates (Umsatzsteuer)

| Rate | Use Case |
|------|----------|
| **19%** | Standard rate (most services, products) |
| **7%** | Reduced rate (books, food, newspapers) |
| **0%** | Exempt (insurance, financial services, medical) |

### Key Formulas

```typescript
// VAT Calculation
const vatAmount = netAmount * (vatRate / 100);
const grossAmount = netAmount + vatAmount;

// Quarterly VAT (USt-Voranmeldung)
const zahllast = sumUmsatzsteuer - sumVorsteuer;
// Positive = you owe money, Negative = refund

// Annual Profit (EÜR)
const gewinn = sumEinnahmen - sumAusgaben - sumAfA - homeoffice;

// Linear Depreciation (AfA)
const annualAfa = purchasePrice / usefulLifeYears;
const firstYearAfa = annualAfa * (monthsInFirstYear / 12);
```

---

### Phase 8: Asset Integration & EÜR Enhancement ✅ COMPLETE

**Goal**: Full integration of assets with EÜR reports and enhanced reporting

**Features**:
- Automatic AfA integration into EÜR Line 30
- Asset disposal gain tracking (EÜR Line 16 - Veräußerungsgewinne)
- Asset disposal loss tracking (EÜR Line 35 - Anlagenabgang)
- Dashboard Asset Widget with total value and current year AfA
- Anlageverzeichnis (Asset register) for tax filing
- Annual AfA summary report by category
- Homeoffice-Pauschale automatic inclusion (€1,260/year)
- Rounding to 2 decimal places for all financial calculations

**Test Results**: 33 new API tests for asset/EÜR integration

**Deliverables**:
- [x] `api/reports.ts` - Enhanced with disposal gains/losses integration
- [x] `api/reports.test.ts` - 33 tests for asset integration
- [x] `api/assets.ts` - Disposal tracking functions (getDisposalGains, getDisposalLosses)
- [x] `components/Reports/Anlageverzeichnis.tsx` - Asset register component
- [x] `components/Reports/AfaSummary.tsx` - Annual AfA summary
- [x] `types/index.ts` - EUER_LINES constants for Lines 16, 35

---

## Future Enhancements (Phase 9+)

Potential next phases:

### Phase 9: Advanced Features
- [ ] PDF invoice export (browser print works for MVP)
- [ ] Bank statement import (CSV/MT940)
- [ ] Receipt image attachment & OCR
- [ ] Markdown export for Obsidian archival
- [ ] ELSTER integration (direct tax filing)
- [ ] Multi-year comparison charts
- [ ] Recurring invoice generation
- [ ] Email invoice delivery

---

## References

- [AfA-Tabelle (BMF)](https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Weitere_Steuerthemen/Betriebspruefung/AfA-Tabellen/afa-tabellen.html)
- [Anlage EÜR (Formular)](https://www.formulare-bfinv.de/)
- [§ 4 Abs. 5 Nr. 6c EStG (Homeoffice-Pauschale)](https://www.gesetze-im-internet.de/estg/__4.html)
- [§ 6 Abs. 2 EStG (GWG)](https://www.gesetze-im-internet.de/estg/__6.html)
