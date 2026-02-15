import { create } from 'zustand';
import type {
  CalendarViewMode,
  CalendarFilters,
  CalendarPreferences,
} from '../types';
import { DEFAULT_FILTERS, DEFAULT_PREFERENCES } from '../types';
import {
  navigateForward,
  navigateBackward,
  getVisibleRange,
} from '../utils/date-helpers';

export interface CalendarState {
  // View state
  selectedDate: Date;
  viewMode: CalendarViewMode;
  visibleRange: { start: Date; end: Date };

  // Filters
  filters: CalendarFilters;

  // Preferences
  preferences: CalendarPreferences;

  // UI state
  isLoaded: boolean;

  // Actions
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  goForward: () => void;
  goBackward: () => void;
  goToToday: () => void;
  setFilter: (filter: Partial<CalendarFilters>) => void;
  resetFilters: () => void;
  updatePreferences: (prefs: Partial<CalendarPreferences>) => void;
  initialize: () => void;
}

function calculateVisibleRange(date: Date, viewMode: CalendarViewMode, weekStartsOn: 0 | 1) {
  return getVisibleRange(date, viewMode, weekStartsOn);
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  selectedDate: new Date(),
  viewMode: 'month' as CalendarViewMode,
  visibleRange: calculateVisibleRange(new Date(), 'month', 1),
  filters: { ...DEFAULT_FILTERS },
  preferences: { ...DEFAULT_PREFERENCES },
  isLoaded: false,

  setSelectedDate: (date: Date) => {
    const { viewMode, preferences } = get();
    set({
      selectedDate: date,
      visibleRange: calculateVisibleRange(date, viewMode, preferences.weekStartsOn),
    });
  },

  setViewMode: (mode: CalendarViewMode) => {
    const { selectedDate, preferences } = get();
    set({
      viewMode: mode,
      visibleRange: calculateVisibleRange(selectedDate, mode, preferences.weekStartsOn),
    });
  },

  goForward: () => {
    const { selectedDate, viewMode, preferences } = get();
    const newDate = navigateForward(selectedDate, viewMode);
    set({
      selectedDate: newDate,
      visibleRange: calculateVisibleRange(newDate, viewMode, preferences.weekStartsOn),
    });
  },

  goBackward: () => {
    const { selectedDate, viewMode, preferences } = get();
    const newDate = navigateBackward(selectedDate, viewMode);
    set({
      selectedDate: newDate,
      visibleRange: calculateVisibleRange(newDate, viewMode, preferences.weekStartsOn),
    });
  },

  goToToday: () => {
    const { viewMode, preferences } = get();
    const today = new Date();
    set({
      selectedDate: today,
      visibleRange: calculateVisibleRange(today, viewMode, preferences.weekStartsOn),
    });
  },

  setFilter: (filter: Partial<CalendarFilters>) => {
    const { filters } = get();
    set({ filters: { ...filters, ...filter } });
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
  },

  updatePreferences: (prefs: Partial<CalendarPreferences>) => {
    const { preferences, selectedDate, viewMode } = get();
    const newPrefs = { ...preferences, ...prefs };
    const updates: Partial<CalendarState> = { preferences: newPrefs };

    // Recalculate visible range if weekStartsOn changed
    if (prefs.weekStartsOn !== undefined && prefs.weekStartsOn !== preferences.weekStartsOn) {
      updates.visibleRange = calculateVisibleRange(selectedDate, viewMode, newPrefs.weekStartsOn);
    }

    set(updates);
  },

  initialize: () => {
    if (get().isLoaded) return;
    set({ isLoaded: true });
  },
}));
