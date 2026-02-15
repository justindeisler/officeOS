import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useCalendarStore } from './calendarStore';
import { DEFAULT_FILTERS, DEFAULT_PREFERENCES } from '../types';

const FIXED_NOW = new Date('2025-07-22T10:30:00.000Z');

describe('calendarStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    // Reset store state
    useCalendarStore.setState({
      selectedDate: new Date(),
      viewMode: 'month',
      filters: { ...DEFAULT_FILTERS },
      preferences: { ...DEFAULT_PREFERENCES },
      isLoaded: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // Initial State
  // ============================================
  describe('initial state', () => {
    it('starts with today as selected date', () => {
      const state = useCalendarStore.getState();
      expect(state.selectedDate.toISOString()).toBe(FIXED_NOW.toISOString());
    });

    it('starts in month view', () => {
      expect(useCalendarStore.getState().viewMode).toBe('month');
    });

    it('starts with default filters', () => {
      expect(useCalendarStore.getState().filters).toEqual(DEFAULT_FILTERS);
    });

    it('starts with default preferences', () => {
      expect(useCalendarStore.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('starts not loaded', () => {
      expect(useCalendarStore.getState().isLoaded).toBe(false);
    });

    it('has a visible range set', () => {
      const { visibleRange } = useCalendarStore.getState();
      expect(visibleRange.start).toBeInstanceOf(Date);
      expect(visibleRange.end).toBeInstanceOf(Date);
      expect(visibleRange.start < visibleRange.end).toBe(true);
    });
  });

  // ============================================
  // setSelectedDate
  // ============================================
  describe('setSelectedDate', () => {
    it('updates the selected date', () => {
      const newDate = new Date('2025-08-15');
      useCalendarStore.getState().setSelectedDate(newDate);
      expect(useCalendarStore.getState().selectedDate).toEqual(newDate);
    });

    it('recalculates visible range', () => {
      const rangeBefore = useCalendarStore.getState().visibleRange;
      // Use a date far enough away that the month grid won't overlap
      const octoberDate = new Date(2025, 9, 15); // October 15
      useCalendarStore.getState().setSelectedDate(octoberDate);
      const rangeAfter = useCalendarStore.getState().visibleRange;

      expect(rangeAfter.start).not.toEqual(rangeBefore.start);
    });
  });

  // ============================================
  // setViewMode
  // ============================================
  describe('setViewMode', () => {
    it('changes view mode', () => {
      useCalendarStore.getState().setViewMode('week');
      expect(useCalendarStore.getState().viewMode).toBe('week');
    });

    it('recalculates visible range for new view', () => {
      const monthRange = useCalendarStore.getState().visibleRange;
      useCalendarStore.getState().setViewMode('day');
      const dayRange = useCalendarStore.getState().visibleRange;

      // Day range should be much smaller than month range
      const monthSpan = monthRange.end.getTime() - monthRange.start.getTime();
      const daySpan = dayRange.end.getTime() - dayRange.start.getTime();
      expect(daySpan).toBeLessThan(monthSpan);
    });
  });

  // ============================================
  // Navigation
  // ============================================
  describe('goForward', () => {
    it('moves forward by one month in month view', () => {
      useCalendarStore.getState().goForward();
      expect(useCalendarStore.getState().selectedDate.getMonth()).toBe(7); // August
    });

    it('moves forward by one week in week view', () => {
      useCalendarStore.getState().setViewMode('week');
      useCalendarStore.getState().goForward();
      expect(useCalendarStore.getState().selectedDate.getDate()).toBe(29);
    });

    it('moves forward by one day in day view', () => {
      useCalendarStore.getState().setViewMode('day');
      useCalendarStore.getState().goForward();
      expect(useCalendarStore.getState().selectedDate.getDate()).toBe(23);
    });
  });

  describe('goBackward', () => {
    it('moves backward by one month in month view', () => {
      useCalendarStore.getState().goBackward();
      expect(useCalendarStore.getState().selectedDate.getMonth()).toBe(5); // June
    });

    it('moves backward by one week in week view', () => {
      useCalendarStore.getState().setViewMode('week');
      useCalendarStore.getState().goBackward();
      expect(useCalendarStore.getState().selectedDate.getDate()).toBe(15);
    });
  });

  describe('goToToday', () => {
    it('resets to current date', () => {
      useCalendarStore.getState().setSelectedDate(new Date('2026-01-15'));
      useCalendarStore.getState().goToToday();
      const selected = useCalendarStore.getState().selectedDate;
      expect(selected.toISOString()).toBe(FIXED_NOW.toISOString());
    });

    it('recalculates visible range', () => {
      useCalendarStore.getState().setSelectedDate(new Date('2026-01-15'));
      const farRange = useCalendarStore.getState().visibleRange;
      useCalendarStore.getState().goToToday();
      const todayRange = useCalendarStore.getState().visibleRange;
      expect(todayRange.start).not.toEqual(farRange.start);
    });
  });

  // ============================================
  // Filters
  // ============================================
  describe('setFilter', () => {
    it('merges filter updates', () => {
      useCalendarStore.getState().setFilter({ showCompleted: false });
      expect(useCalendarStore.getState().filters.showCompleted).toBe(false);
      // Other filters should be unchanged
      expect(useCalendarStore.getState().filters.showTimeEntries).toBe(true);
    });

    it('updates sources filter', () => {
      useCalendarStore.getState().setFilter({ sources: ['task', 'time_entry'] });
      expect(useCalendarStore.getState().filters.sources).toEqual(['task', 'time_entry']);
    });

    it('updates area filter', () => {
      useCalendarStore.getState().setFilter({ areas: ['wellfy'] });
      expect(useCalendarStore.getState().filters.areas).toEqual(['wellfy']);
    });
  });

  describe('resetFilters', () => {
    it('resets to default filters', () => {
      useCalendarStore.getState().setFilter({ showCompleted: false, showCronJobs: false });
      useCalendarStore.getState().resetFilters();
      expect(useCalendarStore.getState().filters).toEqual(DEFAULT_FILTERS);
    });
  });

  // ============================================
  // Preferences
  // ============================================
  describe('updatePreferences', () => {
    it('merges preference updates', () => {
      useCalendarStore.getState().updatePreferences({ showWeekNumbers: true });
      expect(useCalendarStore.getState().preferences.showWeekNumbers).toBe(true);
      // Other prefs unchanged
      expect(useCalendarStore.getState().preferences.defaultView).toBe('month');
    });

    it('recalculates visible range when weekStartsOn changes', () => {
      const rangeBefore = useCalendarStore.getState().visibleRange;
      useCalendarStore.getState().updatePreferences({ weekStartsOn: 0 });
      const rangeAfter = useCalendarStore.getState().visibleRange;
      // Range should be different with different week start
      expect(rangeAfter.start.getDay()).toBe(0); // Sunday
    });
  });

  // ============================================
  // initialize
  // ============================================
  describe('initialize', () => {
    it('sets isLoaded to true', () => {
      useCalendarStore.getState().initialize();
      expect(useCalendarStore.getState().isLoaded).toBe(true);
    });

    it('is idempotent', () => {
      useCalendarStore.getState().initialize();
      useCalendarStore.getState().initialize();
      expect(useCalendarStore.getState().isLoaded).toBe(true);
    });
  });
});
