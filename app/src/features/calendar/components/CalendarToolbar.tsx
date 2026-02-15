import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Clock, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarViewMode } from '../types';
import { formatViewHeader } from '../utils/date-helpers';

interface CalendarToolbarProps {
  selectedDate: Date;
  viewMode: CalendarViewMode;
  weekStartsOn?: 0 | 1;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onNavigateForward: () => void;
  onNavigateBackward: () => void;
  onGoToToday: () => void;
}

const VIEW_MODE_OPTIONS: { mode: CalendarViewMode; label: string; icon: typeof CalendarIcon }[] = [
  { mode: 'month', label: 'Month', icon: LayoutGrid },
  { mode: 'week', label: 'Week', icon: CalendarDays },
  { mode: 'day', label: 'Day', icon: Clock },
  { mode: 'agenda', label: 'Agenda', icon: List },
];

export function CalendarToolbar({
  selectedDate,
  viewMode,
  weekStartsOn = 1,
  onViewModeChange,
  onNavigateForward,
  onNavigateBackward,
  onGoToToday,
}: CalendarToolbarProps) {
  const headerText = formatViewHeader(selectedDate, viewMode, weekStartsOn);

  return (
    <div
      className="flex items-center justify-between gap-4 p-3 border-b border-border flex-wrap"
      role="toolbar"
      aria-label="Calendar navigation"
    >
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onGoToToday}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md',
            'border border-border hover:bg-muted transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring',
          )}
          aria-label="Go to today"
        >
          Today
        </button>

        <div className="flex items-center">
          <button
            type="button"
            onClick={onNavigateBackward}
            className={cn(
              'p-1.5 rounded-md hover:bg-muted transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNavigateForward}
            className={cn(
              'p-1.5 rounded-md hover:bg-muted transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <h1 className="text-lg font-semibold whitespace-nowrap" aria-live="polite">
          {headerText}
        </h1>
      </div>

      {/* Right: View mode selector */}
      <div
        className="flex items-center border border-border rounded-lg overflow-hidden"
        role="tablist"
        aria-label="Calendar view"
      >
        {VIEW_MODE_OPTIONS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={viewMode === mode}
            className={cn(
              'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
              viewMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => onViewModeChange(mode)}
          >
            <Icon className="w-3.5 h-3.5 hidden sm:block" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
