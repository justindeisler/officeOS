/**
 * Travel Records Hooks
 *
 * React hooks for managing travel expense state and calculations.
 * Provides CRUD operations with loading/error states and
 * client-side per diem + mileage calculators.
 */

import { useState, useCallback, useEffect } from 'react';
import { travelService } from '@/services/web/travelService';
import type {
  TravelRecord,
  CreateTravelRecordInput,
  UpdateTravelRecordInput,
  VehicleType,
  MealsProvided,
} from '@/services/web/travelService';
import {
  PER_DIEM_RATE_SHORT,
  PER_DIEM_RATE_FULL,
  PER_DIEM_MIN_HOURS,
  MEAL_DEDUCTION_BREAKFAST,
  MEAL_DEDUCTION_LUNCH,
  MEAL_DEDUCTION_DINNER,
  MILEAGE_RATES,
} from '../api/travel';

// ============================================================================
// useTravelRecords
// ============================================================================

export interface UseTravelRecordsOptions {
  /** Auto-fetch records on mount */
  autoFetch?: boolean;
  /** Filter by date range */
  dateRange?: { start: string; end: string };
}

export interface UseTravelRecordsReturn {
  data: TravelRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRecord: (data: CreateTravelRecordInput) => Promise<TravelRecord | null>;
  updateRecord: (id: string, data: UpdateTravelRecordInput) => Promise<TravelRecord | null>;
  deleteRecord: (id: string) => Promise<boolean>;
}

export function useTravelRecords(options: UseTravelRecordsOptions = {}): UseTravelRecordsReturn {
  const { autoFetch = true, dateRange } = options;

  const [data, setData] = useState<TravelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const records = await travelService.getTravelRecords(
        dateRange ? { startDate: dateRange.start, endDate: dateRange.end } : undefined
      );
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Reisekosten');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange?.start, dateRange?.end]);

  const createRecord = useCallback(async (input: CreateTravelRecordInput): Promise<TravelRecord | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const record = await travelService.createTravelRecord(input);
      setData(prev => [record, ...prev]);
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Reisekosten');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRecord = useCallback(async (id: string, input: UpdateTravelRecordInput): Promise<TravelRecord | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const record = await travelService.updateTravelRecord(id, input);
      setData(prev => prev.map(r => r.id === id ? record : r));
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Reisekosten');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await travelService.deleteTravelRecord(id);
      setData(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen der Reisekosten');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      refetch();
    }
  }, [autoFetch, refetch]);

  return { data, isLoading, error, refetch, createRecord, updateRecord, deleteRecord };
}

// ============================================================================
// usePerDiemCalculator
// ============================================================================

export interface PerDiemResult {
  absenceHours: number;
  rate: number;
  grossAmount: number;
  mealDeductions: number;
  netAmount: number;
}

export interface UsePerDiemCalculatorReturn {
  calculate: (absenceHours: number, mealsProvided?: MealsProvided) => PerDiemResult;
  result: PerDiemResult | null;
}

export function usePerDiemCalculator(): UsePerDiemCalculatorReturn {
  const [result, setResult] = useState<PerDiemResult | null>(null);

  const calculate = useCallback((absenceHours: number, mealsProvided?: MealsProvided): PerDiemResult => {
    const meals = mealsProvided || { breakfast: false, lunch: false, dinner: false };

    // No per diem for absences under 8 hours
    if (absenceHours < PER_DIEM_MIN_HOURS) {
      const res: PerDiemResult = {
        absenceHours,
        rate: 0,
        grossAmount: 0,
        mealDeductions: 0,
        netAmount: 0,
      };
      setResult(res);
      return res;
    }

    // Determine rate based on duration
    const rate = absenceHours >= 24 ? PER_DIEM_RATE_FULL : PER_DIEM_RATE_SHORT;
    const grossAmount = rate;

    // Calculate meal deductions
    let mealDeductions = 0;
    if (meals.breakfast) mealDeductions += MEAL_DEDUCTION_BREAKFAST;
    if (meals.lunch) mealDeductions += MEAL_DEDUCTION_LUNCH;
    if (meals.dinner) mealDeductions += MEAL_DEDUCTION_DINNER;

    mealDeductions = Math.round(mealDeductions * 100) / 100;

    // Per diem cannot go below 0
    const netAmount = Math.max(0, Math.round((grossAmount - mealDeductions) * 100) / 100);

    const res: PerDiemResult = {
      absenceHours,
      rate,
      grossAmount,
      mealDeductions,
      netAmount,
    };
    setResult(res);
    return res;
  }, []);

  return { calculate, result };
}

// ============================================================================
// useMileageCalculator
// ============================================================================

export interface MileageResult {
  distanceKm: number;
  vehicleType: VehicleType;
  kmRate: number;
  amount: number;
}

export interface UseMileageCalculatorReturn {
  calculate: (distanceKm: number, vehicleType?: VehicleType) => MileageResult;
  result: MileageResult | null;
}

export function useMileageCalculator(): UseMileageCalculatorReturn {
  const [result, setResult] = useState<MileageResult | null>(null);

  const calculate = useCallback((distanceKm: number, vehicleType: VehicleType = 'car'): MileageResult => {
    const kmRate = MILEAGE_RATES[vehicleType] || 0.30;
    const amount = Math.round(distanceKm * kmRate * 100) / 100;

    const res: MileageResult = {
      distanceKm,
      vehicleType,
      kmRate,
      amount,
    };
    setResult(res);
    return res;
  }, []);

  return { calculate, result };
}

export default useTravelRecords;
