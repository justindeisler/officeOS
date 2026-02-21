-- Migration 022: Travel Expenses (Reisekosten)
--
-- German travel expense management:
-- - Travel records with mileage, per diem, accommodation tracking
-- - Business meals (Bewirtungskosten) - 70% deductible
-- - Per Diem (Verpflegungsmehraufwand) - €14/€28 rates
-- - Mileage (Kilometerpauschale) - €0.30/km standard

-- Travel Records table
CREATE TABLE IF NOT EXISTS travel_records (
  id TEXT PRIMARY KEY,
  expense_id TEXT REFERENCES expenses(id),
  trip_date TEXT NOT NULL,
  return_date TEXT,
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  -- Mileage (Kilometerpauschale)
  distance_km REAL,
  vehicle_type TEXT DEFAULT 'car',           -- car, motorcycle, bike
  km_rate REAL DEFAULT 0.30,                 -- €0.30/km standard
  mileage_amount REAL,                       -- Computed: distance_km * km_rate
  -- Per Diem (Verpflegungsmehraufwand)
  absence_hours REAL,                        -- Duration of travel
  per_diem_rate REAL,                        -- €14 (8-24h) or €28 (24h+)
  per_diem_amount REAL,
  meals_provided TEXT,                       -- JSON: {breakfast: bool, lunch: bool, dinner: bool}
  meal_deductions REAL,                      -- Deductions for provided meals
  -- Accommodation
  accommodation_amount REAL,
  -- Other
  other_costs REAL,
  notes TEXT,
  total_amount REAL,                         -- Sum of all components
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Business Meals (Bewirtungskosten) - 70% deductible
ALTER TABLE expenses ADD COLUMN is_business_meal INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN meal_participants TEXT;   -- JSON array
ALTER TABLE expenses ADD COLUMN meal_purpose TEXT;
ALTER TABLE expenses ADD COLUMN meal_location TEXT;

CREATE INDEX IF NOT EXISTS idx_travel_expense ON travel_records(expense_id);
CREATE INDEX IF NOT EXISTS idx_travel_date ON travel_records(trip_date);
