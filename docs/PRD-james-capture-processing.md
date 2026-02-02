# PRD: James AI-Powered Capture Processing

**Version:** 1.0  
**Author:** James (AI Assistant)  
**Date:** 2026-01-30  
**Status:** Draft  
**Area:** Personal Assistant  
**Priority:** High

---

## 1. Executive Summary

This feature transforms the Quick Capture inbox into an AI-powered processing pipeline. When captures are flagged for James to process, the system automatically routes them based on type:

- **Meetings** → Create/update iCloud calendar events
- **Tasks** → Create detailed tasks in the backlog
- **Ideas** → Generate PRD → Create implementation tasks → Link artifacts

This eliminates manual processing overhead while ensuring captures are transformed into actionable, well-documented items.

---

## 2. Problem Statement

### Current State
Users capture thoughts, meetings, tasks, and ideas through Quick Capture. These items sit in the inbox until manually processed. Processing requires:
1. Opening each capture
2. Deciding what to do with it
3. Manually creating the appropriate artifact (task, calendar event, etc.)
4. Writing descriptions, setting priorities, linking projects

### Pain Points
- **Manual overhead**: Each capture requires multiple clicks and context switches
- **Inconsistent quality**: Rushed processing leads to sparse task descriptions
- **Lost context**: Original ideas lose nuance when condensed to task titles
- **Delayed processing**: Inbox items accumulate when time is short
- **No intelligent expansion**: Raw captures aren't enriched with details

### Opportunity
James already has:
- API access to the PA app (tasks, projects, captures)
- iCloud calendar access (CalDAV)
- Ability to generate comprehensive PRDs
- Context about Justin's projects and priorities

Connecting these capabilities creates an intelligent processing pipeline.

---

## 3. Goals

### Primary Goals
1. **Zero-friction capture processing**: Click "Process with James" and the capture is handled
2. **High-quality outputs**: Tasks have detailed descriptions, acceptance criteria, and proper categorization
3. **Intelligent routing**: System determines the best artifact type and handles accordingly
4. **Audit trail**: All processing is logged and reversible

### Secondary Goals
5. **Learning over time**: James improves processing based on corrections/feedback
6. **Batch processing**: Process multiple captures in one action
7. **Preview before commit**: Option to review James's proposed processing before execution

### Non-Goals
- Replacing the manual processing flow (it remains available)
- Auto-processing without user trigger (user must initiate)
- Processing captures from external sources (email, etc.) - that's a separate feature

---

## 4. Target Users

### Primary User: Justin (Solo User)
- **Context**: Busy CTO + freelance developer
- **Behavior**: Captures ideas/tasks throughout the day, processes later
- **Need**: Minimize time from capture to actionable item
- **Tech comfort**: High - can review/edit generated content

### Future Users: Other PA App Users
- Same workflow needs at different technical comfort levels
- May want more/less AI involvement

---

## 5. User Stories

### US-1: Process Meeting Capture
**As a** user who captured a meeting note  
**I want** James to create a calendar event from it  
**So that** the meeting appears on my calendar without manual entry

**Acceptance Criteria:**
- [ ] System detects capture type is "meeting"
- [ ] James parses meeting details (title, date/time, attendees, location)
- [ ] James creates iCloud calendar event via CalDAV
- [ ] Calendar event includes parsed details + original capture as notes
- [ ] Capture is marked as processed with link to calendar event
- [ ] If date/time is ambiguous, James asks for clarification

**Example:**
```
Capture: "Meet with Sarah from wellfy about Q2 roadmap - next Tuesday 2pm at WeWork"

→ Calendar Event:
  Title: "Q2 Roadmap - Sarah (wellfy)"
  Date: 2026-02-04 14:00
  Location: WeWork
  Notes: [original capture text]
```

---

### US-2: Process Task Capture
**As a** user who captured a task  
**I want** James to create a comprehensive task in the backlog  
**So that** I have a well-documented, actionable item

**Acceptance Criteria:**
- [ ] System detects capture type is "task"
- [ ] James generates detailed task description from brief capture
- [ ] Task includes: title, detailed description, suggested priority, area assignment
- [ ] If project context is clear, task is linked to project
- [ ] Description includes implementation hints and acceptance criteria
- [ ] Capture is marked as processed with link to created task

**Example:**
```
Capture: "Add dark mode toggle to settings page"

→ Task:
  Title: "Implement Dark Mode Toggle in Settings"
  Description: |
    ## Overview
    Add a user-facing control to toggle between light, dark, and system themes.
    
    ## Implementation Details
    - Add toggle/select component in Settings → Appearance section
    - Options: Light | Dark | System (follows OS preference)
    - Persist selection to settings store
    - Apply theme immediately on change (no page reload)
    
    ## Acceptance Criteria
    - [ ] Toggle visible in Settings page
    - [ ] Selection persists across sessions
    - [ ] Theme applies immediately
    - [ ] System option respects OS dark mode setting
    
    ## Technical Notes
    - Use existing useSettingsStore hook
    - Theme CSS variables already support dark mode
    
  Priority: Medium
  Area: Personal
  Project: Personal Assistant
```

---

### US-3: Process Idea Capture
**As a** user who captured an idea  
**I want** James to create a PRD and implementation task  
**So that** my idea is properly documented and ready for development

**Acceptance Criteria:**
- [ ] System detects capture type is "idea"
- [ ] James generates comprehensive PRD from the idea
- [ ] PRD follows standard template (problem, goals, user stories, requirements)
- [ ] James creates implementation task linked to PRD
- [ ] Task description references PRD and summarizes key deliverables
- [ ] PRD is saved as markdown and linked in PA app
- [ ] Capture is marked as processed with links to both artifacts

**Example:**
```
Capture: "Weekly summary email - James sends me a summary of the week every Sunday"

→ PRD: "Weekly Summary Email Feature"
  [Full PRD with problem statement, user stories, technical approach...]

→ Task:
  Title: "Implement Weekly Summary Email Feature"
  Description: |
    Implement the Weekly Summary Email feature as specified in PRD.
    
    **PRD:** [link to PRD]
    
    ## Key Deliverables
    1. Cron job triggering Sunday 18:00
    2. Summary generation (tasks completed, time tracked, highlights)
    3. Email composition and sending via Strato SMTP
    4. Settings page for enable/disable and time preference
    
    ## Acceptance Criteria
    - [ ] Email sends automatically every Sunday
    - [ ] Summary includes: completed tasks, time tracked, upcoming deadlines
    - [ ] User can disable in settings
```

---

### US-4: Process Note Capture
**As a** user who captured a general note  
**I want** James to save it appropriately  
**So that** it's stored in the right place for future reference

**Acceptance Criteria:**
- [ ] System detects capture type is "note"
- [ ] James determines best storage location (Second Brain, daily notes, project docs)
- [ ] Note is formatted and saved with appropriate metadata
- [ ] Capture is marked as processed with link to saved note

---

### US-5: Batch Process Multiple Captures
**As a** user with multiple unprocessed captures  
**I want** to process them all with one action  
**So that** I can clear my inbox efficiently

**Acceptance Criteria:**
- [ ] "Process All with James" button in Inbox
- [ ] James processes each capture sequentially
- [ ] Progress indicator shows current item
- [ ] Summary shown at end (X meetings, Y tasks, Z PRDs created)
- [ ] Any failures are reported with option to retry

---

### US-6: Preview Before Processing
**As a** user who wants to review AI outputs  
**I want** to preview what James will create before committing  
**So that** I can make adjustments if needed

**Acceptance Criteria:**
- [ ] "Preview" option alongside "Process"
- [ ] Shows proposed artifact (task details, calendar event, PRD outline)
- [ ] User can edit preview before confirming
- [ ] User can reject and process manually instead

---

## 6. Functional Requirements

### FR-1: Capture Type Detection
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | System must identify capture type (meeting/task/idea/note) from content | High |
| FR-1.2 | Use explicit type if set, otherwise infer from content | High |
| FR-1.3 | Confidence scoring for ambiguous captures | Medium |
| FR-1.4 | Fallback to asking user if confidence is low | Medium |

### FR-2: Meeting Processing
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Parse date/time from natural language | High |
| FR-2.2 | Parse attendees and resolve to contacts if possible | Medium |
| FR-2.3 | Parse location (physical or virtual meeting link) | Medium |
| FR-2.4 | Create iCloud calendar event via CalDAV | High |
| FR-2.5 | Handle recurring meetings | Low |
| FR-2.6 | Support meeting updates (not just creation) | Medium |

### FR-3: Task Processing
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Generate detailed task title from capture | High |
| FR-3.2 | Generate comprehensive description with implementation details | High |
| FR-3.3 | Generate acceptance criteria checklist | High |
| FR-3.4 | Infer priority based on content and context | Medium |
| FR-3.5 | Infer area (wellfy/freelance/personal) from context | Medium |
| FR-3.6 | Link to relevant project if identifiable | Medium |
| FR-3.7 | Create task via PA API | High |

### FR-4: Idea Processing
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Generate full PRD from idea capture | High |
| FR-4.2 | PRD includes all standard sections (problem, goals, stories, requirements) | High |
| FR-4.3 | Save PRD as markdown file | High |
| FR-4.4 | Store PRD reference in PA app | High |
| FR-4.5 | Create linked implementation task | High |
| FR-4.6 | Task references PRD and summarizes deliverables | High |

### FR-5: Processing Infrastructure
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | API endpoint to trigger James processing | High |
| FR-5.2 | Processing happens via Clawdbot (sub-agent or direct) | High |
| FR-5.3 | Mark capture as processed with artifact link | High |
| FR-5.4 | Log all processing actions for audit | Medium |
| FR-5.5 | Handle failures gracefully with retry option | Medium |

---

## 7. Non-Functional Requirements

### NFR-1: Performance
- Processing a single capture should complete within 30 seconds
- Batch processing should show progress (not appear frozen)

### NFR-2: Reliability
- Failed processing should not corrupt or lose the original capture
- Partial failures in batch should not stop remaining items

### NFR-3: Quality
- Generated task descriptions should be immediately useful without editing
- PRDs should be comprehensive enough to start implementation

### NFR-4: Security
- All API calls use authenticated endpoints
- Calendar access uses existing secure CalDAV connection

---

## 8. Technical Approach

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PA Web App    │────▶│    PA API       │────▶│   Clawdbot      │
│   (Frontend)    │     │   (Backend)     │     │   (James)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        │                               │                               │
                        ▼                               ▼                               ▼
                ┌───────────────┐            ┌───────────────┐            ┌───────────────┐
                │  iCloud Cal   │            │   PA API      │            │  File System  │
                │  (CalDAV)     │            │  (Tasks/PRDs) │            │  (PRD .md)    │
                └───────────────┘            └───────────────┘            └───────────────┘
```

### Flow: Process Capture

1. User clicks "Process with James" on capture
2. Frontend calls `POST /api/captures/:id/process-with-james`
3. API triggers Clawdbot via cron run or direct API
4. James receives capture content and type
5. James determines processing route:
   - Meeting → Parse + create calendar event
   - Task → Generate description + create task
   - Idea → Generate PRD + create task
   - Note → Determine storage + save
6. James calls appropriate APIs/services
7. James updates capture as processed via `POST /api/captures/:id/process`
8. Frontend receives success response with artifact links

### API Changes

#### New Endpoint: Process with James
```
POST /api/captures/:id/process-with-james
Authorization: Bearer <token>

Response:
{
  "status": "processing" | "completed" | "failed",
  "message": "Processing capture with James...",
  "jobId": "uuid" // for tracking
}
```

#### New Endpoint: Processing Status
```
GET /api/james/processing/:jobId
Authorization: Bearer <token>

Response:
{
  "status": "pending" | "processing" | "completed" | "failed",
  "captureId": "uuid",
  "result": {
    "type": "meeting" | "task" | "idea" | "note",
    "artifactId": "uuid",
    "artifactType": "calendar_event" | "task" | "prd",
    "summary": "Created task: Implement Dark Mode Toggle"
  },
  "error": null
}
```

### Clawdbot Integration

James already has:
- PA API access (token in `config/pa-api.conf`)
- iCloud calendar access (via CalDAV)
- File system access for PRD markdown

Processing logic lives in James's instruction set. When triggered:
1. Fetch capture via API
2. Analyze content and type
3. Execute appropriate processing
4. Update capture as processed
5. Report result

### Database Changes

#### captures table
Add column: `processing_status` (pending | processing | completed | failed)
Add column: `processed_by` (manual | james)
Add column: `artifact_type` (task | calendar_event | prd | note)
Add column: `artifact_id` (reference to created artifact)

---

## 9. UI/UX Design

### Capture Card Updates

Current process button becomes a dropdown:
```
┌────────────────────────────────────────────┐
│ 💡 Add dark mode toggle to settings        │
│ idea • 2 hours ago                         │
│                                            │
│ [Process ▼]  [Delete]                      │
│  ├─ Process Manually                       │
│  ├─ Process with James                     │
│  └─ Preview with James                     │
└────────────────────────────────────────────┘
```

### Processing State

While James processes:
```
┌────────────────────────────────────────────┐
│ 💡 Add dark mode toggle to settings        │
│ idea • 2 hours ago                         │
│                                            │
│ 🔄 James is processing...                  │
│    Generating PRD...                       │
└────────────────────────────────────────────┘
```

### Completed State

After processing:
```
┌────────────────────────────────────────────┐
│ ✅ Add dark mode toggle to settings        │
│ idea • processed by James • 2 hours ago    │
│                                            │
│ Created:                                   │
│ • PRD: Dark Mode Toggle Feature            │
│ • Task: Implement Dark Mode Toggle         │
│                                            │
│ [View PRD]  [View Task]  [Undo]            │
└────────────────────────────────────────────┘
```

### Batch Processing

Inbox header gets batch action:
```
┌────────────────────────────────────────────┐
│ Inbox                    [Process All ▼]   │
│                           ├─ All (5)       │
│ 5 unprocessed             ├─ Meetings (2)  │
│                           └─ Ideas (3)     │
└────────────────────────────────────────────┘
```

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Processing adoption | 80% of captures processed with James | Count processed_by = james vs manual |
| Quality satisfaction | <10% of James-created tasks edited after creation | Track edits within 24h of creation |
| Time saved | 90% reduction in processing time | Compare avg time: manual vs James |
| PRD completeness | PRDs are implementation-ready | Qualitative review |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| James misunderstands capture intent | Medium | Medium | Preview option, easy undo |
| Calendar event created with wrong time | High | Low | Confirmation for calendar events |
| PRD quality varies | Medium | Medium | PRD template enforcement |
| API rate limits | Low | Low | Queue processing, backoff |
| Clawdbot unavailable | High | Low | Graceful fallback to manual |

---

## 12. Dependencies

1. **PA API authentication** - ✅ Already working
2. **iCloud CalDAV access** - ✅ Already configured
3. **Clawdbot trigger mechanism** - ✅ James button already exists
4. **PRD storage system** - ✅ PRD store and markdown export exist

---

## 13. Implementation Milestones

### Phase 1: Core Processing (MVP)
**Target: 1 week**
- [ ] API endpoint for triggering James processing
- [ ] Task processing with description generation
- [ ] Meeting processing with calendar creation
- [ ] Basic UI (Process with James button)

### Phase 2: Idea Pipeline
**Target: 1 week**
- [ ] PRD generation from ideas
- [ ] Task creation linked to PRD
- [ ] PRD saved to filesystem and PA app

### Phase 3: Polish
**Target: 3 days**
- [ ] Preview mode
- [ ] Batch processing
- [ ] Undo capability
- [ ] Processing status tracking

### Phase 4: Refinement
**Ongoing**
- [ ] Improve processing quality based on feedback
- [ ] Add note processing
- [ ] Learning from corrections

---

## 14. Open Questions

1. **Calendar conflict handling**: What if meeting time conflicts with existing event?
2. **PRD storage location**: Store in PA app DB, filesystem, or both?
3. **Undo mechanism**: How long should undo be available? What exactly gets undone?
4. **Batch limits**: Should there be a limit on batch processing?

---

## 15. Appendix

### A. Capture Types Reference

| Type | Icon | Processing Route |
|------|------|------------------|
| meeting | 📅 | → iCloud Calendar |
| task | ✅ | → PA Tasks (backlog) |
| idea | 💡 | → PRD → Task |
| note | 📝 | → Second Brain / Daily Notes |

### B. Example Processing Prompts

**For Tasks:**
```
Given this task capture: "{capture_content}"

Generate a comprehensive task with:
1. Clear, actionable title
2. Detailed description with implementation approach
3. Acceptance criteria checklist
4. Suggested priority (critical/high/medium/low)
5. Inferred area (wellfy/freelance/personal)
6. Related project if identifiable

Output as JSON matching the PA API task schema.
```

**For Meetings:**
```
Given this meeting capture: "{capture_content}"

Extract:
1. Meeting title/purpose
2. Date and time (resolve relative dates to absolute)
3. Duration (default 1 hour if not specified)
4. Attendees (names/emails if mentioned)
5. Location (physical address or meeting link)

Output as iCal VEVENT format.
```

**For Ideas:**
```
Given this idea capture: "{capture_content}"

Generate a complete PRD following the template with:
1. Executive summary
2. Problem statement
3. Goals and non-goals
4. Target users
5. User stories with acceptance criteria
6. Functional requirements
7. Technical approach
8. Success metrics
9. Implementation milestones

Be comprehensive - this should be implementation-ready.
```

---

*Document generated by James • 2026-01-30*
