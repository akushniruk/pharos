# Process-Based Agent Observation Design

Date: 2026-04-02
Status: Draft for review
Supersedes: 2026-04-02-claude-no-hook-observation-design.md

## Goal

Pharos should detect and observe AI coding agents (Claude, Codex, Copilot, etc.) running on the local machine through process detection and native file observation — no hooks, no per-project setup, no project mutation.

The first target is Claude with hook-equivalent fidelity from native files alone. The architecture must not be Claude-locked — other agents plug in via the same profile system.

## Product Outcome

1. Start Pharos daemon.
2. Start any supported AI agent in any folder.
3. Pharos detects it and shows live activity — prompts, tool calls, subagents, session title.
4. No hooks, no `make integrate`, no Python, no per-project config.

## Problem Statement

The current system requires per-project Python hooks to capture events. This is the main adoption blocker:

- Users must run `make integrate` in every project
- Hooks require Python + `uv` as runtime dependencies
- Hooks mutate project `.claude/` config
- Starting Claude in a new folder produces zero visibility

Claude already writes rich native state under `~/.claude/` that contains everything hooks capture. Pharos should read that directly.

## Discovery: What Claude Writes Natively

Investigation of `~/.claude/` reveals these gold-mine files:

### 1. Live Session Registry: `~/.claude/sessions/{pid}.json`

Created when Claude starts, removed when it exits. This IS process detection.

```json
{
    "pid": 63715,
    "sessionId": "f38483d7-8ef5-461c-808c-93c55fade676",
    "cwd": "/Users/akushniruk/work/yellow-com",
    "startedAt": 1775143799221,
    "kind": "interactive",
    "entrypoint": "claude-vscode"
}
```

Fields: `pid`, `sessionId`, `cwd`, `startedAt`, `kind` (interactive/task), `entrypoint` (claude-vscode/claude-cli).

### 2. Full Conversation Transcript: `~/.claude/projects/{path-slug}/{sessionId}.jsonl`

Append-only JSONL with every message in the conversation. Each line is one of:

| Line type | What it contains |
|-----------|-----------------|
| `type: "user"` with `message.content: string` | User's text prompt |
| `type: "user"` with `message.content: [{type: "tool_result", ...}]` | Tool execution results |
| `type: "assistant"` with `message.content: [{type: "text", ...}]` | Assistant text response |
| `type: "assistant"` with `message.content: [{type: "tool_use", name, input}]` | Tool call (name + arguments) |
| `type: "ai-title"` | Auto-generated session title |
| `type: "system"`, `subtype: "stop_hook_summary"` | Response cycle completion |
| `type: "queue-operation"` | Internal queue state |

The assistant messages include `message.model` (e.g. `"claude-haiku-4-5-20251001"`).

The project path slug maps: `/Users/foo/my-project` → `-Users-foo-my-project`.

### 3. Subagent Metadata: `~/.claude/projects/{path-slug}/{sessionId}/subagents/`

Each subagent gets:
- `agent-{id}.meta.json` — `{agentType: "Explore", description: "..."}`
- `agent-{id}.jsonl` — Full subagent transcript (same format as main, with `agentId` field)

### 4. Prompt History: `~/.claude/history.jsonl`

Every prompt ever typed, with timestamp, project path, and sessionId.

### 5. IDE Lock Files: `~/.claude/ide/{pid}.lock`

For VS Code sessions: `{pid, workspaceFolders, ideName, transport}`.

### 6. Tasks: `~/.claude/tasks/{uuid}/*.json`

Agent team task state (subject, status, blockedBy, etc.).

## Data Mapping: Native Files → Hook Equivalents

| Hook event | Native source | How to extract |
|------------|--------------|----------------|
| SessionStart | `sessions/{pid}.json` appears | Watch directory for new files |
| SessionEnd | `sessions/{pid}.json` disappears | Watch directory for removals |
| UserPromptSubmit | JSONL `type: "user"` with string content | Tail JSONL, filter by type |
| PreToolUse | JSONL `type: "assistant"` with `tool_use` block | Parse assistant content blocks |
| PostToolUse | JSONL `type: "user"` with `tool_result`, `is_error: false` | Parse user content blocks |
| PostToolUseFailure | JSONL `type: "user"` with `tool_result`, `is_error: true` | Parse user content blocks |
| SubagentStart | `subagents/agent-{id}.meta.json` appears | Watch subagents directory |
| SubagentStop | Subagent JSONL stops growing + no process | Detect inactivity |
| Model | `message.model` in assistant entries | Extract from first assistant message |
| Session title | `ai-title` entry in JSONL | Parse JSONL |

**Result: Hook-equivalent fidelity from native files alone.**

## Architecture

### Layer 1: Agent Profile Registry

Each supported AI agent has a profile defining detection and parsing:

```rust
/// A live session detected by the scanner (not the existing DiscoveredSession model).
pub struct DetectedSession {
    pub runtime_source: RuntimeSource,
    pub session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub started_at_ms: i64,
    pub entrypoint: String,           // "claude-vscode", "claude-cli", "codex", etc.
    pub transcript_path: Option<PathBuf>,
    pub subagents_dir: Option<PathBuf>,
}

pub trait AgentProfile: Send + Sync {
    /// Unique key: "claude", "codex", "copilot"
    fn key(&self) -> &'static str;

    /// Discover active sessions. Called every scan cycle.
    fn discover_sessions(&self) -> Vec<DetectedSession>;

    /// Create a tailer for a session's transcript.
    fn create_tailer(&self, session: &DetectedSession) -> Box<dyn TranscriptTailer>;
}
```

**Claude profile**: reads `~/.claude/sessions/`, tails `~/.claude/projects/{slug}/{sessionId}.jsonl`
**Future Codex profile**: detects `codex` process, reads its native files
**Future generic profile**: process-name detection with configurable patterns

### Layer 2: Scanner Loop

Runs in the daemon on a 2-3 second interval:

```
every 2-3 seconds:
    for each registered AgentProfile:
        current_sessions = profile.discover_sessions()

        for each new session (not seen before):
            emit SessionStarted event
            spawn transcript tailer task

        for each removed session (was active, now gone):
            emit SessionEnded event
            stop transcript tailer
```

The scanner compares current vs previous state to detect starts/stops.

### Layer 3: Transcript Tailer

Per active session, a background task tails the JSONL file:

```
loop:
    read new lines from JSONL (track file offset)
    for each new line:
        parse JSON
        match type:
            "user" with string content → emit UserPromptSubmit
            "assistant" with tool_use  → emit ToolCallStarted
            "user" with tool_result    → emit ToolCallCompleted / ToolCallFailed
            "ai-title"                 → emit SessionTitleChanged
    check subagents/ dir for new .meta.json files
        → emit SubagentStarted for each new one
    sleep 500ms
```

Each emitted event flows through the existing pipeline:
`Tailer → EventEnvelope → Store.insert_event() → broadcast → WebSocket → Vue client`

### Layer 4: Existing Pipeline (unchanged)

The Store, API endpoints, WebSocket broadcast, and Vue client stay exactly as they are. The scanner/tailer is just a new ingestion source alongside the existing HTTP POST path.

```
                    ┌──────────────────┐
  Scanner ─────────►│                  │
  (file watch)      │  EventEnvelope   │──► Store (SQLite)
                    │  Pipeline        │──► WebSocket broadcast
  HTTP POST ───────►│  (existing)      │──► REST API
  (hooks, optional) │                  │
                    └──────────────────┘
```

## EventKind Additions

Extend the existing `EventKind` enum:

```rust
pub enum EventKind {
    // Existing
    SessionStarted,
    ToolCallStarted,
    ToolCallFailed,
    // New
    SessionEnded,
    ToolCallCompleted,      // successful tool result
    UserPromptSubmitted,
    AssistantResponse,      // text response from assistant
    SubagentStarted,
    SubagentStopped,
    SessionTitleChanged,
}
```

## RuntimeSource Extension

```rust
pub enum RuntimeSource {
    ClaudeCode,
    // Future
    Codex,
    Copilot,
    Generic,
}
```

## AcquisitionMode

No changes needed — `Observed` already exists and is correct for this path.

## New Modules in daemon-rs

### `scanner.rs` — Scanner Loop

- Manages registered `AgentProfile` instances
- Runs periodic scan cycle (tokio interval or file watcher)
- Tracks active sessions (HashMap<session_key, ActiveSession>)
- Detects new/removed sessions by diffing current vs tracked
- Spawns/stops tailer tasks

### `tailer.rs` — Transcript Tailer

- Reads JSONL file from last known offset
- Parses each line into typed message
- Converts to EventEnvelope
- Sends through Store + broadcast
- Watches subagents/ directory for new agents

### `profiles/mod.rs` — Profile registry

### `profiles/claude.rs` — Claude Agent Profile

- `discover_sessions()`: reads `~/.claude/sessions/*.json`, parses each
- `create_tailer()`: maps sessionId to project JSONL path via `~/.claude/projects/`
- Path slug computation: `/Users/foo/bar` → `-Users-foo-bar`

### `profiles/codex.rs` — Codex Agent Profile (stub)

- Placeholder for future implementation
- `discover_sessions()`: uses `sysinfo` crate to find `codex` processes

## Session-to-JSONL Path Resolution

The scanner needs to find the JSONL transcript for a discovered session:

1. Read `sessions/{pid}.json` → get `sessionId` and `cwd`
2. Compute project slug: replace `/` with `-` in `cwd`, strip leading `-`
3. JSONL path: `~/.claude/projects/{slug}/{sessionId}.jsonl`
4. Subagents path: `~/.claude/projects/{slug}/{sessionId}/subagents/`

If the JSONL doesn't exist yet (session just started), the tailer waits for it to appear.

## WebSocket Message Types

New message types broadcast to clients:

```json
{"type": "event", "data": {/* LegacyHookEvent compatible */}}
{"type": "agent_registry", "data": [/* updated registry */]}
```

No new WebSocket message types needed — the scanner emits standard EventEnvelopes that get converted to LegacyHookEvent format by the existing `broadcast_compat_updates()`. The Vue client receives them identically to hook-sourced events.

## What Hooks Become

Hooks become **optional high-fidelity enrichment**, not the primary path:

- Process-based observation is the default (zero setup)
- Hooks can still POST to the daemon for extra data (e.g., permission_request details, custom summaries)
- The daemon merges both sources — hook events and observed events — by session_id
- No breaking changes to the hook API

## Error Handling

- If `~/.claude/sessions/` doesn't exist → no Claude sessions detected, empty results
- If a JSONL file is malformed on one line → skip that line, continue
- If a session file disappears mid-read → treat as session ended
- If subagents/ directory doesn't exist → no subagents for that session
- Scanner failures never crash the daemon or break existing API endpoints

## Desktop App Path (Future)

The Rust daemon is the natural Tauri backend:
- Same binary, same scanner, same store
- Vue client becomes Tauri webview
- Desktop = Tauri wrapper, VPS = standalone daemon + static files
- Not in scope for today, but architecture supports it cleanly

## Implementation Phases

### Phase 1: Session Discovery via Native Files

- Add `scanner.rs` with scan loop
- Add `profiles/claude.rs` that reads `~/.claude/sessions/*.json`
- Emit `SessionStarted` / `SessionEnded` events
- Wire into existing Store + WebSocket broadcast
- **Verification**: Start Claude in new folder → appears in Pharos session list

### Phase 2: Transcript Tailing

- Add `tailer.rs` that tails JSONL files
- Parse user prompts → `UserPromptSubmitted`
- Parse tool_use → `ToolCallStarted`
- Parse tool_result → `ToolCallCompleted` / `ToolCallFailed`
- Parse ai-title → `SessionTitleChanged`
- **Verification**: Tool calls and prompts appear live in Pharos timeline

### Phase 3: Subagent Discovery

- Watch `subagents/` directory for new `.meta.json` files
- Emit `SubagentStarted` with agentType and description
- Tail subagent JSONL files with same logic as main session
- **Verification**: Spawned agents appear in agent registry and metro sidebar

### Phase 4: Multi-Agent Profile Support

- Extract Claude-specific logic behind `AgentProfile` trait
- Add stub `CodexProfile`
- Process-name-based detection for non-Claude agents
- **Verification**: Architecture supports adding new agents without modifying scanner core

## Verification Commands

```bash
# Phase 1: Session detection
cargo test -p daemon-rs
curl http://localhost:4000/sessions  # Should show observed Claude sessions

# Phase 2: Live events
curl http://localhost:4000/api/events  # Should show tool calls from JSONL
# Open Pharos UI → events should stream in real-time

# Phase 3: Subagents
curl http://localhost:4000/api/agents  # Should show subagents

# Manual end-to-end
# 1. Start daemon: make daemon-rs
# 2. Start Claude in a new folder (no hooks)
# 3. Open http://localhost:5173
# 4. Confirm session appears, events stream, agents show
```

## Risks

### Native file format instability
Claude's files are not a public API. Format may change.
**Mitigation**: Isolate all parsing in `profiles/claude.rs`. Defensive parsing — skip unparseable lines. Test with fixtures.

### JSONL tailing race conditions
File may be written to while we're reading.
**Mitigation**: Read by byte offset, only process complete lines (ending with `\n`). Never seek backwards.

### Multiple Claude instances
Handled naturally — each `sessions/{pid}.json` is a separate session with its own JSONL path.

### Performance with large JSONL files
Active sessions can produce large transcripts.
**Mitigation**: Track file offset, only read new bytes. Don't re-read from start.
