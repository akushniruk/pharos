# Pharos — AI Agent Observability

## Architecture

Rust daemon (`apps/daemon-rs`) scans `~/.claude/sessions/` for active AI agent sessions, tails their JSONL transcripts, and streams events via WebSocket to a Vue 3 dashboard (`apps/client`).

## Key Concepts

- **source_app** = last path component of the agent's cwd (e.g. "my-project")
- **session_id** = UUID from Claude's native session file
- **Agent ID** = `source_app:session_id` (session_id truncated to 8 chars)
- **EventEnvelope** = canonical event format in `apps/daemon-rs/src/model.rs`

## Development

```bash
make daemon    # start Rust daemon on port 4000
make client    # start Vue dev server on port 5173
make test      # run Rust tests
```

Rust edition 2024 — use `rustup run 1.85.1 cargo` for all cargo commands.
