import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { EVENT_COLORS } from '../../constants/colors';
import { formatTime, formatDuration } from '../../utils/date-helpers';

interface AgendaEventRowProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

export function AgendaEventRow({ event, onClick }: AgendaEventRowProps) {
  const colors = EVENT_COLORS[event.source];

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-3 rounded-lg flex items-start gap-3',
        'hover:bg-muted/50 transition-colors min-h-[44px]',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        event.isCompleted && 'opacity-50',
      )}
      onClick={() => onClick?.(event)}
    >
      {/* Color bar */}
      <div className={cn(
        'w-1 self-stretch rounded-full shrink-0 mt-0.5',
        colors.dot,
        event.isCompleted && 'opacity-50',
        event.isOverdue && 'bg-destructive',
        event.isRunning && 'animate-pulse',
      )} />

      {/* Time column */}
      <div className="w-16 shrink-0 text-xs text-muted-foreground pt-0.5">
        {event.isAllDay ? (
          <span>All day</span>
        ) : (
          <>
            <div>{formatTime(event.startDate)}</div>
            {event.endDate && (
              <div>{formatTime(event.endDate)}</div>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium text-sm',
          event.isCompleted && 'line-through',
          event.isOverdue && 'text-destructive',
        )}>
          {event.title}
        </div>

        {event.description && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {event.description}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Source badge */}
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full',
            colors.bg,
            colors.text,
          )}>
            {getSourceLabel(event.source)}
          </span>

          {/* Duration */}
          {event.durationMinutes && (
            <span className="text-[10px] text-muted-foreground">
              {formatDuration(event.durationMinutes)}
            </span>
          )}

          {/* Priority */}
          {event.priority && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full',
              event.priority === 1 && 'bg-red-500/10 text-red-700',
              event.priority === 2 && 'bg-amber-500/10 text-amber-700',
              event.priority === 3 && 'bg-blue-500/10 text-blue-700',
            )}>
              {event.priority === 1 ? 'High' : event.priority === 2 ? 'Medium' : 'Low'}
            </span>
          )}

          {/* Status indicators */}
          {event.isRunning && (
            <span className="text-[10px] text-emerald-600 font-medium">● Running</span>
          )}
          {event.isOverdue && (
            <span className="text-[10px] text-destructive font-medium">Overdue</span>
          )}
        </div>
      </div>
    </button>
  );
}

function getSourceLabel(source: CalendarEvent['source']): string {
  const labels: Record<CalendarEvent['source'], string> = {
    task: 'Task',
    time_entry: 'Time',
    project: 'Project',
    invoice: 'Invoice',
    social_post: 'Social',
    icloud: 'iCloud',
    cron_job: 'Cron',
    agent_activity: 'Agent',
    calendar_event: 'Event',
  };
  return labels[source];
}
