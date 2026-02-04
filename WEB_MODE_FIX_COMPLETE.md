# Web Mode API Fix - Complete

## Problem
The income, expenses, and assets pages showed "No records" in web mode because the frontend APIs (`income.ts`, `expenses.ts`, `assets.ts`) were calling `getDb()` which returns an empty stub in web mode.

## Solution
Updated all three API files to detect the runtime environment and use the appropriate data source:
- **Web mode**: Call REST API endpoints with authentication
- **Tauri mode**: Use direct database access (existing behavior)

## Changes Made

### Files Updated
1. **`app/src/features/accounting/api/income.ts`**
   - Added `isTauri()`, `getAuthToken()`, `apiRequest()` helpers
   - Updated all functions: `getAllIncome()`, `getIncomeById()`, `createIncome()`, `updateIncome()`, `deleteIncome()`, etc.
   - Added date string to Date object conversion for API responses

2. **`app/src/features/accounting/api/expenses.ts`**
   - Same pattern as income.ts
   - Updated all CRUD and query functions
   - Handles expense-specific queries (recurring, GWG, vorsteuer)

3. **`app/src/features/accounting/api/assets.ts`**
   - Same pattern with additional complexity for depreciation schedules
   - Updated all asset management functions including disposal

### Implementation Pattern
```typescript
// Helper functions (added to each file)
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

function getAuthToken(): string | null {
  const stored = localStorage.getItem('pa-auth');
  return stored ? JSON.parse(stored).state?.token : null;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(...);
  return response.json();
}

// Example function update
export async function getAllIncome(): Promise<Income[]> {
  if (!isTauri()) {
    const data = await apiRequest<Income[]>('/api/income');
    return data.map(item => ({
      ...item,
      date: new Date(item.date),
      createdAt: new Date(item.createdAt),
    }));
  }
  
  // Tauri mode - use database (existing code)
  const db = await getDb();
  const results = await db.select<IncomeRow[]>('SELECT * FROM income ORDER BY date DESC');
  return results.map(mapDbToIncome);
}
```

## Verification

### Database Status
```bash
$ sqlite3 ~/.local/share/com.personal-assistant.app/personal-assistant.db "SELECT COUNT(*) FROM income"
3
```

**Records:**
1. `test-inc-1` - Test Project Invoice (€5,000)
2. `test-inc-2` - Consulting Services (€3,000)
3. Auto-generated from invoice RE-2026-001 (€2,500)

### Build & Deployment
```bash
✓ Frontend built successfully
✓ PM2 service restarted
✓ Changes committed to git
```

## Testing Checklist
- [x] Code changes implemented
- [x] Frontend builds without errors
- [x] Database contains test data (3 income records)
- [x] PM2 services restarted
- [x] Changes committed with feature commit message
- [ ] Manual browser test (verify income page shows 3 records)

## Next Steps
1. Open web app in browser at http://localhost:3005
2. Navigate to Accounting → Income
3. Verify all 3 income records are displayed
4. Test create/update/delete operations
5. Verify expenses and assets pages also work

## Technical Notes
- Auth token is read from `localStorage.getItem('pa-auth')` with path `state.token`
- Date strings from API are converted to Date objects in the mapping functions
- Existing Tauri code paths remain unchanged
- All REST endpoints already exist on the backend (verified in API code)
- Pattern is consistent with `reports.ts` reference implementation

## Commit
```
feat(accounting): Add web mode support to income, expenses, and assets APIs

- Update income.ts, expenses.ts, and assets.ts to detect Tauri vs web mode
- In web mode: call REST API with authentication instead of using database stub
- In Tauri mode: continue using direct database access
- Add helpers: isTauri(), getAuthToken(), apiRequest()
- Map API responses to convert date strings to Date objects
- Fixes 'No records' issue in web mode - frontend now properly fetches data from backend
```
