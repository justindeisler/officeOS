---
name: meeting-notes
description: Generate structured meeting summaries, extract action items, and create follow-up tasks. Use this skill when summarizing meetings, creating meeting agendas, or extracting key decisions. Triggers on "summarize this meeting", "meeting notes", "extract action items", or "meeting summary".
---

# Meeting Notes Assistant

Transform meeting content into clear, actionable summaries.

## Summary Structure

### Quick Summary (2-3 sentences)
What was discussed and decided in plain language.

### Key Decisions
Bulleted list of decisions made with context.

### Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
|        |       |          |          |

### Open Questions
Items that need follow-up or clarification.

### Next Steps
What happens after this meeting.

## Meeting Types

### Standup/Daily
Focus on:
- Blockers (critical)
- What's being worked on
- Dependencies between team members

Output: Brief bullets, emphasis on blockers

### 1:1 Meeting
Focus on:
- Personal check-in
- Growth/career discussion
- Feedback exchange
- Action items for both parties

Output: Confidential notes, clear follow-ups

### Sprint Planning
Focus on:
- Capacity
- Story points/estimates
- Sprint goals
- Commitments

Output: Sprint backlog, team commitments

### Retrospective
Focus on:
- What went well
- What to improve
- Specific action items for improvement

Output: Categorized feedback, prioritized improvements

### Technical Discussion
Focus on:
- Problem statement
- Options considered
- Decision and rationale
- Implementation notes

Output: ADR-style documentation

### Client/External
Focus on:
- Agreed deliverables
- Timeline confirmations
- Budget discussions
- Next meeting scheduled

Output: Formal summary suitable for sharing

## Action Item Extraction

Look for phrases like:
- "I will...", "Let's...", "We need to..."
- "Can you...", "Please...", "Make sure to..."
- "By [date]...", "Before [event]..."
- "Follow up on...", "Check with..."

For each action item, capture:
1. **What**: The specific task
2. **Who**: Owner (if ambiguous, flag for clarification)
3. **When**: Due date or timeframe
4. **Context**: Why this matters

## Decision Extraction

Look for:
- "We decided...", "We agreed..."
- "Let's go with...", "The plan is..."
- "We're not going to...", "We'll hold off on..."

For each decision, capture:
1. **Decision**: What was decided
2. **Rationale**: Why (if discussed)
3. **Alternatives rejected**: If relevant
4. **Impact**: Who/what is affected

## Formatting Guidelines

- Use present tense for decisions ("We use React")
- Use future tense for actions ("John will create PR")
- Keep summaries scannable (bullets, headers)
- Bold important items
- Include participant names for context

## Output Formats

### Quick Summary (Slack-friendly)
```
📝 **[Meeting Name] - [Date]**
*Attendees: [names]*

**Decisions:**
• [Decision 1]
• [Decision 2]

**Actions:**
• [ ] @person: [task] by [date]

**Next:** [what's next]
```

### Full Notes (Documentation)
Complete markdown with all sections, suitable for wiki/docs.

### Action-Only Extract
Just the action items table for task tracking systems.
