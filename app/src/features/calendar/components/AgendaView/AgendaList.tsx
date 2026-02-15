import { useMemo, useState } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { addDays, eachDayOfInterval, startOfDay, endOfDay } from '../../utils/date-helpers';
import { getEventsForDate, sortEventsByTime } from '../../utils/event-normalizer';
import { AgendaEventRow } from './AgendaEventRow';

type AgendaRange = 7 | 14 | 30;

interface AgendaListProps {
  startDate: Date;
  events: CalendarEvent[];
  initialRange?: AgendaRange;
  onEventClick?: (event: CalendarEvent) => void;
}

export function AgendaList({
  startDate,
  events,
  initialRange = 14,
  onEventClick,
}: AgendaListProps) {
  const [range, setRange] = useState<AgendaRange>(initialRange);

  const days = useMemo(() => {
    const start = startOfDay(startDate);
    const end = endOfDay(addDays(start, range - 1));
    return eachDayOfInterval({ start, end });
  }, [startDate, range]);

  const dayGroups = useMemo(() => {
    return days.map(day => ({
      date: day,
      events: sortEventsByTime(getEventsForDate(events, day)),
    }));
  }, [days, events]);

  const totalEvents = dayGroups.reduce((sum, g) => sum + g.events.length, 0);

  return (
    <div className="flex flex-col h-full" role="list" aria-label="Agenda view">
      {/* Range selector */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <span className="text-sm text-muted-foreground">Show:</span>
        {([7, 14, 30] as AgendaRange[]).map(r => (
          <button
            key={r}
            type="button"
            className={cn(
              'text-xs px-2.5 py-1 rounded-md transition-colors',
              r === range
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setRange(r)}
          >
            {r} days
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          {totalEvents} event{totalEvents !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Day groups */}
      <div className="flex-1 overflow-y-auto">
        {dayGroups.map(({ date, events: dayEvents }) => {
          if (dayEvents.length === 0) return null;

          return (
            <div key={date.toISOString()} role="listitem" className="border-b border-border/50">
              {/* Day header */}
              <div className={cn(
                'sticky top-0 z-10 px-4 py-2',
                'bg-muted/50 backdrop-blur-sm',
                isToday(date) && 'bg-primary/10',
              )}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-semibold text-sm',
                    isToday(date) && 'text-primary',
                  )}>
                    {getDayLabel(date)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(date, 'EEEE')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Events */}
              <div className="px-2 py-1">
                {dayEvents.map(event => (
                  <AgendaEventRow
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {totalEvents === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No events in the next {range} days</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}
