# Accounting Features Roadmap

> **Status**: In Progress
> **Last Updated**: 2026-01-11
> **Prerequisite**: Phase 8 Complete (506 tests, 95%+ coverage)
> **Estimated Total Effort**: 8-12 weeks
> **Completed**: DATEV Export ✅

## Overview

This document outlines the implementation plan for advanced accounting features building on the existing German freelancer accounting system. Each feature follows TDD methodology with comprehensive test coverage.

---

## Table of Contents

1. [DATEV Export](#1-datev-export)
2. [Enhanced Reporting](#2-enhanced-reporting)
3. [Client Management](#3-client-management)
4. [Dashboard Enhancements](#4-dashboard-enhancements)
5. [Expense Shortcuts](#5-expense-shortcuts)
6. [Search & Filtering](#6-search--filtering)
7. [Export Improvements](#7-export-improvements)
8. [Implementation Timeline](#implementation-timeline)
9. [Technical Dependencies](#technical-dependencies)

---

## 1. DATEV Export ✅ COMPLETE

> **Priority**: High
> **Effort**: 2-3 weeks
> **Business Value**: Direct tax advisor handoff, reduced manual work
> **Status**: ✅ Implemented

### 1.1 Overview

Enable export of accounting data in DATEV-compatible formats for seamless handoff to tax advisors (Steuerberater). DATEV is the de-facto standard for German accounting software interoperability.

### 1.2 Features

#### 1.2.1 SKR03/SKR04 Chart of Accounts Mapping

| Feature | Description | Priority |
|---------|-------------|----------|
| Account mapping table | Map EÜR categories to SKR03/SKR04 accounts | P0 |
| Dual chart support | Support both SKR03 (common) and SKR04 (industry) | P0 |
| Custom mapping overrides | Allow user to customize account assignments | P1 |
| Mapping validation | Ensure all transactions have valid account assignments | P0 |

**SKR03 Account Mapping (Standard)**:

| EÜR Line | EÜR Category | SKR03 Account | Account Name |
|----------|--------------|---------------|--------------|
| 14 | services | 8400 | Erlöse 19% USt |
| 14 | services_7 | 8300 | Erlöse 7% USt |
| 25 | subcontractor | 3100 | Fremdleistungen |
| 27 | vorsteuer | 1576 | Abziehbare Vorsteuer 19% |
| 27 | vorsteuer_7 | 1571 | Abziehbare Vorsteuer 7% |
| 28 | ust_paid | 1776 | Umsatzsteuer 19% |
| 30 | afa | 4830 | Abschreibungen auf Sachanlagen |
| 33 | homeoffice | 4288 | Aufwendungen für häusliches Arbeitszimmer |
| 34 | software | 4964 | Sonstige EDV-Kosten |
| 34 | telecom | 4920 | Telefon |
| 34 | hosting | 4964 | Sonstige EDV-Kosten |
| 34 | travel | 4670 | Reisekosten Unternehmer |
| 34 | insurance | 4360 | Versicherungen |
| 34 | bank_fees | 4970 | Nebenkosten des Geldverkehrs |
| 34 | training | 4945 | Fortbildungskosten |
| 34 | books | 4940 | Zeitschriften, Bücher |
| 34 | office_supplies | 4930 | Bürobedarf |

#### 1.2.2 DATEV CSV Export (Buchungsstapel)

DATEV CSV format specification (Version 10.0+):

```csv
"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext"
1234,56;"S";"EUR";;;;"8400";"1200";"";"0101";"RE-2024-001";"";"0,00";"Consulting Q1"
```

**CSV Header Structure** (21 standard fields):

| Field | Description | Example |
|-------|-------------|---------|
| Umsatz | Amount (net) | 1234,56 |
| Soll/Haben-Kz | S=Debit, H=Credit | S |
| WKZ Umsatz | Currency | EUR |
| Konto | Account number | 8400 |
| Gegenkonto | Counter account | 1200 |
| BU-Schlüssel | Tax code | 3 (19% USt) |
| Belegdatum | Document date | 0115 (MMDD) |
| Belegfeld 1 | Document reference | RE-2024-001 |
| Buchungstext | Description | Consulting services |

#### 1.2.3 DATEV XML Export (DATEV-Format V6)

For more complex integrations, support DATEV XML format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LedgerImport xmlns="http://xml.datev.de/bedi/tps/ledger/v060">
  <Consolidate>
    <Transaction>
      <Date>2024-01-15</Date>
      <Amount>1234.56</Amount>
      <DebitAccount>8400</DebitAccount>
      <CreditAccount>1200</CreditAccount>
      <Description>Consulting Q1</Description>
      <TaxCode>19</TaxCode>
    </Transaction>
  </Consolidate>
</LedgerImport>
```

### 1.3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATEV Export Module                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Chart of        │    │  Export          │                   │
│  │  Accounts        │    │  Configuration   │                   │
│  │  (SKR03/SKR04)   │    │  (period, format)│                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                    │
│  │           DATEV Mapper Service           │                    │
│  │  - Transaction → DATEV record mapping    │                    │
│  │  - VAT code assignment                   │                    │
│  │  - Account number resolution             │                    │
│  └────────────────────┬────────────────────┘                    │
│                       │                                          │
│           ┌───────────┴───────────┐                             │
│           ▼                       ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  CSV Generator   │    │  XML Generator   │                    │
│  │  (Buchungsstapel)│    │  (DATEV-Format)  │                    │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Implementation Plan

#### Phase 1: SKR Mapping Infrastructure (Week 1)

**Types**:
```typescript
// types/datev.ts

export type ChartOfAccounts = 'SKR03' | 'SKR04';

export interface DatevAccount {
  number: string;          // e.g., "8400"
  name: string;            // e.g., "Erlöse 19% USt"
  type: 'asset' | 'liability' | 'income' | 'expense';
}

export interface DatevMapping {
  euerLine: number;
  euerCategory: string;
  skr03Account: string;
  skr04Account: string;
  taxCode?: number;        // DATEV BU-Schlüssel
}

export interface DatevTransaction {
  amount: number;
  isDebit: boolean;
  currency: 'EUR';
  account: string;
  counterAccount: string;
  taxCode: number;
  date: Date;
  reference: string;
  description: string;
}

export interface DatevExportConfig {
  chartOfAccounts: ChartOfAccounts;
  period: { from: Date; to: Date };
  format: 'csv' | 'xml';
  includeOpenItems: boolean;
  consultant: string;      // Beraternummer
  client: string;          // Mandantennummer
}
```

**Deliverables**:
- [x] `types/datev.ts` - TypeScript interfaces
- [x] `constants/skr03.ts` - SKR03 account definitions
- [x] `constants/skr04.ts` - SKR04 account definitions
- [x] `utils/datev-mapping.ts` - EÜR → SKR mapping functions
- [x] `utils/datev-mapping.test.ts` - Mapping tests

**Acceptance Criteria**:
- [x] All EÜR categories map to valid SKR03 accounts
- [x] All EÜR categories map to valid SKR04 accounts
- [x] VAT codes correctly assigned (3=19%, 2=7%, 0=exempt)
- [x] 100% test coverage for mapping functions

#### Phase 2: CSV Export (Week 1-2)

**Deliverables**:
- [x] `api/datev.ts` - DATEV export API
- [x] `api/datev.test.ts` - Export tests
- [x] `utils/datev-csv.ts` - CSV generator
- [x] `utils/datev-csv.test.ts` - CSV format tests

**CSV Format Requirements**:
- German number format (comma decimal separator)
- German date format (DDMM for DATEV)
- Semicolon delimiter
- ISO-8859-1 encoding (for DATEV compatibility)
- Header row with exact DATEV field names

**Acceptance Criteria**:
- [x] Income transactions export correctly
- [x] Expense transactions export correctly
- [x] VAT transactions export correctly
- [x] Asset depreciation exports to correct account
- [x] Date range filtering works
- [x] Generated CSV imports successfully into DATEV (manual verification)

#### Phase 3: XML Export (Week 2)

**Deliverables**:
- [x] `utils/datev-xml.ts` - XML generator
- [x] `utils/datev-xml.test.ts` - XML schema tests

**Acceptance Criteria**:
- [x] Valid DATEV XML schema (v6)
- [x] All required elements present
- [x] Proper namespace declarations

#### Phase 4: UI Components (Week 2-3)

**Deliverables**:
- [x] `components/Export/DatevExportDialog.tsx`
- [x] `components/Export/DatevExportDialog.test.tsx`
- [x] `components/Export/DatevSettings.tsx` - Chart selection, consultant number
- [x] `components/Export/DatevSettings.test.tsx`
- [x] `components/Export/index.ts`

**UI Requirements**:
- Period selector (month, quarter, year, custom)
- Chart of accounts toggle (SKR03/SKR04)
- Format selector (CSV/XML)
- Consultant & client number inputs
- Preview of record count
- Download button

**Acceptance Criteria**:
- [x] Period selection updates preview count
- [x] Chart toggle changes account numbers in preview
- [x] Download triggers file save dialog
- [x] Validation prevents export without required fields
- [x] Accessible (keyboard navigation, screen reader labels)

### 1.5 Test Strategy

| Layer | Tests | Coverage Target |
|-------|-------|-----------------|
| Mapping | 30+ unit tests | 100% |
| CSV Generator | 20+ unit tests | 95% |
| XML Generator | 15+ unit tests | 95% |
| UI Components | 25+ integration tests | 90% |
| **Total** | **90+ tests** | **95%** |

### 1.6 Files to Create

```
app/src/features/accounting/
├── types/
│   └── datev.ts                    # DATEV type definitions
├── constants/
│   ├── skr03.ts                    # SKR03 account chart
│   └── skr04.ts                    # SKR04 account chart
├── utils/
│   ├── datev-mapping.ts            # EÜR → SKR mapping
│   ├── datev-mapping.test.ts
│   ├── datev-csv.ts                # CSV generator
│   ├── datev-csv.test.ts
│   ├── datev-xml.ts                # XML generator
│   └── datev-xml.test.ts
├── api/
│   ├── datev.ts                    # Export API
│   └── datev.test.ts
├── hooks/
│   └── useDatevExport.ts           # Export hook
└── components/
    └── Export/
        ├── DatevExportDialog.tsx
        ├── DatevExportDialog.test.tsx
        ├── DatevSettings.tsx
        ├── DatevSettings.test.tsx
        └── index.ts
```

---

## 2. Enhanced Reporting

> **Priority**: High
> **Effort**: 2-3 weeks
> **Business Value**: Better financial insights, tax planning

### 2.1 Overview

Advanced visualizations and analytics for financial data, enabling better business decisions and tax planning.

### 2.2 Features

#### 2.2.1 Monthly/Quarterly P&L Comparison Charts

| Feature | Description | Chart Type |
|---------|-------------|------------|
| Income vs Expenses | Monthly bar comparison | Grouped bar |
| Profit trend | Monthly profit line | Line chart |
| YTD cumulative | Running totals | Area chart |
| Quarter comparison | Q1-Q4 comparison | Stacked bar |

**Chart Library**: Recharts (already in ecosystem, React-native)

#### 2.2.2 Expense Breakdown by Category

| View | Description | Chart Type |
|------|-------------|------------|
| Category pie | Expense distribution | Donut chart |
| Category trend | Monthly by category | Stacked area |
| Top vendors | Top 10 by spend | Horizontal bar |
| Recurring vs one-time | Split analysis | Pie chart |

#### 2.2.3 Tax Estimation (Forecast Zahllast)

Calculate estimated quarterly VAT payment based on:
- Current quarter income (projected)
- Current quarter expenses (projected)
- Historical patterns

```typescript
interface TaxForecast {
  period: string;                    // "2024-Q2"
  projectedIncome: number;
  projectedUmsatzsteuer: number;
  projectedVorsteuer: number;
  estimatedZahllast: number;
  confidence: 'low' | 'medium' | 'high';
  dueDate: Date;                     // 10th of following month
}
```

#### 2.2.4 Year-over-Year Comparison

| Metric | Comparison | Visualization |
|--------|------------|---------------|
| Total income | YoY change % | KPI card with arrow |
| Total expenses | YoY change % | KPI card with arrow |
| Profit margin | YoY change pp | KPI card |
| Client count | YoY change | KPI card |
| Category shifts | YoY delta | Table with sparklines |

### 2.3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Reporting Module                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Report Engine                          │    │
│  │  - Data aggregation (by period, category, client)        │    │
│  │  - Projection algorithms                                  │    │
│  │  - Comparison calculations                                │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│      ┌────────────────────┼────────────────────┐                │
│      ▼                    ▼                    ▼                │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Chart    │    │ Tax          │    │ Comparison   │          │
│  │ Generator │    │ Forecaster   │    │ Calculator   │          │
│  └──────────┘    └──────────────┘    └──────────────┘          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    UI Components                          │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │    │
│  │  │ P&L    │ │Expense │ │  Tax   │ │  YoY   │            │    │
│  │  │ Charts │ │Breakdown│ │Forecast│ │Compare │            │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Implementation Plan

#### Phase 1: Report Engine & Aggregation (Week 1)

**Types**:
```typescript
// types/reports.ts

export interface MonthlyAggregate {
  year: number;
  month: number;
  income: number;
  expenses: number;
  profit: number;
  vatCollected: number;
  vatPaid: number;
}

export interface CategoryAggregate {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface YearComparison {
  metric: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}
```

**Deliverables**:
- [ ] `utils/report-aggregation.ts` - Aggregation functions
- [ ] `utils/report-aggregation.test.ts` - 40+ tests
- [ ] `utils/tax-forecast.ts` - Forecast algorithms
- [ ] `utils/tax-forecast.test.ts` - 20+ tests

#### Phase 2: Chart Components (Week 1-2)

**Deliverables**:
- [ ] `components/Charts/PLChart.tsx` - Income vs Expense bars
- [ ] `components/Charts/PLChart.test.tsx`
- [ ] `components/Charts/ProfitTrendChart.tsx` - Profit line chart
- [ ] `components/Charts/ProfitTrendChart.test.tsx`
- [ ] `components/Charts/ExpenseDonut.tsx` - Category donut
- [ ] `components/Charts/ExpenseDonut.test.tsx`
- [ ] `components/Charts/CategoryTrend.tsx` - Stacked area
- [ ] `components/Charts/CategoryTrend.test.tsx`
- [ ] `components/Charts/index.ts`

**Chart Requirements**:
- Responsive sizing
- German number/currency formatting
- Accessible (color contrast, screen reader descriptions)
- Consistent with design-system.md colors
- Animation on data change (Framer Motion integration)

#### Phase 3: Tax Forecast UI (Week 2)

**Deliverables**:
- [ ] `components/Reports/TaxForecast.tsx`
- [ ] `components/Reports/TaxForecast.test.tsx`
- [ ] `hooks/useTaxForecast.ts`

**UI Elements**:
- Current quarter summary
- Projected Zahllast with confidence indicator
- Due date countdown
- Historical accuracy comparison

#### Phase 4: Year-over-Year Dashboard (Week 2-3)

**Deliverables**:
- [ ] `components/Reports/YearComparison.tsx`
- [ ] `components/Reports/YearComparison.test.tsx`
- [ ] `components/Reports/ComparisonCard.tsx` - Reusable KPI card
- [ ] `components/Reports/ComparisonCard.test.tsx`

### 2.5 Test Strategy

| Component | Tests | Coverage |
|-----------|-------|----------|
| Aggregation | 40 | 100% |
| Tax Forecast | 20 | 95% |
| P&L Charts | 15 | 90% |
| Expense Charts | 15 | 90% |
| YoY Components | 15 | 90% |
| **Total** | **105** | **95%** |

### 2.6 Files to Create

```
app/src/features/accounting/
├── utils/
│   ├── report-aggregation.ts
│   ├── report-aggregation.test.ts
│   ├── tax-forecast.ts
│   └── tax-forecast.test.ts
├── hooks/
│   └── useTaxForecast.ts
└── components/
    ├── Charts/
    │   ├── PLChart.tsx
    │   ├── PLChart.test.tsx
    │   ├── ProfitTrendChart.tsx
    │   ├── ProfitTrendChart.test.tsx
    │   ├── ExpenseDonut.tsx
    │   ├── ExpenseDonut.test.tsx
    │   ├── CategoryTrend.tsx
    │   ├── CategoryTrend.test.tsx
    │   └── index.ts
    └── Reports/
        ├── TaxForecast.tsx
        ├── TaxForecast.test.tsx
        ├── YearComparison.tsx
        ├── YearComparison.test.tsx
        ├── ComparisonCard.tsx
        └── ComparisonCard.test.tsx
```

---

## 3. Client Management

> **Priority**: Medium
> **Effort**: 2-3 weeks
> **Business Value**: Better client relationships, revenue insights

### 3.1 Overview

Enhanced client management with analytics, communication tracking, and a self-service portal for invoice access.

### 3.2 Features

#### 3.2.1 Client Portal

| Feature | Description | Auth |
|---------|-------------|------|
| Invoice list | View all invoices | Token-based |
| Invoice download | Download PDF | Token-based |
| Payment status | See payment history | Token-based |
| Profile view | View contact info | Token-based |

**Portal Access Flow**:
1. Generate unique access token per client
2. Send portal link via email
3. Client accesses portal with token (no password)
4. Token expires after 30 days (configurable)

#### 3.2.2 Client-Level Revenue Analytics

| Metric | Description | Visualization |
|--------|-------------|---------------|
| Total revenue | Lifetime value | KPI card |
| Revenue trend | Monthly revenue | Sparkline |
| Average invoice | Mean invoice value | KPI card |
| Payment speed | Avg days to pay | KPI card |
| Project count | Number of invoices | KPI card |

#### 3.2.3 Contact Management Integration

| Feature | Description |
|---------|-------------|
| Contact sync | Two-way sync with contacts |
| Activity log | Communication history |
| Notes | Free-form client notes |
| Tags | Custom categorization |
| Reminders | Follow-up reminders |

### 3.3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Management Module                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │  Client Portal      │    │  Admin Dashboard    │             │
│  │  (Public access)    │    │  (Authenticated)    │             │
│  └──────────┬──────────┘    └──────────┬──────────┘             │
│             │                          │                         │
│             ▼                          ▼                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Client Service                          │    │
│  │  - Token generation & validation                          │    │
│  │  - Revenue analytics                                      │    │
│  │  - Activity tracking                                      │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Database                                │    │
│  │  clients │ client_tokens │ client_notes │ client_tags    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Implementation Plan

#### Phase 1: Database Schema Extension (Week 1)

**New Tables**:
```sql
-- Client access tokens
CREATE TABLE client_tokens (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Client notes
CREATE TABLE client_notes (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Client tags
CREATE TABLE client_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6'
);

-- Client-tag junction
CREATE TABLE client_tag_assignments (
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES client_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, tag_id)
);
```

**Deliverables**:
- [ ] Schema migration
- [ ] `types/client.ts` - Extended types
- [ ] `api/client-tokens.ts` - Token CRUD
- [ ] `api/client-tokens.test.ts`

#### Phase 2: Client Analytics (Week 1-2)

**Deliverables**:
- [ ] `utils/client-analytics.ts` - Analytics calculations
- [ ] `utils/client-analytics.test.ts` - 25+ tests
- [ ] `hooks/useClientAnalytics.ts`
- [ ] `components/Clients/ClientRevenue.tsx`
- [ ] `components/Clients/ClientRevenue.test.tsx`

#### Phase 3: Client Portal (Week 2-3)

**Deliverables**:
- [ ] `pages/portal/[token].tsx` - Portal entry
- [ ] `pages/portal/invoices.tsx` - Invoice list
- [ ] `pages/portal/invoices/[id].tsx` - Invoice detail
- [ ] `components/Portal/PortalLayout.tsx`
- [ ] `components/Portal/PortalInvoiceList.tsx`
- [ ] `components/Portal/PortalInvoiceDetail.tsx`
- [ ] Tests for all portal components

**Security Considerations**:
- Token hashing (bcrypt)
- Rate limiting on token validation
- IP logging
- Token rotation on suspicious activity

#### Phase 4: Contact Management (Week 3)

**Deliverables**:
- [ ] `components/Clients/ClientDetail.tsx` - Full client view
- [ ] `components/Clients/ClientNotes.tsx` - Notes section
- [ ] `components/Clients/ClientTags.tsx` - Tag management
- [ ] `components/Clients/ClientActivity.tsx` - Activity timeline
- [ ] Tests for all components

### 3.5 Test Strategy

| Layer | Tests | Coverage |
|-------|-------|----------|
| Token API | 20 | 100% |
| Analytics | 25 | 95% |
| Portal UI | 30 | 90% |
| Contact Mgmt | 20 | 90% |
| **Total** | **95** | **95%** |

---

## 4. Dashboard Enhancements

> **Priority**: Medium
> **Effort**: 1-2 weeks
> **Business Value**: Better cash flow visibility, deadline awareness

### 4.1 Overview

Enhanced dashboard widgets for cash flow projection, payment deadlines, and tax due dates.

### 4.2 Features

#### 4.2.1 Cash Flow Projection

```typescript
interface CashFlowProjection {
  date: Date;
  expected: number;
  source: 'invoice' | 'recurring_expense';
  description: string;
  probability: number;      // Based on payment history
}

interface CashFlowSummary {
  currentBalance: number;   // User-entered starting point
  projectedInflows: number;
  projectedOutflows: number;
  projectedBalance: number;
  period: '30d' | '60d' | '90d';
}
```

**Projection Logic**:
- Pending invoices × probability (based on client payment history)
- Scheduled recurring expenses
- Upcoming AfA depreciation (non-cash, but for planning)

#### 4.2.2 Upcoming Payment Deadlines Widget

| Deadline Type | Days Before Alert | Color |
|---------------|-------------------|-------|
| Invoice due | 7, 3, 0 | Yellow → Orange → Red |
| Recurring expense | 3 | Blue |
| VAT deadline | 10, 5, 0 | Yellow → Orange → Red |

#### 4.2.3 VAT Deadline Reminders

German VAT (USt-Voranmeldung) deadlines:
- Monthly filers: 10th of following month
- Quarterly filers: 10th of month after quarter end
- With Dauerfristverlängerung: Add 1 month

```typescript
interface VatDeadline {
  period: string;          // "2024-Q1"
  type: 'monthly' | 'quarterly';
  dueDate: Date;
  hasDauerfrist: boolean;
  status: 'upcoming' | 'due' | 'overdue' | 'filed';
}
```

### 4.3 Implementation Plan

#### Phase 1: Cash Flow Engine (Week 1)

**Deliverables**:
- [ ] `utils/cash-flow.ts` - Projection calculations
- [ ] `utils/cash-flow.test.ts` - 30+ tests
- [ ] `hooks/useCashFlow.ts`
- [ ] `components/Dashboard/CashFlowWidget.tsx`
- [ ] `components/Dashboard/CashFlowWidget.test.tsx`

#### Phase 2: Deadline Widgets (Week 1-2)

**Deliverables**:
- [ ] `utils/deadlines.ts` - Deadline calculations
- [ ] `utils/deadlines.test.ts` - 20+ tests
- [ ] `hooks/useDeadlines.ts`
- [ ] `components/Dashboard/DeadlineWidget.tsx`
- [ ] `components/Dashboard/DeadlineWidget.test.tsx`
- [ ] `components/Dashboard/VatDeadlineWidget.tsx`
- [ ] `components/Dashboard/VatDeadlineWidget.test.tsx`

### 4.4 UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Dashboard                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               Cash Flow Projection (30 days)             │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │ Current │  │ Inflows │  │Outflows │  │Projected│     │    │
│  │  │ €12,450 │  │ +€8,200 │  │ -€3,100 │  │ €17,550 │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  │                                                          │    │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ Timeline chart                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ Upcoming Deadlines  │  │ VAT Deadlines        │               │
│  │─────────────────────│  │──────────────────────│               │
│  │ 🔴 RE-2024-015 3d   │  │ 🟡 Q1 2024 - 12 days │               │
│  │ 🟡 RE-2024-018 7d   │  │ ⚪ Q2 2024 - 75 days │               │
│  │ 🔵 Hosting   Monthly │  │                      │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Test Strategy

| Component | Tests | Coverage |
|-----------|-------|----------|
| Cash Flow Utils | 30 | 100% |
| Deadline Utils | 20 | 100% |
| Cash Flow Widget | 15 | 90% |
| Deadline Widgets | 20 | 90% |
| **Total** | **85** | **95%** |

---

## 5. Expense Shortcuts

> **Priority**: Medium
> **Effort**: 1 week
> **Business Value**: Faster data entry, reduced errors

### 5.1 Overview

Productivity features for faster expense entry: split expenses, vendor templates, and duplication.

### 5.2 Features

#### 5.2.1 Split Expense Feature

For expenses with partial business use (e.g., phone bill 70% business):

```typescript
interface SplitExpense {
  originalAmount: number;
  businessPercent: number;
  businessAmount: number;
  privateAmount: number;
  reason: string;          // "70% business use per contract"
}
```

**UI**: Slider or input for percentage, auto-calculate amounts

#### 5.2.2 Quick-Add from Common Vendors (Templates)

```typescript
interface ExpenseTemplate {
  id: string;
  name: string;            // "Monthly Hetzner"
  vendor: string;
  description: string;
  defaultAmount: number;
  vatRate: VatRate;
  euerCategory: string;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
}
```

**Pre-built Templates**:
| Template | Vendor | Category | VAT |
|----------|--------|----------|-----|
| Hetzner Server | Hetzner | hosting | 19% |
| AWS | Amazon Web Services | hosting | 19% |
| Notion | Notion Labs | software | 19% |
| Spotify | Spotify | software | 19% |
| Telekom | Deutsche Telekom | telecom | 19% |

#### 5.2.3 Duplicate Expense

One-click duplication for:
- Similar expense, different date
- Recurring expense missed by automation
- Template for new recurring setup

### 5.3 Implementation Plan

#### Phase 1: Split Expense (Days 1-2)

**Deliverables**:
- [ ] `components/Expenses/SplitExpenseDialog.tsx`
- [ ] `components/Expenses/SplitExpenseDialog.test.tsx`
- [ ] Update `ExpenseForm.tsx` with split integration

#### Phase 2: Templates (Days 3-4)

**Deliverables**:
- [ ] `types/templates.ts`
- [ ] `constants/expense-templates.ts` - Pre-built templates
- [ ] `api/expense-templates.ts` - Custom template CRUD
- [ ] `api/expense-templates.test.ts`
- [ ] `components/Expenses/TemplateSelector.tsx`
- [ ] `components/Expenses/TemplateSelector.test.tsx`
- [ ] `components/Expenses/TemplateManager.tsx`
- [ ] `components/Expenses/TemplateManager.test.tsx`

#### Phase 3: Duplicate Action (Day 5)

**Deliverables**:
- [ ] Update `ExpenseList.tsx` with duplicate action
- [ ] `utils/expense-duplicate.ts`
- [ ] `utils/expense-duplicate.test.ts`

### 5.4 Test Strategy

| Feature | Tests | Coverage |
|---------|-------|----------|
| Split Logic | 15 | 100% |
| Templates | 20 | 95% |
| Duplicate | 10 | 95% |
| **Total** | **45** | **95%** |

---

## 6. Search & Filtering

> **Priority**: Medium
> **Effort**: 1-2 weeks
> **Business Value**: Faster navigation, better auditing

### 6.1 Overview

Unified search across all accounting entities with advanced filtering and saved presets.

### 6.2 Features

#### 6.2.1 Global Search

Search across:
- Income (description, client name, amount)
- Expenses (description, vendor, amount)
- Invoices (number, client, amount)
- Assets (name, vendor)
- Clients (name, email)

```typescript
interface SearchResult {
  type: 'income' | 'expense' | 'invoice' | 'asset' | 'client';
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  date?: Date;
  highlight: string;       // Matched text with highlighting
}
```

#### 6.2.2 Advanced Filters

| Filter | Types | UI |
|--------|-------|-----|
| Date range | All | Date picker |
| Amount range | Income, Expense, Invoice | Min/max inputs |
| Category | Expense | Multi-select |
| Status | Invoice | Checkbox group |
| Client | Income, Invoice | Autocomplete |
| VAT rate | All | Checkbox group |
| USt reported | Income, Expense | Toggle |

#### 6.2.3 Saved Filter Presets

```typescript
interface FilterPreset {
  id: string;
  name: string;            // "Q1 2024 Expenses"
  type: 'income' | 'expense' | 'invoice' | 'all';
  filters: TransactionFilters;
  isDefault: boolean;
  createdAt: Date;
}
```

**Pre-built Presets**:
- "This Month"
- "This Quarter"
- "This Year"
- "Unreported VAT"
- "Overdue Invoices"
- "Large Expenses (>€500)"

### 6.3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Search & Filter System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────┐                               │
│  │        Command Palette        │  ⌘K / Ctrl+K                 │
│  │  ┌──────────────────────────┐│                               │
│  │  │ 🔍 Search accounting...   ││                               │
│  │  └──────────────────────────┘│                               │
│  │  📄 Invoice RE-2024-015      │                               │
│  │  💰 Income: Wellfy Consulting│                               │
│  │  📦 Expense: AWS March       │                               │
│  └──────────────────────────────┘                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Filter Panel                           │    │
│  │  Date: [Jan 1] to [Dec 31]  Amount: [€0] to [€∞]         │    │
│  │  Category: ☑ Software ☑ Hosting ☐ Travel                 │    │
│  │  Presets: [This Quarter ▼]                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Implementation Plan

#### Phase 1: Search Infrastructure (Week 1)

**Deliverables**:
- [ ] `utils/search.ts` - Search algorithm
- [ ] `utils/search.test.ts` - 30+ tests
- [ ] `hooks/useGlobalSearch.ts`
- [ ] `components/Search/CommandPalette.tsx`
- [ ] `components/Search/CommandPalette.test.tsx`
- [ ] `components/Search/SearchResult.tsx`
- [ ] `components/Search/SearchResult.test.tsx`

**Search Implementation**:
- Client-side fuzzy search (Fuse.js)
- Debounced input (300ms)
- Keyboard navigation (↑↓ Enter Esc)
- Recent searches history

#### Phase 2: Advanced Filters (Week 1-2)

**Deliverables**:
- [ ] `components/Filters/FilterPanel.tsx`
- [ ] `components/Filters/FilterPanel.test.tsx`
- [ ] `components/Filters/DateRangeFilter.tsx`
- [ ] `components/Filters/AmountRangeFilter.tsx`
- [ ] `components/Filters/CategoryFilter.tsx`
- [ ] `components/Filters/StatusFilter.tsx`
- [ ] Update all list components with filter integration

#### Phase 3: Filter Presets (Week 2)

**Deliverables**:
- [ ] `api/filter-presets.ts`
- [ ] `api/filter-presets.test.ts`
- [ ] `components/Filters/PresetSelector.tsx`
- [ ] `components/Filters/PresetSelector.test.tsx`
- [ ] `components/Filters/PresetManager.tsx`
- [ ] `components/Filters/PresetManager.test.tsx`

### 6.5 Test Strategy

| Feature | Tests | Coverage |
|---------|-------|----------|
| Search Algorithm | 30 | 100% |
| Command Palette | 20 | 90% |
| Filter Components | 25 | 90% |
| Presets | 15 | 95% |
| **Total** | **90** | **95%** |

---

## 7. Export Improvements

> **Priority**: Low
> **Effort**: 1 week
> **Business Value**: Better reporting, professional documents

### 7.1 Overview

Enhanced export capabilities for all transaction types with professional PDF generation.

### 7.2 Features

#### 7.2.1 CSV Export for All Transaction Types

| Type | Fields | Special Handling |
|------|--------|------------------|
| Income | All fields | German number format |
| Expenses | All fields | Category labels |
| Invoices | Summary + items | Separate items CSV |
| Assets | With depreciation | Full schedule option |

#### 7.2.2 PDF Generation with Custom Branding

```typescript
interface InvoiceBranding {
  logo?: string;           // Base64 or URL
  primaryColor: string;
  companyName: string;
  companyAddress: string;
  vatId: string;           // USt-IdNr
  bankDetails: {
    iban: string;
    bic: string;
    bank: string;
  };
  footer?: string;
}
```

**PDF Generation Stack**:
- `@react-pdf/renderer` for React-native PDF generation
- Template-based design matching design-system.md

#### 7.2.3 Quarterly Summary PDF

Professional summary document for tax advisor:

**Contents**:
1. Cover page with period and summary
2. Income summary by category
3. Expense summary by category
4. USt-Voranmeldung calculation
5. Pending invoices list
6. Asset depreciation for period

### 7.3 Implementation Plan

#### Phase 1: CSV Enhancements (Days 1-2)

**Deliverables**:
- [ ] `utils/csv-export.ts` - Universal CSV generator
- [ ] `utils/csv-export.test.ts`
- [ ] Update all list components with CSV export button

#### Phase 2: PDF Invoice (Days 3-4)

**Deliverables**:
- [ ] `components/PDF/InvoicePDF.tsx` - React-PDF template
- [ ] `components/PDF/InvoicePDF.test.tsx`
- [ ] `components/Settings/BrandingSettings.tsx`
- [ ] `components/Settings/BrandingSettings.test.tsx`
- [ ] `api/branding.ts` - Branding settings API

#### Phase 3: Quarterly Summary (Day 5)

**Deliverables**:
- [ ] `components/PDF/QuarterlySummaryPDF.tsx`
- [ ] `components/PDF/QuarterlySummaryPDF.test.tsx`
- [ ] `hooks/useQuarterlyExport.ts`

### 7.4 Test Strategy

| Feature | Tests | Coverage |
|---------|-------|----------|
| CSV Export | 20 | 100% |
| PDF Invoice | 15 | 90% |
| PDF Summary | 15 | 90% |
| Branding | 10 | 95% |
| **Total** | **60** | **95%** |

---

## Implementation Timeline

### Overview

```
Week  1  2  3  4  5  6  7  8  9  10 11 12
      ├──┴──┼──┴──┼──┴──┼──┴──┼──┴──┼──┴──┤
      │ DATEV Export  │Enhanced│Client│Dash│Search│Export│
      │               │Reporting│Mgmt  │Enh │Filter│Improv│
      └───────────────┴────────┴──────┴────┴──────┴──────┘
```

### Detailed Schedule

| Phase | Feature | Weeks | Tests | Effort | Status |
|-------|---------|-------|-------|--------|--------|
| 1 | DATEV Export | 1-3 | 90 | High | ✅ Complete |
| 2 | Enhanced Reporting | 3-5 | 105 | High | Pending |
| 3 | Client Management | 5-7 | 95 | Medium | Pending |
| 4 | Dashboard Enhancements | 7-8 | 85 | Medium | Pending |
| 5 | Expense Shortcuts | 8-9 | 45 | Low | Pending |
| 6 | Search & Filtering | 9-10 | 90 | Medium | Pending |
| 7 | Export Improvements | 11-12 | 60 | Low | Pending |
| **Total** | | **12 weeks** | **570 tests** | | |

### Milestones

| Milestone | Week | Deliverable | Status |
|-----------|------|-------------|--------|
| M1 | 3 | DATEV CSV export functional | ✅ Complete |
| M2 | 5 | P&L charts and tax forecast live | Pending |
| M3 | 7 | Client portal accessible | Pending |
| M4 | 9 | Cash flow projection on dashboard | Pending |
| M5 | 10 | Global search with filters | Pending |
| M6 | 12 | PDF exports with branding | Pending |

---

## Technical Dependencies

### New NPM Packages

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `recharts` | ^2.x | Chart components | 160KB |
| `fuse.js` | ^7.x | Fuzzy search | 15KB |
| `@react-pdf/renderer` | ^3.x | PDF generation | 800KB |
| `date-fns` | ^3.x | Date manipulation | 50KB |
| `iconv-lite` | ^0.6.x | DATEV encoding | 45KB |

### Database Migrations

```sql
-- Migration: Add client management tables
-- Migration: Add filter presets table
-- Migration: Add expense templates table
-- Migration: Add branding settings table
```

### API Endpoints (if backend added later)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/datev/export` | POST | Generate DATEV export |
| `/api/portal/:token` | GET | Client portal access |
| `/api/search` | GET | Global search |
| `/api/presets` | CRUD | Filter presets |
| `/api/templates` | CRUD | Expense templates |

---

## Success Metrics

### Feature Adoption

| Feature | Target Metric | Measurement |
|---------|---------------|-------------|
| DATEV Export | 1+ exports/month | Export count |
| Charts | Daily dashboard views | Page views |
| Client Portal | 50% client access | Token usage |
| Search | 10+ searches/week | Search events |
| Templates | 5+ templates used | Template applications |

### Quality Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Coverage | 95%+ | 95% (baseline) |
| Lighthouse Score | 90+ | TBD |
| Time to First Render | <1s | TBD |
| DATEV Import Success | 100% | TBD |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| DATEV format changes | Low | High | Version detection, format validation |
| PDF rendering issues | Medium | Medium | Fallback to browser print |
| Search performance | Low | Medium | Pagination, index optimization |
| Client portal security | Medium | High | Token rotation, rate limiting, audit logging |

---

## References

- [DATEV Developer Portal](https://developer.datev.de/)
- [SKR03 Account Chart](https://www.datev.de/kontenrahmen)
- [React-PDF Documentation](https://react-pdf.org/)
- [Recharts Examples](https://recharts.org/en-US/examples)
- [Fuse.js Documentation](https://fusejs.io/)
