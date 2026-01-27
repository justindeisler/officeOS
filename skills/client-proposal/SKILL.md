---
name: client-proposal
description: Generate professional project proposals for freelance clients. Use this skill when writing proposals, quotes, project scopes, or responding to client inquiries. Triggers on "write a proposal", "client proposal", "project quote", or "scope document".
---

# Client Proposal Generator

Create professional, persuasive project proposals for freelance development work.

## Proposal Structure

### 1. Executive Summary
- One paragraph hook addressing the client's core problem
- Your proposed solution in 2-3 sentences
- Key benefit or outcome they'll achieve

### 2. Understanding of Requirements
- Restate the client's needs in your own words
- Show you've done your homework
- Identify any assumptions or questions

### 3. Proposed Solution
- Technical approach (high-level, avoid jargon)
- Key features/deliverables as bullet points
- Technology stack with brief justification

### 4. Timeline & Milestones
```
Phase 1: Discovery & Planning     [X weeks]
Phase 2: Design/Architecture      [X weeks]
Phase 3: Core Development         [X weeks]
Phase 4: Testing & Refinement     [X weeks]
Phase 5: Launch & Handoff         [X weeks]
```

### 5. Investment
- Present as value, not cost
- Include what's in scope
- Clarify what's out of scope
- Payment terms (e.g., 50% upfront, 50% on completion)

### 6. Why Work With Me
- Relevant experience (2-3 bullet points)
- Similar projects completed
- Unique value proposition

### 7. Next Steps
- Clear call to action
- Availability to discuss
- Proposal validity period

## Tone Guidelines

- **Confident but not arrogant**: "I recommend..." not "You should..."
- **Client-focused**: Emphasize their outcomes, not your process
- **Professional**: No slang, but conversational
- **Specific**: Use numbers and concrete deliverables

## Pricing Strategies

| Project Type | Pricing Model | When to Use |
|--------------|---------------|-------------|
| Clear scope | Fixed price | Well-defined requirements |
| Evolving scope | Hourly/retainer | Ongoing work, discovery |
| High value | Value-based | ROI is measurable |
| Uncertain | Phased | Client wants to test fit |

## Red Flags to Address

If the client mentions these, address proactively:
- "Previous developer failed" → Emphasize communication & process
- "Tight budget" → Offer phased approach or MVP
- "Need it fast" → Set realistic expectations, offer tradeoffs
- "Not technical" → Promise clear explanations, no jargon

## Template Variables

When generating, ask for:
- `{client_name}` - Company or person name
- `{project_type}` - Web app, mobile app, API, etc.
- `{timeline}` - Desired completion date
- `{budget_range}` - If known
- `{key_features}` - Main requirements

## Output Format

Generate proposals in clean Markdown that can be:
- Converted to PDF
- Pasted into email
- Sent via proposal software (e.g., Better Proposals, PandaDoc)
