# Pharos V1 — Full SolidJS UI Design

Date: 2026-04-03
Status: Approved

Back to [Docs Portal](../../README.md).

## Goal

Rebuild the Pharos dashboard in SolidJS with a sidebar + live feed layout, bringing back all critical features lost in the Vue-to-Solid migration. The UI should feel like a Vercel/Railway monitoring tool — dark, clean, information-dense, zero clicks to see what's happening.

## Layout

Four persistent zones, always visible:

```
┌──────────────────────────────────────────────────────────────┐
│ ① HEADER: Pharos  │  ● 3 agents │ sonnet-4-6 │ 95% ok │ 4/m │ 🔍 ⚙ ☀ │
├────────┬─────────────────────────────────────────────────────┤
│        │ ③ AGENT AREA: [Cards ▾ | Graph]                     │
│ ②      │ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ SIDEBAR│ │Orchestrat│ │ Explore  │ │ Builder  │            │
│        │ │● Online  │ │● Idle    │ │○ Done    │            │
│Projects│ └──────────┘ └──────────┘ └──────────┘            │
│        ├─────────────────────────────────────────────────────┤
│ workshop│ ④ EVENT STREAM: [Simple | Detailed] 🔍 search...  │
│ pharos │ 10:32 Orchestrator  TOOL  Bash  ls -la /work/...    │
│ yellow │ 10:32 Orchestrator  DONE  Read  package.json        │
│        │ 10:31 Explore       TOOL  Read  src/App.tsx         │
│Sessions│ 10:31 Explore       FAIL  Read  MEMORY.md           │
│ 82ae.. │ 10:30 Orchestrator  SPAWN Explore — Analyze...      │
│ d081.. │ 10:30 Orchestrator  RESP  It's a crypto platform... │
├────────┴─────────────────────────────────────────────────────┤
│ ● Connected                                    158 events    │
└──────────────────────────────────────────────────────────────┘
```

### Zone ①: Header + Stats Bar (44px)

Left: "Pharos" brand
Center: Live metrics strip:
- Health dot (green/yellow/red based on error rate)
- Agent count
- Primary model name (most-used model)
- Tool success rate (%)
- Events per minute
- Session duration

Right: Search toggle, settings, theme toggle (dark/light)

### Zone ②: Project Sidebar (220px, left)

Top section — **Projects**:
- List of projects sorted by last activity
- Each shows: active dot (green if event < 30s), name, event count
- Selected project has blue left border + darker background
- Expanded project shows agent type badges (Orchestrator, Explore, Builder)
- Click project → filters agent area + event stream

Bottom section — **Sessions**:
- Sessions for the selected project
- Shows: session ID (8 chars), Active/Idle badge
- Click session → further filters to that session

Sidebar is collapsible (thin bar with project dots when collapsed).

### Zone ③: Agent Area (scrollable row, ~100px)

Two view modes toggled by tabs:

**Cards view (default):**
- Horizontal scrollable row of agent cards
- Each card: status dot, agent name, model (monospace), event count, status label
- Active agents have green left border
- Click card → filters event stream to that agent

**Graph view:**
- Node-link diagram showing parent-child agent relationships
- Each node: agent name + status
- Edges: spawning relationships (from SubagentStart events)
- Click node → filters event stream to that agent
- Rendered with SVG (no external graph library)

### Zone ④: Event Stream (fills remaining space)

**Toolbar:**
- Simple/Detailed toggle
- Regex search input
- Stick-to-bottom toggle

**Simple mode:**
Each row: `timestamp | agent name | runtime | summary | context`
- Prioritize readability over raw protocol labels.
- Allow wrapped summary text for long items instead of clipping the most useful phrase.
- Keep low-signal metadata compact (project/time context stays single-line).

Type badges with colors:
- TOOL (neutral gray)
- DONE (green)
- FAIL (red)
- PROMPT (blue)
- RESP (purple)
- SPAWN (yellow)
- START/END (green dim)

**Detailed mode:**
Same as simple but rows are expandable. Click to show:
- Parsed payload view (default): key/value tree with expandable nested objects and arrays
- Raw JSON view: pretty-printed JSON `pre` block
- Copy JSON action: always available in expanded header and copies canonical raw JSON

#### Event view behavior contract

- Simple mode hides lifecycle noise (`SessionStart`, `SessionEnd`, `SessionTitleChanged`).
- Detailed mode reveals all event types and allows row expansion.
- Search applies to both human-readable description and payload-derived text.
- Event compaction may collapse near-duplicate rows, but must not collapse delegated-agent events.

#### Payload UX contract

- Default tab is **Parsed** for operator readability.
- Parsed view sorts top-level payload keys alphabetically for stable scanning.
- Nested payload structures are collapsible by depth (top level open).
- Raw view exists for exact debugging and copy parity.

### Status Bar (24px, bottom)

Connected/disconnected indicator + total event count + selected project name.

## Navigation Flow

1. **No selection**: Sidebar shows all projects. Agent area shows all agents across projects. Event stream shows all events. Landing cards view (Vercel-style) in main content.
2. **Project selected**: Agent area shows only that project's agents. Events filtered to project.
3. **Session selected**: Further filtered to that session.
4. **Agent selected** (click card/node): Events filtered to that agent.
5. Click again to deselect at any level.

## Features to Build

### Critical (V1 must-have):
1. Stats bar with live metrics
2. Project sidebar with session list
3. Agent cards (Railway-style)
4. Agent graph (node-link SVG)
5. Event stream (Simple + Detailed modes)
6. Expandable event rows with JSON payload
7. Regex event search
8. Dark/light theme toggle
9. Auto-scroll with stick-to-bottom
10. Hierarchical filtering (project → session → agent)

### Included but simplified:
11. Notifications — browser toast for new agent spawn only
12. Metrics computation (tool rate, error rate, duration, model distribution)

### Deferred to V2:
- Session replay with timeline scrubber
- Swim lane charts
- HITL response UI
- Chat transcript modal
- Spawn agent modal
- Full notification settings panel

## Component Architecture

```
src/
  index.tsx            — mount point
  App.tsx              — layout shell (header + sidebar + main)
  components/
    Header.tsx         — brand + stats strip + controls
    Sidebar.tsx        — project list + session list
    AgentCards.tsx      — Railway-style horizontal agent cards
    AgentGraph.tsx      — SVG node-link diagram
    EventStream.tsx     — event list container with toolbar
    EventRow.tsx        — single event row (simple + detailed/expandable)
    SearchBar.tsx       — regex search input with validation
    ThemeToggle.tsx     — dark/light switch
  lib/
    store.ts           — reactive state (view, selection, filters, computed projects)
    ws.ts              — WebSocket connection + event/agent signals
    types.ts           — TypeScript interfaces
    describe.ts        — event → one-line description
    time.ts            — time formatting utilities
    metrics.ts         — computed metrics from events
    theme.ts           — theme state + CSS variable switching
    colors.ts          — agent/event color assignment
  styles.css           — global CSS with theme variables
```

15 source files. Each component < 200 lines. Each lib file < 100 lines.

## Typography & Colors

**Font stack:**
- UI text: Inter (400, 500, 600)
- Monospace (timestamps, session IDs, code): JetBrains Mono (400, 500)

**Font sizes:**
- Brand: 14px / 600
- Stats bar: 11px / 500
- Sidebar project names: 12px / 500
- Sidebar labels: 10px / 600 uppercase
- Agent card name: 12px / 500
- Agent card model: 11px / mono
- Event row time: 10px / mono
- Event row agent: 11px / 500
- Event row type badge: 10px / 600 uppercase
- Event row description: 11px / 400

**Colors (dark theme):**
- Backgrounds: #0a0a0a (primary), #111111 (secondary), #171717 (cards), #1a1a1a (elevated)
- Borders: #262626 (default), #333333 (hover)
- Text: #fafafa (primary), #a1a1aa (secondary), #71717a (tertiary), #52525b (dim)
- Green: #22c55e (active, success, online)
- Red: #ef4444 (error, failed)
- Blue: #3b82f6 (accent, prompt, selected)
- Purple: #a78bfa (response)
- Yellow: #eab308 (idle, spawn)

**Colors (light theme):**
- Backgrounds: #ffffff, #fafafa, #f4f4f5, #e4e4e7
- Borders: #e4e4e7, #d4d4d8
- Text: #09090b, #3f3f46, #71717a, #a1a1aa
- Same accent colors but slightly darker

## Styling System Rules (Event Surfaces)

### Class-first policy

- Use semantic classes in `styles.css` for layout and repeated UI patterns.
- Avoid long inline style strings for static styling in TSX.
- Reserve inline styles for truly dynamic values (for example dynamic event-type badge colors from data).

### Why this matters

The following style string is difficult to read and maintain:

`display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0`

Use a class instead (`event-stream-focusbar`) with readable declarations in CSS.

### Inline-style migration rule

- Bad: raw style strings with many declarations inside components.
- Good: class-based composition (`event-row-body`, `event-stream-toolbar`, `event-stream-chip`) and tokenized vars.
- Exception: dynamic geometry and runtime-computed colors only.

## Accessibility Requirements (V1)

- Event row expanders are keyboard operable (`Enter`/`Space`) and expose `aria-expanded`.
- Payload mode tabs are announced as tabs with selected state.
- Copy JSON button has explicit accessible name.
- Focus order flows toolbar -> focus bar controls -> list rows -> expanded payload controls.
- Color is never the sole status signal; status text remains visible.
- New controls must pass contrast in both dark and light themes.

## Verification

After implementation:
1. `pnpm build` — must compile with zero errors
2. Start daemon + client → projects appear within 2 seconds
3. Click project → agent cards show, events filter
4. Toggle to graph → SVG renders with edges
5. Click agent → events filter to that agent
6. Type in search → events filter by regex
7. Toggle theme → all colors switch
8. Expand event row → JSON payload visible
9. New events → auto-scroll works, stats update in real-time
