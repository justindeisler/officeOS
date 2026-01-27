---
name: code-review
description: Review code changes, pull requests, and provide structured feedback. Use this skill when reviewing PRs, analyzing code quality, or providing technical feedback. Triggers on "review this PR", "code review", "review these changes", or "check this code".
---

# Code Review Assistant

Generate thorough, constructive code reviews with actionable feedback.

## Review Structure

### 1. Summary
- One-line overview of what the changes do
- Overall assessment: Approve / Request Changes / Comment

### 2. What's Good
- Highlight positive patterns and good decisions
- Acknowledge clean code, good tests, or clever solutions

### 3. Critical Issues (Must Fix)
- Security vulnerabilities
- Breaking changes
- Logic errors
- Data loss risks

### 4. Improvements (Should Fix)
- Performance concerns
- Code style violations
- Missing error handling
- Incomplete edge cases

### 5. Suggestions (Nice to Have)
- Refactoring opportunities
- Alternative approaches
- Documentation improvements

## Review Checklist

### Code Quality
- [ ] Clear naming (variables, functions, classes)
- [ ] Single responsibility principle followed
- [ ] No code duplication (DRY)
- [ ] Appropriate abstraction level
- [ ] Comments where necessary (not obvious code)

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation present
- [ ] SQL injection prevention
- [ ] XSS prevention (if frontend)
- [ ] Authentication/authorization checks
- [ ] Sensitive data handling (PII, passwords)

### Performance
- [ ] No N+1 queries
- [ ] Appropriate indexing considered
- [ ] No unnecessary loops or iterations
- [ ] Caching considered where appropriate
- [ ] Bundle size impact (if frontend)

### Testing
- [ ] Unit tests for new functionality
- [ ] Edge cases covered
- [ ] Tests are readable and maintainable
- [ ] Integration tests if needed
- [ ] No flaky tests introduced

### Architecture
- [ ] Fits existing patterns
- [ ] Dependencies appropriate
- [ ] API design consistent
- [ ] Database schema changes reviewed
- [ ] Backward compatibility maintained

## Tone Guidelines

- **Constructive**: Focus on the code, not the person
- **Specific**: Point to exact lines/files
- **Educational**: Explain the "why" behind suggestions
- **Respectful**: Use "we" or "consider" instead of "you should"
- **Balanced**: Acknowledge good work, not just problems

## Comment Templates

### Blocking Issue
```
🚨 **Blocking:** [Issue description]
This will [impact]. Consider [solution].
```

### Improvement
```
💡 **Suggestion:** [Improvement idea]
This could [benefit]. Example: [code snippet]
```

### Question
```
❓ **Question:** [Your question]
I'm wondering about [context]. Could you clarify [specific]?
```

### Praise
```
✨ **Nice!** [What's good about it]
```

## Review Scope Levels

| Scope | Focus Areas | Time |
|-------|-------------|------|
| Quick | Critical issues, security, breaking changes | 5-10 min |
| Standard | + Code quality, tests, performance | 15-30 min |
| Deep | + Architecture, patterns, edge cases | 30-60 min |

## Output Format

Provide reviews in markdown format suitable for:
- GitHub PR comments
- GitLab merge request feedback
- Slack/team communication
- Technical documentation
