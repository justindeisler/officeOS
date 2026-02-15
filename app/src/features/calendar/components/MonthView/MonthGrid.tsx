import { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { getMonthGridDates, isSameDay } from '../../utils/date-helpers';
import { getEventsForDate } from '../../utils/event-normalizer';
import { DayCell } from './DayCell';
import { DayPopover } from './DayPopover';

const WEEKDAY_LABELS_MONDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LABELS_SUNDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthGridProps {
  selectedDate: Date;
  events: CalendarEvent[];
  weekStartsOn?: 0 | 1;
  compact?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function MonthGrid({
  selectedDate,
  events,
  weekStartsOn = 1,
  compact = false,
  onDateClick,
  onEventClick,
}: MonthGridProps) {
  const [popoverDate, setPopoverDate] = useState<Date | null>(null);

  const gridDates = useMemo(
    () => getMonthGridDates(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn]
  );

  const weekdayLabels = weekStartsOn === 1 ? WEEKDAY_LABELS_MONDAY : WEEKDAY_LABELS_SUNDAY;

  const handleDateClick = useCallback((date: Date) => {
    onDateClick?.(date);
  }, [onDateClick]);

  const handleOverflowClick = useCallback((date: Date) => {
    setPopoverDate(prev => prev && isSameDay(prev, date) ? null : date);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setPopoverDate(null);
  }, []);

  return (
    <div role="grid" aria-label={`Calendar for ${format(selectedDate, 'MMMM yyyy')}`}>
      {/* Weekday header */}
      <div role="row" className="grid grid-cols-7 border-b border-border">
        {weekdayLabels.map(label => (
          <div
            key={label}
            role="columnheader"
            className={cn(
              'text-center text-xs font-medium text-muted-foreground py-2',
              (label === 'Sat' || label === 'Sun') && 'text-muted-foreground/60',
            )}
          >
            {compact ? label.charAt(0) : label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {gridDates.map((date, index) => {
          const dayEvents = getEventsForDate(events, date);
          const isSelected = isSameDay(date, selectedDate);
          const hasPopover = popoverDate && isSameDay(date, popoverDate);

          return (
            <div key={date.toISOString()} className="relative" role="row">
              <DayCell
                date={date}
                currentMonth={selectedDate}
                events={dayEvents}
                isSelected={isSelected}
                compact={compact}
                onDateClick={handleDateClick}
                onEventClick={onEventClick}
                onOverflowClick={handleOverflowClick}
              />

              {/* Popover for overflow */}
              {hasPopover && (
                <DayPopover
                  date={date}
                  events={dayEvents}
                  onEventClick={onEventClick}
                  onClose={handlePopoverClose}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
