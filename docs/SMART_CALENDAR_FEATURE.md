# Smart Calendar — Technical Specification

> **Status**: Phase 1 — Implementation Started
> **Target**: Unified calendar view aggregating all PA data sources with AI-powered intelligence
> **Last Updated**: 2025-07-27
> **Estimated Total Effort**: 10–14 weeks (6 phases)
> **Test Coverage Target**: 95%+ (following TDD methodology like accounting features)

---

## Table of Contents

1. [Overview](#overview)
2. [Codebase Audit & Integration Points](#codebase-audit--integration-points)
3. [Feature List](#feature-list)
4. [Architecture](#architecture)
5. [Implementation Phases](#implementation-phases)
6. [UI/UX Design](#uiux-design)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Test Strategy](#test-strategy)
10. [Risk Assessment](#risk-assessment)
11. [References](#references)

---

## Overview

The Smart Calendar is a **unified, AI-enhanced calendar view** for the Personal Assistant app. Unlike a traditional calendar that only shows manually-created events, the Smart Calendar **aggregates every time-relevant piece of data** across the PA ecosystem — tasks with due dates, time entries, project milestones, social media posts, invoice deadlines, and external iCloud calendar events — into a single, intelligent view.

### Design Principles

1. **Native, not bolted-on** — Uses the existing design system (Radix + Tailwind + Framer Motion), follows established patterns from accounting/time-tracking features
2. **Data-first** — No separate event CRUD initially; the calendar surfaces existing data from across the app
3. **Smart by default** — AI-powered suggestions, conflict detection, workload analysis, and pattern insights
4. **Multi-source fusion** — One calendar view, many data sources, unified event model
5. **Mobile-first responsive** — PWA-optimized with touch gestures, following established responsive patterns

### Key Differentiator: "The Aggregator Calendar"

Most calendar apps are standalone event stores. The PA Smart Calendar is an **aggregation layer** that presents a unified temporal view over all existing app data, enhanced with AI intelligence. The user creates tasks, tracks time, schedules posts, and generates invoices — the calendar shows it all in one timeline.

---

## Codebase Audit & Integration Points

### Tech Stack Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | React 18 + TypeScript | Lazy-loaded pages, Suspense boundaries |
| **State** | Zustand | Per-feature stores (taskStore, timerStore, projectStore, etc.) |
| **Styling** | Tailwind CSS + Radix UI | shadcn/ui component library |
| **Charts** | Recharts | Already used for accounting dashboards |
| **Dates** | date-fns v4 | Extensively used across the app |
| **Calendar Picker** | react-day-picker v9 | Dependency installed but not yet used in any component |
| **Animation** | Framer Motion | Used for transitions, celebrations |
| **DnD** | @dnd-kit | Used in Kanban board (tasks) |
| **Forms** | react-hook-form + Zod | Form validation pattern |
| **API** | Express + better-sqlite3 | REST API with JWT auth |
| **Testing** | Vitest + Testing Library | TDD workflow, 95%+ coverage target |

### Existing Date/Time Data Sources

| Source | Key Fields | Store | Service | DB Table |
|--------|------------|-------|---------|----------|
| **Tasks** | `dueDate`, `completedAt`, `estimatedMinutes` | `taskStore` | `taskService` | `tasks` |
| **Time Entries** | `startTime`, `endTime`, `durationMinutes`, `isRunning` | `timerStore` | `timeEntryService` | `time_entries` |
| **Projects** | `startDate`, `targetEndDate`, `actualEndDate` | `projectStore` | `projectService` | `projects` |
| **Social Posts** | `scheduled_date`, `published_date` | — (via api) | `api.ts` | `social_media_posts` |
| **Invoices** | `invoice_date`, `due_date`, `payment_date` | `invoiceStore` | `invoiceService` | `invoices` |
| **Income** | `date` | — (accounting) | accounting API | `income` |
| **Expenses** | `date` | — (accounting) | accounting API | `expenses` |
| **Captures** | `createdAt` | `captureStore` | `captureService` | `captures` |
| **PRDs** | `createdAt`, `updatedAt` | `prdStore` | prd API | `prds` |
| **iCloud Calendar** | External CalDAV events | — (new) | `icloud_calendar.py` | — (external) |
| **Cron Jobs** | `name`, `schedule`, `nextRun`, `frequency` | — (new) | `cron list` CLI | — (system) |
| **Agent Activity** | `startTime`, `endTime`, `agent`, `task`, `status` | — (new) | `sessions_list` / TASKS.md | — (system) |

### Reusable UI Components

| Component | Location | Reuse in Calendar |
|-----------|----------|-------------------|
| `PostingCalendar` | `pages/social-media/PostingCalendar.tsx` | **Month/week grid pattern** — existing calendar grid with navigation, view toggle, day cells. Direct design reference for our calendar grid. |
| `DailyTimeline` | `components/time/DailyTimeline.tsx` | **Day view pattern** — grouped entries by date with timeline border. Reuse for day view layout. |
| `WeeklySummary` | `components/time/WeeklySummary.tsx` | **Week stats pattern** — bar chart, category breakdown. Reuse for weekly insights panel. |
| `UpcomingDeadlines` | `components/dashboard/UpcomingDeadlines.tsx` | **Deadline display pattern** — urgency badges, color coding. Reuse for calendar event urgency. |
| `TaskCard` | `components/tasks/TaskCard.tsx` | **Card pattern** — compact info display. Reference for calendar event cards. |
| `TimeEntryCard` | `components/time/TimeEntryCard.tsx` | **Time block pattern** — duration, category colors. Reuse for time blocks in day/week view. |
| Radix UI primitives | `components/ui/*` | All shared: Card, Dialog, Badge, Tabs, Popover, Select, Button, etc. |

### Existing Patterns to Follow

1. **Feature folder structure**: `app/src/features/calendar/` (mirrors `features/accounting/`)
2. **Store pattern**: Zustand store with `initialize()`, optimistic updates, error rollback
3. **Service pattern**: Web services in `services/web/` wrapping `HttpClient`
4. **Lazy loading**: Page component lazy-loaded in `App.tsx`
5. **TDD workflow**: Test file co-located with component, mock data in `test/mocks/`
6. **Mobile responsive**: Container queries (`@lg`, `@md`), `min-h-[44px]` touch targets
7. **Navigation**: Sidebar nav item with optional children (uses `NavItemWithChildren`)

---

## Feature List

### Priority Matrix

| Priority | Category | Feature | Effort | Value |
|----------|----------|---------|--------|-------|
| **P0** | Core | Month view with event dots | M | 🟢🟢🟢 |
| **P0** | Core | Week view with time blocks | L | 🟢🟢🟢 |
| **P0** | Core | Day view with detailed timeline | M | 🟢🟢🟢 |
| **P0** | Core | Agenda view (list mode) | S | 🟢🟢🟢 |
| **P0** | Integration | Task due dates on calendar | S | 🟢🟢🟢 |
| **P0** | Integration | Time entries on calendar | S | 🟢🟢🟢 |
| **P0** | Integration | Project milestones | S | 🟢🟢 |
| **P1** | Integration | Invoice deadlines | S | 🟢🟢 |
| **P1** | Integration | Social media schedule | S | 🟢🟢 |
| **P1** | Integration | iCloud calendar sync | M | 🟢🟢🟢 |
| **P1** | Integration | Cron job schedule | S | 🟢🟢 |
| **P1** | Integration | Agent work activity (past & future) | M | 🟢🟢🟢 |
| **P1** | Smart | Workload heatmap | M | 🟢🟢🟢 |
| **P1** | Smart | Conflict detection | M | 🟢🟢🟢 |
| **P1** | Smart | Daily planning suggestions | M | 🟢🟢🟢 |
| **P1** | Native Events | Calendar event CRUD | L | 🟢🟢 |
| **P2** | Smart | Capacity planning | M | 🟢🟢 |
| **P2** | Smart | Time blocking suggestions | M | 🟢🟢 |
| **P2** | Smart | Pattern analysis & insights | L | 🟢🟢🟢 |
| **P2** | Smart | Focus time protection | S | 🟢🟢 |
| **P2** | Views | Multi-week planning view | M | 🟢 |
| **P3** | Smart | AI auto-scheduling | L | 🟢🟢🟢 |
| **P3** | Integration | Drag task to calendar (schedule) | M | 🟢🟢 |
| **P3** | Views | Year overview (GitHub-style heatmap) | M | 🟢🟢 |

**Legend**: S = Small (<3 days), M = Medium (3–7 days), L = Large (1–2 weeks)

---

### Feature Descriptions

#### Core Views

**Month View**
- Standard calendar grid (Monday-start, matching `PostingCalendar`)
- Color-coded dots/chips for each event type (tasks=blue, time=green, social=pink, invoices=amber)
- Click a day to see event list or drill into day view
- Compact event rendering (max 3 per cell with "+N more" overflow)
- Today highlight, weekend dimming

**Week View**
- 7-column time grid (like Google Calendar)
- Time entries rendered as colored blocks on the timeline (8:00–20:00 default range)
- Task due dates shown as all-day items at the top
- Project milestones as banners across their date range
- Current time indicator (red line)
- Scrollable time axis with hour markers

**Day View**
- Detailed timeline for a single day (extends `DailyTimeline` pattern)
- Left column: hourly time blocks with time entries
- Right sidebar: tasks due today, upcoming events, daily stats
- Integration with active timer (shows running entry in real-time)

**Agenda View**
- Chronological event list grouped by day (next 7/14/30 days)
- Search/filter across all event types
- Quick actions (mark task done, reschedule, start timer)
- Most useful on mobile

#### Integration Features

**Task Integration**
- Tasks with `dueDate` shown as all-day events on their due date
- Color intensity by priority (high=red, medium=amber, low=blue)
- Click to open `TaskDialog` for editing
- Overdue tasks highlighted with destructive styling
- Completed tasks shown with strikethrough/opacity

**Time Entry Integration**
- Completed time entries rendered as timed blocks on the calendar
- Color-coded by `category` (coding=blue, meetings=purple, admin=orange, planning=green)
- Running timer shown as a growing block in real-time
- Click to open/edit time entry

**Project Milestones**
- Projects with `startDate`/`targetEndDate` shown as date range bars
- Color by area (wellfy, freelance, personal)
- Click to navigate to project detail page

**Invoice Deadlines**
- Invoice `due_date` shown as financial deadline markers
- Color by status (overdue=red, upcoming=amber, paid=green)
- Click to open invoice

**Social Media Schedule**
- Scheduled posts shown on their `scheduled_date`
- Platform icon (LinkedIn=🔗, Instagram=📸)
- Published posts shown with reduced opacity

**iCloud Calendar Sync**
- Bidirectional sync with iCloud CalDAV calendars
- External events rendered alongside PA data
- Calendar color matching from iCloud
- Conflict detection between external and internal events

**Cron Job Schedule (Clawdbot Automations)**
- Scheduled Clawdbot automations shown as recurring calendar events
- Data source: `cron list` command via PA API
- Displays job name, next run time, frequency, and automation icon
- Orange color coding with ⚙️ icon for system automations
- Helps avoid scheduling conflicts with heavy automation windows
- Tooltip shows full cron expression and last/next run times

**Agent Work Activity (AI Team)**
- Historical: Completed sub-agent sessions shown as time blocks (start → finish)
- Data source: `sessions_list` for past work, TASKS.md for queued work
- Shows agent name (James/Markus/etc), task description, duration
- Past work: Cyan color with solid border, slightly faded (opacity 0.7)
- Running work: Cyan with pulse animation and animated glow
- Future/queued: Cyan with dotted border, lighter color ("planned" styling)
- Failed sessions: Red-tinted with warning icon and dashed border
- Enables complete visibility of human + automation + AI workload

#### Smart Features

**Workload Heatmap**
- GitHub-style color intensity on month view days
- Calculated from: tracked time + estimated task time + scheduled events
- Visual indicator of over/under-committed days
- Weekly capacity bar (e.g., "32/40 hours planned")

**Conflict Detection**
- Automatic detection of overlapping events
- Double-booked time slots highlighted
- Overdue tasks + new commitments warning
- Invoice deadline vs. vacation conflict alerts

**Daily Planning Suggestions** (AI-powered)
- "Morning briefing" panel showing:
  - Tasks due today/tomorrow
  - Unfinished tasks from yesterday
  - Suggested time blocks for high-priority work
  - Available focus time slots
- Powered by James Brain integration

**Capacity Planning**
- Forward-looking weekly capacity view
- Committed hours vs. available hours
- Color-coded: green (available) → amber (busy) → red (overcommitted)
- Project-level time allocation breakdown

**Time Blocking Suggestions**
- AI suggests optimal time blocks for tasks based on:
  - Task `estimatedMinutes`
  - Historical category patterns (when does Justin usually code?)
  - Existing calendar commitments
  - Energy level patterns (morning vs. afternoon productivity)

**Pattern Analysis & Insights**
- Weekly/monthly reports:
  - "You code most productively Mon-Wed mornings"
  - "Average meeting load: 4.2h/week"
  - "Task completion rate improves when you time-block"
- Trend charts for time allocation

**Focus Time Protection**
- Define recurring focus time blocks
- Visual warning when scheduling during focus time
- Suggestion to move meetings/distractions

**AI Auto-Scheduling**
- One-click "schedule my week" feature
- AI places unscheduled tasks into optimal time slots
- Respects priorities, deadlines, focus time, and patterns
- User confirms/adjusts before applying

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Smart Calendar Module                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Calendar Page                          │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐       │    │
│  │  │Month │ │Week  │ │Day   │ │Agenda│ │Smart Panel│       │    │
│  │  │View  │ │View  │ │View  │ │View  │ │(insights) │       │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────┐    │
│  │              Unified Event Model (useCalendarEvents)      │    │
│  │  Normalizes: Task | TimeEntry | Project | Invoice |       │    │
│  │              SocialPost | iCloudEvent | CalendarEvent     │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│      ┌──────────┬─────────┼──────────┬──────────┬──────────┐    │
│      ▼          ▼         ▼          ▼          ▼          ▼    │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌─────┐│
│  │Task  │ │Timer     │ │Project│ │Invoice   │ │Social│ │Clawd││
│  │Store │ │Store     │ │Store  │ │Store     │ │API   │ │bot  ││
│  └──────┘ └──────────┘ └──────┘ └──────────┘ └──────┘ │Cron ││
│                                                         │Agent││
│                                                         └─────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │             Smart Engine (useCalendarIntelligence)         │    │
│  │  - Conflict detection       - Workload calculation        │    │
│  │  - Pattern analysis          - AI suggestions              │    │
│  │  - Capacity planning         - Time block optimization    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Calendar Store (Zustand)                  │    │
│  │  - Selected date/range       - Active view mode            │    │
│  │  - Native calendar events    - Filter settings             │    │
│  │  - iCloud sync state         - User preferences            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
CalendarPage (lazy-loaded)
├── CalendarToolbar
│   ├── ViewModeSwitcher (Month | Week | Day | Agenda)
│   ├── DateNavigator (← Today →)
│   ├── FilterDropdown (event types, areas, projects)
│   └── SmartPanelToggle
├── CalendarBody
│   ├── MonthView
│   │   ├── MonthGrid
│   │   │   ├── DayCell (×42)
│   │   │   │   ├── DayNumber
│   │   │   │   ├── EventChip (×3 max)
│   │   │   │   └── OverflowIndicator
│   │   │   └── WorkloadHeatmapOverlay
│   │   └── DayPopover (click day → event list)
│   ├── WeekView
│   │   ├── AllDayRow (tasks, milestones)
│   │   ├── TimeGrid (7 cols × 24 hours)
│   │   │   ├── TimeColumn (×7)
│   │   │   │   ├── TimeBlock (time entries, events)
│   │   │   │   └── CurrentTimeIndicator
│   │   │   └── HourLabels
│   │   └── WeekInsightsBar (capacity, conflicts)
│   ├── DayView
│   │   ├── DayTimeline
│   │   │   ├── HourSlot (×24)
│   │   │   │   └── TimeBlock / EventCard
│   │   │   └── CurrentTimeIndicator
│   │   └── DaySidebar
│   │       ├── TasksDueToday
│   │       ├── DailyStats (hours tracked, tasks completed)
│   │       └── SuggestedActions
│   └── AgendaView
│       ├── AgendaDayGroup (×N days)
│       │   ├── DayHeader
│       │   └── AgendaEventRow (×N events)
│       └── LoadMoreButton
├── SmartPanel (collapsible sidebar)
│   ├── DailyBriefing
│   ├── ConflictAlerts
│   ├── WorkloadMeter
│   ├── AIInsights
│   └── QuickActions
├── EventDetailPopover
│   └── (Renders TaskDialog / TimeEntryForm / InvoicePreview based on source)
└── EventCreateDialog (Phase 4: native calendar events)
```

### Data Flow

```
Existing Stores ──────────┐
(task, timer, project,    │
 invoice, social media)   │
                          ▼
              ┌─────────────────────┐
              │  useCalendarEvents  │ ← Custom hook
              │  (normalizer)       │
              └─────────┬───────────┘
                        │
                        ▼ CalendarEvent[]
              ┌─────────────────────┐
              │  calendarStore      │ ← Zustand store
              │  (view state,       │    (native events,
              │   filters, prefs)   │     user prefs)
              └─────────┬───────────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ Calendar  │ │ Smart    │ │ Calendar │
      │ Views     │ │ Engine   │ │ Toolbar  │
      └──────────┘ └──────────┘ └──────────┘
```

### Unified Event Model

```typescript
// types/calendar.ts

export type CalendarEventSource =
  | 'task'
  | 'time_entry'
  | 'project'
  | 'invoice'
  | 'social_post'
  | 'icloud'
  | 'cron_job'         // Scheduled automations (Clawdbot cron)
  | 'agent_activity'   // AI agent work sessions (past & future)
  | 'calendar_event';  // Native calendar events (Phase 4)

export type CalendarEventType =
  | 'deadline'      // Task due dates, invoice due dates
  | 'time_block'    // Time entries, scheduled work blocks
  | 'milestone'     // Project start/end dates
  | 'scheduled'     // Social posts, planned events
  | 'all_day'       // Full-day events
  | 'range'         // Multi-day spans (project timelines)
  | 'recurring'     // Cron jobs and recurring automations
  | 'agent_work';   // AI agent work sessions (past or planned)

export interface CalendarEvent {
  id: string;
  sourceId: string;           // Original entity ID
  source: CalendarEventSource;
  type: CalendarEventType;
  title: string;
  description?: string;

  // Timing
  startDate: string;          // ISO 8601
  endDate?: string;           // ISO 8601 (for ranges and timed events)
  isAllDay: boolean;
  durationMinutes?: number;

  // Visual
  color: string;              // Hex or Tailwind color token
  icon?: string;              // Lucide icon name
  opacity?: number;           // 0-1 for completed/past events

  // Metadata
  area?: Area;
  projectId?: string;
  clientId?: string;
  priority?: TaskPriority;
  status?: string;            // Source-specific status
  isCompleted?: boolean;
  isOverdue?: boolean;
  isRunning?: boolean;        // For active timers

  // Agent & Automation metadata
  agentName?: string;          // 'James' | 'Markus' | etc. (for agent_activity)
  automationType?: string;     // 'cron' | 'agent_session' | 'queued_task'
  sessionStatus?: 'running' | 'completed' | 'queued' | 'failed';
  cronFrequency?: string;      // 'every 30min' | 'daily at 08:00' | etc.

  // Smart features
  conflictsWith?: string[];   // IDs of conflicting events
  workloadMinutes?: number;   // Contribution to daily workload
  aiSuggested?: boolean;      // AI-generated suggestion
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarFilters {
  sources: CalendarEventSource[];  // Which sources to show
  areas: (Area | 'all')[];
  projects: string[];              // Project IDs, empty = all
  showCompleted: boolean;
  showTimeEntries: boolean;
  showSocialPosts: boolean;
}

export interface CalendarPreferences {
  defaultView: CalendarViewMode;
  weekStartsOn: 0 | 1;            // 0=Sunday, 1=Monday
  workingHoursStart: number;       // 8 (8:00)
  workingHoursEnd: number;         // 18 (18:00)
  showWeekNumbers: boolean;
  showWorkloadHeatmap: boolean;
  smartPanelOpen: boolean;
  enabledSources: CalendarEventSource[];
  showCronJobs: boolean;            // Show automation schedule
  showAgentActivity: boolean;       // Show AI agent work blocks
}

// Smart features
export interface DailyWorkload {
  date: string;
  trackedMinutes: number;
  estimatedMinutes: number;    // From task estimates
  scheduledMinutes: number;    // From calendar events
  totalMinutes: number;
  capacityMinutes: number;     // Default: 480 (8h)
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
    handler: string;     // Action identifier
    data?: unknown;
  };
  createdAt: string;
}
```

---

## Implementation Phases

### Phase 1: Core Calendar Views (Weeks 1–3)

**Goal**: Functional month, week, day, and agenda views showing tasks and time entries

#### 1.1 Calendar Store & Event Normalizer (Week 1)

**Deliverables**:
- [x] `features/calendar/types/index.ts` — Calendar types (CalendarEvent, filters, preferences)
- [x] `features/calendar/stores/calendarStore.ts` — View state, filters, preferences
- [x] `features/calendar/stores/calendarStore.test.ts` — 25+ store tests ✅ (25 tests passing)
- [x] `features/calendar/hooks/useCalendarEvents.ts` — Event normalization hook
- [ ] `features/calendar/hooks/useCalendarEvents.test.ts` — 40+ normalizer tests
- [x] `features/calendar/utils/event-normalizer.ts` — Source → CalendarEvent mappers
- [x] `features/calendar/utils/event-normalizer.test.ts` — 50+ unit tests ✅ (82 tests passing)
- [x] `features/calendar/utils/date-helpers.ts` — Calendar date math utilities
- [x] `features/calendar/utils/date-helpers.test.ts` — 30+ tests ✅ (45 tests passing)
- [x] `features/calendar/constants/colors.ts` — Event colors and icons
- [x] `test/mocks/data/calendar/events.ts` — Mock calendar event data

**Event Normalizer Functions**:
```typescript
// utils/event-normalizer.ts

export function taskToCalendarEvent(task: Task): CalendarEvent | null;
export function timeEntryToCalendarEvent(entry: TimeEntry): CalendarEvent;
export function projectToCalendarEvents(project: Project): CalendarEvent[];
export function invoiceToCalendarEvent(invoice: Invoice): CalendarEvent | null;
export function socialPostToCalendarEvent(post: SocialMediaPost): CalendarEvent | null;
export function cronJobToCalendarEvents(job: CronJob, dateRange: DateRange): CalendarEvent[];
export function agentSessionToCalendarEvent(session: AgentSession): CalendarEvent;
export function queuedTaskToCalendarEvent(task: QueuedAgentTask): CalendarEvent;
export function normalizeEvents(sources: EventSources): CalendarEvent[];
export function filterEvents(events: CalendarEvent[], filters: CalendarFilters): CalendarEvent[];
export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[];
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]>;
```

**Calendar Store**:
```typescript
// stores/calendarStore.ts

interface CalendarState {
  // View state
  selectedDate: Date;
  viewMode: CalendarViewMode;
  visibleRange: { start: Date; end: Date };

  // Filters
  filters: CalendarFilters;

  // Preferences
  preferences: CalendarPreferences;

  // Native events (Phase 4)
  nativeEvents: CalendarEvent[];
  isLoaded: boolean;

  // Actions
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  navigateForward: () => void;
  navigateBackward: () => void;
  goToToday: () => void;
  setFilter: (filter: Partial<CalendarFilters>) => void;
  updatePreferences: (prefs: Partial<CalendarPreferences>) => void;

  // Native events (Phase 4)
  initialize: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}
```

**Acceptance Criteria**:
- [ ] Tasks with `dueDate` normalize to deadline CalendarEvents
- [ ] Time entries normalize to time_block CalendarEvents with proper start/end
- [ ] Projects with dates normalize to range CalendarEvents
- [ ] Invoices with `due_date` normalize to deadline CalendarEvents
- [ ] Social posts normalize to scheduled CalendarEvents
- [ ] Filters correctly include/exclude by source, area, completion status
- [ ] Date helpers handle week boundaries, month boundaries, DST transitions

#### 1.2 Month View (Week 1–2)

**Deliverables**:
- [ ] `features/calendar/components/MonthView/MonthGrid.tsx`
- [ ] `features/calendar/components/MonthView/MonthGrid.test.tsx` — 25+ tests
- [ ] `features/calendar/components/MonthView/DayCell.tsx`
- [ ] `features/calendar/components/MonthView/DayCell.test.tsx` — 20+ tests
- [ ] `features/calendar/components/MonthView/EventChip.tsx`
- [ ] `features/calendar/components/MonthView/EventChip.test.tsx` — 15+ tests
- [ ] `features/calendar/components/MonthView/DayPopover.tsx`
- [ ] `features/calendar/components/MonthView/DayPopover.test.tsx` — 15+ tests
- [ ] `features/calendar/components/MonthView/index.ts`

**Design Reference**: Built on top of the `PostingCalendar` grid pattern, extended with:
- Multi-source event rendering (not just social posts)
- Color-coded event chips by source type
- Popover on day click showing full event list
- Keyboard navigation (arrow keys to move between days)

**Acceptance Criteria**:
- [ ] 42-cell grid (6 weeks × 7 days), Monday start
- [ ] Today highlighted with primary color ring
- [ ] Events rendered as colored chips (max 3 + overflow count)
- [ ] Day click opens popover with full event list
- [ ] Previous/next month days shown with reduced opacity
- [ ] Responsive: chips collapse to dots on mobile
- [ ] Accessible: ARIA grid role, keyboard navigation

#### 1.3 Week View (Week 2)

**Deliverables**:
- [ ] `features/calendar/components/WeekView/WeekGrid.tsx`
- [ ] `features/calendar/components/WeekView/WeekGrid.test.tsx` — 25+ tests
- [ ] `features/calendar/components/WeekView/TimeColumn.tsx`
- [ ] `features/calendar/components/WeekView/TimeColumn.test.tsx` — 15+ tests
- [ ] `features/calendar/components/WeekView/TimeBlock.tsx`
- [ ] `features/calendar/components/WeekView/TimeBlock.test.tsx` — 20+ tests
- [ ] `features/calendar/components/WeekView/AllDayRow.tsx`
- [ ] `features/calendar/components/WeekView/AllDayRow.test.tsx` — 10+ tests
- [ ] `features/calendar/components/WeekView/CurrentTimeIndicator.tsx`
- [ ] `features/calendar/components/WeekView/index.ts`

**Acceptance Criteria**:
- [ ] 7-column grid with hour rows (configurable working hours range)
- [ ] Time entries rendered as positioned blocks within their time slots
- [ ] All-day items (tasks, milestones) at top
- [ ] Current time red line indicator (auto-updates every minute)
- [ ] Overlapping events handled (side-by-side placement)
- [ ] Scroll to current time on load
- [ ] Responsive: collapses to 3-day view on mobile, 1-day on very small screens

#### 1.4 Day View & Agenda View (Week 2–3)

**Deliverables**:
- [ ] `features/calendar/components/DayView/DayTimeline.tsx`
- [ ] `features/calendar/components/DayView/DayTimeline.test.tsx` — 20+ tests
- [ ] `features/calendar/components/DayView/DaySidebar.tsx`
- [ ] `features/calendar/components/DayView/DaySidebar.test.tsx` — 15+ tests
- [ ] `features/calendar/components/DayView/index.ts`
- [ ] `features/calendar/components/AgendaView/AgendaList.tsx`
- [ ] `features/calendar/components/AgendaView/AgendaList.test.tsx` — 20+ tests
- [ ] `features/calendar/components/AgendaView/AgendaEventRow.tsx`
- [ ] `features/calendar/components/AgendaView/AgendaEventRow.test.tsx` — 15+ tests
- [ ] `features/calendar/components/AgendaView/index.ts`

**Acceptance Criteria**:
- [ ] Day view: Full timeline with hour slots, sidebar with tasks/stats
- [ ] Day view: Running timer integration (shows growing block)
- [ ] Agenda view: 7/14/30-day forward list grouped by date
- [ ] Agenda view: Quick actions (mark done, start timer, reschedule)
- [ ] Both views: Responsive, touch-friendly

#### 1.5 Calendar Page & Navigation (Week 3)

**Deliverables**:
- [ ] `pages/CalendarPage.tsx` — Main calendar page
- [ ] `features/calendar/components/CalendarToolbar.tsx`
- [ ] `features/calendar/components/CalendarToolbar.test.tsx` — 20+ tests
- [ ] `features/calendar/components/CalendarBody.tsx`
- [ ] `features/calendar/components/EventDetailPopover.tsx`
- [ ] `features/calendar/components/EventDetailPopover.test.tsx` — 15+ tests
- [ ] `features/calendar/components/FilterDropdown.tsx`
- [ ] `features/calendar/components/FilterDropdown.test.tsx` — 10+ tests

**App Integration**:
- [ ] Route: `/calendar` added to `App.tsx`
- [ ] Nav item: `Calendar` with `CalendarDays` icon added after "Time" in sidebar
- [ ] Keyboard shortcut: `Cmd+8` for calendar navigation
- [ ] Command palette: "Go to Calendar" action

**Acceptance Criteria**:
- [ ] View mode tabs: Month | Week | Day | Agenda
- [ ] Date navigation: ← Today → with date/period label
- [ ] Filter dropdown: Toggle sources, areas
- [ ] Click event chip/block → popover with details + link to source
- [ ] Double-click event → open source entity dialog (TaskDialog, TimeEntryForm, etc.)
- [ ] Mobile: View mode as icon buttons, swipe for date navigation

**Phase 1 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Event Normalizer | 50 | 100% |
| Date Helpers | 30 | 100% |
| Calendar Store | 25 | 95% |
| useCalendarEvents | 40 | 95% |
| MonthView | 75 | 90% |
| WeekView | 70 | 90% |
| DayView | 35 | 90% |
| AgendaView | 35 | 90% |
| Toolbar & Nav | 45 | 90% |
| **Total** | **~405** | **95%+** |

---

### Phase 2: Integration Layer (Weeks 4–5)

**Goal**: Connect all remaining data sources and make cross-referencing seamless

#### 2.1 Invoice & Accounting Integration (Week 4)

**Deliverables**:
- [ ] `features/calendar/utils/accounting-normalizer.ts`
- [ ] `features/calendar/utils/accounting-normalizer.test.ts` — 25+ tests
- [ ] Update `useCalendarEvents` to include invoice deadlines
- [ ] Invoice overdue highlighting on calendar
- [ ] USt deadline markers (quarterly VAT filing deadlines)

**Features**:
- Invoice `due_date` shown as amber deadline markers
- Overdue invoices shown with red destructive styling
- Paid invoices shown with green + reduced opacity
- USt-Voranmeldung deadlines: 10th of month after quarter end
- Monthly recurring expense dates shown (optional filter)

#### 2.2 Social Media Integration (Week 4)

**Deliverables**:
- [ ] `features/calendar/utils/social-normalizer.ts`
- [ ] `features/calendar/utils/social-normalizer.test.ts` — 15+ tests
- [ ] Social post events on calendar with platform icons
- [ ] Click-through to SocialMediaPage

#### 2.3 iCloud Calendar Sync (Week 4–5)

**Deliverables**:
- [ ] `api/src/routes/ical.ts` — New API route for iCloud events
- [ ] `api/src/routes/__tests__/ical.test.ts` — 20+ API tests
- [ ] `features/calendar/hooks/useICloudSync.ts`
- [ ] `features/calendar/hooks/useICloudSync.test.ts` — 15+ tests
- [ ] `features/calendar/utils/ical-normalizer.ts`
- [ ] `features/calendar/utils/ical-normalizer.test.ts` — 20+ tests

**API Design**:
```typescript
// GET /api/ical/events?start=2025-07-01&end=2025-07-31
// Returns normalized iCloud calendar events

interface ICalEvent {
  id: string;
  summary: string;
  description?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location?: string;
  calendarName: string;
  calendarColor: string;
  recurring: boolean;
}
```

**Implementation**: Wraps the existing `~/clawd/scripts/icloud_calendar.py` CalDAV script, exposing events via the Express API. The API server calls the Python script and parses its JSON output.

#### 2.4 Cron Job Integration (Week 5)

**Deliverables**:
- [ ] `features/calendar/utils/cron-normalizer.ts`
- [ ] `features/calendar/utils/cron-normalizer.test.ts` — 20+ tests
- [ ] `features/calendar/hooks/useCronEvents.ts`
- [ ] `features/calendar/hooks/useCronEvents.test.ts` — 10+ tests

**Data Source**: Clawdbot `cron list` command output, exposed via PA API.

**API Design**:
```typescript
// GET /api/calendar/cron-jobs
// Returns scheduled automation events

interface CronJobEvent {
  id: string;
  name: string;              // e.g., "context-compression-check", "gmail-newsletter-scan"
  schedule: string;          // Cron expression: "*/30 * * * *"
  frequency: string;         // Human-readable: "every 30 minutes"
  nextRun: string;           // ISO 8601 next execution time
  lastRun?: string;          // ISO 8601 last execution time
  enabled: boolean;
  description?: string;
}
```

**Normalization**:
```typescript
export function cronJobToCalendarEvents(
  job: CronJobEvent,
  dateRange: { start: Date; end: Date }
): CalendarEvent[];  // Generates recurring events within the date range
```

**Visual Design**:
- Icon: ⚙️ (Settings/Cog) or 🤖 (Robot)
- Color: Orange (`bg-orange-500/10`)
- Style: Compact chip with automation icon, shows job name + frequency
- Recurring events shown with dotted left border
- Tooltip: Full cron schedule, last/next run times

**Benefits**:
- Justin sees exactly when automated processes run
- Avoid scheduling meetings/focus time during heavy automation windows
- Quick visibility into system health (are crons running?)

#### 2.5 Agent Work Activity Integration (Week 5)

**Deliverables**:
- [ ] `features/calendar/utils/agent-activity-normalizer.ts`
- [ ] `features/calendar/utils/agent-activity-normalizer.test.ts` — 25+ tests
- [ ] `features/calendar/hooks/useAgentActivity.ts`
- [ ] `features/calendar/hooks/useAgentActivity.test.ts` — 15+ tests
- [ ] `api/src/routes/agent-activity.ts` — API route for agent sessions
- [ ] `api/src/routes/__tests__/agent-activity.test.ts` — 15+ tests

**Data Sources**:

1. **Historical (completed work)** — `sessions_list` command
2. **Future (queued tasks)** — TASKS.md / task queue

**API Design**:
```typescript
// GET /api/calendar/agent-activity?start=2025-07-01&end=2025-07-31
// Returns past agent sessions + queued future work

interface AgentSession {
  id: string;
  agent: string;              // 'James' | 'Markus' | 'Main'
  label: string;              // Session label / task description
  startTime: string;          // ISO 8601
  endTime?: string;           // ISO 8601 (null if still running)
  durationMinutes?: number;
  status: 'running' | 'completed' | 'failed';
  channel: string;            // 'discord' | 'subagent' | 'cron'
}

interface QueuedAgentTask {
  id: string;
  title: string;
  estimatedMinutes?: number;
  scheduledFor?: string;      // ISO 8601 (if time-specific)
  priority: 'high' | 'medium' | 'low';
  assignedAgent?: string;
}
```

**Normalization**:
```typescript
// Historical sessions → time blocks (concrete past work)
export function agentSessionToCalendarEvent(session: AgentSession): CalendarEvent;

// Queued tasks → tentative future blocks
export function queuedTaskToCalendarEvent(task: QueuedAgentTask): CalendarEvent;
```

**Visual Design**:

| Type | Style | Color | Border |
|------|-------|-------|--------|
| Completed agent work | Solid block, slightly faded (opacity 0.7) | Cyan (`bg-cyan-500/10`) | Solid left border |
| Running agent work | Solid block with pulse animation | Cyan (`bg-cyan-500/20`) | Solid + animated glow |
| Queued/planned work | Light block | Cyan (`bg-cyan-500/5`) | Dotted left border |
| Failed session | Faded with warning icon | Red-tinted cyan | Dashed border |

**Agent Name Display**: Shows agent avatar/icon + name (e.g., "🤖 Markus — Smart Calendar spec update")

**Benefits for Justin**:
- **Complete system visibility**: His work + automation schedule + AI team capacity in one view
- **Conflict detection**: Avoid scheduling human work when agents are doing heavy processing
- **Historical record**: See what got done, by whom (human or AI), and when
- **Capacity planning**: Understand total AI team workload alongside personal workload
- **Accountability**: Track agent productivity and task completion rates

#### 2.6 Cross-Reference Navigation (Week 5)

**Deliverables**:
- [ ] `features/calendar/components/EventDetailPopover.tsx` — Enhanced with navigation
- [ ] Deep links from calendar events to source pages
- [ ] "Show in Calendar" buttons added to:
  - Task cards (link to calendar day view with task highlighted)
  - Time entries (link to calendar week view with entry visible)
  - Invoice list (link to calendar showing due date)
  - Project detail (link to calendar showing project timeline)
- [ ] URL sync: `/calendar?date=2025-07-22&view=week` for deep-linkable calendar state

**Phase 2 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Accounting Normalizer | 25 | 100% |
| Social Normalizer | 15 | 100% |
| iCloud API Route | 20 | 95% |
| iCloud Normalizer | 20 | 100% |
| iCloud Sync Hook | 15 | 90% |
| Cron Job Normalizer | 20 | 100% |
| Cron Events Hook | 10 | 90% |
| Agent Activity Normalizer | 25 | 100% |
| Agent Activity Hook | 15 | 90% |
| Agent Activity API Route | 15 | 95% |
| Cross-Reference Nav | 15 | 90% |
| **Total** | **~195** | **95%+** |

---

### Phase 3: Smart Features — Workload & Conflicts (Weeks 6–7)

**Goal**: Add intelligence layer — workload visualization, conflict detection, daily briefing

#### 3.1 Workload Analysis Engine (Week 6)

**Deliverables**:
- [ ] `features/calendar/utils/workload-calculator.ts`
- [ ] `features/calendar/utils/workload-calculator.test.ts` — 35+ tests
- [ ] `features/calendar/hooks/useWorkload.ts`
- [ ] `features/calendar/hooks/useWorkload.test.ts` — 15+ tests

**Workload Calculation Logic**:
```typescript
function calculateDailyWorkload(
  date: string,
  events: CalendarEvent[],
  preferences: CalendarPreferences
): DailyWorkload {
  const dayEvents = events.filter(e => isSameDay(e.startDate, date));

  const trackedMinutes = dayEvents
    .filter(e => e.source === 'time_entry')
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  const estimatedMinutes = dayEvents
    .filter(e => e.source === 'task' && !e.isCompleted)
    .reduce((sum, e) => sum + (e.workloadMinutes || 30), 0); // Default 30min per task

  const scheduledMinutes = dayEvents
    .filter(e => e.source === 'icloud' || e.source === 'calendar_event')
    .reduce((sum, e) => sum + (e.durationMinutes || 60), 0);

  const agentMinutes = dayEvents
    .filter(e => e.source === 'agent_activity')
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  const totalMinutes = trackedMinutes + estimatedMinutes + scheduledMinutes;
  // Note: agentMinutes tracked separately — AI work doesn't count against human capacity
  // but is available for system-level visibility
  const capacityMinutes = (preferences.workingHoursEnd - preferences.workingHoursStart) * 60;

  return {
    date,
    trackedMinutes,
    estimatedMinutes,
    scheduledMinutes,
    totalMinutes,
    capacityMinutes,
    utilizationPercent: Math.round((totalMinutes / capacityMinutes) * 100),
    level: getWorkloadLevel(totalMinutes, capacityMinutes),
  };
}

function getWorkloadLevel(total: number, capacity: number): DailyWorkload['level'] {
  const ratio = total / capacity;
  if (ratio < 0.5) return 'light';
  if (ratio < 0.8) return 'normal';
  if (ratio < 1.0) return 'busy';
  return 'overloaded';
}
```

#### 3.2 Workload Heatmap Overlay (Week 6)

**Deliverables**:
- [ ] `features/calendar/components/WorkloadHeatmap.tsx`
- [ ] `features/calendar/components/WorkloadHeatmap.test.tsx` — 20+ tests
- [ ] `features/calendar/components/CapacityBar.tsx`
- [ ] `features/calendar/components/CapacityBar.test.tsx` — 10+ tests

**Design**: 
- Month view: Each day cell gets a subtle background tint:
  - Light (< 50%): `bg-green-500/5`
  - Normal (50–80%): no overlay
  - Busy (80–100%): `bg-amber-500/10`
  - Overloaded (> 100%): `bg-red-500/10`
- Week view: Capacity bar at top showing "32/40 hrs planned"
- Toggleable via user preferences

#### 3.3 Conflict Detection (Week 6–7)

**Deliverables**:
- [ ] `features/calendar/utils/conflict-detector.ts`
- [ ] `features/calendar/utils/conflict-detector.test.ts` — 30+ tests
- [ ] `features/calendar/components/ConflictBadge.tsx`
- [ ] `features/calendar/components/ConflictBadge.test.tsx` — 10+ tests
- [ ] `features/calendar/components/ConflictPanel.tsx`
- [ ] `features/calendar/components/ConflictPanel.test.tsx` — 15+ tests

**Conflict Types**:
```typescript
type ConflictType =
  | 'time_overlap'       // Two timed events at the same time
  | 'overdue_deadline'   // Task past due date
  | 'overcommitted'      // Day exceeds capacity
  | 'deadline_conflict'  // Invoice due during known absence
  | 'focus_interruption' // Meeting during declared focus time
  | 'automation_overlap' // Heavy cron jobs during focus/meeting time
  | 'agent_overload'     // Too many agent sessions running concurrently
  ;
```

#### 3.4 Daily Briefing / Smart Panel (Week 7)

**Deliverables**:
- [ ] `features/calendar/components/SmartPanel/SmartPanel.tsx`
- [ ] `features/calendar/components/SmartPanel/SmartPanel.test.tsx` — 15+ tests
- [ ] `features/calendar/components/SmartPanel/DailyBriefing.tsx`
- [ ] `features/calendar/components/SmartPanel/DailyBriefing.test.tsx` — 20+ tests
- [ ] `features/calendar/components/SmartPanel/InsightCard.tsx`
- [ ] `features/calendar/components/SmartPanel/InsightCard.test.tsx` — 10+ tests
- [ ] `features/calendar/components/SmartPanel/QuickActions.tsx`
- [ ] `features/calendar/components/SmartPanel/QuickActions.test.tsx` — 10+ tests
- [ ] `features/calendar/components/SmartPanel/index.ts`

**Daily Briefing Content**:
- 📋 Tasks due today (with priority ordering)
- ⏰ Scheduled events/meetings
- ⚠️ Overdue items requiring attention
- 💡 Suggested focus blocks for high-priority unscheduled tasks
- 📊 Workload summary ("You have 6.5h planned, 1.5h free")
- ✅ Yesterday's completions (quick wins summary)

**Smart Panel Position**: Right sidebar (desktop), bottom sheet (mobile), collapsible.

**Phase 3 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Workload Calculator | 35 | 100% |
| Workload Hook | 15 | 95% |
| Heatmap & Capacity | 30 | 90% |
| Conflict Detector | 30 | 100% |
| Conflict UI | 25 | 90% |
| Smart Panel | 55 | 90% |
| **Total** | **~190** | **95%+** |

---

### Phase 4: Native Calendar Events (Weeks 8–9)

**Goal**: Add ability to create, edit, delete native calendar events (not just aggregated data)

#### 4.1 Database Schema & API (Week 8)

**Deliverables**:
- [ ] DB migration: `calendar_events` table
- [ ] `api/src/routes/calendar-events.ts` — CRUD routes
- [ ] `api/src/routes/__tests__/calendar-events.test.ts` — 30+ tests
- [ ] `features/calendar/services/calendarEventService.ts`

#### 4.2 Event CRUD UI (Week 8–9)

**Deliverables**:
- [ ] `features/calendar/components/EventCreateDialog.tsx`
- [ ] `features/calendar/components/EventCreateDialog.test.tsx` — 25+ tests
- [ ] `features/calendar/components/EventEditDialog.tsx`
- [ ] `features/calendar/components/EventEditDialog.test.tsx` — 20+ tests
- [ ] Click empty time slot → create event
- [ ] Drag to create event (time range selection)
- [ ] Quick event creation (keyboard shortcut: `N`)

**Event Fields**:
```typescript
interface CreateCalendarEvent {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  color?: string;
  area?: Area;
  projectId?: string;
  recurring?: RecurrenceRule;
  reminder?: number;           // Minutes before
  location?: string;
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;            // Every N frequency units
  endDate?: string;
  count?: number;
  daysOfWeek?: number[];       // 0=Mon, 6=Sun
}
```

#### 4.3 Drag & Drop (Week 9)

**Deliverables**:
- [ ] Drag-resize events (change duration)
- [ ] Drag-move events (reschedule)
- [ ] Drag task from sidebar to calendar (schedule task)
- [ ] Uses `@dnd-kit` (already in dependencies)

**Phase 4 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| API Routes | 30 | 95% |
| Service Layer | 15 | 95% |
| Event Create Dialog | 25 | 90% |
| Event Edit Dialog | 20 | 90% |
| Drag & Drop | 20 | 85% |
| **Total** | **~110** | **92%+** |

---

### Phase 5: AI Intelligence (Weeks 10–12)

**Goal**: AI-powered suggestions, pattern analysis, auto-scheduling

#### 5.1 Pattern Analysis Engine (Week 10)

**Deliverables**:
- [ ] `features/calendar/utils/pattern-analyzer.ts`
- [ ] `features/calendar/utils/pattern-analyzer.test.ts` — 30+ tests
- [ ] `features/calendar/hooks/useCalendarInsights.ts`
- [ ] `features/calendar/hooks/useCalendarInsights.test.ts` — 15+ tests

**Pattern Analysis**:
```typescript
interface ProductivityPatterns {
  // When does the user do their best deep work?
  peakCodingHours: { start: number; end: number; dayOfWeek: number[] };
  // Average meeting load
  avgMeetingHoursPerWeek: number;
  // Task completion patterns
  avgTaskCompletionTime: number;  // days from creation to done
  completionRate: number;         // percentage of tasks completed on time
  // Work patterns
  avgStartTime: string;           // When does the day usually start?
  avgEndTime: string;
  mostProductiveDay: string;
  leastProductiveDay: string;
}

function analyzePatterns(
  timeEntries: TimeEntry[],
  tasks: Task[],
  lookbackDays: number
): ProductivityPatterns;
```

#### 5.2 AI Suggestions Panel (Week 10–11)

**Deliverables**:
- [ ] `features/calendar/components/SmartPanel/AISuggestions.tsx`
- [ ] `features/calendar/components/SmartPanel/AISuggestions.test.tsx` — 20+ tests
- [ ] `features/calendar/utils/suggestion-generator.ts`
- [ ] `features/calendar/utils/suggestion-generator.test.ts` — 25+ tests

**Suggestion Types**:
```typescript
type SuggestionType =
  | 'schedule_task'      // "Schedule 'Build API' for Wed 9-11am (your peak coding time)"
  | 'reschedule'         // "Move meeting to Thu — Tue is overloaded"
  | 'focus_block'        // "Block 2pm-4pm for deep work (no meetings)"
  | 'deadline_warning'   // "Invoice RE-2025-012 due in 3 days"
  | 'capacity_alert'     // "Next week is at 120% capacity"
  | 'break_reminder'     // "You've been coding 3h straight — take a break"
  | 'achievement'        // "🎉 You completed all tasks on time this week!"
  ;
```

#### 5.3 Time Block Optimization (Week 11)

**Deliverables**:
- [ ] `features/calendar/utils/time-block-optimizer.ts`
- [ ] `features/calendar/utils/time-block-optimizer.test.ts` — 25+ tests
- [ ] `features/calendar/components/AutoScheduleDialog.tsx`
- [ ] `features/calendar/components/AutoScheduleDialog.test.tsx` — 20+ tests

**Auto-Schedule Algorithm**:
```typescript
function generateOptimalSchedule(
  unscheduledTasks: Task[],
  existingEvents: CalendarEvent[],
  patterns: ProductivityPatterns,
  preferences: CalendarPreferences,
  dateRange: { start: Date; end: Date }
): ScheduledBlock[] {
  // 1. Sort tasks by priority and deadline urgency
  // 2. Find available time slots
  // 3. Match task type to optimal time (coding → peak hours)
  // 4. Respect capacity limits and focus time
  // 5. Insert buffer time between blocks
  // 6. Return proposed schedule for user approval
}
```

#### 5.4 Insights Dashboard (Week 12)

**Deliverables**:
- [ ] `features/calendar/components/InsightsDashboard.tsx`
- [ ] `features/calendar/components/InsightsDashboard.test.tsx` — 15+ tests
- [ ] Weekly productivity summary
- [ ] Time allocation trends (Recharts)
- [ ] Goal tracking (target hours per project)

**Phase 5 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Pattern Analyzer | 30 | 100% |
| Insights Hook | 15 | 95% |
| AI Suggestions | 45 | 90% |
| Time Block Optimizer | 25 | 100% |
| Auto-Schedule | 20 | 90% |
| Insights Dashboard | 15 | 90% |
| **Total** | **~150** | **95%+** |

---

### Phase 6: Polish & Advanced Features (Weeks 13–14)

**Goal**: Mobile optimization, year view, keyboard shortcuts, performance

#### 6.1 Mobile Optimization (Week 13)

**Deliverables**:
- [ ] Touch gesture support (swipe left/right for navigation)
- [ ] Mobile-specific agenda view as default
- [ ] Bottom sheet for Smart Panel on mobile
- [ ] Responsive week view (3-day on tablet, 1-day on phone)
- [ ] Touch-friendly event creation (long-press to create)

#### 6.2 Year Overview (Week 13)

**Deliverables**:
- [ ] `features/calendar/components/YearView/YearHeatmap.tsx`
- [ ] `features/calendar/components/YearView/YearHeatmap.test.tsx` — 15+ tests
- [ ] GitHub-style contribution heatmap showing daily activity
- [ ] Click month to drill into month view

#### 6.3 Keyboard Shortcuts & Accessibility (Week 13–14)

**Shortcuts**:
| Shortcut | Action |
|----------|--------|
| `M` | Switch to month view |
| `W` | Switch to week view |
| `D` | Switch to day view |
| `A` | Switch to agenda view |
| `T` | Go to today |
| `N` | Create new event |
| `←` / `→` | Navigate backward/forward |
| `Enter` | Open selected event detail |
| `Esc` | Close popover/dialog |
| `/` | Focus filter search |

**Accessibility**:
- ARIA roles: grid, gridcell, dialog
- Screen reader announcements for navigation
- Focus management in popovers
- High contrast mode support

#### 6.4 Performance Optimization (Week 14)

**Deliverables**:
- [ ] Virtualized rendering for month view (only render visible cells)
- [ ] Lazy loading of non-visible date ranges
- [ ] Memoized event grouping and filtering
- [ ] Event source caching (avoid re-normalizing on every render)
- [ ] Intersection Observer for scroll-based loading in agenda view

**Performance Targets**:
| Metric | Target |
|--------|--------|
| Initial render | < 200ms |
| View switch | < 100ms |
| Date navigation | < 50ms |
| Event count support | 1000+ events per month |
| Memory overhead | < 10MB for full year |

**Phase 6 Test Summary**:

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Mobile Gestures | 15 | 85% |
| Year View | 15 | 90% |
| Keyboard Shortcuts | 20 | 95% |
| Accessibility | 15 | 90% |
| Performance Tests | 10 | — |
| **Total** | **~75** | **90%+** |

---

## UI/UX Design

### Color System (Event Source Colors)

```typescript
export const EVENT_COLORS: Record<CalendarEventSource, { bg: string; text: string; dot: string }> = {
  task:           { bg: 'bg-blue-500/10',   text: 'text-blue-700',    dot: 'bg-blue-500' },
  time_entry:     { bg: 'bg-emerald-500/10', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  project:        { bg: 'bg-violet-500/10',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  invoice:        { bg: 'bg-amber-500/10',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  social_post:    { bg: 'bg-pink-500/10',    text: 'text-pink-700',    dot: 'bg-pink-500' },
  icloud:         { bg: 'bg-sky-500/10',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  cron_job:        { bg: 'bg-orange-500/10',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  agent_activity:  { bg: 'bg-cyan-500/10',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  calendar_event:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
};
```

### Month View Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀  July 2025  ▶   [Today]   [Month] [Week] [Day] [Agenda]  🔍 │
├──────────────────────────────────────────────────────────────────┤
│  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │  Sun    │
├────────┼────────┼────────┼────────┼────────┼────────┼─────────┤
│ 30     │  1     │  2     │  3     │  4     │  5     │  6      │
│        │ ■ API  │ ■ Team │        │ ■ Invoice│       │         │
│        │   call │   mtg  │        │   due   │        │         │
├────────┼────────┼────────┼────────┼────────┼────────┼─────────┤
│  7     │  8     │  9     │ 10     │ 11     │ 12     │ 13      │
│ ■■■    │ ■ Code │ ■■     │ ■ USt  │        │ ■ Post │         │
│ +2 more│   sprint│       │deadline│        │ 📸     │         │
├────────┼────────┼────────┼────────┼────────┼────────┼─────────┤
│ ...    │        │        │        │        │        │         │
└────────┴────────┴────────┴────────┴────────┴────────┴─────────┘
                                              ┌──────────────────┐
                                              │ 📋 Smart Panel   │
                                              ├──────────────────┤
                                              │ Today's Focus    │
                                              │ • Build API (P1) │
                                              │ • Client call 2pm│
                                              │ • Invoice overdue│
                                              │──────────────────│
                                              │ ⚠️ 1 Conflict    │
                                              │ Meeting overlaps │
                                              │ with focus time  │
                                              │──────────────────│
                                              │ 📊 This Week     │
                                              │ ████████░░ 32/40h│
                                              └──────────────────┘
```

### Week View Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀  Jul 21 – 27  ▶   [Today]   [Month] [Week] [Day] [Agenda] 🔍│
├──────────────────────────────────────────────────────────────────┤
│         │  Mon 21 │ Tue 22  │ Wed 23  │ Thu 24  │ Fri 25 │ ... │
│All Day  │ ■ Task  │ ■ Task  │         │ ■ Proj  │ ■ Inv  │     │
│         │  due    │  due    │         │ deadline│  due   │     │
├─────────┼─────────┼─────────┼─────────┼─────────┼────────┤     │
│  8:00   │         │         │         │         │        │     │
│         │ ┌─────┐ │         │         │         │        │     │
│  9:00   │ │ Code│ │         │ ┌─────┐ │         │        │     │
│         │ │     │ │         │ │ Code│ │         │        │     │
│ 10:00   │ │     │ │ ┌─────┐│ │     │ │         │        │     │
│         │ └─────┘ │ │ Mtg ││ │     │ │ ┌─────┐│        │     │
│ 11:00   │         │ │     ││ └─────┘ │ │ Admin││        │     │
│         │         │ └─────┘│         │ │     ││        │     │
│ 12:00   │         │        │         │ └─────┘│        │     │
│─────────│─── now ──│────────│─────────│────────│────────│     │
│ 13:00   │         │        │         │         │        │     │
└─────────┴─────────┴────────┴─────────┴─────────┴────────┴─────┘
```

### Mobile Layout

```
┌────────────────────────┐
│  ◀ July 2025 ▶ [Today] │
│  [📅] [📋] [📆] [📄]   │ ← View mode icons
├────────────────────────┤
│ AGENDA VIEW (default)  │
├────────────────────────┤
│ TODAY — Mon, Jul 21    │
│ ┌──────────────────┐   │
│ │ 🔵 Build Calendar │   │
│ │ Due today • P1    │   │
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │ 🟢 9:00-11:30    │   │
│ │ Coding • Wellfy   │   │
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │ 🟣 14:00-15:00   │   │
│ │ Client meeting    │   │
│ └──────────────────┘   │
├────────────────────────┤
│ TOMORROW — Tue, Jul 22 │
│ ┌──────────────────┐   │
│ │ 🟠 Invoice due    │   │
│ │ RE-2025-012 €2.4k │   │
│ └──────────────────┘   │
│ ...                    │
├────────────────────────┤
│     ▲ Smart Panel      │ ← Pull-up bottom sheet
│ ┌──────────────────┐   │
│ │ 💡 Block 2-4pm   │   │
│ │ for deep work     │   │
│ └──────────────────┘   │
└────────────────────────┘
```

---

## Database Schema

### New Tables

#### calendar_events (Phase 4)

```sql
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,           -- ISO 8601
  end_date TEXT,                       -- ISO 8601
  is_all_day INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6366f1',        -- Indigo default
  area TEXT DEFAULT 'personal',
  project_id TEXT REFERENCES projects(id),
  location TEXT,
  
  -- Recurrence
  recurring INTEGER DEFAULT 0,
  recurrence_rule TEXT,                -- JSON: { frequency, interval, endDate, count, daysOfWeek }
  recurrence_parent_id TEXT REFERENCES calendar_events(id),
  recurrence_exception INTEGER DEFAULT 0,  -- Is this an exception to a recurring event?
  
  -- Reminders
  reminder_minutes INTEGER,            -- NULL = no reminder
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_events_dates ON calendar_events(start_date, end_date);
CREATE INDEX idx_calendar_events_recurring ON calendar_events(recurrence_parent_id);
```

#### calendar_preferences

```sql
CREATE TABLE calendar_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_view TEXT DEFAULT 'month',
  week_starts_on INTEGER DEFAULT 1,        -- 1=Monday
  working_hours_start INTEGER DEFAULT 8,
  working_hours_end INTEGER DEFAULT 18,
  show_week_numbers INTEGER DEFAULT 0,
  show_workload_heatmap INTEGER DEFAULT 1,
  smart_panel_open INTEGER DEFAULT 1,
  enabled_sources TEXT DEFAULT '["task","time_entry","project","invoice","social_post","icloud","cron_job","agent_activity","calendar_event"]',
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Migrations

```sql
-- Migration 001: Add calendar_events table
-- Migration 002: Add calendar_preferences table
-- Migration 003: Add indices for date-range queries on existing tables
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_status ON tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date_status ON invoices(due_date, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_end ON time_entries(start_time, end_time);
```

---

## API Endpoints

### Calendar Events (Phase 4)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar/events` | GET | List events (with date range filter) |
| `/api/calendar/events` | POST | Create event |
| `/api/calendar/events/:id` | GET | Get event detail |
| `/api/calendar/events/:id` | PATCH | Update event |
| `/api/calendar/events/:id` | DELETE | Delete event |
| `/api/calendar/preferences` | GET | Get user preferences |
| `/api/calendar/preferences` | PATCH | Update preferences |

### Aggregated Calendar Feed (Phase 1)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar/feed` | GET | Unified event feed across all sources |

**Query Parameters**:
```
GET /api/calendar/feed?start=2025-07-01&end=2025-07-31&sources=task,time_entry,project
```

**Response**: `CalendarEvent[]` — already normalized to unified format.

### iCloud Sync (Phase 2)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ical/events` | GET | Fetch iCloud calendar events |
| `/api/ical/calendars` | GET | List available iCloud calendars |

### Cron Jobs (Phase 2)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar/cron-jobs` | GET | List scheduled Clawdbot automations |

### Agent Activity (Phase 2)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar/agent-activity` | GET | Agent sessions & queued tasks (date range filter) |
| `/api/calendar/agent-activity/sessions` | GET | Historical agent sessions only |
| `/api/calendar/agent-activity/queued` | GET | Queued/planned agent tasks only |

### Smart Features (Phase 5)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar/workload` | GET | Daily workload data for date range |
| `/api/calendar/conflicts` | GET | Detected conflicts for date range |
| `/api/calendar/suggestions` | GET | AI-generated suggestions |
| `/api/calendar/auto-schedule` | POST | Generate optimal schedule proposal |
| `/api/calendar/insights` | GET | Pattern analysis and insights |

---

## Test Strategy

### Testing Pyramid

```
        ┌──────────┐
        │   E2E    │  5%  — Critical user flows (create event, navigate views)
        ├──────────┤
        │Integration│ 25% — Component with stores, API mocking
        ├──────────┤
        │  Unit    │ 70% — Utils, normalizers, calculators, store logic
        └──────────┘
```

### Coverage Targets

| Module | Tests | Coverage | Method |
|--------|-------|----------|--------|
| Event Normalizer | 50 | 100% | Unit tests |
| Date Helpers | 30 | 100% | Unit tests |
| Calendar Store | 25 | 95% | Unit + integration |
| Workload Calculator | 35 | 100% | Unit tests |
| Conflict Detector | 30 | 100% | Unit tests |
| Pattern Analyzer | 30 | 100% | Unit tests |
| Suggestion Generator | 25 | 95% | Unit tests |
| Time Block Optimizer | 25 | 100% | Unit tests |
| Month View | 75 | 90% | Component tests |
| Week View | 70 | 90% | Component tests |
| Day View | 35 | 90% | Component tests |
| Agenda View | 35 | 90% | Component tests |
| Smart Panel | 55 | 90% | Component tests |
| Event CRUD | 45 | 90% | Component + API tests |
| Drag & Drop | 20 | 85% | Component tests |
| API Routes | 50 | 95% | Supertest |
| iCloud Integration | 35 | 90% | Unit + mocked API |
| Keyboard & A11y | 35 | 90% | Component tests |
| **Total** | **~770** | **95%+** | |

### Mock Data

```typescript
// test/mocks/data/calendar/events.ts

export const mockCalendarEvents: CalendarEvent[] = [
  // Task deadlines
  { id: 'cal-task-1', sourceId: 'task-1', source: 'task', type: 'deadline', ... },
  // Time entries
  { id: 'cal-time-1', sourceId: 'te-1', source: 'time_entry', type: 'time_block', ... },
  // Project milestones
  { id: 'cal-proj-1', sourceId: 'proj-1', source: 'project', type: 'range', ... },
  // Invoice deadlines
  { id: 'cal-inv-1', sourceId: 'inv-1', source: 'invoice', type: 'deadline', ... },
  // Social posts
  { id: 'cal-social-1', sourceId: 'sp-1', source: 'social_post', type: 'scheduled', ... },
  // iCloud events
  { id: 'cal-ical-1', sourceId: 'ical-1', source: 'icloud', type: 'time_block', ... },
  // Cron jobs
  { id: 'cal-cron-1', sourceId: 'cron-1', source: 'cron_job', type: 'recurring', title: 'Context compression check', cronFrequency: 'every 30 min', ... },
  { id: 'cal-cron-2', sourceId: 'cron-2', source: 'cron_job', type: 'recurring', title: 'Gmail newsletter scan', cronFrequency: 'daily at 08:00', ... },
  // Agent activity
  { id: 'cal-agent-1', sourceId: 'session-1', source: 'agent_activity', type: 'agent_work', agentName: 'Markus', sessionStatus: 'completed', ... },
  { id: 'cal-agent-2', sourceId: 'session-2', source: 'agent_activity', type: 'agent_work', agentName: 'James', sessionStatus: 'running', ... },
  { id: 'cal-agent-3', sourceId: 'queued-1', source: 'agent_activity', type: 'agent_work', agentName: 'Markus', sessionStatus: 'queued', ... },
  // Native events
  { id: 'cal-native-1', sourceId: 'ce-1', source: 'calendar_event', type: 'time_block', ... },
];

export const mockConflicts: CalendarConflict[] = [ ... ];
export const mockWorkload: DailyWorkload[] = [ ... ];
export const mockInsights: CalendarInsight[] = [ ... ];
```

### TDD Workflow

Following the established accounting pattern:

1. **Write failing test** → Define expected behavior
2. **Implement minimum code** → Make test pass
3. **Refactor** → Clean up while keeping tests green
4. **Repeat** → Next feature

Example for event normalizer:

```typescript
// utils/event-normalizer.test.ts

describe('taskToCalendarEvent', () => {
  it('returns null for tasks without due date', () => {
    const task = createMockTask({ dueDate: undefined });
    expect(taskToCalendarEvent(task)).toBeNull();
  });

  it('creates deadline event for task with due date', () => {
    const task = createMockTask({ dueDate: '2025-07-22T00:00:00Z', title: 'Build API' });
    const event = taskToCalendarEvent(task);
    expect(event).toMatchObject({
      source: 'task',
      type: 'deadline',
      title: 'Build API',
      isAllDay: true,
      startDate: '2025-07-22T00:00:00Z',
    });
  });

  it('marks overdue tasks', () => {
    const pastDate = subDays(new Date(), 3).toISOString();
    const task = createMockTask({ dueDate: pastDate, status: 'in_progress' });
    const event = taskToCalendarEvent(task);
    expect(event?.isOverdue).toBe(true);
  });

  it('marks completed tasks with reduced opacity', () => {
    const task = createMockTask({ status: 'done', completedAt: new Date().toISOString() });
    const event = taskToCalendarEvent(task);
    expect(event?.isCompleted).toBe(true);
    expect(event?.opacity).toBe(0.5);
  });

  it('sets priority-based color', () => {
    const highPriority = createMockTask({ priority: 1 });
    const lowPriority = createMockTask({ priority: 3 });
    expect(taskToCalendarEvent(highPriority)?.color).toBe(EVENT_COLORS.task.dot);
    // etc.
  });
});
```

---

## Project Structure

```
app/src/
├── features/
│   └── calendar/
│       ├── components/
│       │   ├── CalendarToolbar.tsx
│       │   ├── CalendarToolbar.test.tsx
│       │   ├── CalendarBody.tsx
│       │   ├── EventDetailPopover.tsx
│       │   ├── EventDetailPopover.test.tsx
│       │   ├── FilterDropdown.tsx
│       │   ├── FilterDropdown.test.tsx
│       │   ├── EventCreateDialog.tsx          # Phase 4
│       │   ├── EventCreateDialog.test.tsx
│       │   ├── EventEditDialog.tsx             # Phase 4
│       │   ├── EventEditDialog.test.tsx
│       │   ├── AutoScheduleDialog.tsx          # Phase 5
│       │   ├── AutoScheduleDialog.test.tsx
│       │   ├── MonthView/
│       │   │   ├── MonthGrid.tsx
│       │   │   ├── MonthGrid.test.tsx
│       │   │   ├── DayCell.tsx
│       │   │   ├── DayCell.test.tsx
│       │   │   ├── EventChip.tsx
│       │   │   ├── EventChip.test.tsx
│       │   │   ├── DayPopover.tsx
│       │   │   ├── DayPopover.test.tsx
│       │   │   └── index.ts
│       │   ├── WeekView/
│       │   │   ├── WeekGrid.tsx
│       │   │   ├── WeekGrid.test.tsx
│       │   │   ├── TimeColumn.tsx
│       │   │   ├── TimeColumn.test.tsx
│       │   │   ├── TimeBlock.tsx
│       │   │   ├── TimeBlock.test.tsx
│       │   │   ├── AllDayRow.tsx
│       │   │   ├── AllDayRow.test.tsx
│       │   │   ├── CurrentTimeIndicator.tsx
│       │   │   └── index.ts
│       │   ├── DayView/
│       │   │   ├── DayTimeline.tsx
│       │   │   ├── DayTimeline.test.tsx
│       │   │   ├── DaySidebar.tsx
│       │   │   ├── DaySidebar.test.tsx
│       │   │   └── index.ts
│       │   ├── AgendaView/
│       │   │   ├── AgendaList.tsx
│       │   │   ├── AgendaList.test.tsx
│       │   │   ├── AgendaEventRow.tsx
│       │   │   ├── AgendaEventRow.test.tsx
│       │   │   └── index.ts
│       │   ├── YearView/                      # Phase 6
│       │   │   ├── YearHeatmap.tsx
│       │   │   ├── YearHeatmap.test.tsx
│       │   │   └── index.ts
│       │   └── SmartPanel/
│       │       ├── SmartPanel.tsx
│       │       ├── SmartPanel.test.tsx
│       │       ├── DailyBriefing.tsx
│       │       ├── DailyBriefing.test.tsx
│       │       ├── ConflictPanel.tsx
│       │       ├── ConflictPanel.test.tsx
│       │       ├── InsightCard.tsx
│       │       ├── InsightCard.test.tsx
│       │       ├── WorkloadHeatmap.tsx
│       │       ├── WorkloadHeatmap.test.tsx
│       │       ├── CapacityBar.tsx
│       │       ├── CapacityBar.test.tsx
│       │       ├── AISuggestions.tsx            # Phase 5
│       │       ├── AISuggestions.test.tsx
│       │       ├── QuickActions.tsx
│       │       ├── QuickActions.test.tsx
│       │       └── index.ts
│       ├── hooks/
│       │   ├── useCalendarEvents.ts
│       │   ├── useCalendarEvents.test.ts
│       │   ├── useWorkload.ts
│       │   ├── useWorkload.test.ts
│       │   ├── useICloudSync.ts
│       │   ├── useICloudSync.test.ts
│       │   ├── useCronEvents.ts                 # Phase 2
│       │   ├── useCronEvents.test.ts
│       │   ├── useAgentActivity.ts              # Phase 2
│       │   ├── useAgentActivity.test.ts
│       │   └── useCalendarInsights.ts          # Phase 5
│       ├── stores/
│       │   ├── calendarStore.ts
│       │   └── calendarStore.test.ts
│       ├── services/
│       │   └── calendarEventService.ts          # Phase 4
│       ├── utils/
│       │   ├── event-normalizer.ts
│       │   ├── event-normalizer.test.ts
│       │   ├── date-helpers.ts
│       │   ├── date-helpers.test.ts
│       │   ├── accounting-normalizer.ts         # Phase 2
│       │   ├── accounting-normalizer.test.ts
│       │   ├── social-normalizer.ts             # Phase 2
│       │   ├── social-normalizer.test.ts
│       │   ├── ical-normalizer.ts               # Phase 2
│       │   ├── ical-normalizer.test.ts
│       │   ├── cron-normalizer.ts               # Phase 2
│       │   ├── cron-normalizer.test.ts
│       │   ├── agent-activity-normalizer.ts     # Phase 2
│       │   ├── agent-activity-normalizer.test.ts
│       │   ├── workload-calculator.ts           # Phase 3
│       │   ├── workload-calculator.test.ts
│       │   ├── conflict-detector.ts             # Phase 3
│       │   ├── conflict-detector.test.ts
│       │   ├── pattern-analyzer.ts              # Phase 5
│       │   ├── pattern-analyzer.test.ts
│       │   ├── suggestion-generator.ts          # Phase 5
│       │   ├── suggestion-generator.test.ts
│       │   ├── time-block-optimizer.ts          # Phase 5
│       │   └── time-block-optimizer.test.ts
│       ├── constants/
│       │   └── colors.ts                        # EVENT_COLORS
│       └── types/
│           └── index.ts
│
├── pages/
│   └── CalendarPage.tsx
│
└── test/
    └── mocks/
        └── data/
            └── calendar/
                ├── events.ts
                ├── workload.ts
                ├── conflicts.ts
                └── insights.ts
```

---

## Implementation Timeline

### Overview

```
Week  1   2   3   4   5   6   7   8   9   10  11  12  13  14
      ├───┴───┼───┴───┼───┴───┼───┴───┼───┴───┼───┴───┼───┴───┤
      │Phase 1: Core  │Phase 2│Phase 3│Phase 4│Phase 5: AI   │Ph6│
      │Calendar Views │Integr.│Smart  │Events │Intelligence  │Pol│
      └───────────────┴───────┴───────┴───────┴──────────────┴───┘
```

### Milestones

| Milestone | Week | Deliverable | Tests |
|-----------|------|-------------|-------|
| M1 | 3 | Core views live (month/week/day/agenda with tasks & time) | ~405 |
| M2 | 5 | All data sources integrated + iCloud + cron + agent activity | ~600 |
| M3 | 7 | Workload heatmap, conflict detection, smart panel | ~705 |
| M4 | 9 | Native calendar events with CRUD + drag & drop | ~815 |
| M5 | 12 | AI suggestions, pattern analysis, auto-scheduling | ~965 |
| M6 | 14 | Mobile polish, year view, a11y, performance | ~1040 |

### Dependencies

| Phase | Depends On | New Packages |
|-------|------------|-------------|
| 1 | Existing stores (task, timer, project, invoice) | None (date-fns, react-day-picker already installed) |
| 2 | Phase 1, iCloud script | None |
| 3 | Phase 1–2 | None |
| 4 | Phase 1 | None (uses existing @dnd-kit) |
| 5 | Phase 3, James Brain integration | None |
| 6 | Phase 1–5 | None |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Week view performance with many events | Medium | High | Virtualization, time-based windowing, event consolidation |
| iCloud CalDAV API changes | Low | Medium | Abstraction layer, fallback to cached data |
| AI suggestion quality | Medium | Medium | Start with rule-based suggestions, graduate to AI |
| Complexity of recurring events | High | Medium | Start without recurrence in Phase 4, add in Phase 6 |
| Mobile touch gesture conflicts | Medium | Low | Use established gesture libraries, careful event delegation |
| State management complexity (7+ stores) | Medium | High | Dedicated aggregation hook, memoization, test coverage |
| Drag & drop precision on time grid | Medium | Medium | Snap-to-grid (15min intervals), visual preview |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Daily active usage | Calendar opened 5+ times/week | Page view analytics |
| View mode preference | Track most-used view | Store analytics |
| Task completion improvement | 15%+ improvement | Compare pre/post rates |
| Smart panel engagement | 3+ interactions/session | Click tracking |
| AI suggestion acceptance | 40%+ acceptance rate | Suggestion tracking |
| Performance budget | <200ms initial render | Lighthouse / Web Vitals |
| Test coverage | 95%+ | Vitest coverage report |
| Mobile usage | 30%+ of calendar views | Viewport tracking |

---

## Future Enhancements (Post-Phase 6)

- [ ] **Shared calendars** — Collaborative calendars with clients
- [ ] **Email-to-event** — Parse meeting invites from email
- [ ] **Google Calendar sync** — Alternative to iCloud
- [ ] **Calendar widget** — Dashboard calendar mini-view
- [ ] **Recurring event exceptions** — Edit single occurrence of recurring event
- [ ] **Event attachments** — Link files/documents to events
- [ ] **Meeting prep AI** — Auto-generate agenda from related tasks/notes
- [ ] **Revenue calendar** — Overlay expected payment dates on calendar
- [ ] **Pomodoro integration** — Timer blocks shown as Pomodoro segments
- [ ] **Calendar export** — ICS file export for sharing

---

## References

- [PostingCalendar.tsx](../app/src/pages/social-media/PostingCalendar.tsx) — Existing calendar grid reference
- [DailyTimeline.tsx](../app/src/components/time/DailyTimeline.tsx) — Timeline pattern reference
- [ACCOUNTING_FEATURE.md](./ACCOUNTING_FEATURE.md) — TDD methodology and phase structure reference
- [date-fns Documentation](https://date-fns.org/) — Date manipulation library
- [Radix UI Primitives](https://www.radix-ui.com/) — Component library
- [@dnd-kit](https://dndkit.com/) — Drag and drop library
- [CalDAV RFC 4791](https://tools.ietf.org/html/rfc4791) — CalDAV protocol reference
- [iCalendar RFC 5545](https://tools.ietf.org/html/rfc5545) — iCalendar data format
