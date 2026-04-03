# Pharos Rust Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first repo-side Rust slice of Pharos: a host-agnostic daemon foundation with a canonical event model, a Claude-compatibility normalizer, a replay-based verification tool, and a minimal read/write API backed by SQLite.

**Architecture:** Add a new Rust daemon under `apps/daemon-rs` beside the existing Go and Vue apps. Keep the current product working while introducing a parallel Rust core that can ingest normalized events, persist them to SQLite, replay captured Claude traces through a compatibility adapter, and expose a minimal HTTP API for observability-only flows.

**Tech Stack:** Rust 2024, Tokio, Axum, Serde, Serde JSON, Clap, ThisError, Rusqlite, UUID, Insta, Assert Cmd, Tempfile

---

## File Structure

- Create: `apps/daemon-rs/Cargo.toml`
- Create: `apps/daemon-rs/src/lib.rs`
- Create: `apps/daemon-rs/src/main.rs`
- Create: `apps/daemon-rs/src/config.rs`
- Create: `apps/daemon-rs/src/model.rs`
- Create: `apps/daemon-rs/src/legacy/mod.rs`
- Create: `apps/daemon-rs/src/legacy/claude.rs`
- Create: `apps/daemon-rs/src/store.rs`
- Create: `apps/daemon-rs/src/api.rs`
- Create: `apps/daemon-rs/src/replay.rs`
- Create: `apps/daemon-rs/tests/model_normalization.rs`
- Create: `apps/daemon-rs/tests/api_smoke.rs`
- Create: `apps/daemon-rs/tests/replay_cli.rs`
- Create: `apps/daemon-rs/fixtures/claude/session_start.json`
- Create: `apps/daemon-rs/fixtures/claude/pre_tool_use.json`
- Create: `apps/daemon-rs/fixtures/claude/post_tool_use_failure.json`
- Modify: `Makefile`
- Modify: `README.md`

### Task 1: Scaffold the Rust daemon crate

**Files:**
- Create: `apps/daemon-rs/Cargo.toml`
- Create: `apps/daemon-rs/src/lib.rs`
- Create: `apps/daemon-rs/src/main.rs`
- Create: `apps/daemon-rs/src/config.rs`
- Test: `apps/daemon-rs/tests/api_smoke.rs`

- [ ] **Step 1: Write the failing smoke test for the binary config path**

```rust
use pharos_daemon::config::Config;

#[test]
fn config_defaults_to_local_sqlite_and_loopback_http() {
    let cfg = Config::from_env_map(std::collections::BTreeMap::new());

    assert_eq!(cfg.host, "127.0.0.1");
    assert_eq!(cfg.port, 4010);
    assert_eq!(cfg.db_path, "pharos-daemon.db");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test config_defaults_to_local_sqlite_and_loopback_http -- --exact`

Expected: FAIL with `could not find Cargo.toml` or unresolved `pharos_daemon::config::Config`

- [ ] **Step 3: Create the crate with the required Rust project defaults**

`apps/daemon-rs/Cargo.toml`

```toml
[package]
name = "pharos-daemon"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"

[lints.rust]
unsafe_code = "warn"

[lints.clippy]
all = "warn"
pedantic = "warn"

[dependencies]
axum = { version = "0.8", features = ["json"] }
clap = { version = "4.5", features = ["derive"] }
rusqlite = { version = "0.37", features = ["bundled"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
tokio = { version = "1.47", features = ["macros", "rt-multi-thread", "signal", "sync"] }
tower-http = { version = "0.6", features = ["cors", "trace"] }
uuid = { version = "1.18", features = ["serde", "v4"] }

[dev-dependencies]
assert_cmd = "2.0"
insta = { version = "1.43", features = ["json"] }
tempfile = "3.20"
```

`apps/daemon-rs/src/lib.rs`

```rust
pub mod api;
pub mod config;
pub mod legacy;
pub mod model;
pub mod replay;
pub mod store;
```

`apps/daemon-rs/src/config.rs`

```rust
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub db_path: String,
}

impl Config {
    pub fn from_env() -> Self {
        let mut vars = BTreeMap::new();
        for (key, value) in std::env::vars() {
            vars.insert(key, value);
        }
        Self::from_env_map(vars)
    }

    pub fn from_env_map(vars: BTreeMap<String, String>) -> Self {
        let host = vars
            .get("PHAROS_DAEMON_HOST")
            .cloned()
            .unwrap_or_else(|| "127.0.0.1".to_owned());
        let port = vars
            .get("PHAROS_DAEMON_PORT")
            .and_then(|raw| raw.parse::<u16>().ok())
            .unwrap_or(4010);
        let db_path = vars
            .get("PHAROS_DAEMON_DB_PATH")
            .cloned()
            .unwrap_or_else(|| "pharos-daemon.db".to_owned());

        Self { host, port, db_path }
    }
}
```

`apps/daemon-rs/src/main.rs`

```rust
use pharos_daemon::config::Config;

#[tokio::main]
async fn main() {
    let cfg = Config::from_env();
    println!("pharos-daemon listening on {}:{}", cfg.host, cfg.port);
}
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `cd apps/daemon-rs && cargo test config_defaults_to_local_sqlite_and_loopback_http -- --exact`

Expected: PASS

- [ ] **Step 5: Run the binary once to verify the crate boots**

Run: `cd apps/daemon-rs && cargo run --quiet`

Expected: prints `pharos-daemon listening on 127.0.0.1:4010`

- [ ] **Step 6: Commit**

```bash
git add apps/daemon-rs
git commit -m "feat: scaffold rust daemon crate"
```

### Task 2: Define the canonical event model and Claude compatibility normalizer

**Files:**
- Create: `apps/daemon-rs/src/model.rs`
- Create: `apps/daemon-rs/src/legacy/mod.rs`
- Create: `apps/daemon-rs/src/legacy/claude.rs`
- Create: `apps/daemon-rs/tests/model_normalization.rs`
- Create: `apps/daemon-rs/fixtures/claude/session_start.json`
- Create: `apps/daemon-rs/fixtures/claude/pre_tool_use.json`
- Create: `apps/daemon-rs/fixtures/claude/post_tool_use_failure.json`

- [ ] **Step 1: Write the failing normalization test from a Claude fixture**

`apps/daemon-rs/tests/model_normalization.rs`

```rust
use insta::assert_json_snapshot;
use pharos_daemon::legacy::claude::normalize_claude_event;

#[test]
fn normalizes_pre_tool_use_fixture_into_event_envelope() {
    let raw = include_str!("../fixtures/claude/pre_tool_use.json");
    let envelope = normalize_claude_event(raw).expect("fixture should normalize");

    assert_json_snapshot!(envelope);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test normalizes_pre_tool_use_fixture_into_event_envelope -- --exact`

Expected: FAIL with unresolved import or missing `normalize_claude_event`

- [ ] **Step 3: Add the canonical model types**

`apps/daemon-rs/src/model.rs`

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeSource {
    ClaudeCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AcquisitionMode {
    Managed,
    Observed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    SessionStarted,
    ToolCallStarted,
    ToolCallFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionRef {
    pub host_id: String,
    pub workspace_id: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapabilitySet {
    pub can_observe: bool,
    pub can_start: bool,
    pub can_stop: bool,
    pub can_retry: bool,
    pub can_respond: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventEnvelope {
    pub runtime_source: RuntimeSource,
    pub acquisition_mode: AcquisitionMode,
    pub event_kind: EventKind,
    pub session: SessionRef,
    pub agent_id: Option<String>,
    pub occurred_at_ms: i64,
    pub capabilities: CapabilitySet,
    pub title: String,
    pub payload: Value,
}
```

`apps/daemon-rs/src/legacy/mod.rs`

```rust
pub mod claude;
```

- [ ] **Step 4: Implement the Claude compatibility normalizer**

`apps/daemon-rs/src/legacy/claude.rs`

```rust
use serde::Deserialize;
use serde_json::Value;
use thiserror::Error;

use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};

#[derive(Debug, Error)]
pub enum ClaudeNormalizeError {
    #[error("invalid json: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("missing required field: {0}")]
    MissingField(&'static str),
    #[error("unsupported hook event type: {0}")]
    UnsupportedType(String),
}

#[derive(Debug, Deserialize)]
struct ClaudeHookEvent {
    source_app: String,
    session_id: String,
    hook_event_type: String,
    payload: Value,
    timestamp: Option<i64>,
    agent_id: Option<String>,
}

pub fn normalize_claude_event(raw: &str) -> Result<EventEnvelope, ClaudeNormalizeError> {
    let event: ClaudeHookEvent = serde_json::from_str(raw)?;
    if event.source_app.is_empty() {
        return Err(ClaudeNormalizeError::MissingField("source_app"));
    }
    if event.session_id.is_empty() {
        return Err(ClaudeNormalizeError::MissingField("session_id"));
    }

    let event_kind = match event.hook_event_type.as_str() {
        "SessionStart" => EventKind::SessionStarted,
        "PreToolUse" => EventKind::ToolCallStarted,
        "PostToolUseFailure" => EventKind::ToolCallFailed,
        other => return Err(ClaudeNormalizeError::UnsupportedType(other.to_owned())),
    };

    let title = match event_kind {
        EventKind::SessionStarted => "session started".to_owned(),
        EventKind::ToolCallStarted => {
            let tool = event
                .payload
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            format!("tool call started: {tool}")
        }
        EventKind::ToolCallFailed => {
            let tool = event
                .payload
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            format!("tool call failed: {tool}")
        }
    };

    Ok(EventEnvelope {
        runtime_source: RuntimeSource::ClaudeCode,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_owned(),
            workspace_id: event.source_app,
            session_id: event.session_id,
        },
        agent_id: event.agent_id,
        occurred_at_ms: event.timestamp.unwrap_or(0),
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title,
        payload: event.payload,
    })
}
```

- [ ] **Step 5: Add real fixtures and snapshot assertions**

`apps/daemon-rs/fixtures/claude/pre_tool_use.json`

```json
{
  "source_app": "demo-project",
  "session_id": "sess-1234",
  "hook_event_type": "PreToolUse",
  "timestamp": 1711234571000,
  "payload": {
    "tool_name": "Bash",
    "tool_use_id": "toolu_123",
    "tool_input": {
      "command": "git status"
    }
  }
}
```

`apps/daemon-rs/fixtures/claude/session_start.json`

```json
{
  "source_app": "demo-project",
  "session_id": "sess-1234",
  "hook_event_type": "SessionStart",
  "timestamp": 1711234567000,
  "payload": {
    "session_id": "sess-1234",
    "agent_type": "main",
    "model": "claude-opus-4-5"
  }
}
```

`apps/daemon-rs/fixtures/claude/post_tool_use_failure.json`

```json
{
  "source_app": "demo-project",
  "session_id": "sess-1234",
  "hook_event_type": "PostToolUseFailure",
  "timestamp": 1711234573000,
  "payload": {
    "tool_name": "Bash",
    "tool_use_id": "toolu_123",
    "error": "Command failed with exit code 1"
  }
}
```

- [ ] **Step 6: Run tests and accept the snapshots**

Run: `cd apps/daemon-rs && cargo test normalizes_pre_tool_use_fixture_into_event_envelope -- --exact`

Expected: FAIL once with insta snapshot pending

Run: `cd apps/daemon-rs && cargo insta accept`

Expected: snapshot accepted

Run: `cd apps/daemon-rs && cargo test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/daemon-rs
git commit -m "feat: add canonical event model and claude normalizer"
```

### Task 3: Persist normalized events and expose a minimal observability API

**Files:**
- Create: `apps/daemon-rs/src/store.rs`
- Create: `apps/daemon-rs/src/api.rs`
- Modify: `apps/daemon-rs/src/lib.rs`
- Modify: `apps/daemon-rs/src/main.rs`
- Test: `apps/daemon-rs/tests/api_smoke.rs`

- [ ] **Step 1: Write the failing API smoke test**

`apps/daemon-rs/tests/api_smoke.rs`

```rust
use pharos_daemon::api::build_router;
use pharos_daemon::store::Store;
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn posts_and_reads_back_normalized_events() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);

    let event = json!({
        "runtime_source": "claude_code",
        "acquisition_mode": "observed",
        "event_kind": "session_started",
        "session": {
            "host_id": "local",
            "workspace_id": "demo-project",
            "session_id": "sess-1234"
        },
        "agent_id": null,
        "occurred_at_ms": 1711234567000_i64,
        "capabilities": {
            "can_observe": true,
            "can_start": false,
            "can_stop": false,
            "can_retry": false,
            "can_respond": false
        },
        "title": "session started",
        "payload": { "raw": true }
    });

    let response = app
        .clone()
        .oneshot(
            http::Request::post("/api/events")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(axum::body::Body::from(event.to_string()))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), http::StatusCode::CREATED);

    let response = app
        .oneshot(
            http::Request::get("/api/events")
                .body(axum::body::Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), http::StatusCode::OK);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test posts_and_reads_back_normalized_events -- --exact`

Expected: FAIL with unresolved `Store` or `build_router`

- [ ] **Step 3: Implement the SQLite store**

`apps/daemon-rs/src/store.rs`

```rust
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use thiserror::Error;

use crate::model::EventEnvelope;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("store mutex poisoned")]
    Poisoned,
}

#[derive(Clone)]
pub struct Store {
    conn: Arc<Mutex<Connection>>,
}

impl Store {
    pub fn open(path: &str) -> Result<Self, StoreError> {
        let conn = Connection::open(path)?;
        Self::init(conn)
    }

    pub fn open_in_memory() -> Result<Self, StoreError> {
        let conn = Connection::open_in_memory()?;
        Self::init(conn)
    }

    fn init(conn: Connection) -> Result<Self, StoreError> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                runtime_source TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                event_kind TEXT NOT NULL,
                occurred_at_ms INTEGER NOT NULL,
                json TEXT NOT NULL
            );",
        )?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn insert_event(&self, event: &EventEnvelope) -> Result<(), StoreError> {
        let json = serde_json::to_string(event)?;
        let conn = self.conn.lock().map_err(|_| StoreError::Poisoned)?;
        conn.execute(
            "INSERT INTO events (runtime_source, workspace_id, session_id, event_kind, occurred_at_ms, json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                serde_json::to_string(&event.runtime_source)?,
                event.session.workspace_id,
                event.session.session_id,
                serde_json::to_string(&event.event_kind)?,
                event.occurred_at_ms,
                json
            ],
        )?;
        Ok(())
    }

    pub fn list_events(&self) -> Result<Vec<EventEnvelope>, StoreError> {
        let conn = self.conn.lock().map_err(|_| StoreError::Poisoned)?;
        let mut stmt = conn.prepare("SELECT json FROM events ORDER BY occurred_at_ms ASC, id ASC")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut events = Vec::new();
        for row in rows {
            let json = row?;
            events.push(serde_json::from_str::<EventEnvelope>(&json)?);
        }
        Ok(events)
    }
}
```

- [ ] **Step 4: Implement the minimal API router**

`apps/daemon-rs/src/api.rs`

```rust
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;

use crate::{model::EventEnvelope, store::Store};

pub fn build_router(store: Store) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/events", post(create_event).get(list_events))
        .with_state(store)
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn create_event(
    State(store): State<Store>,
    Json(event): Json<EventEnvelope>,
) -> Result<(StatusCode, Json<EventEnvelope>), StatusCode> {
    store
        .insert_event(&event)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok((StatusCode::CREATED, Json(event)))
}

async fn list_events(
    State(store): State<Store>,
) -> Result<Json<Vec<EventEnvelope>>, StatusCode> {
    let events = store
        .list_events()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(events))
}
```

`apps/daemon-rs/src/main.rs`

```rust
use std::net::SocketAddr;

use pharos_daemon::{api::build_router, config::Config, store::Store};

#[tokio::main]
async fn main() {
    let cfg = Config::from_env();
    let store = Store::open(&cfg.db_path).expect("sqlite store");
    let app = build_router(store);
    let addr: SocketAddr = format!("{}:{}", cfg.host, cfg.port)
        .parse()
        .expect("valid socket address");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind daemon listener");
    axum::serve(listener, app).await.expect("serve daemon");
}
```

- [ ] **Step 5: Run tests to verify persistence and readback work**

Run: `cd apps/daemon-rs && cargo test posts_and_reads_back_normalized_events -- --exact`

Expected: PASS

Run: `cd apps/daemon-rs && cargo test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/daemon-rs
git commit -m "feat: add sqlite store and minimal daemon api"
```

### Task 4: Add replay tooling and regression fixtures for migration safety

**Files:**
- Create: `apps/daemon-rs/src/replay.rs`
- Modify: `apps/daemon-rs/src/main.rs`
- Create: `apps/daemon-rs/tests/replay_cli.rs`

- [ ] **Step 1: Write the failing replay CLI test**

`apps/daemon-rs/tests/replay_cli.rs`

```rust
use assert_cmd::Command;

#[test]
fn replay_command_imports_a_fixture_file() {
    let mut cmd = Command::cargo_bin("pharos-daemon").expect("binary exists");
    cmd.args([
        "replay",
        "--input",
        "fixtures/claude/pre_tool_use.json",
    ]);
    cmd.assert().success();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test replay_command_imports_a_fixture_file -- --exact`

Expected: FAIL because the CLI subcommand does not exist

- [ ] **Step 3: Implement the replay subcommand**

`apps/daemon-rs/src/replay.rs`

```rust
use std::{fs, path::PathBuf};

use clap::{Parser, Subcommand};

use crate::legacy::claude::normalize_claude_event;

#[derive(Debug, Parser)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Serve,
    Replay { input: PathBuf },
}

pub fn replay_file(path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let raw = fs::read_to_string(path)?;
    let normalized = normalize_claude_event(&raw)?;
    println!("{}", serde_json::to_string_pretty(&normalized)?);
    Ok(())
}
```

`apps/daemon-rs/src/main.rs`

```rust
use clap::Parser;
use pharos_daemon::{
    api::build_router,
    config::Config,
    replay::{replay_file, Cli, Command},
    store::Store,
};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    match cli.command {
        Command::Replay { input } => {
            replay_file(input).expect("replay fixture");
        }
        Command::Serve => {
            let cfg = Config::from_env();
            let store = Store::open(&cfg.db_path).expect("sqlite store");
            let app = build_router(store);
            let addr: SocketAddr = format!("{}:{}", cfg.host, cfg.port)
                .parse()
                .expect("valid socket address");

            let listener = tokio::net::TcpListener::bind(addr)
                .await
                .expect("bind daemon listener");
            axum::serve(listener, app).await.expect("serve daemon");
        }
    }
}
```

- [ ] **Step 4: Run the replay test and inspect the output**

Run: `cd apps/daemon-rs && cargo test replay_command_imports_a_fixture_file -- --exact`

Expected: PASS

Run: `cd apps/daemon-rs && cargo run --quiet -- replay --input fixtures/claude/pre_tool_use.json`

Expected: pretty-printed normalized event JSON with `runtime_source` set to `claude_code`

- [ ] **Step 5: Commit**

```bash
git add apps/daemon-rs
git commit -m "feat: add replay cli for connector regression fixtures"
```

### Task 5: Wire repo entrypoints and document the new execution slice

**Files:**
- Modify: `Makefile`
- Modify: `README.md`

- [ ] **Step 1: Write the failing documentation smoke check**

Open `README.md` and confirm it does not mention the Rust daemon or replay flow.

Expected: the new daemon slice is absent

- [ ] **Step 2: Add repo entrypoints**

Append these targets to `Makefile`:

```make
daemon-rs: ## Start the Rust daemon
	cd $(PROJECT_ROOT)/apps/daemon-rs && cargo run -- serve

daemon-rs-test: ## Run Rust daemon tests
	cd $(PROJECT_ROOT)/apps/daemon-rs && cargo test

daemon-rs-replay: ## Replay one Claude fixture through the Rust normalizer
	cd $(PROJECT_ROOT)/apps/daemon-rs && cargo run -- replay --input fixtures/claude/pre_tool_use.json
```

- [ ] **Step 3: Document the slice in the README**

Add this section near the architecture and running instructions in `README.md`:

```md
## Rust Daemon Slice

Pharos now includes an experimental Rust daemon foundation under `apps/daemon-rs`.

Current scope:

- canonical event envelope
- Claude compatibility normalizer
- SQLite-backed event storage
- minimal API for ingesting and reading normalized events
- replay CLI for migration and regression testing

Useful commands:

```bash
make daemon-rs
make daemon-rs-test
make daemon-rs-replay
```
```

- [ ] **Step 4: Run the repo-level verification commands**

Run: `make daemon-rs-test`

Expected: Rust daemon tests PASS

Run: `make daemon-rs-replay`

Expected: normalized JSON prints to stdout

- [ ] **Step 5: Commit**

```bash
git add Makefile README.md
git commit -m "docs: add rust daemon entrypoints and usage"
```

## Self-Review

- Spec coverage:
  - Neutral core model: covered by Task 2
  - Rust daemon direction: covered by Tasks 1 and 3
  - Verification tooling: covered by Task 4
  - Incremental migration: covered by Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or undefined steps remain
- Type consistency:
  - `EventEnvelope`, `RuntimeSource`, `AcquisitionMode`, `EventKind`, `Store`, and `build_router` are named consistently across tasks

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-02-pharos-rust-core-foundation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
