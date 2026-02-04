# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

This is a **personal productivity workspace** for Justin Deisler (CTO at wellfy GmbH, freelance developer). It serves as both an **Obsidian vault** for knowledge management and a **Claude Code project** with custom skills for AI-assisted workflows.

This is NOT a code repository - it's a markdown-based workspace with templates, task management, and AI skills.

## Deployment & Access

The Personal Assistant web app is accessed via **https://pa.justin-deisler.com** through a Cloudflare Tunnel.

**Architecture:**
- **Cloudflare Tunnel** routes `pa.justin-deisler.com` → `localhost:3005` on the server
- **API server** (port 3005, PM2 name: `personal-assistant-api`) serves both:
  - REST API endpoints (`/api/*`)
  - Static frontend from `app/dist-web/`
- **Frontend build** must use relative API URL (`/api`) - NOT absolute URLs like `localhost:3005`

**Port Configuration:**
- `api/.env`: `PORT=3005`
- `app/.env`: `VITE_API_URL=/api`

**Build & Deploy Commands:**
```bash
cd app
npm run build:web                    # Builds frontend to dist-web/
pm2 restart personal-assistant-api   # Restart to serve new build
```

**Common Gotcha:** If login fails with "<!DOCTYPE" JSON parse error, the frontend is calling the wrong API URL. Check:
1. `app/.env` has `VITE_API_URL=/api` (relative, not absolute)
2. Rebuild with `npm run build:web`
3. API services in `app/src/services/web/` should use paths like `/tasks` not `/api/tasks` (the `/api` prefix comes from `VITE_API_URL`)

## Directory Purpose

- `Tasks/` - Kanban board (Backlog → Queue → InProgress → Done)
- `Areas/` - Work areas: Wellfy (CTO), Freelance, Finances
- `Templates/` - Reusable markdown templates
- `skills/` - Claude Code skill definitions (SKILL.md files)

## Available Skills

Invoke these via trigger phrases or `/skill-name`:

| Skill | Triggers |
|-------|----------|
| `client-proposal` | "write a proposal", "project quote" |
| `react-component` | "create a component", "scaffold component" |
| `code-review` | "review this PR", "code review" |
| `meeting-notes` | "summarize meeting", "extract action items" |
| `tech-docs` | "write an ADR", "create RFC" |
| `email-draft` | "draft an email", "follow-up email" |
| `social-content` | "LinkedIn post", "Twitter thread" |

## Skill Architecture

Skills are defined in `/skills/[name]/SKILL.md` with YAML frontmatter:
```yaml
---
name: skill-name
description: Brief description with trigger phrases
---
```

The `.claude/skills` symlink exposes skills to Claude Code.

## React Component Conventions

When the `react-component` skill generates components:
- Use Framer Motion with easing `[0.16, 1, 0.3, 1]`
- Animation durations: 200ms (fast), 400ms (normal), 600ms (slow)
- Use `cn()` utility for conditional Tailwind classes
- Named exports only, PascalCase filenames
- Place in: `src/components/ui/`, `layout/`, `folders/`, or `documents/`

## Templates

Copy from `Templates/` when creating:
- `meeting-notes.md` - General meetings
- `1-on-1.md` - Team 1:1s → save to `Areas/Wellfy/Team/`
- `decision-record.md` - ADRs → save to `Areas/Wellfy/Technical/`
- `project-brief.md` - New projects
- `invoice.md` - Freelance billing → save to `Areas/Finances/Invoices/`
- `weekly-review.md` - Weekly reflection

## Frontend Development

1. **Always use the frontend-design skill** - When working on any frontend UI components, views, or visual elements, invoke the `frontend-design:frontend-design` skill to ensure high-quality, production-grade interfaces.

2. **Follow design-system.md** - All frontend work must adhere to the specifications in `/docs/context/design-system.md`:
   - Use the defined color palette and CSS variables
   - Follow typography guidelines (fonts, sizes, weights)
   - Implement animations with specified easing curves and durations
   - Maintain spacing and layout conventions
   - Reference component specifications for consistent UI patterns

## Test-Driven Development

### Test Stack
- **Vitest** - Test runner (native Vite integration)
- **@testing-library/react** - Component testing
- **@vitest/coverage-v8** - Code coverage (80% threshold)

### Test Commands
```bash
npm test            # Watch mode
npm run test:ui     # Visual dashboard
npm run test:run    # Single run
npm run test:coverage # With coverage report
npm run test:ci     # CI pipeline
```

### Test Structure
```
app/src/test/
├── setup.ts              # Global mocks (matchMedia, ResizeObserver)
├── utils/
│   ├── render.tsx        # Custom render with providers + userEvent
│   ├── test-utils.ts     # Helpers (waitForAnimation, mockFramerMotion)
│   └── index.ts
└── mocks/
    └── data/             # Mock factories (tasks, clients, projects, etc.)
```

### TDD Workflow
1. **Write test first** - Create `Component.test.tsx` with expected behavior
2. **Run test** - `npm test` - watch it fail (Red)
3. **Implement** - Write minimal code to pass
4. **Run test** - Watch it pass (Green)
5. **Refactor** - Clean up while tests stay green
6. **Repeat** - For each new feature/component

### Test File Conventions
- Co-locate tests: `Component.tsx` → `Component.test.tsx`
- Use mock factories: `createMockTask()`, `createMockClient()`, etc.
- Import from `@/test/utils` for custom render with providers
- Mock Framer Motion with `mockFramerMotion()` for faster tests

### Example Test
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const { user } = render(<MyComponent />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

## Task Workflow

Move markdown files between folders:
```
Tasks/Backlog/ → Tasks/Queue/ → Tasks/InProgress/ → Tasks/Done/
```

Each task is a markdown file with context, links, and acceptance criteria.

## Working Rules

1. **Think first, read code second** - Before answering questions or making changes, read the relevant files in the codebase to understand the current implementation.

2. **Check in before major changes** - Before making any significant changes, present the plan for user verification and approval.

3. **Explain changes at a high level** - After each step, provide a brief high-level explanation of what was changed and why.

4. **Keep it simple** - Make every task and code change as simple as possible. Avoid massive or complex changes. Every change should impact as little code as possible. Simplicity is paramount.

5. **Maintain architecture documentation** - Keep a documentation file (e.g., `docs/ARCHITECTURE.md`) that describes how the app architecture works inside and out.

6. **Never speculate about unread code** - Never make claims about code without first investigating. If a specific file is referenced, read it before answering. Always give grounded, hallucination-free answers based on actual code inspection.
