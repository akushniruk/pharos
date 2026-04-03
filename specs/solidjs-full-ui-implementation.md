# Plan: Pharos V1 Full SolidJS UI

## Task Description
Rebuild the Pharos SolidJS frontend with a sidebar + live feed layout, bringing back all critical features: stats bar, project sidebar, agent cards/graph toggle, event stream with simple/detailed modes, expandable event rows, regex search, theme toggle, metrics, and hierarchical filtering. The current SolidJS app at `apps/client-solid/` has basic scaffolding (WebSocket, store, types, describe) but only two minimal pages. This plan replaces all page/component files while preserving the working lib/ foundation.

## Objective
A production-quality monitoring dashboard where users can see all AI agent activity at a glance — projects on the left, agents in the middle, live events below — with zero clicks needed to understand what's happening.

## Problem Statement
The SolidJS rewrite lost ~90% of Vue features. The current UI shows project cards and a flat event list with no stats, no search, no filtering, no agent graph, no expandable events, no themes. Users can't effectively monitor agent activity.

## Solution Approach
Rebuild as a 4-zone persistent layout (header + sidebar + agent area + event stream). Each zone is a focused SolidJS component under 200 lines. Extend the existing lib/ with metrics, theme, and colors modules. Use the existing store.ts project/session/agent derivation and ws.ts WebSocket connection as-is.

## Relevant Files
Use these files to complete the task:

**Existing files to keep and extend:**
- `apps/client-solid/src/lib/store.ts` — reactive state, project derivation. Extend with selectedAgent signal and agent filtering.
- `apps/client-solid/src/lib/ws.ts` — WebSocket connection. Keep as-is.
- `apps/client-solid/src/lib/types.ts` — TypeScript interfaces. Keep as-is.
- `apps/client-solid/src/lib/describe.ts` — event descriptions. Keep as-is.
- `apps/client-solid/src/lib/time.ts` — time formatting. Keep as-is.
- `apps/client-solid/src/styles.css` — CSS variables and base styles. Rewrite with full theme system.
- `apps/client-solid/src/index.tsx` — mount point. Keep as-is.
- `apps/client-solid/package.json` — dependencies. Keep as-is.
- `apps/client-solid/vite.config.ts` — build config. Keep as-is.

**Existing files to replace entirely:**
- `apps/client-solid/src/App.tsx` — replace with 4-zone layout shell
- `apps/client-solid/src/pages/ProjectsOverview.tsx` — delete (merged into Sidebar)
- `apps/client-solid/src/pages/ProjectDetail.tsx` — delete (split into AgentCards + EventStream)

**Spec:**
- `docs/superpowers/specs/2026-04-03-solidjs-full-ui-design.md` — full design spec with layout, colors, typography, component architecture

### New Files
- `apps/client-solid/src/components/Header.tsx` — brand + live metrics strip + controls
- `apps/client-solid/src/components/Sidebar.tsx` — project list + session list, collapsible
- `apps/client-solid/src/components/AgentCards.tsx` — Railway-style horizontal agent cards
- `apps/client-solid/src/components/AgentGraph.tsx` — SVG node-link diagram of agent spawning
- `apps/client-solid/src/components/EventStream.tsx` — event list container with toolbar
- `apps/client-solid/src/components/EventRow.tsx` — single event row (simple + expandable detailed)
- `apps/client-solid/src/components/SearchBar.tsx` — regex search input with validation
- `apps/client-solid/src/lib/metrics.ts` — computed metrics (tool rate, error rate, events/min, duration)
- `apps/client-solid/src/lib/theme.ts` — dark/light theme state + CSS variable switching
- `apps/client-solid/src/lib/colors.ts` — deterministic color assignment for agents

## Implementation Phases

### Phase 1: Foundation
Extend store.ts with agent selection and search signals. Create metrics.ts, theme.ts, colors.ts lib files. Rewrite styles.css with full dark+light theme variables. Rewrite App.tsx as 4-zone layout shell.

### Phase 2: Core Components
Build all 7 components: Header, Sidebar, AgentCards, AgentGraph, EventStream, EventRow, SearchBar. Each is self-contained, receives data via props or lib imports, and follows the spec typography/colors exactly.

### Phase 3: Integration & Polish
Wire all components into App.tsx. Verify hierarchical filtering works (project → session → agent). Test theme toggle. Test search. Run `pnpm build`. Manual verification against spec checklist.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to the building, validating, testing, deploying, and other tasks.
- Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: builder-foundation
  - Role: Extend lib/ files (store, metrics, theme, colors) and rewrite styles.css + App.tsx layout shell
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-sidebar
  - Role: Build Sidebar.tsx and Header.tsx components
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-agents
  - Role: Build AgentCards.tsx and AgentGraph.tsx components
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-events
  - Role: Build EventStream.tsx, EventRow.tsx, and SearchBar.tsx components
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-integrator
  - Role: Wire all components into App.tsx, fix any type errors, run pnpm build, verify
  - Agent Type: general-purpose
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Foundation — Extend lib/ and rewrite layout
- **Task ID**: foundation
- **Depends On**: none
- **Assigned To**: builder-foundation
- **Agent Type**: general-purpose
- **Parallel**: false
- Extend `apps/client-solid/src/lib/store.ts`: add `selectedAgent` signal, `selectedSession` signal, `selectProject()`, `selectSession()`, `selectAgent()`, `clearSelection()` functions. Add `filteredAgents` memo that derives agents for selected project/session. Update `filteredEvents` to also filter by selectedAgent.
- Create `apps/client-solid/src/lib/metrics.ts`: export `createMetrics(events)` that returns reactive signals for: agentCount, primaryModel, toolSuccessRate (%), eventsPerMinute, sessionDuration, errorRate, healthStatus ('green'|'yellow'|'red'). Use `createMemo` for each. Health: green if error rate < 5%, yellow if < 15%, red otherwise.
- Create `apps/client-solid/src/lib/theme.ts`: export `[theme, setTheme]` signal ('dark'|'light'), `toggleTheme()`, `initTheme()` (reads localStorage). On theme change, set `data-theme` attribute on `<html>` element.
- Create `apps/client-solid/src/lib/colors.ts`: export `getAgentColor(id: string): string` — deterministic HSL color from string hash. Export `getEventTypeColor(type: string)` and `getEventTypeLabel(type: string)` — maps hook_event_type to badge color/label as specified in design.
- Rewrite `apps/client-solid/src/styles.css`: full CSS with `[data-theme="dark"]` and `[data-theme="light"]` selectors. All colors from spec. Layout classes for 4-zone structure: `.app` (flex col), `.app-header` (44px), `.app-body` (flex row, flex-1), `.app-sidebar` (220px), `.app-main` (flex-1, flex col), `.app-statusbar` (24px).
- Rewrite `apps/client-solid/src/App.tsx`: 4-zone layout importing Header, Sidebar, and main content area. Use `<Show>` for conditional agent area + event stream when project selected, card grid when not selected.
- Delete `apps/client-solid/src/pages/ProjectsOverview.tsx` and `apps/client-solid/src/pages/ProjectDetail.tsx`.
- Run `pnpm build` to verify no compilation errors (components not yet built, so use placeholder divs in App.tsx).
- Commit: `feat: foundation — extend store, add metrics/theme/colors, rewrite layout`

### 2. Header + Sidebar components
- **Task ID**: header-sidebar
- **Depends On**: foundation
- **Assigned To**: builder-sidebar
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 3 and 4 after foundation)
- Create `apps/client-solid/src/components/Header.tsx`:
  - Left: "Pharos" brand (14px/600)
  - Center: metrics strip using `createMetrics(filteredEvents())` — health dot, agent count, model, tool success %, events/min, duration. Each metric as a `<span>` with separator `|`. Stats are 11px/500.
  - Right: theme toggle button (sun/moon SVG icon), calls `toggleTheme()`.
  - 44px height, bg `var(--bg-secondary)`, border-bottom.
- Create `apps/client-solid/src/components/Sidebar.tsx`:
  - Top section "PROJECTS" (10px/600 uppercase label): `<For each={projects()}>` rendering project items. Each item shows: active dot (green/gray), project name (12px/500), event count. Selected project: blue left border + `var(--bg-elevated)` background. Click calls `selectProject(name)`.
  - Below selected project: agent type badges (small pills with agent names).
  - Bottom section "SESSIONS": for selected project, list sessions with ID (8 chars, mono) and Active/Idle badge. Click calls `selectSession(id)`.
  - Collapsible: collapsed state shows thin 40px bar with just project dots. Toggle button (chevron).
  - 220px width, bg `var(--bg-primary)`, border-right.
- Run `pnpm build` to verify these two components compile.
- Commit: `feat: add Header with live metrics and Sidebar with project/session list`

### 3. Agent Cards + Graph components
- **Task ID**: agent-views
- **Depends On**: foundation
- **Assigned To**: builder-agents
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 2 and 4)
- Create `apps/client-solid/src/components/AgentCards.tsx`:
  - Horizontal scrollable row of agent cards using `filteredAgents()` from store.
  - Tab bar at top: "Cards" | "Graph" toggle (store in local signal).
  - Each card: status dot (green=active, yellow=idle, gray=completed), agent displayName (12px/500), model name (11px/mono, dim), event count, status label ("Online"/"Idle"/"Completed"). Active agents: green left border (3px solid).
  - Click card calls `selectAgent(agentId)`. Selected card has blue border.
  - Container: `overflow-x: auto`, `display: flex`, `gap: 10px`, padding 12px 16px, border-bottom.
- Create `apps/client-solid/src/components/AgentGraph.tsx`:
  - SVG-based node-link diagram.
  - Nodes: rectangles with agent name + status dot. Position using simple tree layout: orchestrator at top, children below, spaced evenly.
  - Edges: SVG `<line>` or `<path>` from parent to child. Derive edges from SubagentStart events (parent session → agent_id).
  - Click node calls `selectAgent(agentId)`.
  - Rendered inside the same container as AgentCards (shown when "Graph" tab active).
  - Keep it simple: no drag, no zoom, just static layout that re-renders on data change.
- Run `pnpm build` to verify.
- Commit: `feat: add AgentCards and AgentGraph components with Cards/Graph toggle`

### 4. Event Stream + Row + Search components
- **Task ID**: event-stream
- **Depends On**: foundation
- **Assigned To**: builder-events
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 2 and 3)
- Create `apps/client-solid/src/components/SearchBar.tsx`:
  - Input field with search icon. Placeholder: "Search events (regex)...".
  - Stores `[searchQuery, setSearchQuery]` signal. Validates regex, shows red border on invalid.
  - Export searchQuery signal so EventStream can use it.
  - Styling: bg `var(--bg-elevated)`, border on focus, 12px font.
- Create `apps/client-solid/src/components/EventRow.tsx`:
  - Props: `event: HookEvent`, `detailed: boolean`.
  - Simple mode: single row `time | agent | type badge | tool name | description`.
    - Time: 10px mono, `var(--text-dim)`
    - Agent: 11px/500, `var(--text-secondary)`, max 100px truncated
    - Type badge: 10px/600 uppercase, colored background per type using `getEventTypeColor()` / `getEventTypeLabel()`
    - Tool name: 11px, `var(--accent)` color, only for tool events
    - Description: 11px, `var(--text-primary)`, flex-1, truncated
  - Detailed mode: same row but clickable to expand. Expanded section shows:
    - Full JSON payload formatted with `JSON.stringify(payload, null, 2)` in `<pre>` block
    - Copy to clipboard button
    - Collapsed by default, toggle on click with local `[expanded, setExpanded]` signal.
  - Row hover: `var(--bg-card-hover)`. Border-bottom 1px `var(--border)`.
- Create `apps/client-solid/src/components/EventStream.tsx`:
  - Toolbar row: "Simple" | "Detailed" toggle buttons, SearchBar component, stick-to-bottom toggle (pin icon).
  - Event list: `<For each={displayEvents()}>` rendering EventRow components.
  - `displayEvents` memo: takes `filteredEvents()`, applies search regex filter, takes last 500, reverses (newest first).
  - Auto-scroll: `ref` on container div, use `onMount` + `createEffect` to scroll to top when new events arrive and stick is enabled.
  - Fills remaining vertical space with `overflow-y: auto`.
- Run `pnpm build` to verify.
- Commit: `feat: add EventStream with Simple/Detailed modes, search, and expandable rows`

### 5. Integration — Wire everything together
- **Task ID**: integration
- **Depends On**: header-sidebar, agent-views, event-stream
- **Assigned To**: builder-integrator
- **Agent Type**: general-purpose
- **Parallel**: false
- Update `apps/client-solid/src/App.tsx` to import and render all real components:
  - Header at top
  - Body: Sidebar on left, main content on right
  - Main content: AgentCards (with graph toggle) at top when project selected, EventStream below
  - When no project selected: show ProjectsHome card grid (inline, not a separate page — just a `<Show>` with `<For each={projects()}>` rendering simple cards that call `selectProject()`)
  - StatusBar at bottom
- Verify hierarchical filtering: click project → agents + events filter. Click session → further filter. Click agent → events filter to agent. Click again → deselect.
- Verify theme toggle works (dark ↔ light).
- Verify search filters events in real-time.
- Verify expandable event rows show JSON payload.
- Run `pnpm build` — must compile with zero errors.
- Manual test: start daemon (`make daemon`) + client (`cd apps/client-solid && pnpm dev`), verify all 9 spec verification items pass.
- Commit: `feat: integrate all components into 4-zone layout`

### 6. Final validation
- **Task ID**: validate-all
- **Depends On**: integration
- **Assigned To**: builder-integrator
- **Agent Type**: general-purpose
- **Parallel**: false
- Run `pnpm build` — zero errors
- Verify bundle size is under 30KB JS (SolidJS should be ~20-25KB with all features)
- Check that all CSS variables work in both dark and light themes
- Fix any remaining TypeScript errors or runtime issues
- Commit any fixes: `fix: final UI polish and type fixes`

## Acceptance Criteria
- `pnpm build` compiles with zero errors
- Start daemon + client → projects appear within 2 seconds
- Click project in sidebar → agent cards show, events filter to project
- Toggle to Graph → SVG diagram renders with edges between agents
- Click agent card → events filter to that agent
- Type regex in search → events filter in real-time
- Toggle theme → dark/light switch, all colors update
- Click event row in Detailed mode → JSON payload expands
- New events arrive → auto-scroll works, stats update
- Bundle size < 30KB JS gzipped

## Validation Commands
Execute these commands to validate the task is complete:

- `cd apps/client-solid && pnpm build` — Must compile with zero errors
- `cd apps/client-solid && du -sh dist/assets/*.js` — Verify JS bundle under 30KB
- `cd apps/daemon-rs && rustup run 1.85.1 cargo test` — Daemon tests still pass (no backend changes)
- Manual: open `http://localhost:5173`, verify all 4 zones visible, events streaming

## Notes
- No external UI libraries. Only `solid-js` and `vite-plugin-solid`.
- SVG for AgentGraph — no D3, no graph library. Simple tree layout with manual positioning.
- All font sizes and colors are specified exactly in the design spec — follow them precisely.
- Each component file must stay under 200 lines. If it grows beyond that, split into sub-components.
- The daemon backend requires NO changes. All work is in `apps/client-solid/`.
