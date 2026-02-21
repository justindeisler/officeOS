/**
 * Travel Expense Calculation Service (Reisekosten)
 *
 * Implements German tax rules for travel expenses:
 * - Verpflegungsmehraufwand (per diem): §9 Abs. 4a EStG
 * - Kilometerpauschale (mileage): §9 Abs. 1 Nr. 4a EStG
 * - Bewirtungskosten (business meals): §4 Abs. 5 Nr. 2 EStG
 *
 * All rates are for 2024 (unchanged since 2020).
 */

import type {
  MealsProvided,
  PerDiemCalculation,
  MileageCalculation,
  TravelRecord,
  VehicleType,
} from '../types/travel.js';

import {
  PER_DIEM_RATE_SHORT,
  PER_DIEM_RATE_FULL,
  PER_DIEM_MIN_HOURS,
  MEAL_DEDUCTION_BREAKFAST,
  MEAL_DEDUCTION_LUNCH,
  MEAL_DEDUCTION_DINNER,
  MILEAGE_RATES,
} from '../types/travel.js';

// ============================================================================
// Per Diem Calculation (Verpflegungsmehraufwand)
// ============================================================================

/**
 * Calculate per diem allowance based on absence duration.
 *
 * German rules (2024):
 * - Less than 8 hours: no per diem
 * - 8-24 hours: €14/day
 * - 24+ hours (full day): €28/day
 *
 * Meal deductions when meals are provided by employer:
 * - Breakfast: -€5.60 (20% of €28)
 * - Lunch: -€11.20 (40% of €28)
 * - Dinner: -€11.20 (40% of €28)
 *
 * Per diem cannot go below €0 after deductions.
 */
export function calculatePerDiem(
  absence_hours: number,
  meals_provided: MealsProvided = { breakfast: false, lunch: false, dinner: false }
): PerDiemCalculation {
  // Validate input
  if (absence_hours < 0) {
    throw new Error('Absence hours cannot be negative');
  }

  // No per diem for absences under 8 hours
  if (absence_hours < PER_DIEM_MIN_HOURS) {
    return {
      absence_hours,
      rate: 0,
      gross_amount: 0,
      meal_deductions: 0,
      net_amount: 0,
    };
  }

  // Determine rate based on duration
  const rate = absence_hours >= 24 ? PER_DIEM_RATE_FULL : PER_DIEM_RATE_SHORT;
  const gross_amount = rate;

  // Calculate meal deductions
  let meal_deductions = 0;
  if (meals_provided.breakfast) {
    meal_deductions += MEAL_DEDUCTION_BREAKFAST;
  }
  if (meals_provided.lunch) {
    meal_deductions += MEAL_DEDUCTION_LUNCH;
  }
  if (meals_provided.dinner) {
    meal_deductions += MEAL_DEDUCTION_DINNER;
  }

  // Per diem cannot go below 0
  const net_amount = Math.max(0, round(gross_amount - meal_deductions));

  return {
    absence_hours,
    rate,
    gross_amount,
    meal_deductions: round(meal_deductions),
    net_amount,
  };
}

// ============================================================================
// Mileage Calculation (Kilometerpauschale)
// ============================================================================

/**
 * Calculate mileage compensation.
 *
 * Standard rates (2024):
 * - Car: €0.30/km
 * - Motorcycle: €0.20/km
 * - Bike: €0.05/km
 */
export function calculateMileage(
  distance_km: number,
  vehicle_type: VehicleType = 'car'
): MileageCalculation {
  if (distance_km < 0) {
    throw new Error('Distance cannot be negative');
  }

  const km_rate = MILEAGE_RATES[vehicle_type];
  if (km_rate === undefined) {
    throw new Error(`Unknown vehicle type: ${vehicle_type}`);
  }

  const amount = round(distance_km * km_rate);

  return {
    distance_km,
    vehicle_type,
    km_rate,
    amount,
  };
}

// ============================================================================
// Total Travel Expense Calculation
// ============================================================================

/**
 * Calculate total travel expense from all components.
 *
 * Components:
 * - Mileage compensation (Kilometerpauschale)
 * - Per diem allowance (Verpflegungsmehraufwand)
 * - Accommodation costs
 * - Other travel costs
 */
export function calculateTotalTravel(
  travel: Partial<TravelRecord>
): number {
  let total = 0;

  // Mileage
  if (travel.distance_km && travel.distance_km > 0) {
    const vehicleType = travel.vehicle_type || 'car';
    const mileage = calculateMileage(travel.distance_km, vehicleType);
    total += mileage.amount;
  } else if (travel.mileage_amount && travel.mileage_amount > 0) {
    total += travel.mileage_amount;
  }

  // Per diem
  if (travel.absence_hours && travel.absence_hours >= PER_DIEM_MIN_HOURS) {
    const meals: MealsProvided = travel.meals_provided || {
      breakfast: false,
      lunch: false,
      dinner: false,
    };
    const perDiem = calculatePerDiem(travel.absence_hours, meals);
    total += perDiem.net_amount;
  } else if (travel.per_diem_amount && travel.per_diem_amount > 0) {
    total += travel.per_diem_amount;
  }

  // Accommodation
  if (travel.accommodation_amount && travel.accommodation_amount > 0) {
    total += travel.accommodation_amount;
  }

  // Other costs
  if (travel.other_costs && travel.other_costs > 0) {
    total += travel.other_costs;
  }

  return round(total);
}

// ============================================================================
// Multi-day Travel Calculation
// ============================================================================

/**
 * Calculate per diem for a multi-day trip.
 *
 * For trips spanning multiple days:
 * - First day (departure): partial day, use absence_hours for that day
 * - Middle days: full days (24h) → €28 each
 * - Last day (return): partial day, use absence_hours for that day
 *
 * This is a convenience function. For single days, use calculatePerDiem directly.
 */
export function calculateMultiDayPerDiem(
  trip_date: string,
  return_date: string,
  departure_hours: number,
  return_hours: number,
  meals_provided_per_day?: MealsProvided[]
): PerDiemCalculation[] {
  const start = new Date(trip_date);
  const end = new Date(return_date);

  if (end < start) {
    throw new Error('Return date must be on or after trip date');
  }

  const days: PerDiemCalculation[] = [];
  const diffTime = end.getTime() - start.getTime();
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < totalDays; i++) {
    let hours: number;
    if (totalDays === 1) {
      hours = departure_hours; // Single day trip
    } else if (i === 0) {
      hours = departure_hours; // First day
    } else if (i === totalDays - 1) {
      hours = return_hours; // Last day
    } else {
      hours = 24; // Middle days = full day
    }

    const meals = meals_provided_per_day?.[i] || {
      breakfast: false,
      lunch: false,
      dinner: false,
    };

    days.push(calculatePerDiem(hours, meals));
  }

  return days;
}

// ============================================================================
// Helpers
// ============================================================================

/** Round to 2 decimal places */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
