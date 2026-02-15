import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../types';
import { EVENT_COLORS } from '../constants/colors';
import { formatTime, formatDuration, formatTimeRange } from '../utils/date-helpers';

interface EventDetailPopoverProps {
  event: CalendarEvent;
  onClose?: () => void;
  onNavigateToSource?: (event: CalendarEvent) => void;
}

export function EventDetailPopover({ event, onClose, onNavigateToSource }: EventDetailPopoverProps) {
  const colors = EVENT_COLORS[event.source];

  return (
    <div
      role="dialog"
      aria-label={`Event details: ${event.title}`}
      className={cn(
        'w-80 bg-popover border border-border rounded-lg shadow-lg',
        'p-4 space-y-3',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={cn('w-3 h-3 rounded-full shrink-0 mt-1', colors.dot)} />
          <div className="min-w-0">
            <h3 className={cn(
              'font-semibold text-sm',
              event.isCompleted && 'line-through opacity-60',
              event.isOverdue && 'text-destructive',
            )}>
              {event.title}
            </h3>
            <span className={cn('text-xs', colors.text)}>
              {getSourceLabel(event.source)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm p-1 rounded hover:bg-muted transition-colors shrink-0"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Time info */}
      <div className="text-sm space-y-1">
        {event.isAllDay ? (
          <div className="text-muted-foreground">
            All day — {format(new Date(event.startDate), 'MMMM d, yyyy')}
          </div>
        ) : (
          <div className="text-muted-foreground">
            {format(new Date(event.startDate), 'MMM d, yyyy')} • {formatTime(event.startDate)}
            {event.endDate && ` – ${formatTime(event.endDate)}`}
          </div>
        )}
        {event.durationMinutes && (
          <div className="text-xs text-muted-foreground">
            Duration: {formatDuration(event.durationMinutes)}
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {event.description}
        </p>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-1.5">
        {event.area && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {event.area}
          </span>
        )}
        {event.priority && (
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full',
            event.priority === 1 && 'bg-red-500/10 text-red-700',
            event.priority === 2 && 'bg-amber-500/10 text-amber-700',
            event.priority === 3 && 'bg-blue-500/10 text-blue-700',
          )}>
            P{event.priority}
          </span>
        )}
        {event.isRunning && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 animate-pulse">
            ● Running
          </span>
        )}
        {event.isOverdue && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
            Overdue
          </span>
        )}
        {event.agentName && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700">
            🤖 {event.agentName}
          </span>
        )}
        {event.cronFrequency && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700">
            ⚙️ {event.cronFrequency}
          </span>
        )}
      </div>

      {/* Action */}
      <div className="pt-2 border-t border-border/50">
        <button
          type="button"
          onClick={() => onNavigateToSource?.(event)}
          className={cn(
            'w-full text-center text-sm py-1.5 rounded-md',
            'bg-primary/10 text-primary hover:bg-primary/20 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring',
          )}
        >
          Open {getSourceLabel(event.source)}
        </button>
      </div>
    </div>
  );
}

function getSourceLabel(source: CalendarEvent['source']): string {
  const labels: Record<CalendarEvent['source'], string> = {
    task: 'Task',
    time_entry: 'Time Entry',
    project: 'Project',
    invoice: 'Invoice',
    social_post: 'Social Post',
    icloud: 'iCloud Event',
    cron_job: 'Automation',
    agent_activity: 'Agent Activity',
    calendar_event: 'Calendar Event',
  };
  return labels[source];
}
