import { cn } from '@/lib/utils';
import { isToday, isSameMonth } from '../../utils/date-helpers';
import type { CalendarEvent } from '../../types';
import { EventChip, OverflowIndicator } from './EventChip';

const MAX_VISIBLE_EVENTS = 3;

interface DayCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  isSelected?: boolean;
  compact?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onOverflowClick?: (date: Date) => void;
}

export function DayCell({
  date,
  currentMonth,
  events,
  isSelected = false,
  compact = false,
  onDateClick,
  onEventClick,
  onOverflowClick,
}: DayCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);
  const overflowCount = Math.max(0, events.length - MAX_VISIBLE_EVENTS);
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
  const dayNumber = date.getDate();

  return (
    <div
      role="gridcell"
      aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${events.length > 0 ? `, ${events.length} event${events.length !== 1 ? 's' : ''}` : ''}`}
      aria-selected={isSelected}
      className={cn(
        'relative min-h-[80px] p-1 border-b border-r border-border/50',
        'transition-colors cursor-pointer',
        'hover:bg-muted/50',
        !inMonth && 'bg-muted/20',
        isSelected && 'bg-primary/5 ring-1 ring-primary/30',
        today && 'bg-primary/5',
      )}
      onClick={() => onDateClick?.(date)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDateClick?.(date);
        }
      }}
    >
      {/* Day number */}
      <div className="flex items-center justify-center mb-1">
        <span
          className={cn(
            'text-sm w-7 h-7 flex items-center justify-center rounded-full',
            today && 'bg-primary text-primary-foreground font-bold',
            !inMonth && !today && 'text-muted-foreground',
            inMonth && !today && 'text-foreground',
          )}
        >
          {dayNumber}
        </span>
      </div>

      {/* Events */}
      <div className="space-y-0.5">
        {compact ? (
          // Mobile: show dots only
          events.length > 0 && (
            <div className="flex items-center justify-center gap-0.5 flex-wrap">
              {events.slice(0, 4).map(event => (
                <EventChip
                  key={event.id}
                  event={event}
                  compact
                  onClick={onEventClick}
                />
              ))}
              {events.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{events.length - 4}</span>
              )}
            </div>
          )
        ) : (
          // Desktop: show chips
          <>
            {visibleEvents.map(event => (
              <EventChip
                key={event.id}
                event={event}
                onClick={onEventClick}
              />
            ))}
            <OverflowIndicator
              count={overflowCount}
              onClick={() => onOverflowClick?.(date)}
            />
          </>
        )}
      </div>
    </div>
  );
}
