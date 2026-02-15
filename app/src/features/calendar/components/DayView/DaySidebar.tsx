import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { getEventsForDate } from '../../utils/event-normalizer';
import { formatDuration } from '../../utils/date-helpers';
import { EVENT_COLORS } from '../../constants/colors';

interface DaySidebarProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

export function DaySidebar({ date, events, onEventClick }: DaySidebarProps) {
  const dayEvents = useMemo(() => getEventsForDate(events, date), [events, date]);

  const tasks = dayEvents.filter(e => e.source === 'task');
  const completedTasks = tasks.filter(e => e.isCompleted);
  const overdueTasks = tasks.filter(e => e.isOverdue);

  const totalTrackedMinutes = dayEvents
    .filter(e => e.source === 'time_entry' && !e.isRunning)
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  const runningEntry = dayEvents.find(e => e.isRunning);

  return (
    <aside className="w-72 border-l border-border p-4 space-y-6 overflow-y-auto" aria-label="Day details sidebar">
      {/* Date header */}
      <div>
        <h2 className="font-semibold text-lg">{format(date, 'EEEE')}</h2>
        <p className="text-sm text-muted-foreground">{format(date, 'MMMM d, yyyy')}</p>
      </div>

      {/* Daily stats */}
      <div className="space-y-2" aria-label="Daily statistics">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Stats</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Time tracked" value={formatDuration(totalTrackedMinutes)} />
          <StatCard label="Tasks due" value={`${tasks.length}`} />
          <StatCard label="Completed" value={`${completedTasks.length}`} />
          {overdueTasks.length > 0 && (
            <StatCard label="Overdue" value={`${overdueTasks.length}`} variant="destructive" />
          )}
        </div>
      </div>

      {/* Running timer */}
      {runningEntry && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Timer</h3>
          <button
            type="button"
            onClick={() => onEventClick?.(runningEntry)}
            className={cn(
              'w-full text-left p-3 rounded-lg border animate-pulse',
              'bg-emerald-500/10 border-emerald-500/30',
              'hover:bg-emerald-500/20 transition-colors',
            )}
          >
            <div className="font-medium text-sm text-emerald-700 dark:text-emerald-400">
              {runningEntry.title}
            </div>
            {runningEntry.durationMinutes && (
              <div className="text-xs text-emerald-600/70 mt-1">
                {formatDuration(runningEntry.durationMinutes)} running
              </div>
            )}
          </button>
        </div>
      )}

      {/* Tasks due today */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tasks Due</h3>
          <div className="space-y-1">
            {tasks.map(task => (
              <TaskItem key={task.id} event={task} onClick={() => onEventClick?.(task)} />
            ))}
          </div>
        </div>
      )}

      {/* All events summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          All Events ({dayEvents.length})
        </h3>
        <div className="space-y-1">
          {dayEvents.map(event => (
            <EventSummaryItem key={event.id} event={event} onClick={() => onEventClick?.(event)} />
          ))}
          {dayEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">No events today</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, variant }: { label: string; value: string; variant?: 'destructive' }) {
  return (
    <div className={cn(
      'p-2 rounded-md text-center',
      variant === 'destructive' ? 'bg-destructive/10' : 'bg-muted/50',
    )}>
      <div className={cn(
        'text-lg font-bold',
        variant === 'destructive' && 'text-destructive',
      )}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TaskItem({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const colors = EVENT_COLORS[event.source];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded-md text-sm flex items-center gap-2',
        'hover:bg-muted/50 transition-colors',
        event.isCompleted && 'opacity-50',
      )}
    >
      <div className={cn(
        'w-3 h-3 rounded-sm border-2 shrink-0',
        event.isCompleted ? 'bg-primary border-primary' : 'border-muted-foreground',
      )} />
      <span className={cn(
        'truncate flex-1',
        event.isCompleted && 'line-through',
        event.isOverdue && 'text-destructive',
      )}>
        {event.title}
      </span>
    </button>
  );
}

function EventSummaryItem({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const colors = EVENT_COLORS[event.source];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2',
        'hover:bg-muted/50 transition-colors',
        event.isCompleted && 'opacity-50',
      )}
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', colors.dot)} />
      <span className="truncate">{event.title}</span>
    </button>
  );
}
