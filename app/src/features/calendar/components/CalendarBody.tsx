import type { CalendarViewMode, CalendarEvent } from '../types';
import { MonthGrid } from './MonthView/MonthGrid';
import { WeekGrid } from './WeekView/WeekGrid';
import { DayTimeline } from './DayView/DayTimeline';
import { DaySidebar } from './DayView/DaySidebar';
import { AgendaList } from './AgendaView/AgendaList';

interface CalendarBodyProps {
  viewMode: CalendarViewMode;
  selectedDate: Date;
  events: CalendarEvent[];
  weekStartsOn?: 0 | 1;
  workingHoursStart?: number;
  workingHoursEnd?: number;
  compact?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function CalendarBody({
  viewMode,
  selectedDate,
  events,
  weekStartsOn = 1,
  workingHoursStart = 8,
  workingHoursEnd = 18,
  compact = false,
  onDateClick,
  onEventClick,
}: CalendarBodyProps) {
  switch (viewMode) {
    case 'month':
      return (
        <MonthGrid
          selectedDate={selectedDate}
          events={events}
          weekStartsOn={weekStartsOn}
          compact={compact}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      );

    case 'week':
      return (
        <WeekGrid
          selectedDate={selectedDate}
          events={events}
          weekStartsOn={weekStartsOn}
          workingHoursStart={workingHoursStart}
          workingHoursEnd={workingHoursEnd}
          onDateClick={onDateClick}
          onEventClick={onEventClick}
        />
      );

    case 'day':
      return (
        <div className="flex flex-1 h-full">
          <DayTimeline
            date={selectedDate}
            events={events}
            workingHoursStart={workingHoursStart}
            workingHoursEnd={workingHoursEnd}
            onEventClick={onEventClick}
          />
          {!compact && (
            <DaySidebar
              date={selectedDate}
              events={events}
              onEventClick={onEventClick}
            />
          )}
        </div>
      );

    case 'agenda':
      return (
        <AgendaList
          startDate={selectedDate}
          events={events}
          onEventClick={onEventClick}
        />
      );

    default:
      return null;
  }
}
