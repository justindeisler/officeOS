import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, TimeEntry, Project } from '@/types';
import type { CalendarFilters } from '../types';
import { DEFAULT_FILTERS } from '../types';
import {
  taskToCalendarEvent,
  timeEntryToCalendarEvent,
  projectToCalendarEvents,
  normalizeEvents,
  filterEvents,
  sortEventsByTime,
  groupEventsByDate,
  getEventsForDate,
} from './event-normalizer';
import type { CalendarEvent } from '../types';

const FIXED_NOW = new Date('2025-07-22T10:30:00.000Z');

// ============================================
// Test Helpers
// ============================================

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Build calendar feature',
    status: 'in_progress',
    priority: 2,
    area: 'wellfy',
    sortOrder: 0,
    createdAt: '2025-07-01T00:00:00Z',
    updatedAt: '2025-07-22T00:00:00Z',
    ...overrides,
  };
}

function createMockTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'te-1',
    category: 'coding',
    startTime: '2025-07-22T09:00:00Z',
    endTime: '2025-07-22T11:30:00Z',
    durationMinutes: 150,
    isRunning: false,
    createdAt: '2025-07-22T09:00:00Z',
    ...overrides,
  } as TimeEntry;
}

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Smart Calendar',
    status: 'active',
    area: 'wellfy',
    budgetCurrency: 'EUR',
    createdAt: '2025-07-01T00:00:00Z',
    updatedAt: '2025-07-22T00:00:00Z',
    ...overrides,
  };
}

function createMockCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'cal-1',
    sourceId: 'src-1',
    source: 'task',
    type: 'deadline',
    title: 'Test Event',
    startDate: '2025-07-22T09:00:00Z',
    isAllDay: false,
    color: '#3b82f6',
    ...overrides,
  };
}

describe('event-normalizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // taskToCalendarEvent
  // ============================================
  describe('taskToCalendarEvent', () => {
    it('returns null for tasks without due date', () => {
      const task = createMockTask({ dueDate: undefined });
      expect(taskToCalendarEvent(task)).toBeNull();
    });

    it('creates deadline event for task with due date', () => {
      const task = createMockTask({ dueDate: '2025-07-25T00:00:00Z', title: 'Build API' });
      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      expect(event!.source).toBe('task');
      expect(event!.type).toBe('deadline');
      expect(event!.title).toBe('Build API');
      expect(event!.isAllDay).toBe(true);
      expect(event!.startDate).toBe('2025-07-25T00:00:00Z');
    });

    it('generates correct calendar event ID', () => {
      const task = createMockTask({ id: 'task-42', dueDate: '2025-07-25T00:00:00Z' });
      const event = taskToCalendarEvent(task);
      expect(event!.id).toBe('cal-task-task-42');
      expect(event!.sourceId).toBe('task-42');
    });

    it('marks overdue tasks', () => {
      const task = createMockTask({
        dueDate: '2025-07-20T00:00:00Z',
        status: 'in_progress',
      });
      const event = taskToCalendarEvent(task);
      expect(event!.isOverdue).toBe(true);
    });

    it('does not mark future tasks as overdue', () => {
      const task = createMockTask({
        dueDate: '2025-07-25T00:00:00Z',
        status: 'in_progress',
      });
      const event = taskToCalendarEvent(task);
      expect(event!.isOverdue).toBe(false);
    });

    it('does not mark completed tasks as overdue even with past date', () => {
      const task = createMockTask({
        dueDate: '2025-07-20T00:00:00Z',
        status: 'done',
      });
      const event = taskToCalendarEvent(task);
      expect(event!.isOverdue).toBe(false);
    });

    it('marks completed tasks with reduced opacity', () => {
      const task = createMockTask({
        dueDate: '2025-07-20T00:00:00Z',
        status: 'done',
        completedAt: '2025-07-19T15:00:00Z',
      });
      const event = taskToCalendarEvent(task);
      expect(event!.isCompleted).toBe(true);
      expect(event!.opacity).toBe(0.5);
    });

    it('sets full opacity for incomplete tasks', () => {
      const task = createMockTask({
        dueDate: '2025-07-25T00:00:00Z',
        status: 'in_progress',
      });
      const event = taskToCalendarEvent(task);
      expect(event!.opacity).toBe(1);
    });

    it('preserves task area', () => {
      const task = createMockTask({ dueDate: '2025-07-25T00:00:00Z', area: 'freelance' });
      expect(taskToCalendarEvent(task)!.area).toBe('freelance');
    });

    it('preserves task priority', () => {
      const task = createMockTask({ dueDate: '2025-07-25T00:00:00Z', priority: 1 });
      expect(taskToCalendarEvent(task)!.priority).toBe(1);
    });

    it('preserves project ID', () => {
      const task = createMockTask({ dueDate: '2025-07-25T00:00:00Z', projectId: 'proj-1' });
      expect(taskToCalendarEvent(task)!.projectId).toBe('proj-1');
    });

    it('uses estimated minutes for workload or defaults to 30', () => {
      const taskWithEstimate = createMockTask({ dueDate: '2025-07-25T00:00:00Z', estimatedMinutes: 120 });
      expect(taskToCalendarEvent(taskWithEstimate)!.workloadMinutes).toBe(120);

      const taskWithoutEstimate = createMockTask({ dueDate: '2025-07-25T00:00:00Z' });
      expect(taskToCalendarEvent(taskWithoutEstimate)!.workloadMinutes).toBe(30);
    });

    it('sets correct icon', () => {
      const task = createMockTask({ dueDate: '2025-07-25T00:00:00Z' });
      expect(taskToCalendarEvent(task)!.icon).toBe('CheckSquare');
    });
  });

  // ============================================
  // timeEntryToCalendarEvent
  // ============================================
  describe('timeEntryToCalendarEvent', () => {
    it('creates time_block event', () => {
      const entry = createMockTimeEntry();
      const event = timeEntryToCalendarEvent(entry);

      expect(event.source).toBe('time_entry');
      expect(event.type).toBe('time_block');
      expect(event.isAllDay).toBe(false);
    });

    it('generates correct ID', () => {
      const entry = createMockTimeEntry({ id: 'te-42' });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.id).toBe('cal-time-te-42');
      expect(event.sourceId).toBe('te-42');
    });

    it('uses provided duration', () => {
      const entry = createMockTimeEntry({ durationMinutes: 120 });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.durationMinutes).toBe(120);
    });

    it('calculates duration from start/end when not provided', () => {
      const entry = createMockTimeEntry({
        startTime: '2025-07-22T09:00:00Z',
        endTime: '2025-07-22T11:30:00Z',
        durationMinutes: undefined as unknown as number,
      });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.durationMinutes).toBe(150);
    });

    it('uses description as title', () => {
      const entry = createMockTimeEntry({ description: 'Working on calendar' });
      expect(timeEntryToCalendarEvent(entry).title).toBe('Working on calendar');
    });

    it('falls back to category for title when no description', () => {
      const entry = createMockTimeEntry({ description: undefined });
      expect(timeEntryToCalendarEvent(entry).title).toBe('coding time');
    });

    it('marks running entries', () => {
      const entry = createMockTimeEntry({ isRunning: true, endTime: undefined as unknown as string });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.isRunning).toBe(true);
      expect(event.status).toBe('running');
    });

    it('marks completed entries', () => {
      const entry = createMockTimeEntry({ isRunning: false });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.isRunning).toBe(false);
      expect(event.status).toBe('completed');
    });

    it('sets start and end dates', () => {
      const entry = createMockTimeEntry({
        startTime: '2025-07-22T09:00:00Z',
        endTime: '2025-07-22T11:30:00Z',
      });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.startDate).toBe('2025-07-22T09:00:00Z');
      expect(event.endDate).toBe('2025-07-22T11:30:00Z');
    });

    it('preserves project and client IDs', () => {
      const entry = createMockTimeEntry({ projectId: 'proj-1', clientId: 'client-1' });
      const event = timeEntryToCalendarEvent(entry);
      expect(event.projectId).toBe('proj-1');
      expect(event.clientId).toBe('client-1');
    });

    it('sets workload minutes to duration', () => {
      const entry = createMockTimeEntry({ durationMinutes: 90 });
      expect(timeEntryToCalendarEvent(entry).workloadMinutes).toBe(90);
    });
  });

  // ============================================
  // projectToCalendarEvents
  // ============================================
  describe('projectToCalendarEvents', () => {
    it('returns empty array for project without dates', () => {
      const project = createMockProject({ startDate: undefined, targetEndDate: undefined });
      expect(projectToCalendarEvents(project)).toHaveLength(0);
    });

    it('creates start milestone for project with start date', () => {
      const project = createMockProject({ startDate: '2025-07-01T00:00:00Z' });
      const events = projectToCalendarEvents(project);
      const startEvent = events.find(e => e.id.includes('start'));
      expect(startEvent).toBeDefined();
      expect(startEvent!.type).toBe('milestone');
      expect(startEvent!.title).toContain('Start');
    });

    it('creates end milestone for project with target end date', () => {
      const project = createMockProject({ targetEndDate: '2025-08-31T00:00:00Z' });
      const events = projectToCalendarEvents(project);
      const endEvent = events.find(e => e.id.includes('end'));
      expect(endEvent).toBeDefined();
      expect(endEvent!.type).toBe('milestone');
      expect(endEvent!.title).toContain('Target End');
    });

    it('creates range event when both dates exist', () => {
      const project = createMockProject({
        startDate: '2025-07-01T00:00:00Z',
        targetEndDate: '2025-08-31T00:00:00Z',
      });
      const events = projectToCalendarEvents(project);
      const rangeEvent = events.find(e => e.type === 'range');
      expect(rangeEvent).toBeDefined();
      expect(rangeEvent!.startDate).toBe('2025-07-01T00:00:00Z');
      expect(rangeEvent!.endDate).toBe('2025-08-31T00:00:00Z');
    });

    it('creates 3 events when both dates exist (start + end + range)', () => {
      const project = createMockProject({
        startDate: '2025-07-01T00:00:00Z',
        targetEndDate: '2025-08-31T00:00:00Z',
      });
      expect(projectToCalendarEvents(project)).toHaveLength(3);
    });

    it('marks completed project events', () => {
      const project = createMockProject({
        status: 'completed',
        targetEndDate: '2025-07-15T00:00:00Z',
      });
      const events = projectToCalendarEvents(project);
      const endEvent = events.find(e => e.id.includes('end'));
      expect(endEvent!.isCompleted).toBe(true);
      expect(endEvent!.opacity).toBe(0.5);
    });

    it('marks overdue project end dates', () => {
      const project = createMockProject({
        status: 'active',
        targetEndDate: '2025-07-15T00:00:00Z', // Past
      });
      const events = projectToCalendarEvents(project);
      const endEvent = events.find(e => e.id.includes('end'));
      expect(endEvent!.isOverdue).toBe(true);
    });

    it('preserves project area', () => {
      const project = createMockProject({
        area: 'freelance',
        startDate: '2025-07-01T00:00:00Z',
      });
      const events = projectToCalendarEvents(project);
      expect(events[0].area).toBe('freelance');
    });
  });

  // ============================================
  // normalizeEvents
  // ============================================
  describe('normalizeEvents', () => {
    it('normalizes an empty sources object', () => {
      expect(normalizeEvents({})).toHaveLength(0);
    });

    it('normalizes tasks', () => {
      const tasks = [
        createMockTask({ id: 't1', dueDate: '2025-07-22T00:00:00Z' }),
        createMockTask({ id: 't2', dueDate: '2025-07-25T00:00:00Z' }),
        createMockTask({ id: 't3' }), // No due date — should be excluded
      ];
      const events = normalizeEvents({ tasks });
      expect(events).toHaveLength(2);
    });

    it('normalizes time entries', () => {
      const timeEntries = [
        createMockTimeEntry({ id: 'te1' }),
        createMockTimeEntry({ id: 'te2' }),
      ];
      const events = normalizeEvents({ timeEntries });
      expect(events).toHaveLength(2);
    });

    it('normalizes projects with multiple events each', () => {
      const projects = [
        createMockProject({
          id: 'p1',
          startDate: '2025-07-01T00:00:00Z',
          targetEndDate: '2025-08-31T00:00:00Z',
        }),
      ];
      const events = normalizeEvents({ projects });
      expect(events).toHaveLength(3); // start + end + range
    });

    it('combines all sources', () => {
      const events = normalizeEvents({
        tasks: [createMockTask({ dueDate: '2025-07-22T00:00:00Z' })],
        timeEntries: [createMockTimeEntry()],
        projects: [createMockProject({ startDate: '2025-07-01T00:00:00Z' })],
      });
      expect(events.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================
  // filterEvents
  // ============================================
  describe('filterEvents', () => {
    const sampleEvents: CalendarEvent[] = [
      createMockCalendarEvent({ id: '1', source: 'task', isCompleted: false }),
      createMockCalendarEvent({ id: '2', source: 'time_entry', isCompleted: false }),
      createMockCalendarEvent({ id: '3', source: 'task', isCompleted: true }),
      createMockCalendarEvent({ id: '4', source: 'social_post', isCompleted: false }),
      createMockCalendarEvent({ id: '5', source: 'cron_job', isCompleted: false }),
      createMockCalendarEvent({ id: '6', source: 'agent_activity', isCompleted: false }),
      createMockCalendarEvent({ id: '7', source: 'task', area: 'wellfy', isCompleted: false }),
      createMockCalendarEvent({ id: '8', source: 'task', area: 'freelance', isCompleted: false }),
    ];

    it('shows all events with default filters', () => {
      expect(filterEvents(sampleEvents, DEFAULT_FILTERS)).toHaveLength(sampleEvents.length);
    });

    it('filters by source', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        sources: ['task'],
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => e.source === 'task')).toBe(true);
    });

    it('hides completed events', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showCompleted: false,
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => !e.isCompleted)).toBe(true);
    });

    it('hides time entries when disabled', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showTimeEntries: false,
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => e.source !== 'time_entry')).toBe(true);
    });

    it('hides social posts when disabled', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showSocialPosts: false,
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => e.source !== 'social_post')).toBe(true);
    });

    it('hides cron jobs when disabled', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showCronJobs: false,
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => e.source !== 'cron_job')).toBe(true);
    });

    it('hides agent activity when disabled', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        showAgentActivity: false,
      };
      const result = filterEvents(sampleEvents, filters);
      expect(result.every(e => e.source !== 'agent_activity')).toBe(true);
    });

    it('filters by area', () => {
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        areas: ['wellfy'],
      };
      const result = filterEvents(sampleEvents, filters);
      // Events without area or with matching area should pass
      result.forEach(e => {
        if (e.area) expect(e.area).toBe('wellfy');
      });
    });

    it('filters by project', () => {
      const events = [
        createMockCalendarEvent({ id: '1', projectId: 'p1' }),
        createMockCalendarEvent({ id: '2', projectId: 'p2' }),
        createMockCalendarEvent({ id: '3', projectId: undefined }),
      ];
      const filters: CalendarFilters = {
        ...DEFAULT_FILTERS,
        projects: ['p1'],
      };
      const result = filterEvents(events, filters);
      result.forEach(e => {
        if (e.projectId) expect(e.projectId).toBe('p1');
      });
    });
  });

  // ============================================
  // sortEventsByTime
  // ============================================
  describe('sortEventsByTime', () => {
    it('puts all-day events first', () => {
      const events = [
        createMockCalendarEvent({ id: '1', isAllDay: false, startDate: '2025-07-22T09:00:00Z' }),
        createMockCalendarEvent({ id: '2', isAllDay: true, startDate: '2025-07-22T00:00:00Z' }),
      ];
      const sorted = sortEventsByTime(events);
      expect(sorted[0].id).toBe('2');
    });

    it('sorts by start date', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T14:00:00Z' }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-22T09:00:00Z' }),
        createMockCalendarEvent({ id: '3', startDate: '2025-07-22T11:00:00Z' }),
      ];
      const sorted = sortEventsByTime(events);
      expect(sorted.map(e => e.id)).toEqual(['2', '3', '1']);
    });

    it('sorts longer events first when same start time', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T09:00:00Z', durationMinutes: 30 }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-22T09:00:00Z', durationMinutes: 120 }),
      ];
      const sorted = sortEventsByTime(events);
      expect(sorted[0].id).toBe('2');
    });

    it('does not mutate original array', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T14:00:00Z' }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-22T09:00:00Z' }),
      ];
      const original = [...events];
      sortEventsByTime(events);
      expect(events.map(e => e.id)).toEqual(original.map(e => e.id));
    });
  });

  // ============================================
  // groupEventsByDate
  // ============================================
  describe('groupEventsByDate', () => {
    it('groups events by date string', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T09:00:00Z' }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-22T14:00:00Z' }),
        createMockCalendarEvent({ id: '3', startDate: '2025-07-23T09:00:00Z' }),
      ];
      const grouped = groupEventsByDate(events);
      expect(grouped.get('2025-07-22')!.length).toBe(2);
      expect(grouped.get('2025-07-23')!.length).toBe(1);
    });

    it('sorts events within each group', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T14:00:00Z' }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-22T09:00:00Z' }),
      ];
      const grouped = groupEventsByDate(events);
      const dayEvents = grouped.get('2025-07-22')!;
      expect(dayEvents[0].id).toBe('2'); // 09:00 before 14:00
    });

    it('returns empty map for no events', () => {
      expect(groupEventsByDate([]).size).toBe(0);
    });
  });

  // ============================================
  // getEventsForDate
  // ============================================
  describe('getEventsForDate', () => {
    it('returns events on the specified date', () => {
      const events = [
        createMockCalendarEvent({ id: '1', startDate: '2025-07-22T09:00:00Z' }),
        createMockCalendarEvent({ id: '2', startDate: '2025-07-23T09:00:00Z' }),
      ];
      const result = getEventsForDate(events, new Date('2025-07-22'));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('includes range events spanning the date', () => {
      const events = [
        createMockCalendarEvent({
          id: '1',
          startDate: '2025-07-20T00:00:00Z',
          endDate: '2025-07-25T00:00:00Z',
          type: 'range',
        }),
      ];
      const result = getEventsForDate(events, new Date('2025-07-22'));
      expect(result).toHaveLength(1);
    });

    it('excludes range events not spanning the date', () => {
      const events = [
        createMockCalendarEvent({
          id: '1',
          startDate: '2025-07-10T00:00:00Z',
          endDate: '2025-07-15T00:00:00Z',
          type: 'range',
        }),
      ];
      const result = getEventsForDate(events, new Date('2025-07-22'));
      expect(result).toHaveLength(0);
    });

    it('returns empty array when no events match', () => {
      const result = getEventsForDate([], new Date('2025-07-22'));
      expect(result).toHaveLength(0);
    });
  });
});
