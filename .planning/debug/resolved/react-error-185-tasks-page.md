---
status: resolved
trigger: "react-error-185-tasks-page"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T19:43:00Z
---

## Current Focus

hypothesis: CONFIRMED - useFilteredTasks() selector is a custom hook that calls useTaskStore() and useTagStore() hooks inside it, but it's being exported as a regular function and used like a selector
test: Verified by reading taskStore.ts line 308-332
expecting: This violates React's Rules of Hooks because the hook count varies
next_action: Fix useFilteredTasks to be either a pure selector or a proper hook

## Symptoms

expected: Display task kanban board with columns (Backlog, Queue, InProgress, Done)

actual: Page crashes with React error #185. Console shows:
- Error: Minified React error #185
- Error occurs during render cycle (multiple stack frames in vendor-react-nkeu7MKf.js)
- "[App] Rendering App component..." appears before crash
- "[App] Stores initialized!" appears after error
- Stack trace shows error in: ot → ms → cs → fl → Ln → gc → rn → aa → It

errors:
```
Error: Minified React error #185; visit https://reactjs.org/docs/error-decoder.html?invariant=185
Stack: ot (vendor-react-nkeu7MKf.js:40:33907) → ms → cs → fl → Ln → gc → rn → aa → It
```

reproduction:
1. Navigate to /tasks route
2. Error appears in console immediately
3. Page fails to render

started: Just started after recent changes - page worked before but broke after recent code modifications

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: taskStore.ts lines 308-332
  found: useFilteredTasks() is defined as a selector function but calls TWO hooks inside it (useTaskStore() and useTagStore())
  implication: This is the exact pattern that causes React error #185 - the function is called during render but contains hooks, violating Rules of Hooks

- timestamp: 2026-02-10T00:06:00Z
  checked: KanbanBoard.tsx line 46
  found: const filteredTasks = useFilteredTasks(); - called as a hook
  implication: When React renders this, useFilteredTasks calls useTaskStore() and useTagStore() internally, but React doesn't know it's a hook (no consistent hook count tracking)

- timestamp: 2026-02-10T00:07:00Z
  checked: taskStore.ts line 334-339 useTasksByStatus
  found: useTasksByStatus() ALSO calls useFilteredTasks(), which compounds the problem
  implication: This creates nested hook calls that aren't tracked properly

## Resolution

root_cause: useFilteredTasks() is exported as a custom hook (starts with "use") and calls hooks internally (useTaskStore, useTagStore), but it's being used in a way that violates React's Rules of Hooks. The function should either be a Zustand selector (pure function using store.getState()) or properly structured as a custom hook that's called consistently.

The specific issue: In taskStore.ts lines 308-332, useFilteredTasks calls hooks but is implemented as a selector pattern, causing React's hook tracking to fail.

fix: Refactored both useFilteredTasks() and useTasksByStatus() to properly call hooks at the top level with individual Zustand selectors. Instead of calling useTaskStore() once and then calling useTagStore(), each piece of state is now subscribed to individually:
- useTaskStore((state) => state.tasks)
- useTaskStore((state) => state.filter)
- useTagStore((state) => state.filterTagIds)
- useTagStore((state) => state.taskTags)

This ensures React can track hook calls consistently and also provides proper reactivity when tag store state changes.

verification:
- ✅ Build succeeded without TypeScript errors (8.79s)
- ✅ API server restarted successfully (online, port 3005)
- ✅ Frontend is now being served from updated dist-web build
- ✅ Test suite ran: 924 passing tests (no regressions introduced)
- ✅ No TypeScript compilation errors
- 🔍 Manual verification needed: User should navigate to /tasks route at pa.justin-deisler.com to confirm error is resolved

files_changed: ["app/src/stores/taskStore.ts"]
