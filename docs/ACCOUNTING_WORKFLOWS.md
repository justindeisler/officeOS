# officeOS Accounting Workflows

> Complete guide to using all accounting features for German freelancers (EÜR/Kleinunternehmer)

---

## Table of Contents

1. [Daily Workflows](#daily-workflows)
2. [Monthly Workflows](#monthly-workflows)
3. [Quarterly Workflows](#quarterly-workflows)
4. [Annual Workflows](#annual-workflows)
5. [Feature-Specific Guides](#feature-specific-guides)

---

## Daily Workflows

### 📥 Recording Income

**When:** You receive payment for services

1. Go to **Accounting → Income**
2. Click **+ New Income**
3. Fill in:
   - **Date:** Payment received date (cash-basis!)
   - **Client:** Select or create
   - **Description:** "Consulting January 2026"
   - **Net Amount:** €5,000
   - **VAT Rate:** 19% (or 0% for Kleinunternehmer)
4. System auto-calculates: Gross = €5,950, VAT = €950
5. **Save**

💡 **Tip:** If linked to an invoice, the system auto-matches when you connect banking.

---

### 📤 Recording Expenses

**When:** You pay for business costs

1. Go to **Accounting → Expenses**
2. Click **+ New Expense**
3. Fill in:
   - **Date:** Payment date
   - **Vendor:** "Hetzner"
   - **Description:** "Server hosting February"
   - **Category:** Hosting & Domains (auto-assigns EÜR line 34)
   - **Gross Amount:** €47.60
   - **VAT Rate:** 19%
4. System auto-calculates: Net = €40.00, Vorsteuer = €7.60
5. **Upload receipt** (required for GoBD compliance!)
6. **Save**

💡 **Smart Features:**
- **Auto-categorization:** System suggests category based on vendor history
- **Duplicate detection:** Warns if similar expense exists
- **Missing receipt alert:** Dashboard shows expenses without receipts

---

### 🧾 Creating Invoices

**When:** You complete work for a client

1. Go to **Accounting → Invoices**
2. Click **+ New Invoice**
3. Select **Client** (or create new)
4. Add line items:
   - Description: "Web Development - Feature X"
   - Quantity: 40 (hours)
   - Unit Price: €100
   - VAT: 19%
5. System generates:
   - **Invoice Number:** RE-2026-001 (sequential, GoBD-compliant)
   - **Due Date:** +14 days (configurable)
6. **Preview PDF** → **Save**
7. **Download PDF** or **Send via Email**

💡 **E-Rechnung:** Click "Download as ZUGFeRD" or "Download as X-Rechnung" for B2G clients.

---

### 🏦 Bank Reconciliation

**When:** Daily or when new transactions arrive

1. Go to **Accounting → Banking**
2. Click **Sync** on your connected account
3. Review **Unmatched Transactions**:
   - Green suggestions = high-confidence matches
   - Click **Match** to link to invoice/expense
   - Click **Create Expense** for new costs
   - Click **Create Income** for new revenue
4. **Auto-Match** button processes all high-confidence matches

💡 **Booking Rules:** Create rules like "HETZNER* → Category: Hosting" for automatic categorization.

---

## Monthly Workflows

### 📊 USt-Voranmeldung (VAT Return)

**When:** 10th of following month (or with Dauerfristverlängerung: 10th + 1 month)

1. Go to **Accounting → Reports → USt-Voranmeldung**
2. Select **Period:** January 2026
3. Review calculated values:
   - **Kz 81:** Revenue at 19% (Bemessungsgrundlage)
   - **Kz 86:** Revenue at 7%
   - **Kz 66:** Vorsteuer (input VAT)
   - **Kz 83:** Zahllast (amount to pay/receive)
4. Click **Generate ELSTER XML**
5. Either:
   - **Submit via ELSTER Portal** (manual upload)
   - **Submit via API** (if ELSTER provider configured)
6. After submission: **Lock Period** (prevents changes)

💡 **Tax Forecast:** Dashboard widget shows projected quarterly Zahllast.

---

### 📈 BWA Report (Monthly P&L)

**When:** End of month, for business overview

1. Go to **Accounting → Reports → BWA**
2. Select **Year:** 2026
3. View 12-column monthly breakdown:
   - Revenue by category
   - Expenses by category
   - Monthly profit/loss
   - YTD totals
4. **Export PDF** for your Steuerberater

💡 **Charts:** Switch to "Charts" tab for visual P&L, expense donut, profit trend.

---

### 🔔 Dunning (Payment Reminders)

**When:** Invoice overdue

1. Go to **Accounting → Invoices**
2. Filter: **Status = Overdue**
3. Click invoice → **Send Reminder**
4. System creates dunning entry:
   - **Level 1:** Friendly reminder (0 days overdue)
   - **Level 2:** First dunning (14 days)
   - **Level 3:** Second dunning (28 days)
   - **Level 4:** Final warning (42 days)
5. Each level adds late fees (configurable)
6. **Generate Dunning Letter PDF** → Send

💡 **Dashboard Widget:** Shows overdue invoices with days outstanding.

---

## Quarterly Workflows

### 📋 Zusammenfassende Meldung (ZM)

**When:** If you have EU B2B sales (reverse charge)

1. Go to **Accounting → Reports → ZM**
2. Select **Quarter:** Q1 2026
3. Review EU sales by country/VAT-ID
4. **Generate ELSTER XML**
5. Submit to Bundeszentralamt für Steuern

---

### 🔒 Period Locking (Festschreibung)

**When:** After submitting USt-VA/ZM

1. Go to **Accounting → GoBD → Period Locks**
2. Click **Lock Period**
3. Select: **Q1 2026** (or individual months)
4. Enter reason: "USt-VA submitted 2026-04-10"
5. **Confirm Lock**

⚠️ **Warning:** Locked periods cannot be modified (GoBD requirement). Only unlock with documented reason.

---

### 💾 DATEV Export

**When:** Sending data to Steuerberater

1. Go to **Accounting → Export → DATEV**
2. Select:
   - **Period:** Q1 2026
   - **Chart of Accounts:** SKR03 or SKR04
   - **Format:** CSV (Buchungsstapel) or XML
3. Enter:
   - **Beraternummer:** (from your Steuerberater)
   - **Mandantennummer:** (your client number)
4. **Preview** → Review record count
5. **Download**
6. Send ZIP to Steuerberater

💡 **Includes:** All income, expenses, and asset depreciation for the period.

---

## Annual Workflows

### 📑 EÜR (Einnahmenüberschussrechnung)

**When:** After year-end (deadline: July 31 for previous year)

1. Go to **Accounting → Reports → EÜR**
2. Select **Year:** 2025
3. Review all 23 EÜR lines:
   - Lines 14-16: Income (services, goods, asset sales)
   - Lines 25-35: Expenses by category
   - Line 36: Profit/Loss
4. Verify:
   - ✅ All income recorded
   - ✅ All expenses with receipts
   - ✅ Asset depreciation calculated
   - ✅ Homeoffice-Pauschale (if applicable)
5. **Generate ELSTER XML**
6. Submit via ELSTER Portal
7. **Lock Year**

---

### 🏢 Anlageverzeichnis (Asset Register)

**When:** Year-end, for tax records

1. Go to **Accounting → Reports → Anlageverzeichnis**
2. Select **Year:** 2025
3. Review all assets:
   - Purchase date & price
   - Depreciation method (linear/declining)
   - Annual AfA amount
   - Book value
4. **Export PDF** for records

---

### 📉 AfA Summary (Depreciation)

**When:** Year-end review

1. Go to **Accounting → Assets**
2. Click **AfA Summary** tab
3. View:
   - Total depreciation for year
   - Assets fully depreciated
   - GWG (immediate write-offs)
   - Planned depreciation for next year
4. This amount flows to EÜR Line 30

---

## Feature-Specific Guides

### ✈️ Travel Expenses (Reisekosten)

**When:** Business travel

1. Go to **Accounting → Travel Expenses**
2. Click **+ New Travel Record**
3. Fill in wizard:
   - **Step 1:** Dates & Destination
     - Departure: 2026-03-15 08:00
     - Return: 2026-03-16 18:00
     - Destination: Berlin
     - Purpose: Client meeting
   - **Step 2:** Per Diem (auto-calculated)
     - Day 1: 8+ hours = €14
     - Day 2: 24+ hours = €28
     - Meals provided? (deductions apply)
   - **Step 3:** Mileage (optional)
     - Distance: 450 km
     - Vehicle: Car (€0.30/km)
     - = €135.00
   - **Step 4:** Other costs
     - Hotel: €120.00 (upload receipt)
     - Parking: €15.00
4. **Summary:** Total = €312.00
5. **Save** → Creates expense entries automatically

💡 **German Rates (2024):**
- 8-24h absence: €14/day
- 24h+ absence: €28/day
- Mileage: €0.30/km (car), €0.20/km (motorcycle)
- Meal deductions: Breakfast -€5.60, Lunch/Dinner -€11.20 each

---

### 🔄 Recurring Invoices

**When:** Monthly retainer clients

1. Go to **Accounting → Recurring Invoices**
2. Click **+ New Template**
3. Configure:
   - Client: Wellfy GmbH
   - Description: "Monthly Retainer - CTO Services"
   - Amount: €5,000 net
   - Frequency: Monthly
   - Start: 2026-01-01
   - Auto-send: Yes/No
4. **Save**
5. On the 1st of each month, invoice is auto-generated

💡 **Processing:** Click "Process Due" to manually trigger all due invoices.

---

### 🧾 E-Rechnung (Electronic Invoices)

**When:** B2G (government) clients or large corporations

#### Sending E-Rechnung:
1. Create invoice normally
2. Click **Download as ZUGFeRD** or **Download as X-Rechnung**
3. Send to client via their portal (e.g., ZRE Bund)

#### Receiving E-Rechnung:
1. Go to **Accounting → Invoices**
2. Click **Import E-Rechnung**
3. Upload XML file
4. System extracts:
   - Vendor, amounts, line items
   - Validates against schema
5. **Create Expense** from parsed data

---

### 📊 Booking Rules (Auto-Categorization)

**When:** Setting up automated expense categorization

1. Go to **Accounting → Booking Rules**
2. Click **+ New Rule**
3. Configure:
   - **Match:** Counterpart name contains "HETZNER"
   - **Action:** Set category = Hosting
   - **Action:** Set vendor = "Hetzner Online GmbH"
4. **Save**
5. Future bank transactions matching "HETZNER" auto-categorize

💡 **Create from Transaction:** On any bank transaction, click "Create Rule" to auto-fill pattern.

---

### 🔍 Duplicate Detection

**When:** Preventing double-entry

1. System automatically scans for duplicates:
   - Same amount ± €0.01
   - Same day or within 48 hours
   - Similar vendor/client name (fuzzy match)
2. **Alert appears** on dashboard and expense list
3. Review duplicates:
   - **Mark as Duplicate:** Excludes from EÜR/USt-VA
   - **Not a Duplicate:** Confirms both are valid

---

### 📜 GoBD Audit Trail

**When:** Tax audit or compliance review

1. Go to **Accounting → GoBD → Audit Log**
2. Filter by:
   - Entity type (income, expense, invoice, asset)
   - Date range
   - User
   - Action (create, update, delete)
3. View complete history:
   - Who changed what, when
   - Old value → New value
   - IP address, session ID
4. **Export** for auditor

💡 **Verfahrensdokumentation:** Access at GoBD → Documentation for complete process description.

---

### 🔌 Public API (Integrations)

**When:** Connecting external tools

#### Get API Key:
1. Go to **Settings → API Keys**
2. Click **+ Generate Key**
3. Name: "Zapier Integration"
4. Scopes: Select permissions
5. **Copy key** (shown once!)

#### Use API:
```bash
# List invoices
curl -H "Authorization: Bearer pk_live_abc123..." \
  https://pa.justin-deisler.com/api/v1/invoices

# Create expense
curl -X POST \
  -H "Authorization: Bearer pk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-15","vendor":"AWS","amount":50.00}' \
  https://pa.justin-deisler.com/api/v1/expenses
```

#### Webhooks:
1. Go to **Settings → Webhooks**
2. Click **+ Add Webhook**
3. Configure:
   - URL: https://your-app.com/webhook
   - Events: invoice.created, expense.created
4. **Save**
5. Receive POST requests with event data

💡 **API Docs:** Visit `/api/docs` for interactive Swagger UI.

---

## Quick Reference

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| New Income | `Ctrl+I` |
| New Expense | `Ctrl+E` |
| New Invoice | `Ctrl+N` |
| Search | `Ctrl+K` |
| Save | `Ctrl+S` |

### Important Deadlines (Germany)
| Filing | Deadline |
|--------|----------|
| USt-VA (monthly) | 10th of following month |
| USt-VA (with Dauerfrist) | 10th + 1 month |
| ZM (quarterly) | 25th after quarter end |
| EÜR (annual) | July 31 |
| Aufbewahrungsfrist | 10 years |

### VAT Rates
| Type | Rate |
|------|------|
| Standard | 19% |
| Reduced | 7% |
| Exempt | 0% |
| Reverse Charge | 0% (B2B EU) |

---

*Last updated: 2026-02-21*
