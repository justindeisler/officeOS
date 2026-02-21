/**
 * Travel Expense API
 *
 * Re-exports travel service for use within the accounting feature.
 * Provides typed API methods for travel records, per diem calculations,
 * mileage calculations, and business meal management.
 */

export {
  travelService,
  type TravelRecord,
  type CreateTravelRecordInput,
  type UpdateTravelRecordInput,
  type PerDiemInput,
  type PerDiemCalculation,
  type MileageInput,
  type MileageCalculation,
  type BusinessMealInput,
  type BusinessMealExpense,
  type VehicleType,
  type MealsProvided,
} from '@/services/web/travelService';

import { travelService } from '@/services/web/travelService';
import type {
  TravelRecord,
  CreateTravelRecordInput,
  UpdateTravelRecordInput,
  PerDiemInput,
  PerDiemCalculation,
  MileageInput,
  MileageCalculation,
  BusinessMealInput,
  BusinessMealExpense,
} from '@/services/web/travelService';

// ============================================================================
// Convenience Functions (matching sprint spec signatures)
// ============================================================================

export async function createTravelRecord(data: CreateTravelRecordInput): Promise<TravelRecord> {
  return travelService.createTravelRecord(data);
}

export async function getTravelRecords(): Promise<TravelRecord[]> {
  return travelService.getTravelRecords();
}

export async function getTravelRecord(id: string): Promise<TravelRecord> {
  return travelService.getTravelRecord(id);
}

export async function updateTravelRecord(id: string, data: UpdateTravelRecordInput): Promise<TravelRecord> {
  return travelService.updateTravelRecord(id, data);
}

export async function deleteTravelRecord(id: string): Promise<void> {
  return travelService.deleteTravelRecord(id);
}

export async function calculatePerDiem(data: PerDiemInput): Promise<PerDiemCalculation> {
  return travelService.calculatePerDiem(data);
}

export async function calculateMileage(data: MileageInput): Promise<MileageCalculation> {
  return travelService.calculateMileage(data);
}

export async function getBusinessMeals(): Promise<BusinessMealExpense[]> {
  return travelService.getBusinessMeals();
}

export async function updateBusinessMeal(expenseId: string, data: BusinessMealInput): Promise<BusinessMealExpense> {
  return travelService.updateBusinessMeal(expenseId, data);
}

// ============================================================================
// German Tax Constants (client-side, for calculator components)
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
export const MILEAGE_RATES: Record<string, number> = {
  car: 0.30,
  motorcycle: 0.20,
  bike: 0.05,
};

/** Vehicle type labels (German) */
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: 'Auto',
  motorcycle: 'Motorrad',
  bike: 'Fahrrad',
};

/** Business meal deductibility percentage */
export const BUSINESS_MEAL_DEDUCTIBLE_PERCENT = 70;
