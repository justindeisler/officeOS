import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { EVENT_COLORS } from '../../constants/colors';
import { formatTime, formatDuration } from '../../utils/date-helpers';

interface DayPopoverProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onClose?: () => void;
}

export function DayPopover({ date, events, onEventClick, onClose }: DayPopoverProps) {
  return (
    <div
      role="dialog"
      aria-label={`Events for ${format(date, 'MMMM d, yyyy')}`}
      className={cn(
        'absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg',
        'p-3 space-y-2',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {format(date, 'EEEE, MMMM d')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm p-1 rounded hover:bg-muted transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No events</p>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {events.map(event => (
            <DayPopoverEvent
              key={event.id}
              event={event}
              onClick={() => onEventClick?.(event)}
            />
          ))}
        </div>
      )}

      {/* Event count */}
      {events.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

interface DayPopoverEventProps {
  event: CalendarEvent;
  onClick?: () => void;
}

function DayPopoverEvent({ event, onClick }: DayPopoverEventProps) {
  const colors = EVENT_COLORS[event.source];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded-md text-sm',
        'hover:bg-muted/80 transition-colors',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        'flex items-start gap-2',
        event.isCompleted && 'opacity-50',
      )}
    >
      {/* Color indicator */}
      <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', colors.dot)} />

      <div className="min-w-0 flex-1">
        <div className={cn(
          'font-medium truncate',
          event.isCompleted && 'line-through',
          event.isOverdue && 'text-destructive',
        )}>
          {event.title}
        </div>

        {/* Time info */}
        {!event.isAllDay && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatTime(event.startDate)}
            {event.endDate && ` – ${formatTime(event.endDate)}`}
            {event.durationMinutes && ` (${formatDuration(event.durationMinutes)})`}
          </div>
        )}

        {/* Source badge */}
        <div className={cn('text-xs mt-0.5', colors.text)}>
          {getSourceLabel(event.source)}
          {event.isRunning && ' • Running'}
          {event.isOverdue && ' • Overdue'}
        </div>
      </div>
    </button>
  );
}

function getSourceLabel(source: CalendarEvent['source']): string {
  const labels: Record<CalendarEvent['source'], string> = {
    task: 'Task',
    time_entry: 'Time Entry',
    project: 'Project',
    invoice: 'Invoice',
    social_post: 'Social Post',
    icloud: 'iCloud',
    cron_job: 'Automation',
    agent_activity: 'Agent',
    calendar_event: 'Event',
  };
  return labels[source];
}
