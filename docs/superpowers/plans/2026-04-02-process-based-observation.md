# Process-Based Agent Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Back to [Docs Portal](../../README.md).

**Goal:** Replace hook-dependent observation with process-based detection that reads Claude's native files (`~/.claude/sessions/`, `~/.claude/projects/`) to achieve hook-equivalent fidelity with zero per-project setup.

**Architecture:** A scanner loop in the Rust daemon discovers active Claude sessions by watching `~/.claude/sessions/{pid}.json` files. For each discovered session, a transcript tailer reads the append-only JSONL at `~/.claude/projects/{slug}/{sessionId}.jsonl`, parsing user prompts, tool calls, and tool results into `EventEnvelope` objects that flow through the existing Store → WebSocket pipeline unchanged. An `AgentProfile` trait makes this extensible to non-Claude agents.

**Tech Stack:** Rust, tokio (async runtime + intervals), serde_json (JSONL parsing), existing axum/SQLite/WebSocket pipeline

**Spec:** `docs/superpowers/specs/2026-04-02-process-based-observation-design.md`

---

### Task 1: Extend EventKind and RuntimeSource Enums

**Files:**
- Modify: `apps/daemon-rs/src/model.rs`
- Modify: `apps/daemon-rs/src/store.rs` (update `hook_event_type_for_kind` and `resolve_lifecycle_status`)

- [ ] **Step 1: Add new EventKind variants to model.rs**

In `apps/daemon-rs/src/model.rs`, replace the `EventKind` enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    SessionStarted,
    SessionEnded,
    UserPromptSubmitted,
    ToolCallStarted,
    ToolCallCompleted,
    ToolCallFailed,
    SubagentStarted,
    SubagentStopped,
    SessionTitleChanged,
    AssistantResponse,
}
```

- [ ] **Step 2: Update hook_event_type_for_kind in store.rs**

In `apps/daemon-rs/src/store.rs`, update the `hook_event_type_for_kind` function to handle all new variants:

```rust
fn hook_event_type_for_kind(event_kind: &EventKind) -> &'static str {
    match event_kind {
        EventKind::SessionStarted => "SessionStart",
        EventKind::SessionEnded => "SessionEnd",
        EventKind::UserPromptSubmitted => "UserPromptSubmit",
        EventKind::ToolCallStarted => "PreToolUse",
        EventKind::ToolCallCompleted => "PostToolUse",
        EventKind::ToolCallFailed => "PostToolUseFailure",
        EventKind::SubagentStarted => "SubagentStart",
        EventKind::SubagentStopped => "SubagentStop",
        EventKind::SessionTitleChanged => "SessionTitleChanged",
        EventKind::AssistantResponse => "AssistantResponse",
    }
}
```

- [ ] **Step 3: Update resolve_lifecycle_status in store.rs**

```rust
fn resolve_lifecycle_status(event_kind: &EventKind) -> &'static str {
    match event_kind {
        EventKind::SessionEnded | EventKind::SubagentStopped => "inactive",
        _ => "active",
    }
}
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd apps/daemon-rs && cargo test`
Expected: All existing tests pass (the new variants don't affect existing serialized data because existing JSON still maps to the original variant names).

- [ ] **Step 5: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/src/model.rs apps/daemon-rs/src/store.rs
git commit -m "feat: extend EventKind with session, prompt, subagent, and response variants"
```

---

### Task 2: Add Claude Session File Parser

**Files:**
- Create: `apps/daemon-rs/src/profiles/mod.rs`
- Create: `apps/daemon-rs/src/profiles/claude.rs`
- Create: `apps/daemon-rs/fixtures/native/claude_session.json`
- Create: `apps/daemon-rs/tests/claude_profile.rs`
- Modify: `apps/daemon-rs/src/lib.rs`

- [ ] **Step 1: Create the test fixture**

Create `apps/daemon-rs/fixtures/native/claude_session.json`:

```json
{
    "pid": 12345,
    "sessionId": "abc12345-def6-7890-abcd-ef1234567890",
    "cwd": "/Users/testuser/my-project",
    "startedAt": 1775143799221,
    "kind": "interactive",
    "entrypoint": "claude-vscode"
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/daemon-rs/tests/claude_profile.rs`:

```rust
use std::path::Path;
use tempfile::tempdir;

#[test]
fn parses_claude_session_file_into_detected_session() {
    let temp = tempdir().expect("tempdir");
    let sessions_dir = temp.path().join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("create sessions dir");
    std::fs::copy(
        "fixtures/native/claude_session.json",
        sessions_dir.join("12345.json"),
    )
    .expect("copy fixture");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();

    assert_eq!(sessions.len(), 1);
    let session = &sessions[0];
    assert_eq!(session.session_id, "abc12345-def6-7890-abcd-ef1234567890");
    assert_eq!(session.pid, Some(12345));
    assert_eq!(session.cwd, "/Users/testuser/my-project");
    assert_eq!(session.started_at_ms, 1775143799221);
    assert_eq!(session.entrypoint, "claude-vscode");
}

#[test]
fn returns_empty_when_sessions_dir_missing() {
    let temp = tempdir().expect("tempdir");
    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();
    assert!(sessions.is_empty());
}

#[test]
fn skips_malformed_session_files() {
    let temp = tempdir().expect("tempdir");
    let sessions_dir = temp.path().join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("create sessions dir");
    std::fs::write(sessions_dir.join("99999.json"), "not valid json").expect("write bad file");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();
    assert!(sessions.is_empty());
}

#[test]
fn computes_project_slug_from_cwd() {
    assert_eq!(
        pharos_daemon::profiles::claude::cwd_to_project_slug("/Users/testuser/my-project"),
        "-Users-testuser-my-project"
    );
}

#[test]
fn resolves_transcript_path() {
    let temp = tempdir().expect("tempdir");
    let slug = "-Users-testuser-my-project";
    let session_id = "abc12345-def6-7890-abcd-ef1234567890";

    let projects_dir = temp.path().join("projects").join(slug);
    std::fs::create_dir_all(&projects_dir).expect("create projects dir");
    let jsonl_path = projects_dir.join(format!("{session_id}.jsonl"));
    std::fs::write(&jsonl_path, "").expect("create empty jsonl");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let resolved = profile.resolve_transcript_path("/Users/testuser/my-project", session_id);
    assert!(resolved.is_some());
    assert_eq!(resolved.unwrap(), jsonl_path);
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test --test claude_profile`
Expected: FAIL — module `profiles` not found.

- [ ] **Step 4: Implement the profiles module**

Create `apps/daemon-rs/src/profiles/mod.rs`:

```rust
pub mod claude;

use std::path::PathBuf;

use crate::model::RuntimeSource;

/// A live session detected by the scanner.
#[derive(Debug, Clone)]
pub struct DetectedSession {
    pub runtime_source: RuntimeSource,
    pub session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub started_at_ms: i64,
    pub entrypoint: String,
    pub transcript_path: Option<PathBuf>,
    pub subagents_dir: Option<PathBuf>,
}
```

Create `apps/daemon-rs/src/profiles/claude.rs`:

```rust
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::model::RuntimeSource;
use super::DetectedSession;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeSessionFile {
    pid: u32,
    session_id: String,
    cwd: String,
    started_at: i64,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    entrypoint: String,
}

pub struct ClaudeProfile {
    claude_home: PathBuf,
}

impl ClaudeProfile {
    pub fn new(claude_home: PathBuf) -> Self {
        Self { claude_home }
    }

    pub fn discover_sessions(&self) -> Vec<DetectedSession> {
        let sessions_dir = self.claude_home.join("sessions");
        let entries = match std::fs::read_dir(&sessions_dir) {
            Ok(entries) => entries,
            Err(_) => return Vec::new(),
        };

        let mut sessions = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let parsed: ClaudeSessionFile = match serde_json::from_str(&content) {
                Ok(p) => p,
                Err(_) => continue,
            };

            let transcript_path =
                self.resolve_transcript_path(&parsed.cwd, &parsed.session_id);
            let subagents_dir = transcript_path.as_ref().map(|tp| {
                tp.parent().unwrap().join(&parsed.session_id).join("subagents")
            });

            sessions.push(DetectedSession {
                runtime_source: RuntimeSource::ClaudeCode,
                session_id: parsed.session_id,
                pid: Some(parsed.pid),
                cwd: parsed.cwd,
                started_at_ms: parsed.started_at,
                entrypoint: if parsed.entrypoint.is_empty() {
                    parsed.kind
                } else {
                    parsed.entrypoint
                },
                transcript_path,
                subagents_dir,
            });
        }
        sessions
    }

    pub fn resolve_transcript_path(&self, cwd: &str, session_id: &str) -> Option<PathBuf> {
        let slug = cwd_to_project_slug(cwd);
        let jsonl = self
            .claude_home
            .join("projects")
            .join(&slug)
            .join(format!("{session_id}.jsonl"));
        if jsonl.exists() {
            Some(jsonl)
        } else {
            None
        }
    }
}

pub fn cwd_to_project_slug(cwd: &str) -> String {
    cwd.replace('/', "-")
}
```

- [ ] **Step 5: Register the profiles module in lib.rs**

In `apps/daemon-rs/src/lib.rs`, add:

```rust
pub mod profiles;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/daemon-rs && cargo test --test claude_profile`
Expected: All 5 tests PASS.

- [ ] **Step 7: Run all tests**

Run: `cd apps/daemon-rs && cargo test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/src/profiles/ apps/daemon-rs/src/lib.rs apps/daemon-rs/fixtures/native/ apps/daemon-rs/tests/claude_profile.rs
git commit -m "feat: add Claude session file parser with profile module"
```

---

### Task 3: Add JSONL Transcript Parser

**Files:**
- Create: `apps/daemon-rs/src/tailer.rs`
- Create: `apps/daemon-rs/fixtures/native/transcript.jsonl`
- Create: `apps/daemon-rs/tests/tailer.rs`
- Modify: `apps/daemon-rs/src/lib.rs`

- [ ] **Step 1: Create the test fixture**

Create `apps/daemon-rs/fixtures/native/transcript.jsonl` — one JSON object per line. Each line below is a single line in the file (shown multiline here for readability):

```jsonl
{"type":"user","message":{"role":"user","content":"hello world"},"timestamp":"2026-04-02T15:00:00.000Z","uuid":"u1"}
{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"text","text":"Hi there!"}]},"uuid":"u2"}
{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"toolu_01abc","name":"Bash","input":{"command":"ls"}}]},"uuid":"u3"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01abc","content":"file1.txt\nfile2.txt","is_error":false}]},"uuid":"u4"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_02def","content":"error: not found","is_error":true}]},"uuid":"u5"}
{"type":"ai-title","sessionId":"sess-test","aiTitle":"Test session title"}
{"type":"queue-operation","operation":"enqueue","timestamp":"2026-04-02T15:00:00.000Z","sessionId":"sess-test"}
```

- [ ] **Step 2: Write the failing test**

Create `apps/daemon-rs/tests/tailer.rs`:

```rust
use pharos_daemon::tailer::{parse_jsonl_line, TranscriptEvent};

#[test]
fn parses_user_prompt_from_string_content() {
    let line = r#"{"type":"user","message":{"role":"user","content":"hello world"},"uuid":"u1"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::UserPrompt { .. }));
    if let TranscriptEvent::UserPrompt { text } = event {
        assert_eq!(text, "hello world");
    }
}

#[test]
fn parses_tool_use_from_assistant_content() {
    let line = r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"toolu_01abc","name":"Bash","input":{"command":"ls"}}]},"uuid":"u3"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::ToolUse { .. }));
    if let TranscriptEvent::ToolUse { tool_name, tool_use_id, input, model } = event {
        assert_eq!(tool_name, "Bash");
        assert_eq!(tool_use_id, "toolu_01abc");
        assert_eq!(model, Some("claude-opus-4-5".to_string()));
        assert_eq!(input["command"], "ls");
    }
}

#[test]
fn parses_tool_result_success() {
    let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01abc","content":"file1.txt","is_error":false}]},"uuid":"u4"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::ToolResult { is_error: false, .. }));
    if let TranscriptEvent::ToolResult { tool_use_id, is_error, .. } = event {
        assert_eq!(tool_use_id, "toolu_01abc");
        assert!(!is_error);
    }
}

#[test]
fn parses_tool_result_failure() {
    let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_02def","content":"error: not found","is_error":true}]},"uuid":"u5"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::ToolResult { is_error: true, .. }));
}

#[test]
fn parses_ai_title() {
    let line = r#"{"type":"ai-title","sessionId":"sess-test","aiTitle":"Test session title"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::AiTitle { .. }));
    if let TranscriptEvent::AiTitle { title } = event {
        assert_eq!(title, "Test session title");
    }
}

#[test]
fn parses_assistant_text_response() {
    let line = r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"text","text":"Hi there!"}]},"uuid":"u2"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_some());
    let event = event.unwrap();
    assert!(matches!(event, TranscriptEvent::AssistantText { .. }));
}

#[test]
fn skips_queue_operations() {
    let line = r#"{"type":"queue-operation","operation":"enqueue"}"#;
    let event = parse_jsonl_line(line);
    assert!(event.is_none());
}

#[test]
fn skips_malformed_json() {
    let event = parse_jsonl_line("not json at all");
    assert!(event.is_none());
}

#[test]
fn parses_all_events_from_fixture_file() {
    let content = std::fs::read_to_string("fixtures/native/transcript.jsonl").expect("read fixture");
    let events: Vec<_> = content
        .lines()
        .filter_map(parse_jsonl_line)
        .collect();
    // 7 lines: user prompt, assistant text, tool_use, tool_result ok, tool_result err, ai-title, queue-op(skipped)
    assert_eq!(events.len(), 6);
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test --test tailer`
Expected: FAIL — module `tailer` not found.

- [ ] **Step 4: Implement the JSONL parser**

Create `apps/daemon-rs/src/tailer.rs`:

```rust
use serde_json::Value;

/// A parsed event from a Claude JSONL transcript line.
#[derive(Debug, Clone)]
pub enum TranscriptEvent {
    UserPrompt {
        text: String,
    },
    AssistantText {
        text: String,
        model: Option<String>,
    },
    ToolUse {
        tool_name: String,
        tool_use_id: String,
        input: Value,
        model: Option<String>,
    },
    ToolResult {
        tool_use_id: String,
        is_error: bool,
        content: String,
    },
    AiTitle {
        title: String,
    },
}

/// Parse a single JSONL line into a TranscriptEvent, or None if not relevant.
pub fn parse_jsonl_line(line: &str) -> Option<TranscriptEvent> {
    let obj: Value = serde_json::from_str(line).ok()?;
    let line_type = obj.get("type")?.as_str()?;

    match line_type {
        "ai-title" => {
            let title = obj.get("aiTitle")?.as_str()?.to_string();
            Some(TranscriptEvent::AiTitle { title })
        }
        "user" => parse_user_line(&obj),
        "assistant" => parse_assistant_line(&obj),
        _ => None,
    }
}

fn parse_user_line(obj: &Value) -> Option<TranscriptEvent> {
    let content = obj.get("message")?.get("content")?;

    // String content = user prompt
    if let Some(text) = content.as_str() {
        return Some(TranscriptEvent::UserPrompt {
            text: text.to_string(),
        });
    }

    // Array content = tool results
    let blocks = content.as_array()?;
    for block in blocks {
        if block.get("type")?.as_str()? == "tool_result" {
            let tool_use_id = block
                .get("tool_use_id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let is_error = block
                .get("is_error")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let content = block
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            return Some(TranscriptEvent::ToolResult {
                tool_use_id,
                is_error,
                content,
            });
        }
    }
    None
}

fn parse_assistant_line(obj: &Value) -> Option<TranscriptEvent> {
    let message = obj.get("message")?;
    let model = message
        .get("model")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let content = message.get("content")?;
    let blocks = content.as_array()?;

    for block in blocks {
        let block_type = block.get("type")?.as_str()?;
        match block_type {
            "tool_use" => {
                let tool_name = block.get("name")?.as_str()?.to_string();
                let tool_use_id = block.get("id")?.as_str()?.to_string();
                let input = block.get("input").cloned().unwrap_or(Value::Null);
                return Some(TranscriptEvent::ToolUse {
                    tool_name,
                    tool_use_id,
                    input,
                    model,
                });
            }
            "text" => {
                let text = block.get("text")?.as_str()?.to_string();
                return Some(TranscriptEvent::AssistantText { text, model });
            }
            _ => continue,
        }
    }
    None
}
```

- [ ] **Step 5: Register tailer module in lib.rs**

In `apps/daemon-rs/src/lib.rs`, add:

```rust
pub mod tailer;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/daemon-rs && cargo test --test tailer`
Expected: All 9 tests PASS.

- [ ] **Step 7: Run all tests**

Run: `cd apps/daemon-rs && cargo test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/src/tailer.rs apps/daemon-rs/src/lib.rs apps/daemon-rs/fixtures/native/transcript.jsonl apps/daemon-rs/tests/tailer.rs
git commit -m "feat: add JSONL transcript parser for Claude native files"
```

---

### Task 4: Add TranscriptEvent to EventEnvelope Converter

**Files:**
- Create: `apps/daemon-rs/src/envelope.rs`
- Create: `apps/daemon-rs/tests/envelope.rs`
- Modify: `apps/daemon-rs/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Create `apps/daemon-rs/tests/envelope.rs`:

```rust
use pharos_daemon::envelope::transcript_event_to_envelope;
use pharos_daemon::model::{AcquisitionMode, EventKind, RuntimeSource};
use pharos_daemon::tailer::TranscriptEvent;
use serde_json::json;

#[test]
fn converts_user_prompt_to_envelope() {
    let event = TranscriptEvent::UserPrompt {
        text: "hello world".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::UserPromptSubmitted);
    assert_eq!(envelope.acquisition_mode, AcquisitionMode::Observed);
    assert_eq!(envelope.session.workspace_id, "my-project");
    assert_eq!(envelope.session.session_id, "sess-1234");
    assert_eq!(envelope.title, "user prompt");
    assert_eq!(envelope.payload["prompt"], "hello world");
}

#[test]
fn converts_tool_use_to_envelope() {
    let event = TranscriptEvent::ToolUse {
        tool_name: "Bash".to_string(),
        tool_use_id: "toolu_01abc".to_string(),
        input: json!({"command": "ls"}),
        model: Some("claude-opus-4-5".to_string()),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallStarted);
    assert_eq!(envelope.title, "tool call started: Bash");
    assert_eq!(envelope.payload["tool_name"], "Bash");
    assert_eq!(envelope.payload["tool_use_id"], "toolu_01abc");
    assert_eq!(envelope.payload["model"], "claude-opus-4-5");
}

#[test]
fn converts_tool_result_success_to_envelope() {
    let event = TranscriptEvent::ToolResult {
        tool_use_id: "toolu_01abc".to_string(),
        is_error: false,
        content: "output".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallCompleted);
    assert_eq!(envelope.title, "tool call completed");
}

#[test]
fn converts_tool_result_failure_to_envelope() {
    let event = TranscriptEvent::ToolResult {
        tool_use_id: "toolu_01abc".to_string(),
        is_error: true,
        content: "error".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallFailed);
    assert_eq!(envelope.title, "tool call failed");
}

#[test]
fn converts_ai_title_to_envelope() {
    let event = TranscriptEvent::AiTitle {
        title: "Test session".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::SessionTitleChanged);
    assert_eq!(envelope.title, "session title: Test session");
}

#[test]
fn includes_agent_id_when_provided() {
    let event = TranscriptEvent::UserPrompt {
        text: "do something".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        Some("agent-abc"),
        1711234567000,
    );

    assert_eq!(envelope.agent_id, Some("agent-abc".to_string()));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/daemon-rs && cargo test --test envelope`
Expected: FAIL — module `envelope` not found.

- [ ] **Step 3: Implement the converter**

Create `apps/daemon-rs/src/envelope.rs`:

```rust
use serde_json::json;

use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::tailer::TranscriptEvent;

pub fn transcript_event_to_envelope(
    event: &TranscriptEvent,
    runtime_source: RuntimeSource,
    workspace_id: &str,
    session_id: &str,
    agent_id: Option<&str>,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let (event_kind, title, payload) = match event {
        TranscriptEvent::UserPrompt { text } => (
            EventKind::UserPromptSubmitted,
            "user prompt".to_string(),
            json!({ "prompt": text }),
        ),
        TranscriptEvent::AssistantText { text, model } => (
            EventKind::AssistantResponse,
            "assistant response".to_string(),
            json!({ "text": truncate(text, 200), "model": model }),
        ),
        TranscriptEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
            model,
        } => (
            EventKind::ToolCallStarted,
            format!("tool call started: {tool_name}"),
            json!({
                "tool_name": tool_name,
                "tool_use_id": tool_use_id,
                "tool_input": input,
                "model": model,
            }),
        ),
        TranscriptEvent::ToolResult {
            tool_use_id,
            is_error,
            content,
        } => {
            let kind = if *is_error {
                EventKind::ToolCallFailed
            } else {
                EventKind::ToolCallCompleted
            };
            let title = if *is_error {
                "tool call failed".to_string()
            } else {
                "tool call completed".to_string()
            };
            (
                kind,
                title,
                json!({
                    "tool_use_id": tool_use_id,
                    "is_error": is_error,
                    "content": truncate(content, 500),
                }),
            )
        }
        TranscriptEvent::AiTitle { title } => (
            EventKind::SessionTitleChanged,
            format!("session title: {title}"),
            json!({ "title": title }),
        ),
    };

    EventEnvelope {
        runtime_source,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
        },
        agent_id: agent_id.map(ToString::to_string),
        occurred_at_ms,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title,
        payload,
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max])
    }
}
```

- [ ] **Step 4: Register module in lib.rs**

Add to `apps/daemon-rs/src/lib.rs`:

```rust
pub mod envelope;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/daemon-rs && cargo test --test envelope`
Expected: All 6 tests PASS.

- [ ] **Step 6: Run all tests**

Run: `cd apps/daemon-rs && cargo test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/src/envelope.rs apps/daemon-rs/src/lib.rs apps/daemon-rs/tests/envelope.rs
git commit -m "feat: add TranscriptEvent to EventEnvelope converter"
```

---

### Task 5: Add Scanner Loop

**Files:**
- Create: `apps/daemon-rs/src/scanner.rs`
- Modify: `apps/daemon-rs/src/lib.rs`
- Modify: `apps/daemon-rs/src/api.rs` (expose Store + broadcast sender for scanner)
- Modify: `apps/daemon-rs/src/main.rs` (spawn scanner on startup)
- Modify: `apps/daemon-rs/src/config.rs` (add claude_home config)

- [ ] **Step 1: Add claude_home to Config**

In `apps/daemon-rs/src/config.rs`, add a new env var and field:

After the existing constants, add:

```rust
const CLAUDE_HOME_ENV: &str = "PHAROS_CLAUDE_HOME";
```

Add to the `Config` struct:

```rust
pub claude_home: Option<PathBuf>,
```

In `from_env_map`, add before the `Ok(Self { ... })`:

```rust
let claude_home = env_map
    .get(CLAUDE_HOME_ENV)
    .map(PathBuf::from)
    .or_else(default_claude_home);
```

Add the field to the Ok return: `claude_home,`

In `from_env`, add:

```rust
if let Ok(claude_home) = env::var(CLAUDE_HOME_ENV) {
    env_map.insert(CLAUDE_HOME_ENV.to_string(), claude_home);
}
```

Add a new default function:

```rust
fn default_claude_home() -> Option<PathBuf> {
    env::var("HOME").ok().map(|home| PathBuf::from(home).join(".claude"))
}
```

- [ ] **Step 2: Implement the scanner**

Create `apps/daemon-rs/src/scanner.rs`:

```rust
use std::collections::HashMap;
use std::io::{BufRead, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tokio::sync::broadcast;
use tokio::time::interval;

use crate::envelope::transcript_event_to_envelope;
use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::claude::ClaudeProfile;
use crate::profiles::DetectedSession;
use crate::store::Store;
use crate::tailer::parse_jsonl_line;

struct TrackedSession {
    session: DetectedSession,
    file_offset: u64,
    known_subagents: Vec<String>,
}

pub async fn run_scanner(
    store: Store,
    sender: broadcast::Sender<crate::api::OutboundWsMessage>,
    claude_home: PathBuf,
) {
    let profile = ClaudeProfile::new(claude_home);
    let mut tracked: HashMap<String, TrackedSession> = HashMap::new();
    let mut tick = interval(Duration::from_secs(2));

    loop {
        tick.tick().await;

        let current_sessions = profile.discover_sessions();
        let current_ids: Vec<String> = current_sessions
            .iter()
            .map(|s| s.session_id.clone())
            .collect();

        // Detect ended sessions
        let ended: Vec<String> = tracked
            .keys()
            .filter(|id| !current_ids.contains(id))
            .cloned()
            .collect();

        for id in ended {
            if let Some(ts) = tracked.remove(&id) {
                let now_ms = now_millis();
                let envelope = session_lifecycle_envelope(
                    &ts.session,
                    EventKind::SessionEnded,
                    "session ended",
                    now_ms,
                );
                let _ = store.insert_event(&envelope);
                broadcast_event(&store, &sender, &envelope);
            }
        }

        // Detect new sessions and tail existing ones
        for session in current_sessions {
            let session_id = session.session_id.clone();

            if !tracked.contains_key(&session_id) {
                // New session detected
                let envelope = session_lifecycle_envelope(
                    &session,
                    EventKind::SessionStarted,
                    "session started",
                    session.started_at_ms,
                );
                let _ = store.insert_event(&envelope);
                broadcast_event(&store, &sender, &envelope);

                tracked.insert(
                    session_id.clone(),
                    TrackedSession {
                        session,
                        file_offset: 0,
                        known_subagents: Vec::new(),
                    },
                );
            }

            // Tail transcript
            if let Some(ts) = tracked.get_mut(&session_id) {
                tail_transcript(ts, &store, &sender);
                scan_subagents(ts, &store, &sender);
            }
        }
    }
}

fn tail_transcript(
    ts: &mut TrackedSession,
    store: &Store,
    sender: &broadcast::Sender<crate::api::OutboundWsMessage>,
) {
    let transcript_path = match &ts.session.transcript_path {
        Some(p) if p.exists() => p.clone(),
        _ => return,
    };

    let file = match std::fs::File::open(&transcript_path) {
        Ok(f) => f,
        Err(_) => return,
    };

    let mut reader = std::io::BufReader::new(file);
    if reader.seek(SeekFrom::Start(ts.file_offset)).is_err() {
        return;
    }

    let now_ms = now_millis();
    let workspace = workspace_from_cwd(&ts.session.cwd);

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Some(event) = parse_jsonl_line(trimmed) {
                    let envelope = transcript_event_to_envelope(
                        &event,
                        RuntimeSource::ClaudeCode,
                        &workspace,
                        &ts.session.session_id,
                        None,
                        now_ms,
                    );
                    let _ = store.insert_event(&envelope);
                    broadcast_event(store, sender, &envelope);
                }
            }
            Err(_) => break,
        }
    }

    ts.file_offset = reader.stream_position().unwrap_or(ts.file_offset);
}

fn scan_subagents(
    ts: &mut TrackedSession,
    store: &Store,
    sender: &broadcast::Sender<crate::api::OutboundWsMessage>,
) {
    let subagents_dir = match &ts.session.subagents_dir {
        Some(d) if d.exists() => d.clone(),
        _ => return,
    };

    let entries = match std::fs::read_dir(&subagents_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let now_ms = now_millis();
    let workspace = workspace_from_cwd(&ts.session.cwd);

    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if !name.ends_with(".meta.json") {
            continue;
        }

        let agent_id = name.trim_end_matches(".meta.json").to_string();
        if ts.known_subagents.contains(&agent_id) {
            continue;
        }

        // Parse meta file
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let meta: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let agent_type = meta
            .get("agentType")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let description = meta
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let envelope = EventEnvelope {
            runtime_source: RuntimeSource::ClaudeCode,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SubagentStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: workspace.clone(),
                session_id: ts.session.session_id.clone(),
            },
            agent_id: Some(agent_id.clone()),
            occurred_at_ms: now_ms,
            capabilities: CapabilitySet {
                can_observe: true,
                can_start: false,
                can_stop: false,
                can_retry: false,
                can_respond: false,
            },
            title: format!("subagent started: {agent_type}"),
            payload: json!({
                "agent_type": agent_type,
                "description": description,
                "agent_id": agent_id,
            }),
        };

        let _ = store.insert_event(&envelope);
        broadcast_event(store, sender, &envelope);
        ts.known_subagents.push(agent_id);
    }
}

fn session_lifecycle_envelope(
    session: &DetectedSession,
    event_kind: EventKind,
    title: &str,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let workspace = workspace_from_cwd(&session.cwd);
    EventEnvelope {
        runtime_source: session.runtime_source.clone(),
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace,
            session_id: session.session_id.clone(),
        },
        agent_id: None,
        occurred_at_ms,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: title.to_string(),
        payload: json!({
            "pid": session.pid,
            "cwd": session.cwd,
            "entrypoint": session.entrypoint,
        }),
    }
}

fn workspace_from_cwd(cwd: &str) -> String {
    cwd.split('/').last().unwrap_or("unknown").to_string()
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn broadcast_event(
    store: &Store,
    sender: &broadcast::Sender<crate::api::OutboundWsMessage>,
    event: &EventEnvelope,
) {
    if let Ok(compat) = crate::store::legacy_event_from_envelope(event) {
        if let (Ok(ep), Ok(rp)) = (
            serde_json::to_value(&compat),
            store
                .list_agent_registry()
                .and_then(|r| Ok(serde_json::to_value(r)?)),
        ) {
            let _ = sender.send(crate::api::OutboundWsMessage {
                message_type: "event",
                payload: ep,
            });
            let _ = sender.send(crate::api::OutboundWsMessage {
                message_type: "agent_registry",
                payload: rp,
            });
        }
    }
}
```

- [ ] **Step 3: Expose OutboundWsMessage from api.rs**

In `apps/daemon-rs/src/api.rs`, rename `OutboundMessage` to `OutboundWsMessage` and make it public:

```rust
#[derive(Clone)]
pub struct OutboundWsMessage {
    pub message_type: &'static str,
    pub payload: serde_json::Value,
}
```

Update all references in `api.rs` from `OutboundMessage` to `OutboundWsMessage`.

Also make `sender` accessible — add a public method to `AppState` or expose it. The simplest approach: make `AppState` fields public and expose a builder:

```rust
#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub sender: broadcast::Sender<OutboundWsMessage>,
    pub claude_sessions_dir: Option<PathBuf>,
}
```

- [ ] **Step 4: Update main.rs to spawn scanner**

Replace `apps/daemon-rs/src/main.rs`:

```rust
use clap::Parser;
use pharos_daemon::api::{build_router_with_options, AppOptions};
use pharos_daemon::config::Config;
use pharos_daemon::replay::{replay_file, Cli, Command};
use pharos_daemon::scanner;
use pharos_daemon::store::Store;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    match Cli::parse().command {
        Command::Replay { connector, input } => {
            replay_file(input, &connector)?;
        }
        Command::Serve => {
            let config = Config::from_env()?;
            let store = Store::open(&config.db_path)?;
            let (app, state) = build_router_with_options(
                store,
                AppOptions {
                    claude_sessions_dir: config.claude_sessions_dir,
                },
            );

            // Spawn scanner if claude_home is available
            if let Some(claude_home) = config.claude_home {
                let scanner_store = state.store.clone();
                let scanner_sender = state.sender.clone();
                tokio::spawn(async move {
                    scanner::run_scanner(scanner_store, scanner_sender, claude_home).await;
                });
            }

            let address = format!("{}:{}", config.host, config.port);
            let listener = tokio::net::TcpListener::bind(&address).await?;

            println!("pharos-daemon listening on {address}");
            axum::serve(listener, app).await?;
        }
    }

    Ok(())
}
```

- [ ] **Step 5: Update build_router_with_options to return state**

In `apps/daemon-rs/src/api.rs`, change the return type to also return the `AppState`:

```rust
pub fn build_router_with_options(store: Store, options: AppOptions) -> (Router, AppState) {
    let (sender, _) = broadcast::channel(32);
    let state = AppState {
        store,
        sender,
        claude_sessions_dir: options.claude_sessions_dir,
    };

    let router = Router::new()
        .route("/health", get(health))
        .route("/events", post(create_legacy_hook_event))
        .route("/api/discovery/claude/sessions", get(list_discovered_claude_sessions))
        .route("/api/connectors/{connector}/events", post(create_connector_event))
        .route("/api/events", post(create_event).get(list_events))
        .route("/api/agents", get(list_agent_registry))
        .route("/api/events/legacy/claude", post(create_legacy_claude_event))
        .route("/events/filter-options", get(get_filter_options))
        .route("/sessions", get(list_sessions))
        .route("/sessions/{id}", get(get_session_events))
        .route("/stream", get(stream_events))
        .with_state(state.clone());

    (router, state)
}
```

Update `build_router` to match:

```rust
pub fn build_router(store: Store) -> Router {
    let (router, _) = build_router_with_options(store, AppOptions::default());
    router
}
```

- [ ] **Step 6: Register scanner module in lib.rs**

Add to `apps/daemon-rs/src/lib.rs`:

```rust
pub mod scanner;
```

- [ ] **Step 7: Run all tests and fix any compilation issues**

Run: `cd apps/daemon-rs && cargo test`
Expected: All tests pass. If compilation errors occur from the `OutboundMessage` rename or `build_router` return type change, fix them.

- [ ] **Step 8: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/src/scanner.rs apps/daemon-rs/src/api.rs apps/daemon-rs/src/main.rs apps/daemon-rs/src/config.rs apps/daemon-rs/src/lib.rs
git commit -m "feat: add scanner loop with transcript tailing and subagent discovery"
```

---

### Task 6: Integration Test — End-to-End Scan Cycle

**Files:**
- Create: `apps/daemon-rs/tests/scanner_integration.rs`

- [ ] **Step 1: Write the integration test**

Create `apps/daemon-rs/tests/scanner_integration.rs`:

```rust
use std::path::PathBuf;
use pharos_daemon::profiles::claude::ClaudeProfile;
use pharos_daemon::tailer::parse_jsonl_line;
use pharos_daemon::envelope::transcript_event_to_envelope;
use pharos_daemon::model::{EventKind, RuntimeSource};
use pharos_daemon::store::Store;
use tempfile::tempdir;

/// Simulates the full scanner cycle: discover session → tail transcript → produce events.
#[test]
fn full_scan_cycle_discovers_session_and_tails_transcript() {
    let temp = tempdir().expect("tempdir");
    let claude_home = temp.path();

    // 1. Create session file
    let sessions_dir = claude_home.join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("mkdir sessions");
    std::fs::write(
        sessions_dir.join("55555.json"),
        r#"{"pid":55555,"sessionId":"test-sess-001","cwd":"/Users/testuser/my-project","startedAt":1775143799221,"kind":"interactive","entrypoint":"claude-vscode"}"#,
    ).expect("write session");

    // 2. Create transcript JSONL
    let project_dir = claude_home
        .join("projects")
        .join("-Users-testuser-my-project");
    std::fs::create_dir_all(&project_dir).expect("mkdir projects");
    std::fs::write(
        project_dir.join("test-sess-001.jsonl"),
        r#"{"type":"user","message":{"role":"user","content":"hello from test"},"uuid":"u1"}
{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"toolu_01","name":"Read","input":{"file":"foo.rs"}}]},"uuid":"u2"}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"fn main() {}","is_error":false}]},"uuid":"u3"}
{"type":"ai-title","sessionId":"test-sess-001","aiTitle":"Test project work"}
"#,
    ).expect("write transcript");

    // 3. Create subagent
    let subagent_dir = project_dir.join("test-sess-001").join("subagents");
    std::fs::create_dir_all(&subagent_dir).expect("mkdir subagents");
    std::fs::write(
        subagent_dir.join("agent-abc123.meta.json"),
        r#"{"agentType":"Explore","description":"Explore codebase"}"#,
    ).expect("write subagent meta");

    // 4. Discover sessions
    let profile = ClaudeProfile::new(claude_home.to_path_buf());
    let sessions = profile.discover_sessions();
    assert_eq!(sessions.len(), 1);
    let session = &sessions[0];
    assert_eq!(session.session_id, "test-sess-001");
    assert!(session.transcript_path.is_some());

    // 5. Parse transcript
    let transcript = std::fs::read_to_string(session.transcript_path.as_ref().unwrap())
        .expect("read transcript");
    let events: Vec<_> = transcript
        .lines()
        .filter_map(parse_jsonl_line)
        .collect();
    assert_eq!(events.len(), 4); // prompt, tool_use, tool_result, ai-title

    // 6. Convert to envelopes and insert into store
    let store = Store::open_in_memory().expect("store");
    for event in &events {
        let envelope = transcript_event_to_envelope(
            event,
            RuntimeSource::ClaudeCode,
            "my-project",
            "test-sess-001",
            None,
            1775143799221,
        );
        store.insert_event(&envelope).expect("insert");
    }

    // 7. Verify store has all events
    let stored = store.list_events().expect("list events");
    assert_eq!(stored.len(), 4);
    assert_eq!(stored[0].event_kind, EventKind::UserPromptSubmitted);
    assert_eq!(stored[1].event_kind, EventKind::ToolCallStarted);
    assert_eq!(stored[2].event_kind, EventKind::ToolCallCompleted);
    assert_eq!(stored[3].event_kind, EventKind::SessionTitleChanged);

    // 8. Verify sessions API
    let sessions = store.list_sessions().expect("list sessions");
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].session_id, "test-sess-001");
    assert_eq!(sessions[0].event_count, 4);

    // 9. Verify subagent meta exists
    assert!(subagent_dir.join("agent-abc123.meta.json").exists());
}
```

- [ ] **Step 2: Run the integration test**

Run: `cd apps/daemon-rs && cargo test --test scanner_integration`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `cd apps/daemon-rs && cargo test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/akushniruk/home_projects/pharos
git add apps/daemon-rs/tests/scanner_integration.rs
git commit -m "test: add end-to-end scanner integration test"
```

---

### Task 7: Manual Verification and Cleanup

**Files:**
- Modify: `apps/daemon-rs/src/config.rs` (verify defaults)
- Modify: `Makefile` (add scanner-aware target if needed)

- [ ] **Step 1: Verify the daemon starts with scanner**

Run: `cd apps/daemon-rs && cargo run -- serve`
Expected: Prints `pharos-daemon listening on 127.0.0.1:4000` and scanner runs silently in background. If Claude is running, sessions should be detected.

- [ ] **Step 2: Check sessions endpoint**

Run: `curl -s http://localhost:4000/sessions | python3 -m json.tool`
Expected: If Claude sessions are running, they appear here with session_id, source_app (derived from cwd), event_count.

- [ ] **Step 3: Check events endpoint**

Run: `curl -s http://localhost:4000/api/events | python3 -m json.tool | head -50`
Expected: Events from the JSONL transcript appear — UserPromptSubmitted, ToolCallStarted, etc.

- [ ] **Step 4: Check agents endpoint**

Run: `curl -s http://localhost:4000/api/agents | python3 -m json.tool`
Expected: Agents appear including any subagents detected from .meta.json files.

- [ ] **Step 5: Open UI and verify live updates**

Run: `make client` (in separate terminal)
Open: `http://localhost:5173`
Expected: Sessions appear in the session list. Events stream in real-time as Claude works. Subagents show in the metro sidebar.

- [ ] **Step 6: Test with fresh folder (no hooks)**

Start Claude in a brand new folder that has no `.claude/hooks/` setup.
Expected: Pharos detects the session within 2-3 seconds and begins streaming events.

- [ ] **Step 7: Commit any fixes**

```bash
cd /Users/akushniruk/home_projects/pharos
git add -A
git commit -m "fix: scanner manual verification fixes"
```

---

### Task 8: Final Validation

- [ ] **Step 1: Run full test suite**

Run: `cd apps/daemon-rs && cargo test`
Expected: ALL tests pass.

- [ ] **Step 2: Run clippy**

Run: `cd apps/daemon-rs && cargo clippy -- -D warnings`
Expected: No warnings.

- [ ] **Step 3: Verify no regressions in hook-based flow**

Run: `curl -s -X POST http://localhost:4000/events -H 'Content-Type: application/json' -d '{"source_app":"test","session_id":"s1","hook_event_type":"SessionStart","payload":{},"timestamp":1711234567000}'`
Expected: 200 OK — hook-based ingestion still works alongside the scanner.

- [ ] **Step 4: Final commit if needed**

```bash
cd /Users/akushniruk/home_projects/pharos
git add -A
git commit -m "chore: final validation pass for process-based observation"
```
