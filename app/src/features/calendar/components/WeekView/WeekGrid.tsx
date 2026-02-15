import { useMemo, useRef, useEffect } from 'react';
import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { getWeekDates, generateHourSlots } from '../../utils/date-helpers';
import { TimeColumn } from './TimeColumn';
import { AllDayRow } from './AllDayRow';

interface WeekGridProps {
  selectedDate: Date;
  events: CalendarEvent[];
  weekStartsOn?: 0 | 1;
  workingHoursStart?: number;
  workingHoursEnd?: number;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function WeekGrid({
  selectedDate,
  events,
  weekStartsOn = 1,
  workingHoursStart = 0,
  workingHoursEnd = 24,
  onDateClick,
  onEventClick,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(
    () => getWeekDates(selectedDate, weekStartsOn),
    [selectedDate, weekStartsOn]
  );

  const hourSlots = useMemo(
    () => generateHourSlots(workingHoursStart, workingHoursEnd),
    [workingHoursStart, workingHoursEnd]
  );

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

  // Separate timed and all-day events
  const timedEvents = useMemo(
    () => events.filter(e => !e.isAllDay),
    [events]
  );

  return (
    <div className="flex flex-col h-full" role="grid" aria-label="Week view">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-10">
        <div className="p-2" /> {/* Spacer for hour labels */}
        {weekDates.map(date => {
          const today = isToday(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={cn(
                'text-center py-2 border-r border-border/50',
                'hover:bg-muted/50 transition-colors cursor-pointer',
                today && 'bg-primary/5',
              )}
              onClick={() => onDateClick?.(date)}
            >
              <div className="text-xs text-muted-foreground">
                {format(date, 'EEE')}
              </div>
              <div className={cn(
                'text-lg font-semibold w-8 h-8 flex items-center justify-center rounded-full mx-auto',
                today && 'bg-primary text-primary-foreground',
              )}>
                {format(date, 'd')}
              </div>
            </button>
          );
        })}
      </div>

      {/* All-day events row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        <div className="text-xs text-muted-foreground p-1 text-right pr-2 border-r border-border/50">
          All day
        </div>
        <div className="col-span-7">
          <AllDayRow dates={weekDates} events={events} onEventClick={onEventClick} />
        </div>
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="week-scroll-container">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[800px]">
          {/* Hour labels column */}
          <div className="relative border-r border-border/50">
            {hourSlots.map((slot, i) => (
              <div
                key={slot}
                className="text-xs text-muted-foreground text-right pr-2 -mt-2"
                style={{ height: `${100 / hourSlots.length}%` }}
              >
                {slot}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map(date => (
            <TimeColumn
              key={date.toISOString()}
              date={date}
              events={timedEvents}
              workingHoursStart={workingHoursStart}
              workingHoursEnd={workingHoursEnd}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
