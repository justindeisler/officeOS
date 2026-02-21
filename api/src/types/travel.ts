/**
 * Travel Expense Types (Reisekosten)
 *
 * German tax-compliant travel expense management:
 * - Per Diem (Verpflegungsmehraufwand): €14 / €28 rates
 * - Mileage (Kilometerpauschale): €0.30/km standard
 * - Business Meals (Bewirtungskosten): 70% deductible
 */

// ============================================================================
// Core Types
// ============================================================================

export interface TravelRecord {
  id: string;
  expense_id: string | null;
  trip_date: string;
  return_date: string | null;
  destination: string;
  purpose: string;
  // Mileage
  distance_km: number | null;
  vehicle_type: VehicleType;
  km_rate: number;
  mileage_amount: number | null;
  // Per Diem
  absence_hours: number | null;
  per_diem_rate: number | null;
  per_diem_amount: number | null;
  meals_provided: MealsProvided | null;
  meal_deductions: number | null;
  // Accommodation
  accommodation_amount: number | null;
  // Other
  other_costs: number | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
}

export type VehicleType = 'car' | 'motorcycle' | 'bike';

export interface MealsProvided {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface BusinessMeal {
  participants: string[];  // Names of attendees
  purpose: string;         // Business purpose
  location: string;        // Restaurant/venue
}

// ============================================================================
// Calculation Types
// ============================================================================

export interface PerDiemCalculation {
  absence_hours: number;
  rate: number;            // €14 or €28
  gross_amount: number;
  meal_deductions: number;
  net_amount: number;
}

export interface MileageCalculation {
  distance_km: number;
  vehicle_type: VehicleType;
  km_rate: number;
  amount: number;
}

// ============================================================================
// German Tax Constants (2024)
// ============================================================================

/** Per diem rate for absences of 8-24 hours */
export const PER_DIEM_RATE_SHORT = 14;

/** Per diem rate for absences of 24+ hours (full day) */
export const PER_DIEM_RATE_FULL = 28;

/** Minimum absence hours to qualify for per diem */
export const PER_DIEM_MIN_HOURS = 8;

/** Meal deduction: Breakfast (20% of full-day rate) */
export const MEAL_DEDUCTION_BREAKFAST = 5.60;

/** Meal deduction: Lunch (40% of full-day rate) */
export const MEAL_DEDUCTION_LUNCH = 11.20;

/** Meal deduction: Dinner (40% of full-day rate) */
export const MEAL_DEDUCTION_DINNER = 11.20;

/** Mileage rates by vehicle type */
export const MILEAGE_RATES: Record<VehicleType, number> = {
  car: 0.30,
  motorcycle: 0.20,
  bike: 0.05,
};

/** Business meal deductibility percentage */
export const BUSINESS_MEAL_DEDUCTIBLE_PERCENT = 70;
