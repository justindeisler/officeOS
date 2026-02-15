import { differenceInMinutes, parseISO, isBefore, startOfDay } from 'date-fns';
import type { Task, TimeEntry, Project, Area } from '@/types';
import type { CalendarEvent, CalendarFilters } from '../types';
import { EVENT_COLORS } from '../constants/colors';

// ============================================
// Task → CalendarEvent
// ============================================

export function taskToCalendarEvent(task: Task): CalendarEvent | null {
  if (!task.dueDate) return null;

  const isCompleted = task.status === 'done';
  const now = new Date();
  const dueDate = parseISO(task.dueDate);
  const taskIsOverdue = !isCompleted && isBefore(dueDate, startOfDay(now));

  return {
    id: `cal-task-${task.id}`,
    sourceId: task.id,
    source: 'task',
    type: 'deadline',
    title: task.title,
    description: task.description,
    startDate: task.dueDate,
    isAllDay: true,
    color: EVENT_COLORS.task.dot,
    icon: 'CheckSquare',
    opacity: isCompleted ? 0.5 : 1,
    area: task.area,
    projectId: task.projectId,
    priority: task.priority,
    status: task.status,
    isCompleted,
    isOverdue: taskIsOverdue,
    workloadMinutes: task.estimatedMinutes || 30,
  };
}

// ============================================
// TimeEntry → CalendarEvent
// ============================================

export function timeEntryToCalendarEvent(entry: TimeEntry): CalendarEvent {
  const durationMinutes = entry.durationMinutes ||
    (entry.endTime
      ? differenceInMinutes(parseISO(entry.endTime), parseISO(entry.startTime))
      : differenceInMinutes(new Date(), parseISO(entry.startTime)));

  return {
    id: `cal-time-${entry.id}`,
    sourceId: entry.id,
    source: 'time_entry',
    type: 'time_block',
    title: entry.description || `${entry.category} time`,
    startDate: entry.startTime,
    endDate: entry.endTime || undefined,
    isAllDay: false,
    durationMinutes,
    color: EVENT_COLORS.time_entry.dot,
    icon: 'Clock',
    area: entry.area as Area | undefined,
    projectId: entry.projectId || undefined,
    clientId: entry.clientId || undefined,
    status: entry.isRunning ? 'running' : 'completed',
    isRunning: entry.isRunning || false,
    workloadMinutes: durationMinutes,
  };
}

// ============================================
// Project → CalendarEvent(s)
// ============================================

export function projectToCalendarEvents(project: Project): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Start date milestone
  if (project.startDate) {
    events.push({
      id: `cal-proj-start-${project.id}`,
      sourceId: project.id,
      source: 'project',
      type: 'milestone',
      title: `${project.name} — Start`,
      startDate: project.startDate,
      isAllDay: true,
      color: EVENT_COLORS.project.dot,
      icon: 'FolderKanban',
      area: project.area,
      status: project.status,
    });
  }

  // Target end date milestone
  if (project.targetEndDate) {
    const isCompleted = project.status === 'completed';
    const now = new Date();
    const targetDate = parseISO(project.targetEndDate);
    const projectIsOverdue = !isCompleted && isBefore(targetDate, startOfDay(now));

    events.push({
      id: `cal-proj-end-${project.id}`,
      sourceId: project.id,
      source: 'project',
      type: 'milestone',
      title: `${project.name} — Target End`,
      startDate: project.targetEndDate,
      isAllDay: true,
      color: EVENT_COLORS.project.dot,
      icon: 'FolderKanban',
      opacity: isCompleted ? 0.5 : 1,
      area: project.area,
      status: project.status,
      isCompleted,
      isOverdue: projectIsOverdue,
    });
  }

  // Date range (if both start and end exist)
  if (project.startDate && project.targetEndDate) {
    events.push({
      id: `cal-proj-range-${project.id}`,
      sourceId: project.id,
      source: 'project',
      type: 'range',
      title: project.name,
      startDate: project.startDate,
      endDate: project.targetEndDate,
      isAllDay: true,
      color: EVENT_COLORS.project.dot,
      icon: 'FolderKanban',
      opacity: project.status === 'completed' ? 0.5 : 0.8,
      area: project.area,
      status: project.status,
      isCompleted: project.status === 'completed',
    });
  }

  return events;
}

// ============================================
// Normalize all events from multiple sources
// ============================================

export interface EventSources {
  tasks?: Task[];
  timeEntries?: TimeEntry[];
  projects?: Project[];
}

export function normalizeEvents(sources: EventSources): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  if (sources.tasks) {
    for (const task of sources.tasks) {
      const event = taskToCalendarEvent(task);
      if (event) events.push(event);
    }
  }

  if (sources.timeEntries) {
    for (const entry of sources.timeEntries) {
      events.push(timeEntryToCalendarEvent(entry));
    }
  }

  if (sources.projects) {
    for (const project of sources.projects) {
      events.push(...projectToCalendarEvents(project));
    }
  }

  return events;
}

// ============================================
// Filtering
// ============================================

export function filterEvents(
  events: CalendarEvent[],
  filters: CalendarFilters
): CalendarEvent[] {
  return events.filter(event => {
    // Source filter
    if (!filters.sources.includes(event.source)) return false;

    // Area filter
    if (filters.areas.length > 0 && !filters.areas.includes('all')) {
      if (event.area && !filters.areas.includes(event.area)) return false;
    }

    // Project filter
    if (filters.projects.length > 0) {
      if (event.projectId && !filters.projects.includes(event.projectId)) return false;
    }

    // Completed filter
    if (!filters.showCompleted && event.isCompleted) return false;

    // Time entries filter
    if (!filters.showTimeEntries && event.source === 'time_entry') return false;

    // Social posts filter
    if (!filters.showSocialPosts && event.source === 'social_post') return false;

    // Cron jobs filter
    if (!filters.showCronJobs && event.source === 'cron_job') return false;

    // Agent activity filter
    if (!filters.showAgentActivity && event.source === 'agent_activity') return false;

    return true;
  });
}

// ============================================
// Sorting & Grouping
// ============================================

export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    // All-day events first
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;

    // Then by start date
    const aTime = new Date(a.startDate).getTime();
    const bTime = new Date(b.startDate).getTime();
    if (aTime !== bTime) return aTime - bTime;

    // Then by duration (longer first)
    const aDuration = a.durationMinutes || 0;
    const bDuration = b.durationMinutes || 0;
    return bDuration - aDuration;
  });
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateKey = event.startDate.split('T')[0]; // YYYY-MM-DD
    const existing = grouped.get(dateKey) || [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }

  // Sort events within each group
  for (const [key, group] of grouped) {
    grouped.set(key, sortEventsByTime(group));
  }

  return grouped;
}

/**
 * Get events that fall on a specific date.
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dateStr = date.toISOString().split('T')[0];

  return events.filter(event => {
    const eventDate = event.startDate.split('T')[0];
    if (eventDate === dateStr) return true;

    // Check if the event spans this date (range events)
    if (event.endDate) {
      const endDate = event.endDate.split('T')[0];
      return eventDate <= dateStr && endDate >= dateStr;
    }

    return false;
  });
}
