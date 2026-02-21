# Public REST API v1

Base URL: `http://localhost:3001/api/v1`

> **Note:** Authentication is not yet required (Sprint 7 will add API key authentication).  
> The existing internal routes (`/api/invoices`, etc.) remain available for backward compatibility.

## Response Format

All endpoints return a consistent JSON envelope:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

The `meta` field is included only for paginated list endpoints.

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Invoice not found",
    "details": { ... }
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid or missing input |
| `NOT_FOUND` | 404 | Resource not found |
| `EXPORT_ERROR` | 400 | Export generation failed |
| `PDF_GENERATION_FAILED` | 500 | PDF could not be generated |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Default | Min | Max | Description |
|-----------|---------|-----|-----|-------------|
| `page` | 1 | 1 | — | Page number |
| `limit` | 20 | 1 | 100 | Items per page |

## Endpoints

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/invoices` | List invoices (paginated) |
| `GET` | `/invoices/:id` | Get single invoice |
| `POST` | `/invoices` | Create invoice |
| `PATCH` | `/invoices/:id` | Update draft invoice |
| `DELETE` | `/invoices/:id` | Delete invoice |
| `GET` | `/invoices/:id/pdf` | Download invoice PDF |

**Query Parameters (GET /invoices):**
- `status` — Filter by status (`draft`, `sent`, `paid`, `cancelled`)
- `client_id` — Filter by client

**Create/Update Body:**
```json
{
  "client_id": "uuid",
  "project_id": "uuid",
  "invoice_date": "2024-06-01",
  "due_date": "2024-06-15",
  "vat_rate": 19,
  "notes": "...",
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unit": "hours",
      "unit_price": 100,
      "vat_rate": 19
    }
  ]
}
```

### Income

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/income` | List income records (paginated) |
| `GET` | `/income/:id` | Get single income record |
| `POST` | `/income` | Create income record |
| `PATCH` | `/income/:id` | Update income record |
| `DELETE` | `/income/:id` | Soft-delete income record |

**Query Parameters (GET /income):**
- `start_date` — Filter from date (YYYY-MM-DD)
- `end_date` — Filter to date (YYYY-MM-DD)
- `client_id` — Filter by client

**Create Body (required fields marked with *):**
```json
{
  "date": "2024-06-01",       // *
  "description": "Payment",   // *
  "net_amount": 5000,          // *
  "vat_rate": 19,
  "client_id": "uuid",
  "invoice_id": "uuid",
  "euer_line": 14,
  "euer_category": "services",
  "payment_method": "bank_transfer"
}
```

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/expenses` | List expenses (paginated) |
| `GET` | `/expenses/:id` | Get single expense |
| `POST` | `/expenses` | Create expense |
| `PATCH` | `/expenses/:id` | Update expense |
| `DELETE` | `/expenses/:id` | Soft-delete expense |

**Query Parameters (GET /expenses):**
- `start_date`, `end_date` — Date range filter
- `category` — Filter by category
- `vendor` — Search by vendor name (partial match)

**Create Body (required *):**
```json
{
  "date": "2024-06-01",           // *
  "description": "Software",      // *
  "category": "software",         // *
  "net_amount": 100,              // *
  "vat_rate": 19,
  "vendor": "Adobe Inc",
  "payment_method": "credit_card",
  "deductible_percent": 100
}
```

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/assets` | List assets (paginated) |
| `GET` | `/assets/:id` | Get asset with depreciation schedule |
| `POST` | `/assets` | Create asset |
| `PATCH` | `/assets/:id` | Update asset |
| `DELETE` | `/assets/:id` | Delete asset |
| `GET` | `/assets/:id/depreciation` | Get depreciation schedule only |

**Query Parameters (GET /assets):**
- `status` — Filter by status (`active`, `disposed`, `sold`)
- `category` — Filter by category

**Create Body (required *):**
```json
{
  "name": "MacBook Pro",              // *
  "category": "equipment",            // *
  "purchase_date": "2024-01-01",      // *
  "purchase_price": 3000,             // *
  "useful_life_years": 3,             // *
  "depreciation_method": "linear",
  "salvage_value": 0,
  "vendor": "Apple",
  "description": "Dev laptop"
}
```

### Reports (read-only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/reports/euer?year=2024` | EÜR (income/expense summary) |
| `GET` | `/reports/ust-va?year=2024&quarter=1` | USt-Voranmeldung (VAT report) |
| `GET` | `/reports/bwa?year=2024&month=3` | BWA (P&L overview) |

**EÜR Response:**
```json
{
  "year": 2024,
  "income": { "14": 50000 },
  "expenses": { "27": 5000, "30": 3000 },
  "totalIncome": 50000,
  "totalExpenses": 8000,
  "gewinn": 42000
}
```

**BWA Response:**
```json
{
  "period": "2024-03",
  "year": 2024,
  "month": 3,
  "totalIncome": 8000,
  "totalExpenses": 3000,
  "result": 5000,
  "expensesByCategory": { "software": 1000, "travel": 2000 }
}
```

### Exports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/exports/datev` | Generate DATEV export |
| `POST` | `/exports/csv` | Generate CSV export |

**DATEV Export Body:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "chart_of_accounts": "SKR03",
  "consultant_number": "12345",
  "client_number": "67890"
}
```

**CSV Export Body:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "type": "all"
}
```
Type can be `all`, `income`, or `expenses`.
