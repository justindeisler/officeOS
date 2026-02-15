import { cn } from '@/lib/utils';
import type { CalendarEvent } from '../../types';
import { EVENT_COLORS } from '../../constants/colors';
import { getTimePosition, getTimeBlockHeight, formatTime, formatDuration } from '../../utils/date-helpers';

interface TimeBlockProps {
  event: CalendarEvent;
  workingHoursStart?: number;
  workingHoursEnd?: number;
  columnIndex?: number;
  totalColumns?: number;
  onClick?: (event: CalendarEvent) => void;
}

export function TimeBlock({
  event,
  workingHoursStart = 0,
  workingHoursEnd = 24,
  columnIndex = 0,
  totalColumns = 1,
  onClick,
}: TimeBlockProps) {
  const colors = EVENT_COLORS[event.source];
  const top = getTimePosition(event.startDate, workingHoursStart, workingHoursEnd);
  const height = event.durationMinutes
    ? getTimeBlockHeight(event.durationMinutes, workingHoursStart, workingHoursEnd)
    : getTimeBlockHeight(30, workingHoursStart, workingHoursEnd); // Default 30min

  const width = totalColumns > 1 ? `${100 / totalColumns}%` : '100%';
  const left = totalColumns > 1 ? `${(columnIndex / totalColumns) * 100}%` : '0';

  return (
    <button
      type="button"
      className={cn(
        'absolute rounded-md px-1.5 py-0.5 text-xs overflow-hidden',
        'border-l-2 cursor-pointer transition-opacity',
        'hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-ring',
        colors.bg,
        colors.border,
        colors.text,
        event.isCompleted && 'opacity-50',
        event.isRunning && 'animate-pulse',
      )}
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 1.5)}%`,
        width,
        left,
      }}
      onClick={() => onClick?.(event)}
      title={event.title}
      aria-label={`${event.title}, ${formatTime(event.startDate)}${event.endDate ? ` to ${formatTime(event.endDate)}` : ''}`}
    >
      <div className="font-medium truncate leading-tight">{event.title}</div>
      {event.durationMinutes && event.durationMinutes >= 30 && (
        <div className="text-[10px] opacity-70 truncate">
          {formatTime(event.startDate)}
          {event.endDate && ` – ${formatTime(event.endDate)}`}
        </div>
      )}
      {event.durationMinutes && event.durationMinutes >= 45 && (
        <div className="text-[10px] opacity-60">
          {formatDuration(event.durationMinutes)}
        </div>
      )}
    </button>
  );
}
