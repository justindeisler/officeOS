import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { EVENT_COLORS } from '../../constants/colors';

interface EventChipProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
}

export function EventChip({ event, compact = false, onClick }: EventChipProps) {
  const colors = EVENT_COLORS[event.source];

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          colors.dot,
          event.isCompleted && 'opacity-50',
        )}
        onClick={() => onClick?.(event)}
        aria-label={event.title}
        title={event.title}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left text-xs px-1.5 py-0.5 rounded truncate',
        'min-h-[20px] leading-tight',
        'hover:opacity-80 transition-opacity cursor-pointer',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        colors.bg,
        colors.text,
        event.isCompleted && 'line-through opacity-50',
        event.isOverdue && 'ring-1 ring-destructive/50',
        event.isRunning && 'animate-pulse',
      )}
      onClick={() => onClick?.(event)}
      title={event.title}
    >
      <span className="truncate">{event.title}</span>
    </button>
  );
}

interface OverflowIndicatorProps {
  count: number;
  onClick?: () => void;
}

export function OverflowIndicator({ count, onClick }: OverflowIndicatorProps) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left text-xs px-1.5 py-0.5',
        'text-muted-foreground hover:text-foreground',
        'transition-colors cursor-pointer',
        'focus:outline-none focus:ring-1 focus:ring-ring rounded',
      )}
      onClick={onClick}
    >
      +{count} more
    </button>
  );
}
