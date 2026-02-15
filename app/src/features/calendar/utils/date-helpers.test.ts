import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMonthGridDates,
  getWeekDates,
  getVisibleRange,
  navigateForward,
  navigateBackward,
  isDateInRange,
  doesEventOverlap,
  isDatePast,
  isOverdue,
  formatViewHeader,
  formatDuration,
  formatTime,
  formatTimeRange,
  generateHourSlots,
  getTimePosition,
  getTimeBlockHeight,
  getWeekNumber,
} from './date-helpers';

// Use a fixed "now" for deterministic tests
const FIXED_NOW = new Date('2025-07-22T10:30:00.000Z');

describe('date-helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // getMonthGridDates
  // ============================================
  describe('getMonthGridDates', () => {
    it('returns dates starting on Monday when weekStartsOn=1', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 1);
      // July 2025: 1st is Tuesday, so grid starts on Monday June 30
      expect(dates[0].getDay()).toBe(1); // Monday
    });

    it('returns dates starting on Sunday when weekStartsOn=0', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 0);
      expect(dates[0].getDay()).toBe(0); // Sunday
    });

    it('returns at least 28 days (4 weeks)', () => {
      const dates = getMonthGridDates(new Date('2025-02-15'), 1);
      expect(dates.length).toBeGreaterThanOrEqual(28);
    });

    it('returns at most 42 days (6 weeks)', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 1);
      expect(dates.length).toBeLessThanOrEqual(42);
    });

    it('includes all days of the target month', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 1);
      // July has 31 days
      const julyDates = dates.filter(d => d.getMonth() === 6); // 0-indexed
      expect(julyDates.length).toBe(31);
    });

    it('includes padding days from adjacent months', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 1);
      const nonJulyDates = dates.filter(d => d.getMonth() !== 6);
      expect(nonJulyDates.length).toBeGreaterThan(0);
    });

    it('returns consecutive dates', () => {
      const dates = getMonthGridDates(new Date('2025-07-15'), 1);
      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i].getTime() - dates[i - 1].getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000); // 1 day in ms
      }
    });
  });

  // ============================================
  // getWeekDates
  // ============================================
  describe('getWeekDates', () => {
    it('returns exactly 7 dates', () => {
      const dates = getWeekDates(new Date('2025-07-22'), 1);
      expect(dates.length).toBe(7);
    });

    it('starts on Monday when weekStartsOn=1', () => {
      const dates = getWeekDates(new Date('2025-07-22'), 1);
      expect(dates[0].getDay()).toBe(1);
    });

    it('starts on Sunday when weekStartsOn=0', () => {
      const dates = getWeekDates(new Date('2025-07-22'), 0);
      expect(dates[0].getDay()).toBe(0);
    });

    it('ends on Sunday when weekStartsOn=1', () => {
      const dates = getWeekDates(new Date('2025-07-22'), 1);
      expect(dates[6].getDay()).toBe(0); // Sunday
    });
  });

  // ============================================
  // getVisibleRange
  // ============================================
  describe('getVisibleRange', () => {
    it('returns month grid range for month view', () => {
      const range = getVisibleRange(new Date('2025-07-15'), 'month', 1);
      expect(range.start.getDay()).toBe(1); // Starts on Monday
      expect(range.end.getDay()).toBe(0);   // Ends on Sunday
    });

    it('returns week range for week view', () => {
      const range = getVisibleRange(new Date('2025-07-22'), 'week', 1);
      expect(range.start.getDay()).toBe(1);
      expect(range.end.getDay()).toBe(0);
    });

    it('returns single day for day view', () => {
      const range = getVisibleRange(new Date('2025-07-22'), 'day', 1);
      expect(range.start.getHours()).toBe(0);
      expect(range.end.getHours()).toBe(23);
    });

    it('returns approximately 14-day range for agenda view', () => {
      const range = getVisibleRange(new Date(2025, 6, 22), 'agenda', 1);
      const diff = Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
      // endOfDay adds ~24h to the last day, so diff is ~14
      expect(diff).toBeGreaterThanOrEqual(13);
      expect(diff).toBeLessThanOrEqual(14);
    });
  });

  // ============================================
  // navigateForward / navigateBackward
  // ============================================
  describe('navigateForward', () => {
    it('moves forward by one month in month view', () => {
      const result = navigateForward(new Date('2025-07-15'), 'month');
      expect(result.getMonth()).toBe(7); // August
    });

    it('moves forward by one week in week view', () => {
      const result = navigateForward(new Date('2025-07-22'), 'week');
      expect(result.getDate()).toBe(29);
    });

    it('moves forward by one day in day view', () => {
      const result = navigateForward(new Date('2025-07-22'), 'day');
      expect(result.getDate()).toBe(23);
    });

    it('moves forward by two weeks in agenda view', () => {
      const result = navigateForward(new Date('2025-07-22'), 'agenda');
      expect(result.getDate()).toBe(5); // Aug 5
      expect(result.getMonth()).toBe(7);
    });
  });

  describe('navigateBackward', () => {
    it('moves backward by one month in month view', () => {
      const result = navigateBackward(new Date('2025-07-15'), 'month');
      expect(result.getMonth()).toBe(5); // June
    });

    it('moves backward by one week in week view', () => {
      const result = navigateBackward(new Date('2025-07-22'), 'week');
      expect(result.getDate()).toBe(15);
    });

    it('moves backward by one day in day view', () => {
      const result = navigateBackward(new Date('2025-07-22'), 'day');
      expect(result.getDate()).toBe(21);
    });

    it('moves backward by two weeks in agenda view', () => {
      const result = navigateBackward(new Date('2025-07-22'), 'agenda');
      expect(result.getDate()).toBe(8);
    });
  });

  // ============================================
  // isDateInRange
  // ============================================
  describe('isDateInRange', () => {
    const start = new Date('2025-07-01');
    const end = new Date('2025-07-31');

    it('returns true for date within range', () => {
      expect(isDateInRange(new Date('2025-07-15'), start, end)).toBe(true);
    });

    it('returns true for start boundary', () => {
      expect(isDateInRange(new Date('2025-07-01'), start, end)).toBe(true);
    });

    it('returns true for end boundary', () => {
      expect(isDateInRange(new Date('2025-07-31'), start, end)).toBe(true);
    });

    it('returns false for date before range', () => {
      expect(isDateInRange(new Date('2025-06-30'), start, end)).toBe(false);
    });

    it('returns false for date after range', () => {
      expect(isDateInRange(new Date('2025-08-01'), start, end)).toBe(false);
    });

    it('accepts string dates', () => {
      expect(isDateInRange('2025-07-15T10:00:00Z', start, end)).toBe(true);
    });
  });

  // ============================================
  // doesEventOverlap
  // ============================================
  describe('doesEventOverlap', () => {
    const rangeStart = new Date('2025-07-21T00:00:00Z');
    const rangeEnd = new Date('2025-07-27T23:59:59Z');

    it('returns true for event fully within range', () => {
      expect(doesEventOverlap('2025-07-22T09:00:00Z', '2025-07-22T11:00:00Z', rangeStart, rangeEnd)).toBe(true);
    });

    it('returns true for event spanning entire range', () => {
      expect(doesEventOverlap('2025-07-20T09:00:00Z', '2025-07-28T11:00:00Z', rangeStart, rangeEnd)).toBe(true);
    });

    it('returns true for event starting before and ending within range', () => {
      expect(doesEventOverlap('2025-07-19T09:00:00Z', '2025-07-23T11:00:00Z', rangeStart, rangeEnd)).toBe(true);
    });

    it('returns true for event starting within and ending after range', () => {
      expect(doesEventOverlap('2025-07-25T09:00:00Z', '2025-07-29T11:00:00Z', rangeStart, rangeEnd)).toBe(true);
    });

    it('returns true for event on the start boundary', () => {
      expect(doesEventOverlap('2025-07-21T09:00:00Z', '2025-07-21T11:00:00Z', rangeStart, rangeEnd)).toBe(true);
    });

    it('returns true for event without end date on a range day', () => {
      expect(doesEventOverlap('2025-07-23T09:00:00Z', undefined, rangeStart, rangeEnd)).toBe(true);
    });

    it('returns false for event entirely before range', () => {
      expect(doesEventOverlap('2025-07-18T09:00:00Z', '2025-07-19T11:00:00Z', rangeStart, rangeEnd)).toBe(false);
    });

    it('returns false for event entirely after range', () => {
      expect(doesEventOverlap('2025-07-29T09:00:00Z', '2025-07-30T11:00:00Z', rangeStart, rangeEnd)).toBe(false);
    });
  });

  // ============================================
  // isDatePast / isOverdue
  // ============================================
  describe('isDatePast', () => {
    it('returns true for yesterday', () => {
      expect(isDatePast('2025-07-21T00:00:00Z')).toBe(true);
    });

    it('returns false for today', () => {
      expect(isDatePast('2025-07-22T00:00:00Z')).toBe(false);
    });

    it('returns false for tomorrow', () => {
      expect(isDatePast('2025-07-23T00:00:00Z')).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('returns true for past due date with incomplete task', () => {
      expect(isOverdue('2025-07-20T00:00:00Z', false)).toBe(true);
    });

    it('returns false for past due date with completed task', () => {
      expect(isOverdue('2025-07-20T00:00:00Z', true)).toBe(false);
    });

    it('returns false for future due date', () => {
      expect(isOverdue('2025-07-25T00:00:00Z', false)).toBe(false);
    });

    it('returns false for undefined due date', () => {
      expect(isOverdue(undefined, false)).toBe(false);
    });
  });

  // ============================================
  // formatViewHeader
  // ============================================
  describe('formatViewHeader', () => {
    it('formats month view as "Month Year"', () => {
      // Use local date to avoid timezone shifting the day
      expect(formatViewHeader(new Date(2025, 6, 15), 'month')).toBe('July 2025');
    });

    it('formats week view as date range within same month', () => {
      const result = formatViewHeader(new Date(2025, 6, 22), 'week', 1);
      expect(result).toBe('Jul 21 – 27, 2025');
    });

    it('formats week view spanning months', () => {
      const result = formatViewHeader(new Date(2025, 6, 30), 'week', 1);
      expect(result).toBe('Jul 28 – Aug 3, 2025');
    });

    it('formats day view as full day name + date', () => {
      const result = formatViewHeader(new Date(2025, 6, 22), 'day');
      expect(result).toBe('Tuesday, July 22, 2025');
    });

    it('formats agenda view as 2-week range', () => {
      const result = formatViewHeader(new Date(2025, 6, 22), 'agenda');
      expect(result).toContain('Jul 22');
      expect(result).toContain('Aug 4');
    });
  });

  // ============================================
  // formatDuration
  // ============================================
  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(30)).toBe('30m');
    });

    it('formats exact hours', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(145)).toBe('2h 25m');
    });
  });

  // ============================================
  // formatTime / formatTimeRange
  // ============================================
  describe('formatTime', () => {
    it('formats ISO string to HH:mm', () => {
      // Note: formatTime uses local timezone. These tests use local Date representations.
      const result = formatTime('2025-07-22T09:30:00Z');
      expect(result).toMatch(/^\d{2}:\d{2}$/); // HH:mm format
    });

    it('formats Date object to HH:mm', () => {
      // Create a date at a known local time
      const date = new Date(2025, 6, 22, 14, 15, 0); // July 22, 2025 14:15 local
      expect(formatTime(date)).toBe('14:15');
    });
  });

  describe('formatTimeRange', () => {
    it('formats start and end times as range', () => {
      // Use local dates to avoid timezone issues
      const start = new Date(2025, 6, 22, 9, 0, 0).toISOString();
      const end = new Date(2025, 6, 22, 11, 30, 0).toISOString();
      expect(formatTimeRange(start, end)).toBe('09:00 – 11:30');
    });
  });

  // ============================================
  // generateHourSlots
  // ============================================
  describe('generateHourSlots', () => {
    it('generates 24 slots for full day', () => {
      expect(generateHourSlots(0, 24)).toHaveLength(24);
    });

    it('generates correct working hours range', () => {
      const slots = generateHourSlots(8, 18);
      expect(slots).toHaveLength(10);
      expect(slots[0]).toBe('08:00');
      expect(slots[9]).toBe('17:00');
    });

    it('pads single-digit hours', () => {
      const slots = generateHourSlots(6, 10);
      expect(slots[0]).toBe('06:00');
      expect(slots[1]).toBe('07:00');
    });
  });

  // ============================================
  // getTimePosition
  // ============================================
  describe('getTimePosition', () => {
    // Use local Date objects to avoid timezone offset issues
    it('returns 0% for start of range', () => {
      const date = new Date(2025, 6, 22, 8, 0, 0); // 08:00 local
      expect(getTimePosition(date, 8, 18)).toBe(0);
    });

    it('returns 100% for end of range', () => {
      const date = new Date(2025, 6, 22, 18, 0, 0); // 18:00 local
      expect(getTimePosition(date, 8, 18)).toBe(100);
    });

    it('returns 50% for midpoint', () => {
      const date = new Date(2025, 6, 22, 13, 0, 0); // 13:00 local
      expect(getTimePosition(date, 8, 18)).toBe(50);
    });

    it('clamps to 0% for times before range', () => {
      const date = new Date(2025, 6, 22, 6, 0, 0); // 06:00 local
      expect(getTimePosition(date, 8, 18)).toBe(0);
    });

    it('clamps to 100% for times after range', () => {
      const date = new Date(2025, 6, 22, 20, 0, 0); // 20:00 local
      expect(getTimePosition(date, 8, 18)).toBe(100);
    });

    it('handles partial hours', () => {
      const date = new Date(2025, 6, 22, 9, 30, 0); // 09:30 local
      const pos = getTimePosition(date, 8, 18);
      expect(pos).toBe(15); // 1.5h / 10h = 15%
    });
  });

  // ============================================
  // getTimeBlockHeight
  // ============================================
  describe('getTimeBlockHeight', () => {
    it('returns correct percentage for 1 hour in 10-hour range', () => {
      expect(getTimeBlockHeight(60, 8, 18)).toBe(10); // 60/600 = 10%
    });

    it('returns correct percentage for 30 minutes', () => {
      expect(getTimeBlockHeight(30, 8, 18)).toBe(5); // 30/600 = 5%
    });

    it('clamps to 100% for very long blocks', () => {
      expect(getTimeBlockHeight(9999, 8, 18)).toBe(100);
    });

    it('returns 0% for 0 minutes', () => {
      expect(getTimeBlockHeight(0, 8, 18)).toBe(0);
    });
  });

  // ============================================
  // getWeekNumber
  // ============================================
  describe('getWeekNumber', () => {
    it('returns correct ISO week number', () => {
      // July 22, 2025 is in week 30
      expect(getWeekNumber(new Date('2025-07-22'))).toBe(30);
    });

    it('handles first week of year', () => {
      expect(getWeekNumber(new Date('2025-01-06'))).toBe(2);
    });
  });
});
