/**
 * Web-based Travel Expense Service using REST API
 *
 * Manages travel records with German tax-compliant calculations:
 * - Per Diem (Verpflegungsmehraufwand)
 * - Mileage (Kilometerpauschale)
 * - Business Meals (Bewirtungskosten)
 */

import { adminClient } from '@/api';

// ============================================================================
// Types
// ============================================================================

export type VehicleType = 'car' | 'motorcycle' | 'bike';

export interface MealsProvided {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface TravelRecord {
  id: string;
  expenseId: string | null;
  tripDate: string;
  returnDate: string | null;
  destination: string;
  purpose: string;
  distanceKm: number | null;
  vehicleType: VehicleType;
  kmRate: number;
  mileageAmount: number | null;
  absenceHours: number | null;
  perDiemRate: number | null;
  perDiemAmount: number | null;
  mealsProvided: MealsProvided | null;
  mealDeductions: number | null;
  accommodationAmount: number | null;
  otherCosts: number | null;
  notes: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface CreateTravelRecordInput {
  tripDate: string;
  returnDate?: string | null;
  destination: string;
  purpose: string;
  distanceKm?: number | null;
  vehicleType?: VehicleType;
  absenceHours?: number | null;
  mealsProvided?: MealsProvided | null;
  accommodationAmount?: number | null;
  otherCosts?: number | null;
  notes?: string | null;
}

export interface UpdateTravelRecordInput {
  tripDate?: string;
  returnDate?: string | null;
  destination?: string;
  purpose?: string;
  distanceKm?: number | null;
  vehicleType?: VehicleType;
  absenceHours?: number | null;
  mealsProvided?: MealsProvided | null;
  accommodationAmount?: number | null;
  otherCosts?: number | null;
  notes?: string | null;
}

export interface PerDiemInput {
  absenceHours: number;
  mealsProvided?: MealsProvided;
}

export interface PerDiemCalculation {
  absenceHours: number;
  rate: number;
  grossAmount: number;
  mealDeductions: number;
  netAmount: number;
}

export interface MileageInput {
  distanceKm: number;
  vehicleType?: VehicleType;
}

export interface MileageCalculation {
  distanceKm: number;
  vehicleType: VehicleType;
  kmRate: number;
  amount: number;
}

export interface BusinessMealInput {
  isBusinessMeal: boolean;
  mealParticipants?: string[];
  mealPurpose?: string;
  mealLocation?: string | null;
}

export interface BusinessMealExpense {
  id: string;
  date: string;
  description: string;
  category: string;
  netAmount: number;
  deductiblePercent: number;
  isBusinessMeal: boolean;
  mealParticipants: string[];
  mealPurpose: string | null;
  mealLocation: string | null;
  [key: string]: unknown;
}

// ============================================================================
// Helpers
// ============================================================================

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[snakeKey] = toSnakeCase(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function toTravelRecord(obj: Record<string, unknown>): TravelRecord {
  const c = toCamelCase(obj);
  return {
    id: String(c.id ?? ''),
    expenseId: c.expenseId ? String(c.expenseId) : null,
    tripDate: String(c.tripDate ?? ''),
    returnDate: c.returnDate ? String(c.returnDate) : null,
    destination: String(c.destination ?? ''),
    purpose: String(c.purpose ?? ''),
    distanceKm: c.distanceKm != null ? Number(c.distanceKm) : null,
    vehicleType: (String(c.vehicleType ?? 'car')) as VehicleType,
    kmRate: Number(c.kmRate) || 0.30,
    mileageAmount: c.mileageAmount != null ? Number(c.mileageAmount) : null,
    absenceHours: c.absenceHours != null ? Number(c.absenceHours) : null,
    perDiemRate: c.perDiemRate != null ? Number(c.perDiemRate) : null,
    perDiemAmount: c.perDiemAmount != null ? Number(c.perDiemAmount) : null,
    mealsProvided: c.mealsProvided as MealsProvided | null,
    mealDeductions: c.mealDeductions != null ? Number(c.mealDeductions) : null,
    accommodationAmount: c.accommodationAmount != null ? Number(c.accommodationAmount) : null,
    otherCosts: c.otherCosts != null ? Number(c.otherCosts) : null,
    notes: c.notes ? String(c.notes) : null,
    totalAmount: Number(c.totalAmount) || 0,
    createdAt: String(c.createdAt ?? ''),
  };
}

function toBusinessMealExpense(obj: Record<string, unknown>): BusinessMealExpense {
  const c = toCamelCase(obj);
  return {
    ...c,
    id: String(c.id ?? ''),
    date: String(c.date ?? ''),
    description: String(c.description ?? ''),
    category: String(c.category ?? ''),
    netAmount: Number(c.netAmount) || 0,
    deductiblePercent: Number(c.deductiblePercent) || 100,
    isBusinessMeal: Boolean(c.isBusinessMeal),
    mealParticipants: Array.isArray(c.mealParticipants) ? c.mealParticipants as string[] : [],
    mealPurpose: c.mealPurpose ? String(c.mealPurpose) : null,
    mealLocation: c.mealLocation ? String(c.mealLocation) : null,
  };
}

// ============================================================================
// API Client
// ============================================================================

class TravelService {
  // ── Travel Records CRUD ─────────────────────────────────────────────

  async createTravelRecord(data: CreateTravelRecordInput): Promise<TravelRecord> {
    const snakeData = toSnakeCase(data as unknown as Record<string, unknown>);
    const result = await adminClient.request<Record<string, unknown>>('/travel-records', {
      method: 'POST',
      body: JSON.stringify(snakeData),
    });
    return toTravelRecord(result);
  }

  async getTravelRecords(filters?: { startDate?: string; endDate?: string }): Promise<TravelRecord[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    const query = params.toString();
    const results = await adminClient.request<Record<string, unknown>[]>(
      `/travel-records${query ? `?${query}` : ''}`
    );
    return results.map(toTravelRecord);
  }

  async getTravelRecord(id: string): Promise<TravelRecord> {
    const result = await adminClient.request<Record<string, unknown>>(`/travel-records/${id}`);
    return toTravelRecord(result);
  }

  async updateTravelRecord(id: string, data: UpdateTravelRecordInput): Promise<TravelRecord> {
    const snakeData = toSnakeCase(data as unknown as Record<string, unknown>);
    const result = await adminClient.request<Record<string, unknown>>(`/travel-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(snakeData),
    });
    return toTravelRecord(result);
  }

  async deleteTravelRecord(id: string): Promise<void> {
    await adminClient.request(`/travel-records/${id}`, { method: 'DELETE' });
  }

  // ── Calculators ─────────────────────────────────────────────────────

  async calculatePerDiem(data: PerDiemInput): Promise<PerDiemCalculation> {
    const snakeData = toSnakeCase(data as unknown as Record<string, unknown>);
    const result = await adminClient.request<Record<string, unknown>>('/travel-records/calculate-per-diem', {
      method: 'POST',
      body: JSON.stringify(snakeData),
    });
    const c = toCamelCase(result);
    return {
      absenceHours: Number(c.absenceHours) || 0,
      rate: Number(c.rate) || 0,
      grossAmount: Number(c.grossAmount) || 0,
      mealDeductions: Number(c.mealDeductions) || 0,
      netAmount: Number(c.netAmount) || 0,
    };
  }

  async calculateMileage(data: MileageInput): Promise<MileageCalculation> {
    const snakeData = toSnakeCase(data as unknown as Record<string, unknown>);
    const result = await adminClient.request<Record<string, unknown>>('/travel-records/calculate-mileage', {
      method: 'POST',
      body: JSON.stringify(snakeData),
    });
    const c = toCamelCase(result);
    return {
      distanceKm: Number(c.distanceKm) || 0,
      vehicleType: (String(c.vehicleType ?? 'car')) as VehicleType,
      kmRate: Number(c.kmRate) || 0,
      amount: Number(c.amount) || 0,
    };
  }

  // ── Business Meals ──────────────────────────────────────────────────

  async getBusinessMeals(): Promise<BusinessMealExpense[]> {
    const results = await adminClient.request<Record<string, unknown>[]>('/travel-records/business-meals/list');
    return results.map(toBusinessMealExpense);
  }

  async updateBusinessMeal(expenseId: string, data: BusinessMealInput): Promise<BusinessMealExpense> {
    const snakeData: Record<string, unknown> = {
      is_business_meal: data.isBusinessMeal ? 1 : 0,
    };
    if (data.mealParticipants) snakeData.meal_participants = data.mealParticipants;
    if (data.mealPurpose) snakeData.meal_purpose = data.mealPurpose;
    if (data.mealLocation !== undefined) snakeData.meal_location = data.mealLocation;

    const result = await adminClient.request<Record<string, unknown>>(`/travel-records/business-meal/${expenseId}`, {
      method: 'PATCH',
      body: JSON.stringify(snakeData),
    });
    return toBusinessMealExpense(result);
  }
}

export const travelService = new TravelService();
