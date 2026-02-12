# Personal Assistant

A comprehensive workspace for Justin Deisler — CTO of wellfy GmbH, full-stack developer, and freelance consultant.

This workspace integrates with both **Obsidian** (for note-taking and knowledge management) and **Claude Code** (for AI-assisted development and automation).

---

## About Justin

- **Role:** CTO at wellfy GmbH
- **Side Work:** Freelance full-stack development
- **Focus Areas:** Web development, system architecture, team leadership
- **Goal:** Streamline work across CTO duties, freelance projects, and personal finances

---

## Directory Structure

```
Personal-Assistant/
├── README.md                  # This file
│
├── Tasks/                     # Kanban task management
│   ├── Backlog/               # Ideas and future tasks
│   ├── Queue/                 # Ready to start
│   ├── InProgress/            # Currently working on
│   └── Done/                  # Completed tasks
│
├── Areas/                     # Areas of responsibility
│   ├── Wellfy/                # CTO work at wellfy GmbH
│   │   ├── Team/              # 1:1 notes, team management
│   │   ├── Technical/         # ADRs, architecture decisions
│   │   └── Roadmap/           # Product planning
│   ├── Freelance/             # Side business
│   │   ├── Clients/           # Active client projects
│   │   ├── Marketing/         # Social media, outreach
│   │   └── Pipeline/          # Leads, proposals
│   └── Finances/              # Financial tracking
│       ├── Invoices/          # Invoice records
│       └── Reports/           # Monthly summaries
│
├── Templates/                 # Reusable templates
│   ├── meeting-notes.md       # General meeting template
│   ├── 1-on-1.md              # Team 1:1 meetings
│   ├── decision-record.md     # Architecture Decision Record (ADR)
│   ├── project-brief.md       # New project kickoff
│   ├── invoice.md             # Freelance invoicing
│   └── weekly-review.md       # Weekly reflection
│
├── skills/                    # Claude Code skills
│   ├── client-proposal/       # Generate freelance proposals
│   ├── react-component/       # Scaffold React components
│   ├── code-review/           # PR review assistance
│   ├── meeting-notes/         # Meeting summaries
│   ├── tech-docs/             # Technical documentation
│   ├── email-draft/           # Professional emails
│   └── social-content/        # LinkedIn/Twitter content
│
├── .claude/                   # Claude Code configuration
│   ├── settings.local.json
│   └── skills -> ../skills    # Symlink to skills
│
└── .obsidian/                 # Obsidian vault configuration
```

---

## Task Workflow (Kanban)

Tasks flow through four stages:

```
Backlog → Queue → InProgress → Done
```

| Stage | Purpose |
|-------|---------|
| **Backlog/** | Ideas, someday/maybe, not yet prioritized |
| **Queue/** | Prioritized and ready to start |
| **InProgress/** | Currently being worked on |
| **Done/** | Completed (archive periodically) |

### Usage
- Create a markdown file for each task
- Move files between folders as status changes
- Include context, links, and acceptance criteria in each task

---

## Areas

### Wellfy (CTO Work)
| Folder | Purpose |
|--------|---------|
| `Team/` | 1:1 meeting notes, team feedback, hiring notes |
| `Technical/` | ADRs, tech debt tracking, architecture decisions |
| `Roadmap/` | Feature planning, sprint goals, product direction |

### Freelance (Side Business)
| Folder | Purpose |
|--------|---------|
| `Clients/` | Active project notes, client communication logs |
| `Marketing/` | Social media content, portfolio updates, outreach |
| `Pipeline/` | Leads, proposals in progress, opportunities |

### Finances
| Folder | Purpose |
|--------|---------|
| `Invoices/` | Invoice records (use invoice.md template) |
| `Reports/` | Monthly/quarterly summaries, tax prep |

---

## Templates

Copy these to create new documents:

| Template | Use When |
|----------|----------|
| `meeting-notes.md` | Any meeting that needs documentation |
| `1-on-1.md` | Regular 1:1s with team members |
| `decision-record.md` | Significant technical/architecture decisions |
| `project-brief.md` | Starting a new project (freelance or internal) |
| `invoice.md` | Billing freelance clients |
| `weekly-review.md` | End-of-week reflection and planning |

---

## Claude Code Skills

Skills are AI-powered workflows triggered by natural language. Say the trigger phrase to activate.

| Skill | Trigger Phrases | Purpose |
|-------|-----------------|---------|
| **client-proposal** | "write a proposal", "project quote" | Generate freelance proposals |
| **react-component** | "create a component", "scaffold component" | React + TypeScript + Framer Motion |
| **code-review** | "review this PR", "code review" | Structured PR feedback |
| **meeting-notes** | "summarize meeting", "extract action items" | Meeting summaries with actions |
| **tech-docs** | "write an ADR", "create RFC" | Technical documentation |
| **email-draft** | "draft an email", "follow-up email" | Professional communication |
| **social-content** | "LinkedIn post", "Twitter thread" | Build freelance brand |

### How Skills Work
1. Skills are defined in `/skills/[skill-name]/SKILL.md`
2. The `.claude/skills` symlink makes them available to Claude Code
3. Trigger with natural language or `/skill-name` command

---

## Integrations

### Obsidian
This directory is an Obsidian vault. Features:
- Wiki-style linking with `[[double brackets]]`
- Graph view to visualize connections
- Daily notes and templates
- Search across all markdown files

### Claude Code
This directory is a Claude Code project. Features:
- Skills for automated workflows
- Context-aware assistance
- File creation and editing
- Task management integration

---

## Quick Start

### New Task
1. Create markdown file in `Tasks/Backlog/`
2. Move to `Queue/` when ready
3. Move to `InProgress/` when starting
4. Move to `Done/` when complete

### New 1:1 Meeting
1. Copy `Templates/1-on-1.md` to `Areas/Wellfy/Team/`
2. Name it `[Name]-[Date].md`
3. Fill in during/after meeting

### New Freelance Client
1. Copy `Templates/project-brief.md` to `Areas/Freelance/Clients/`
2. Use `/client-proposal` skill for proposal
3. Track invoices in `Areas/Finances/Invoices/`

### Weekly Review
1. Copy `Templates/weekly-review.md`
2. Review accomplishments, plan next week
3. Archive in `Areas/` or `Tasks/Done/`

---

## Maintenance

### Weekly
- [ ] Review and update task boards
- [ ] Move completed tasks to Done
- [ ] Update active client projects

### Monthly
- [ ] Archive old tasks from Done
- [ ] Review freelance pipeline
- [ ] Update financial reports

---

*Last updated: December 2024*


---

## Progressive Web App (PWA)

The Personal Assistant app includes full PWA support for enhanced mobile experience and offline functionality.

### Features

✅ **Install to Home Screen**: Add the app to your device's home screen for quick access
✅ **Offline Mode**: Continue working even without internet connection
✅ **Background Sync**: Changes made offline automatically sync when connection is restored
✅ **Fast Loading**: Cached assets load instantly
✅ **App-like Experience**: Runs in standalone mode without browser chrome

### Installation

#### Desktop (Chrome/Edge)
1. Visit the app in Chrome or Edge
2. Look for the install icon (➕) in the address bar
3. Click "Install" when prompted
4. The app will open in a standalone window

#### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button (□↗)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

#### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (⋮) and select "Add to Home screen"
3. Or wait for the automatic install banner

### Offline Capabilities

When offline, the app will:
- ✅ Load all previously cached pages
- ✅ Display tasks and projects from cache
- ✅ Allow creating new tasks (queued for sync)
- ✅ Allow updating task status (queued for sync)
- ⚠️ Show an offline indicator at the top
- 🔄 Display pending sync count

**All changes made offline will automatically sync when you reconnect to the internet.**

### Testing PWA Features

#### Test Offline Mode
1. Open the app
2. Open DevTools (F12)
3. Go to Application → Service Workers
4. Check "Offline"
5. Reload the page - it should still work
6. Try creating/updating tasks - they'll queue for sync

#### Test Installation
1. Build the app: `npm run build:web`
2. Serve it: `npm run preview:web`
3. Open in Chrome/Edge
4. Look for the install prompt

#### Verify Service Worker
1. Open DevTools → Application
2. Check "Service Workers" section
3. Verify service worker is registered and active
4. Check "Cache Storage" to see cached resources

### Development

PWA features are **disabled in development mode** to avoid caching issues during development. They only activate in production builds.

```bash
# Build for production (enables PWA)
cd app
npm run build:web

# Preview production build
npm run preview:web
```

### Cache Strategy

| Resource Type | Strategy | Details |
|--------------|----------|---------|
| Static Assets | CacheFirst | JS, CSS, fonts cached indefinitely |
| Images | CacheFirst | Cached for 30 days |
| API Calls | NetworkFirst | Fresh data preferred, cache fallback (5 min) |
| Google Fonts | CacheFirst | Cached for 1 year |

### Troubleshooting

**App won't update?**
- Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Clear site data: DevTools → Application → Clear storage

**Offline sync not working?**
- Check the sync status indicator (bottom-right)
- Manually trigger sync by clicking "Sync now"
- Check browser console for errors

**Install prompt not showing?**
- Make sure you're using HTTPS (or localhost)
- The prompt shows 30 seconds after first visit
- It won't show if previously dismissed (wait 7 days)
- Check if already installed (display-mode: standalone)

---
