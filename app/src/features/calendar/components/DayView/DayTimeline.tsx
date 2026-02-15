import { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { generateHourSlots, getEventsForDate } from '../../utils/date-helpers';
import { TimeBlock } from '../WeekView/TimeBlock';
import { CurrentTimeIndicator } from '../WeekView/CurrentTimeIndicator';

interface DayTimelineProps {
  date: Date;
  events: CalendarEvent[];
  workingHoursStart?: number;
  workingHoursEnd?: number;
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayTimeline({
  date,
  events,
  workingHoursStart = 0,
  workingHoursEnd = 24,
  onEventClick,
}: DayTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const hourSlots = useMemo(
    () => generateHourSlots(workingHoursStart, workingHoursEnd),
    [workingHoursStart, workingHoursEnd]
  );

  const timedEvents = useMemo(() => {
    const dayEvents = getEventsForDate(events, date);
    return dayEvents.filter(e => !e.isAllDay);
  }, [events, date]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const totalHours = workingHoursEnd - workingHoursStart;
      const scrollPosition =
        ((currentHour - workingHoursStart - 1) / totalHours) * scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [workingHoursStart, workingHoursEnd]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      role="region"
      aria-label="Day timeline"
      data-testid="day-timeline"
    >
      <div className="grid grid-cols-[60px_1fr] min-h-[800px]">
        {/* Hour labels */}
        <div className="relative border-r border-border/50">
          {hourSlots.map(slot => (
            <div
              key={slot}
              className="text-xs text-muted-foreground text-right pr-2 -mt-2"
              style={{ height: `${100 / hourSlots.length}%` }}
            >
              {slot}
            </div>
          ))}
        </div>

        {/* Time blocks area */}
        <div className="relative">
          {/* Hour grid lines */}
          {hourSlots.map((slot, i) => (
            <div
              key={slot}
              className="border-b border-border/30"
              style={{ height: `${100 / hourSlots.length}%` }}
            />
          ))}

          {/* Events */}
          {timedEvents.map(event => (
            <TimeBlock
              key={event.id}
              event={event}
              workingHoursStart={workingHoursStart}
              workingHoursEnd={workingHoursEnd}
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
      </div>
    </div>
  );
}
