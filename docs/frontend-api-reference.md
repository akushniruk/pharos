# Frontend API Reference

This document describes the current daemon endpoints and websocket messages that the frontend can use.

Back to [Docs Portal](README.md).

Base assumptions:

- Local daemon base URL: `http://localhost:4000`
- Websocket URL: `ws://localhost:4000/stream`
- CORS is enabled for local frontend development

## Recommended Frontend Data Sources

Use these as the primary frontend read surface:

- `GET /api/projects`
- `GET /api/projects/:name`
- `GET /api/sessions/:id/snapshot`
- `GET /api/agents`
- `GET /sessions/:id`
- `GET /events/filter-options`
- `GET /health`
- `GET /stream` via websocket

Prefer project and session snapshots for UI state. Use raw event streams mainly for logs, timeline, and recent activity.

## HTTP Endpoints

### `GET /health`

Basic health check.

Response:

```json
{
  "status": "ok"
}
```

### `GET /api/projects`

Returns live project snapshots. This is the main overview endpoint for the frontend.

Response shape:

```ts
type ProjectSnapshot = {
  name: string;
  icon_url: string | null;
  runtime_labels: string[];
  sessions: SessionSnapshot[];
  summary: string | null;
  event_count: number;
  agent_count: number;
  active_session_count: number;
  last_event_at: number;
  is_active: boolean;
};
```

### `GET /api/projects/:name`

Returns a single live project snapshot.

Status codes:

- `200` if found
- `404` if the project name does not exist

Response shape:

```ts
type ProjectSnapshot = {
  name: string;
  icon_url: string | null;
  runtime_labels: string[];
  sessions: SessionSnapshot[];
  summary: string | null;
  event_count: number;
  agent_count: number;
  active_session_count: number;
  last_event_at: number;
  is_active: boolean;
};
```

### `GET /api/sessions/:id/snapshot`

Returns a single live session snapshot.

Status codes:

- `200` if found
- `404` if the session ID does not exist

Response shape:

```ts
type SessionSnapshot = {
  session_id: string;
  label: string;
  runtime_label: string | null;
  summary: string | null;
  current_action: string | null;
  event_count: number;
  agents: AgentSnapshot[];
  active_agent_count: number;
  last_event_at: number;
  is_active: boolean;
};

type AgentSnapshot = {
  agent_id: string | null;
  display_name: string;
  avatar_url: string | null;
  runtime_label: string | null;
  assignment: string | null;
  current_action: string | null;
  agent_type: string | null;
  model_name: string | null;
  event_count: number;
  last_event_at: number;
  is_active: boolean;
  parent_id: string | null;
};
```

### `GET /api/agents`

Returns the live agent registry. This is useful for graph views, live runtime status, and hierarchy.

Response shape:

```ts
type AgentRegistryEntry = {
  id: string;
  source_app: string;
  session_id: string;
  agent_id: string | null;
  display_name: string;
  agent_type: string | null;
  model_name: string | null;
  parent_id: string | null;
  team_name: string | null;
  lifecycle_status: string;
  first_seen_at: number;
  last_seen_at: number;
  event_count: number;
};
```

Notes:

- `source_app` is effectively the project or workspace label
- `lifecycle_status` is currently `active` or `inactive`
- `parent_id` is the main hierarchy link for subagent graphs

### `GET /api/events`

Returns normalized daemon events, not the legacy frontend event shape.

Response shape:

```ts
type EventEnvelope = {
  runtime_source:
    | "claude_code"
    | "codex_cli"
    | "gemini_cli"
    | "pi_cli"
    | "open_code"
    | "aider"
    | "generic_agent_cli"
    | "custom_cli";
  acquisition_mode: "managed" | "observed";
  event_kind:
    | "session_started"
    | "session_ended"
    | "user_prompt_submitted"
    | "tool_call_started"
    | "tool_call_completed"
    | "tool_call_failed"
    | "subagent_started"
    | "subagent_stopped"
    | "session_title_changed"
    | "assistant_response";
  session: {
    host_id: string;
    workspace_id: string;
    session_id: string;
  };
  agent_id: string | null;
  occurred_at_ms: number;
  capabilities: {
    can_observe: boolean;
    can_start: boolean;
    can_stop: boolean;
    can_retry: boolean;
    can_respond: boolean;
  };
  title: string;
  payload: Record<string, unknown>;
};
```

Use this only if you need the daemon-native event model. Most frontend views should prefer websocket legacy events or live snapshots.

### `GET /events/filter-options`

Returns the current filter values derived from live state.

Response shape:

```ts
type FilterOptions = {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
  agent_ids: string[];
  agent_types: string[];
};
```

### `GET /sessions`

Returns session summaries. This is older and lighter than snapshot-driven project/session views, but still useful.

Response shape:

```ts
type SessionSummary = {
  session_id: string;
  source_app: string;
  started_at: number;
  last_event_at: number;
  event_count: number;
  agent_count: number;
  agents: string[];
  is_active: boolean;
};
```

Notes:

- This can include merged discovered Claude sessions when Claude native session discovery is enabled.

### `GET /sessions/:id`

Returns legacy frontend-friendly events for a single session.

Response shape:

```ts
type LegacyHookEvent = {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  agent_id?: string | null;
  agent_type?: string | null;
  model_name?: string | null;
  display_name?: string | null;
  agent_name?: string | null;
};
```

Use this for:

- event log drill-down
- per-session timelines
- activity summaries derived from raw events

### `GET /api/discovery/claude/sessions`

Returns native Claude-discovered sessions from the configured Claude sessions directory.

Response shape:

```ts
type DiscoveredSession = {
  session_id: string;
  prompt_count: number;
  latest_prompt_preview: string;
  path: string;
};
```

This is mostly useful for debugging or Claude-specific UI.

## Websocket: `GET /stream`

The frontend websocket stream is the main live-update transport.

URL:

```txt
ws://localhost:4000/stream
```

### Initial messages on connect

The daemon sends these immediately after the websocket opens:

1. `initial`
2. `agent_registry`
3. `projects`

Envelope shape:

```ts
type WsEnvelope<T> = {
  type: string;
  data: T;
};
```

### Websocket message types

#### `type: "initial"`

Payload:

```ts
LegacyHookEvent[]
```

Meaning:

- initial log/timeline event buffer
- frontend usually stores this as the raw event list

#### `type: "agent_registry"`

Payload:

```ts
AgentRegistryEntry[]
```

Meaning:

- current live agent graph / registry snapshot

When it is sent:

- once on connect
- after topology-changing events only

Topology-changing events currently include:

- session start
- session end
- subagent start
- subagent stop
- session title change

#### `type: "projects"`

Payload:

```ts
ProjectSnapshot[]
```

Meaning:

- current live project/session/agent snapshot for overview UI

When it is sent:

- once on connect
- after every recorded event

#### `type: "event"`

Payload:

```ts
LegacyHookEvent
```

Meaning:

- append-only live event for logs, timeline, activity digests

## Frontend Event Vocabulary

The websocket and `/sessions/:id` endpoint use `hook_event_type`, not `event_kind`.

Current normalized values:

- `SessionStart`
- `SessionEnd`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PostToolUseFailure`
- `SubagentStart`
- `SubagentStop`
- `SessionTitleChanged`
- `AssistantResponse`

These come from the daemon’s native `EventKind` mapping:

```txt
session_started        -> SessionStart
session_ended          -> SessionEnd
user_prompt_submitted  -> UserPromptSubmit
tool_call_started      -> PreToolUse
tool_call_completed    -> PostToolUse
tool_call_failed       -> PostToolUseFailure
subagent_started       -> SubagentStart
subagent_stopped       -> SubagentStop
session_title_changed  -> SessionTitleChanged
assistant_response     -> AssistantResponse
```

## Common Event Payload Fields

Payload is runtime-specific, but these fields are commonly present and already used by the Solid client:

- `runtime_label`
- `runtime_source`
- `project_name`
- `cwd`
- `title`
- `text`
- `prompt`
- `message`
- `tool_name`
- `tool_use_id`
- `tool_input`
- `agent_name`
- `display_name`
- `agent_type`
- `parent_agent_id`
- `model`

Examples:

### `PreToolUse`

```json
{
  "runtime_label": "Codex",
  "project_name": "pharos",
  "tool_name": "exec_command",
  "tool_use_id": "019d5424-ddca-7793-b4ba-adc203c2f435",
  "tool_input": {
    "cmd": "rg -n \"TODO\" src",
    "workdir": "/Users/akushniruk/home_projects/pharos"
  }
}
```

### `UserPromptSubmit`

```json
{
  "runtime_label": "Claude",
  "project_name": "yellow",
  "prompt": "review this codebase and summarize the main risks"
}
```

### `SubagentStart`

```json
{
  "runtime_label": "Codex",
  "project_name": "signal",
  "display_name": "Pauli",
  "agent_type": "worker",
  "parent_agent_id": "main",
  "description": "audit the frontend architecture",
  "model": "gpt-5.4-mini",
  "reasoning_effort": "medium"
}
```

## Current Runtime Labels

The daemon currently normalizes these display labels:

- `Claude`
- `Codex`
- `Gemini`
- `Pi`
- `OpenCode`
- `Aider`
- `Agent CLI`
- `Custom CLI`

Frontend should treat runtime labels as display strings, not strict identifiers.

## Which Surface To Use For What

### Projects sidebar / home

Use:

- `projects` websocket message
- fallback: `GET /api/projects`

### Selected project detail

Use:

- `GET /api/projects/:name`
- plus live `projects` websocket updates

### Selected session detail

Use:

- `GET /api/sessions/:id/snapshot`
- `GET /sessions/:id` for log rows

### Agent graph

Use:

- `agent_registry` websocket message
- fallback: `GET /api/agents`

### Timeline / event stream

Use:

- `initial` websocket payload
- `event` websocket payloads
- `GET /sessions/:id` for session-specific drill-down

### Filters

Use:

- `GET /events/filter-options`

## Notes And Caveats

- `projects` and `agent_registry` are live-state driven. They are the preferred frontend source of truth for current status.
- Raw event payloads are intentionally runtime-specific. Frontend should render them defensively.
- `LegacyHookEvent` is still the main event shape exposed to the current frontend, even though the daemon internally stores normalized `EventEnvelope`s.
- Some routes are compatibility routes for ingestion, not for frontend reads:
  - `POST /events`
  - `POST /api/events`
  - `POST /api/events/legacy/claude`
  - `POST /api/connectors/:connector/events`

## Frontend Type Suggestions

If you are adding or updating frontend code, these are the safest canonical shapes to mirror:

- `HookEvent` for websocket events
- `AgentRegistryEntry` for live graph/registry
- `ProjectSnapshot` for overview and navigation
- `SessionSnapshot` for selected-session state
- `FilterOptions` for filter controls

The existing Solid client types in [`apps/client-solid/src/lib/types.ts`](../apps/client-solid/src/lib/types.ts) are a good reference, but this document should be treated as the backend contract summary.
