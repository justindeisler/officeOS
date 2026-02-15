import { useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTimerStore } from '@/stores/timerStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCalendarStore } from '../stores/calendarStore';
import type { CalendarEvent } from '../types';
import {
  normalizeEvents,
  filterEvents,
  sortEventsByTime,
  groupEventsByDate,
  getEventsForDate,
} from '../utils/event-normalizer';
import { isDateInRange } from '../utils/date-helpers';

export interface UseCalendarEventsReturn {
  /** All normalized and filtered events for the visible range */
  events: CalendarEvent[];
  /** Events grouped by date string (YYYY-MM-DD) */
  eventsByDate: Map<string, CalendarEvent[]>;
  /** Get events for a specific date */
  getEventsForDay: (date: Date) => CalendarEvent[];
  /** Total event count */
  totalCount: number;
  /** Whether data is still loading */
  isLoading: boolean;
}

export function useCalendarEvents(): UseCalendarEventsReturn {
  const tasks = useTaskStore(state => state.tasks);
  const tasksLoaded = useTaskStore(state => state.isLoaded);
  const timeEntries = useTimerStore(state => state.entries);
  const timerLoaded = useTimerStore(state => state.isLoaded);
  const projects = useProjectStore(state => state.projects);
  const projectsLoaded = useProjectStore(state => state.isLoaded);

  const filters = useCalendarStore(state => state.filters);
  const visibleRange = useCalendarStore(state => state.visibleRange);

  const isLoading = !tasksLoaded || !timerLoaded || !projectsLoaded;

  // Step 1: Normalize all data sources into CalendarEvent[]
  const allEvents = useMemo(() => {
    return normalizeEvents({
      tasks,
      timeEntries,
      projects,
    });
  }, [tasks, timeEntries, projects]);

  // Step 2: Filter by user preferences
  const filteredEvents = useMemo(() => {
    return filterEvents(allEvents, filters);
  }, [allEvents, filters]);

  // Step 3: Filter to visible range
  const visibleEvents = useMemo(() => {
    return filteredEvents.filter(event =>
      isDateInRange(event.startDate, visibleRange.start, visibleRange.end) ||
      (event.endDate && isDateInRange(event.endDate, visibleRange.start, visibleRange.end))
    );
  }, [filteredEvents, visibleRange]);

  // Step 4: Sort
  const sortedEvents = useMemo(() => {
    return sortEventsByTime(visibleEvents);
  }, [visibleEvents]);

  // Step 5: Group by date
  const eventsByDate = useMemo(() => {
    return groupEventsByDate(sortedEvents);
  }, [sortedEvents]);

  // Helper: get events for a specific date
  const getEventsForDay = useMemo(() => {
    return (date: Date) => getEventsForDate(sortedEvents, date);
  }, [sortedEvents]);

  return {
    events: sortedEvents,
    eventsByDate,
    getEventsForDay,
    totalCount: sortedEvents.length,
    isLoading,
  };
}
