import { useState } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEventSource, CalendarFilters } from '../types';
import { EVENT_COLORS } from '../constants/colors';

interface FilterDropdownProps {
  filters: CalendarFilters;
  onFilterChange: (filters: Partial<CalendarFilters>) => void;
}

const SOURCE_OPTIONS: { source: CalendarEventSource; label: string }[] = [
  { source: 'task', label: 'Tasks' },
  { source: 'time_entry', label: 'Time Entries' },
  { source: 'project', label: 'Projects' },
  { source: 'invoice', label: 'Invoices' },
  { source: 'social_post', label: 'Social Posts' },
  { source: 'icloud', label: 'iCloud' },
  { source: 'cron_job', label: 'Automations' },
  { source: 'agent_activity', label: 'Agent Activity' },
  { source: 'calendar_event', label: 'Calendar Events' },
];

export function FilterDropdown({ filters, onFilterChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = SOURCE_OPTIONS.filter(
    opt => !filters.sources.includes(opt.source)
  ).length + (filters.showCompleted ? 0 : 1);

  const toggleSource = (source: CalendarEventSource) => {
    const current = filters.sources;
    const newSources = current.includes(source)
      ? current.filter(s => s !== source)
      : [...current, source];
    onFilterChange({ sources: newSources });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
          'border border-border hover:bg-muted transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          activeFilterCount > 0 && 'border-primary/50 text-primary',
        )}
        aria-label="Filter events"
        aria-expanded={isOpen}
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Filter</span>
        {activeFilterCount > 0 && (
          <span className="text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            data-testid="filter-backdrop"
          />

          {/* Dropdown */}
          <div
            className={cn(
              'absolute right-0 top-full mt-1 z-50',
              'w-64 bg-popover border border-border rounded-lg shadow-lg',
              'p-3 space-y-3',
            )}
            role="dialog"
            aria-label="Event filters"
          >
            <h3 className="text-sm font-medium">Event Sources</h3>

            <div className="space-y-1">
              {SOURCE_OPTIONS.map(({ source, label }) => {
                const colors = EVENT_COLORS[source];
                const isActive = filters.sources.includes(source);

                return (
                  <label
                    key={source}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded-md cursor-pointer',
                      'hover:bg-muted/50 transition-colors',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleSource(source)}
                      className="rounded border-muted-foreground"
                    />
                    <div className={cn('w-2.5 h-2.5 rounded-full', colors.dot)} />
                    <span className="text-sm">{label}</span>
                  </label>
                );
              })}
            </div>

            <hr className="border-border/50" />

            <label className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                checked={filters.showCompleted}
                onChange={() => onFilterChange({ showCompleted: !filters.showCompleted })}
                className="rounded border-muted-foreground"
              />
              <span className="text-sm">Show completed</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
