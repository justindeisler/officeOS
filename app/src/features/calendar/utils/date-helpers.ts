import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  differenceInMinutes,
  differenceInDays,
  format,
  parseISO,
  isToday,
  isBefore,
  isAfter,
  getWeek,
  eachDayOfInterval,
  setHours,
  setMinutes,
} from 'date-fns';
import type { CalendarViewMode } from '../types';

// ============================================
// Calendar Grid Helpers
// ============================================

/**
 * Get the 42-cell grid dates for a month view (6 weeks × 7 days).
 * Always starts on the configured weekStartsOn day.
 */
export function getMonthGridDates(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * Get the dates for a week view.
 */
export function getWeekDates(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn });
  const weekEnd = endOfWeek(date, { weekStartsOn });
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/**
 * Get the visible date range for a given view mode.
 */
export function getVisibleRange(
  date: Date,
  viewMode: CalendarViewMode,
  weekStartsOn: 0 | 1 = 1
): { start: Date; end: Date } {
  switch (viewMode) {
    case 'month': {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      return {
        start: startOfWeek(monthStart, { weekStartsOn }),
        end: endOfWeek(monthEnd, { weekStartsOn }),
      };
    }
    case 'week':
      return {
        start: startOfWeek(date, { weekStartsOn }),
        end: endOfWeek(date, { weekStartsOn }),
      };
    case 'day':
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    case 'agenda':
      return {
        start: startOfDay(date),
        end: endOfDay(addDays(date, 13)), // 14 days forward
      };
  }
}

// ============================================
// Navigation Helpers
// ============================================

/**
 * Navigate to the next period based on view mode.
 */
export function navigateForward(date: Date, viewMode: CalendarViewMode): Date {
  switch (viewMode) {
    case 'month':
      return addMonths(date, 1);
    case 'week':
      return addWeeks(date, 1);
    case 'day':
      return addDays(date, 1);
    case 'agenda':
      return addWeeks(date, 2);
  }
}

/**
 * Navigate to the previous period based on view mode.
 */
export function navigateBackward(date: Date, viewMode: CalendarViewMode): Date {
  switch (viewMode) {
    case 'month':
      return subMonths(date, 1);
    case 'week':
      return subWeeks(date, 1);
    case 'day':
      return subDays(date, 1);
    case 'agenda':
      return subWeeks(date, 2);
  }
}

// ============================================
// Date Comparison Helpers
// ============================================

/**
 * Check if a date falls within a given range (inclusive).
 */
export function isDateInRange(date: Date | string, start: Date, end: Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isWithinInterval(d, { start, end });
}

/**
 * Check if an event (with start/end) overlaps with a date range.
 */
export function doesEventOverlap(
  eventStart: string,
  eventEnd: string | undefined,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const eStart = parseISO(eventStart);
  const eEnd = eventEnd ? parseISO(eventEnd) : eStart;

  return (
    isBefore(eStart, rangeEnd) &&
    isAfter(eEnd, rangeStart)
  ) || (
    isSameDay(eStart, rangeStart) || isSameDay(eStart, rangeEnd)
  );
}

/**
 * Check if a date is in the past (before today).
 */
export function isDatePast(date: string): boolean {
  return isBefore(parseISO(date), startOfDay(new Date()));
}

/**
 * Check if a date is overdue (past due and not completed).
 */
export function isOverdue(dueDate: string | undefined, isCompleted: boolean): boolean {
  if (!dueDate || isCompleted) return false;
  return isDatePast(dueDate);
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format a date for display in the toolbar header.
 */
export function formatViewHeader(date: Date, viewMode: CalendarViewMode, weekStartsOn: 0 | 1 = 1): string {
  switch (viewMode) {
    case 'month':
      return format(date, 'MMMM yyyy');
    case 'week': {
      const weekStart = startOfWeek(date, { weekStartsOn });
      const weekEnd = endOfWeek(date, { weekStartsOn });
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    case 'day':
      return format(date, 'EEEE, MMMM d, yyyy');
    case 'agenda':
      return `${format(date, 'MMM d')} – ${format(addDays(date, 13), 'MMM d, yyyy')}`;
  }
}

/**
 * Format duration in minutes to human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format a time string for display (e.g., "09:00").
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

/**
 * Format a time range (e.g., "09:00 – 11:30").
 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// ============================================
// Hour Slot Helpers
// ============================================

/**
 * Generate hour slot labels for the time grid.
 */
export function generateHourSlots(startHour: number = 0, endHour: number = 24): string[] {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

/**
 * Calculate the top position (percentage) of a time within the day grid.
 */
export function getTimePosition(
  time: string | Date,
  workingHoursStart: number = 0,
  workingHoursEnd: number = 24
): number {
  const d = typeof time === 'string' ? parseISO(time) : time;
  const hours = d.getHours() + d.getMinutes() / 60;
  const totalHours = workingHoursEnd - workingHoursStart;
  const position = ((hours - workingHoursStart) / totalHours) * 100;
  return Math.max(0, Math.min(100, position));
}

/**
 * Calculate the height (percentage) of a time block in the day grid.
 */
export function getTimeBlockHeight(
  durationMinutes: number,
  workingHoursStart: number = 0,
  workingHoursEnd: number = 24
): number {
  const totalMinutes = (workingHoursEnd - workingHoursStart) * 60;
  return Math.max(0, Math.min(100, (durationMinutes / totalMinutes) * 100));
}

// ============================================
// Week Number Helper
// ============================================

/**
 * Get ISO week number for a date.
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1 });
}

// Re-export commonly used date-fns functions for convenience
export {
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  isAfter,
  parseISO,
  format,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInMinutes,
  differenceInDays,
  eachDayOfInterval,
};
