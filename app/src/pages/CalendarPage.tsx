import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/features/calendar/stores/calendarStore';
import { useCalendarEvents } from '@/features/calendar/hooks/useCalendarEvents';
import { CalendarToolbar } from '@/features/calendar/components/CalendarToolbar';
import { CalendarBody } from '@/features/calendar/components/CalendarBody';
import { FilterDropdown } from '@/features/calendar/components/FilterDropdown';
import { EventDetailPopover } from '@/features/calendar/components/EventDetailPopover';
import type { CalendarEvent } from '@/features/calendar/types';

export function CalendarPage() {
  const {
    selectedDate,
    viewMode,
    filters,
    preferences,
    setSelectedDate,
    setViewMode,
    goForward,
    goBackward,
    goToToday,
    setFilter,
  } = useCalendarStore();

  const { events, isLoading } = useCalendarEvents();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, [setSelectedDate]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Detect mobile via container width (responsive)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between p-4 pb-0">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <FilterDropdown filters={filters} onFilterChange={setFilter} />
      </div>

      {/* Toolbar */}
      <CalendarToolbar
        selectedDate={selectedDate}
        viewMode={viewMode}
        weekStartsOn={preferences.weekStartsOn}
        onViewModeChange={setViewMode}
        onNavigateForward={goForward}
        onNavigateBackward={goBackward}
        onGoToToday={goToToday}
      />

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading calendar...</div>
          </div>
        ) : (
          <CalendarBody
            viewMode={viewMode}
            selectedDate={selectedDate}
            events={events}
            weekStartsOn={preferences.weekStartsOn}
            workingHoursStart={preferences.workingHoursStart}
            workingHoursEnd={preferences.workingHoursEnd}
            compact={isMobile}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
          />
        )}

        {/* Event detail popover */}
        {selectedEvent && (
          <div className="absolute top-4 right-4 z-50">
            <EventDetailPopover
              event={selectedEvent}
              onClose={handleClosePopover}
            />
          </div>
        )}
      </div>
    </div>
  );
}
