# Architecture

#architecture #overview

This document describes the system architecture of the Claude Code Multi-Agent Observability platform.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code Agents                           │
│  (one or more agents running in parallel, each with session_id)     │
└────────────────────────────┬────────────────────────────────────────┘
                             │ lifecycle events
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Python Hooks (.claude/hooks/)                   │
│  send_event.py — reads stdin JSON, enriches, POSTs to server        │
│  pre_tool_use.py, post_tool_use.py, notification.py, …             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP POST /events
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Go Server  (port 4000)                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  REST API    │   │   SQLite DB  │   │   WebSocket /stream  │   │
│  │  /events     │──▶│  events.db   │──▶│  broadcasts to all   │   │
│  │  /agents     │   │  WAL mode    │   │  connected clients   │   │
│  │  /sessions   │   └──────────────┘   └──────────────────────┘   │
│  └──────────────┘                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ WebSocket ws://localhost:4000/stream
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Vue 3 Client  (port 5173)                          │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐ │
│  │  EventTimeline   │  │  AgentSwimLane    │  │  LivePulseChart  │ │
│  │  (scrollable     │  │  (per-agent rows, │  │  (canvas-based   │ │
│  │   event list)    │  │   metro map style)│  │   activity bars) │ │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### Hook System (`.claude/hooks/`)

The hook system is the data ingestion layer. Claude Code fires hooks at each lifecycle point (tool use, session start/stop, notifications, etc.) and the hook scripts capture that data.

**`send_event.py`** is the universal event sender. It:
- Reads the JSON event payload from stdin (Claude Code passes it there automatically)
- Enriches the event with `source_app`, `timestamp`, and `model_name`
- Forwards event-specific fields (`tool_name`, `agent_id`, `notification_type`, etc.) as top-level properties
- Optionally generates an AI summary (`--summarize`) or attaches the chat transcript (`--add-chat`)
- POSTs the enriched JSON to `http://localhost:4000/events`

Each of the 12 hook types also has a dedicated script (`pre_tool_use.py`, `post_tool_use.py`, etc.) for validation logic, blocking dangerous commands, and type-aware processing. These run before `send_event.py` in the hook chain.

### Server (`apps/server-go/`)

A Go server providing HTTP REST endpoints and WebSocket streaming.

- **Runtime**: Go 1.25+ (compiled binary)
- **Database**: SQLite via `modernc.org/sqlite` with WAL mode enabled for concurrent reads
- **Database file**: `apps/server-go/events.db` (gitignored)
- **Schema migrations**: Automatic on startup — columns are added as needed
- **WebSocket**: On connection, sends the last 300 events as `{ type: "initial", data: [...] }`. New events are broadcast as `{ type: "event", data: {...} }`

See [[api-reference]] for the full endpoint list.

### Client (`apps/client-solid/`)

A SolidJS + Vite + TypeScript single-page application.

- **Projects Home**: Project-first overview with active session and agent summaries
- **Sidebar**: Project and session selection with live status badges
- **EventStream**: Scrollable event log with simple/detailed modes and regex search
- **AgentCards / AgentGraph**: Compact card view and graph view for observed agents and subagents
- **AgentDetail**: Selected agent drill-down with recent activity context

### Metro Map Visualization

Each agent occupies its own horizontal swim lane. Events appear as stops along the lane in chronological order. The dual-color system uses:
- Left border color: assigned to the `source_app`
- Second border / fill color: assigned to the `session_id`

This makes it easy to distinguish agents belonging to the same app (same left color) from agents in different apps.

## Data Flow

1. **Agent action** — A Claude Code agent executes a tool, sends a notification, starts a session, etc.
2. **Hook fires** — Claude Code runs the configured hook command from `.claude/settings.json`, passing event data as JSON on stdin.
3. **HTTP POST** — `send_event.py` enriches the payload and POSTs it to `POST /events` on the Go server.
4. **Server stores and broadcasts** — The server validates the event, inserts it into SQLite, then broadcasts it over WebSocket to all connected clients.
5. **Client receives** — The Vue 3 client receives the WebSocket message and appends it to its in-memory event list (capped at `VITE_MAX_EVENTS_TO_DISPLAY`).
6. **UI updates** — Vue reactivity triggers re-renders of the timeline, swim lanes, and pulse chart.

## Agent Naming Resolution

Each agent is uniquely identified by the pair `(source_app, session_id)`. For display, the system resolves a human-readable name using a 4-level priority:

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | User-set `display_name` via `PATCH /agents/name` | `"my-builder-agent"` |
| 2 | `agent_name` passed via `--agent-name` flag on `send_event.py` | `"Builder"` |
| 3 | Auto-derived from `agent_type` + spawn index | `"subagent #2"` |
| 4 (fallback) | Hash: `source_app:session_id[0:8]` | `"my-app:a3f9c12b"` |

The CLAUDE.md project instruction states: display the agent ID as `source_app:session_id` with session_id truncated to the first 8 characters.

## Related Docs

- [[setup-guide]] — How to install and run the system
- [[hook-events]] — All 12 event types with payload schemas
- [[api-reference]] — Full server API reference
- [[deployment]] — Docker and production deployment
