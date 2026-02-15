import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import type { CalendarEvent } from '../../types';
import { getEventsForDate } from '../../utils/event-normalizer';
import { TimeBlock } from './TimeBlock';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';

interface TimeColumnProps {
  date: Date;
  events: CalendarEvent[];
  workingHoursStart?: number;
  workingHoursEnd?: number;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * A single day column in the week view showing timed events.
 */
export function TimeColumn({
  date,
  events,
  workingHoursStart = 0,
  workingHoursEnd = 24,
  onEventClick,
}: TimeColumnProps) {
  const today = isToday(date);

  // Get timed events (non-all-day) for this day
  const timedEvents = useMemo(() => {
    const dayEvents = getEventsForDate(events, date);
    return dayEvents.filter(e => !e.isAllDay);
  }, [events, date]);

  // Simple overlap detection: assign column indices
  const positionedEvents = useMemo(() => {
    return assignEventColumns(timedEvents);
  }, [timedEvents]);

  return (
    <div
      className={cn(
        'relative border-r border-border/50 min-h-full',
        today && 'bg-primary/[0.02]',
      )}
      aria-label={`${format(date, 'EEEE, MMMM d')}`}
    >
      {/* Hour grid lines */}
      {Array.from({ length: workingHoursEnd - workingHoursStart }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/30"
          style={{ height: `${100 / (workingHoursEnd - workingHoursStart)}%` }}
        />
      ))}

      {/* Time blocks */}
      {positionedEvents.map(({ event, columnIndex, totalColumns }) => (
        <TimeBlock
          key={event.id}
          event={event}
          workingHoursStart={workingHoursStart}
          workingHoursEnd={workingHoursEnd}
          columnIndex={columnIndex}
          totalColumns={totalColumns}
          onClick={onEventClick}
        />
      ))}

      {/* Current time indicator */}
      <CurrentTimeIndicator
        date={date}
        workingHoursStart={workingHoursStart}
        workingHoursEnd={workingHoursEnd}
      />
    </div>
  );
}

interface PositionedEvent {
  event: CalendarEvent;
  columnIndex: number;
  totalColumns: number;
}

/**
 * Simple overlap detection: assigns column index to overlapping events.
 */
function assignEventColumns(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  // Sort by start time
  const sorted = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const positioned: PositionedEvent[] = [];
  const groups: CalendarEvent[][] = [];

  // Group overlapping events
  let currentGroup: CalendarEvent[] = [];
  let groupEnd = 0;

  for (const event of sorted) {
    const eventStart = new Date(event.startDate).getTime();
    const eventEnd = event.endDate
      ? new Date(event.endDate).getTime()
      : eventStart + (event.durationMinutes || 30) * 60000;

    if (currentGroup.length === 0 || eventStart < groupEnd) {
      currentGroup.push(event);
      groupEnd = Math.max(groupEnd, eventEnd);
    } else {
      groups.push(currentGroup);
      currentGroup = [event];
      groupEnd = eventEnd;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Assign columns within each group
  for (const group of groups) {
    const totalColumns = group.length;
    group.forEach((event, index) => {
      positioned.push({ event, columnIndex: index, totalColumns });
    });
  }

  return positioned;
}
