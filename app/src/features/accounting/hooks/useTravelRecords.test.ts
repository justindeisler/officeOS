import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerDiemCalculator, useMileageCalculator } from './useTravelRecords';

describe('usePerDiemCalculator', () => {
  it('returns null result initially', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    expect(result.current.result).toBeNull();
  });

  it('returns 0 for under 8 hours', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(5);
    });
    expect(calcResult!.rate).toBe(0);
    expect(calcResult!.grossAmount).toBe(0);
    expect(calcResult!.netAmount).toBe(0);
  });

  it('returns €14 for 8-24 hours', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(10);
    });
    expect(calcResult!.rate).toBe(14);
    expect(calcResult!.grossAmount).toBe(14);
    expect(calcResult!.netAmount).toBe(14);
  });

  it('returns €28 for 24+ hours', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(24);
    });
    expect(calcResult!.rate).toBe(28);
    expect(calcResult!.grossAmount).toBe(28);
    expect(calcResult!.netAmount).toBe(28);
  });

  it('deducts breakfast (€5.60)', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(24, { breakfast: true, lunch: false, dinner: false });
    });
    expect(calcResult!.mealDeductions).toBe(5.60);
    expect(calcResult!.netAmount).toBe(22.40);
  });

  it('deducts lunch (€11.20)', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(24, { breakfast: false, lunch: true, dinner: false });
    });
    expect(calcResult!.mealDeductions).toBe(11.20);
    expect(calcResult!.netAmount).toBe(16.80);
  });

  it('deducts dinner (€11.20)', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(24, { breakfast: false, lunch: false, dinner: true });
    });
    expect(calcResult!.mealDeductions).toBe(11.20);
    expect(calcResult!.netAmount).toBe(16.80);
  });

  it('deducts all meals (€28.00)', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(24, { breakfast: true, lunch: true, dinner: true });
    });
    expect(calcResult!.mealDeductions).toBe(28.00);
    expect(calcResult!.netAmount).toBe(0);
  });

  it('net amount cannot go below 0', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      // 14 - 28 deductions = should be 0
      calcResult = result.current.calculate(10, { breakfast: true, lunch: true, dinner: true });
    });
    expect(calcResult!.netAmount).toBe(0);
  });

  it('updates stored result after calculate', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    act(() => {
      result.current.calculate(10);
    });
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.rate).toBe(14);
  });

  it('handles exactly 8 hours', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(8);
    });
    expect(calcResult!.rate).toBe(14);
    expect(calcResult!.netAmount).toBe(14);
  });

  it('handles 0 hours', () => {
    const { result } = renderHook(() => usePerDiemCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(0);
    });
    expect(calcResult!.rate).toBe(0);
    expect(calcResult!.netAmount).toBe(0);
  });
});

describe('useMileageCalculator', () => {
  it('returns null result initially', () => {
    const { result } = renderHook(() => useMileageCalculator());
    expect(result.current.result).toBeNull();
  });

  it('calculates car mileage at €0.30/km', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(100, 'car');
    });
    expect(calcResult!.amount).toBe(30);
    expect(calcResult!.kmRate).toBe(0.30);
  });

  it('calculates motorcycle mileage at €0.20/km', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(100, 'motorcycle');
    });
    expect(calcResult!.amount).toBe(20);
    expect(calcResult!.kmRate).toBe(0.20);
  });

  it('calculates bike mileage at €0.05/km', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(100, 'bike');
    });
    expect(calcResult!.amount).toBe(5);
    expect(calcResult!.kmRate).toBe(0.05);
  });

  it('defaults to car when no vehicle type specified', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(100);
    });
    expect(calcResult!.vehicleType).toBe('car');
    expect(calcResult!.amount).toBe(30);
  });

  it('handles decimal distances', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(75.5, 'car');
    });
    expect(calcResult!.amount).toBe(22.65);
  });

  it('handles 0 km', () => {
    const { result } = renderHook(() => useMileageCalculator());
    let calcResult: ReturnType<typeof result.current.calculate>;
    act(() => {
      calcResult = result.current.calculate(0);
    });
    expect(calcResult!.amount).toBe(0);
  });

  it('updates stored result after calculate', () => {
    const { result } = renderHook(() => useMileageCalculator());
    act(() => {
      result.current.calculate(200, 'car');
    });
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.amount).toBe(60);
  });
});
