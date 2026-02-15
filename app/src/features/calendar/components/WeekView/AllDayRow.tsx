import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { EVENT_COLORS } from '../../constants/colors';

interface AllDayRowProps {
  dates: Date[];
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * Row at the top of the week view showing all-day events (tasks, milestones).
 */
export function AllDayRow({ dates, events, onEventClick }: AllDayRowProps) {
  // Filter to only all-day events
  const allDayEvents = events.filter(e => e.isAllDay);

  if (allDayEvents.length === 0) return null;

  return (
    <div className="border-b border-border" role="row" aria-label="All-day events">
      <div className="grid grid-cols-7 min-h-[32px]">
        {dates.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const dayEvents = allDayEvents.filter(e => {
            const eventDate = e.startDate.split('T')[0];
            if (eventDate === dateStr) return true;
            if (e.endDate) {
              const endDate = e.endDate.split('T')[0];
              return eventDate <= dateStr && endDate >= dateStr;
            }
            return false;
          });

          return (
            <div key={dateStr} className="px-0.5 py-0.5 border-r border-border/50 space-y-0.5">
              {dayEvents.map(event => (
                <AllDayChip key={event.id} event={event} onClick={onEventClick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AllDayChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

function AllDayChip({ event, onClick }: AllDayChipProps) {
  const colors = EVENT_COLORS[event.source];

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left text-[11px] px-1 py-0.5 rounded truncate',
        'hover:opacity-80 transition-opacity cursor-pointer',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        colors.bg,
        colors.text,
        event.isCompleted && 'line-through opacity-50',
        event.isOverdue && 'ring-1 ring-destructive/50',
      )}
      onClick={() => onClick?.(event)}
      title={event.title}
    >
      {event.title}
    </button>
  );
}
