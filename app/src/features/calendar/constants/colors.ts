import type { CalendarEventSource } from '../types';

export interface EventColorSet {
  bg: string;
  text: string;
  dot: string;
  border: string;
}

export const EVENT_COLORS: Record<CalendarEventSource, EventColorSet> = {
  task:            { bg: 'bg-blue-500/10',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-500' },
  time_entry:      { bg: 'bg-emerald-500/10', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-500' },
  project:         { bg: 'bg-violet-500/10',  text: 'text-violet-700',  dot: 'bg-violet-500',  border: 'border-violet-500' },
  invoice:         { bg: 'bg-amber-500/10',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-500' },
  social_post:     { bg: 'bg-pink-500/10',    text: 'text-pink-700',    dot: 'bg-pink-500',    border: 'border-pink-500' },
  icloud:          { bg: 'bg-sky-500/10',     text: 'text-sky-700',     dot: 'bg-sky-500',     border: 'border-sky-500' },
  cron_job:        { bg: 'bg-orange-500/10',  text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-500' },
  agent_activity:  { bg: 'bg-cyan-500/10',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-500' },
  calendar_event:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-indigo-500' },
};

export const EVENT_ICONS: Record<CalendarEventSource, string> = {
  task:           'CheckSquare',
  time_entry:     'Clock',
  project:        'FolderKanban',
  invoice:        'FileText',
  social_post:    'Share2',
  icloud:         'Cloud',
  cron_job:       'Settings',
  agent_activity: 'Bot',
  calendar_event: 'CalendarDays',
};

export const WORKLOAD_COLORS = {
  light:      'bg-green-500/5',
  normal:     'bg-transparent',
  busy:       'bg-amber-500/10',
  overloaded: 'bg-red-500/10',
} as const;
