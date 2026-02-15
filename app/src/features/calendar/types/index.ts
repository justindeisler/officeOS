import type { Area, TaskPriority } from '@/types';

// ============================================
// Event Source & Type Enums
// ============================================

export type CalendarEventSource =
  | 'task'
  | 'time_entry'
  | 'project'
  | 'invoice'
  | 'social_post'
  | 'icloud'
  | 'cron_job'
  | 'agent_activity'
  | 'calendar_event';

export type CalendarEventType =
  | 'deadline'
  | 'time_block'
  | 'milestone'
  | 'scheduled'
  | 'all_day'
  | 'range'
  | 'recurring'
  | 'agent_work';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

// ============================================
// Core Calendar Event Model
// ============================================

export interface CalendarEvent {
  id: string;
  sourceId: string;
  source: CalendarEventSource;
  type: CalendarEventType;
  title: string;
  description?: string;

  // Timing
  startDate: string;          // ISO 8601
  endDate?: string;           // ISO 8601
  isAllDay: boolean;
  durationMinutes?: number;

  // Visual
  color: string;
  icon?: string;              // Lucide icon name
  opacity?: number;           // 0-1 for completed/past events

  // Metadata
  area?: Area;
  projectId?: string;
  clientId?: string;
  priority?: TaskPriority;
  status?: string;
  isCompleted?: boolean;
  isOverdue?: boolean;
  isRunning?: boolean;

  // Agent & Automation metadata
  agentName?: string;
  automationType?: string;
  sessionStatus?: 'running' | 'completed' | 'queued' | 'failed';
  cronFrequency?: string;

  // Smart features
  conflictsWith?: string[];
  workloadMinutes?: number;
  aiSuggested?: boolean;
}

// ============================================
// Filters & Preferences
// ============================================

export interface CalendarFilters {
  sources: CalendarEventSource[];
  areas: (Area | 'all')[];
  projects: string[];
  showCompleted: boolean;
  showTimeEntries: boolean;
  showSocialPosts: boolean;
  showCronJobs: boolean;
  showAgentActivity: boolean;
}

export interface CalendarPreferences {
  defaultView: CalendarViewMode;
  weekStartsOn: 0 | 1;            // 0=Sunday, 1=Monday
  workingHoursStart: number;
  workingHoursEnd: number;
  showWeekNumbers: boolean;
  showWorkloadHeatmap: boolean;
  smartPanelOpen: boolean;
  enabledSources: CalendarEventSource[];
}

// ============================================
// Smart Feature Types
// ============================================

export interface DailyWorkload {
  date: string;
  trackedMinutes: number;
  estimatedMinutes: number;
  scheduledMinutes: number;
  agentMinutes: number;
  totalMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  level: 'light' | 'normal' | 'busy' | 'overloaded';
}

export interface CalendarConflict {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  overlapMinutes: number;
  severity: 'info' | 'warning' | 'critical';
  suggestion?: string;
}

export interface CalendarInsight {
  id: string;
  type: 'pattern' | 'suggestion' | 'warning' | 'achievement';
  title: string;
  description: string;
  icon: string;
  action?: {
    label: string;
    handler: string;
    data?: unknown;
  };
  createdAt: string;
}

// ============================================
// Defaults
// ============================================

export const DEFAULT_FILTERS: CalendarFilters = {
  sources: ['task', 'time_entry', 'project', 'invoice', 'social_post', 'icloud', 'cron_job', 'agent_activity', 'calendar_event'],
  areas: ['all'],
  projects: [],
  showCompleted: true,
  showTimeEntries: true,
  showSocialPosts: true,
  showCronJobs: true,
  showAgentActivity: true,
};

export const DEFAULT_PREFERENCES: CalendarPreferences = {
  defaultView: 'month',
  weekStartsOn: 1,
  workingHoursStart: 8,
  workingHoursEnd: 18,
  showWeekNumbers: false,
  showWorkloadHeatmap: true,
  smartPanelOpen: true,
  enabledSources: ['task', 'time_entry', 'project', 'invoice', 'social_post', 'icloud', 'cron_job', 'agent_activity', 'calendar_event'],
};
