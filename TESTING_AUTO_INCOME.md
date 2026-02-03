# Testing Auto-Income Creation Feature

## Feature Description
When an invoice status is changed to "paid", the system automatically creates a corresponding income record with all invoice details.

## Implementation Details
- **File Modified:** `api/src/routes/invoices.ts`
- **Endpoint:** `POST /api/invoices/:id/pay`
- **Duplicate Prevention:** Checks for existing income record with matching `invoice_id`

## Manual Testing Steps

### Prerequisites
1. Have valid API authentication token
2. Access to Personal Assistant webapp or API

### Test Scenario 1: New Invoice Payment
1. Create a new invoice (status: "draft")
2. Note the invoice ID and number
3. Mark invoice as paid via API or webapp:
   ```bash
   curl -X POST http://localhost:3005/api/invoices/{invoice_id}/pay \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "payment_date": "2024-02-03",
       "payment_method": "bank_transfer"
     }'
   ```
4. Verify income record was created:
   ```bash
   curl http://localhost:3005/api/income?invoice_id={invoice_id} \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Test Scenario 2: Duplicate Prevention
1. Use the same invoice from Scenario 1
2. Try to mark it as paid again
3. Verify that:
   - API returns error "Invoice is already paid"
   - No duplicate income record is created

### Test Scenario 3: Database Verification
```sql
-- Check invoice status
SELECT id, invoice_number, status, payment_date, total 
FROM invoices 
WHERE status = 'paid';

-- Check corresponding income records
SELECT i.invoice_number, inc.* 
FROM income inc
JOIN invoices i ON inc.invoice_id = i.id
WHERE inc.invoice_id IS NOT NULL;
```

## Expected Income Record Fields
- `date`: invoice.payment_date
- `client_id`: invoice.client_id
- `invoice_id`: invoice.id
- `description`: "Payment for Invoice #[invoice_number]"
- `net_amount`: invoice.subtotal
- `vat_rate`: invoice.vat_rate
- `vat_amount`: invoice.vat_amount
- `gross_amount`: invoice.total
- `payment_method`: invoice.payment_method
- `euer_line`: 14 (services)
- `euer_category`: "services"
- `ust_reported`: 0 (not yet reported)

## Validation Checklist
- [ ] Income record created when invoice marked as paid
- [ ] No duplicate income if invoice already has one
- [ ] All fields correctly populated from invoice
- [ ] invoice_id correctly links to invoice
- [ ] Console log shows: "Auto-created income record [id] for invoice [number]"
- [ ] Frontend displays income in income list
- [ ] Income record appears in accounting reports

## Rollback Plan
If issues arise:
1. Revert commit: `git revert 7d53852`
2. Rebuild API: `cd ~/projects/personal-assistant/api && npm run build`
3. Restart PM2: `pm2 restart personal-assistant-api`
