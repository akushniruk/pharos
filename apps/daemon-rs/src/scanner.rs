use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tokio::sync::broadcast;
use tokio::time::interval;

use crate::api::OutboundWsMessage;
use crate::envelope::{codex_event_to_envelope, cursor_event_to_envelope, transcript_event_to_envelope};
use crate::live_state::{LiveState, should_broadcast_registry};
use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::{
    DiscoveryOptions, claude::ClaudeProfile, codex::CodexProfile, cursor::CursorProfile,
    discover_all_sessions, gemini::GeminiProfile,
};
use crate::store::Store;
use crate::tailer::parse_jsonl_line;

struct TrackedSubagent {
    agent_id: String,
    jsonl_path: PathBuf,
    file_offset: u64,
    tool_name_map: HashMap<String, String>,
}

struct TrackedSession {
    session: crate::profiles::DetectedSession,
    missed_discovery_cycles: u8,
    file_offset: u64,
    codex_item_offset: usize,
    codex_log_offset: i64,
    codex_next_poll_at_ms: i64,
    recent_codex_signatures: Vec<String>,
    gemini_log_offset: usize,
    recent_gemini_signatures: Vec<String>,
    recent_cursor_signatures: Vec<String>,
    known_subagents: Vec<TrackedSubagent>,
    /// Maps tool_use_id → tool_name so ToolResult events can inherit the tool name.
    tool_name_map: HashMap<String, String>,
}

const SESSION_REMOVAL_GRACE_CYCLES: u8 = 3;

fn should_remove_after_missed_discovery(missed_cycles: u8) -> bool {
    missed_cycles >= SESSION_REMOVAL_GRACE_CYCLES
}

pub async fn run_scanner(
    store: Store,
    live_state: LiveState,
    sender: broadcast::Sender<OutboundWsMessage>,
    discovery_options: DiscoveryOptions,
) {
    let claude_home = discovery_options.claude_home.clone();
    let claude_profile = claude_home.clone().map(ClaudeProfile::new);
    let codex_profile = discovery_options.codex_home.clone().map(CodexProfile::new);
    let gemini_profile = discovery_options
        .gemini_home
        .clone()
        .map(GeminiProfile::new);
    let cursor_profile = discovery_options
        .cursor_home
        .clone()
        .map(CursorProfile::new);
    let mut tracked: HashMap<String, TrackedSession> = HashMap::new();
    let mut tick = interval(Duration::from_secs(1));
    let mut ticks_since_discovery = usize::MAX;

    loop {
        tick.tick().await;

        ticks_since_discovery = ticks_since_discovery.saturating_add(1);
        if ticks_since_discovery >= 5 {
            ticks_since_discovery = 0;

            let current_sessions = discover_all_sessions(&discovery_options);
            let current_ids: Vec<String> = current_sessions
                .iter()
                .map(|s| s.session_id.clone())
                .collect();
            let active_sessions = active_session_ids(&live_state);

            // Detect new sessions
            for session in current_sessions {
                if let Some(existing) = tracked.get_mut(&session.session_id) {
                    existing.missed_discovery_cycles = 0;
                    if session.display_title != existing.session.display_title {
                        if let Some(title) = session.display_title.clone() {
                            let envelope = EventEnvelope {
                                runtime_source: session.runtime_source.clone(),
                                acquisition_mode: AcquisitionMode::Observed,
                                event_kind: EventKind::SessionTitleChanged,
                                session: SessionRef {
                                    host_id: "local".to_string(),
                                    workspace_id: workspace_id_from_cwd(&session.cwd),
                                    session_id: session.session_id.clone(),
                                },
                                agent_id: None,
                                occurred_at_ms: now_millis(),
                                capabilities: observed_capabilities(),
                                title: "session title changed".to_string(),
                                payload: json!({ "title": title }),
                            };

                            if let Ok(true) = store.insert_event(&envelope) {
                                broadcast_envelope(&live_state, &sender, &envelope);
                            }
                        }
                    }
                    existing.session = session;
                    continue;
                }
                let session_id = session.session_id.clone();
                let workspace_id = workspace_id_from_cwd(&session.cwd);
                let now_ms = now_millis();

                let envelope = EventEnvelope {
                    runtime_source: session.runtime_source.clone(),
                    acquisition_mode: AcquisitionMode::Observed,
                    event_kind: EventKind::SessionStarted,
                    session: SessionRef {
                        host_id: "local".to_string(),
                        workspace_id: workspace_id.clone(),
                        session_id: session_id.clone(),
                    },
                    agent_id: None,
                    occurred_at_ms: now_ms,
                    capabilities: observed_capabilities(),
                    title: "session started".to_string(),
                    payload: json!({
                        "runtime_source": format!("{:?}", session.runtime_source),
                        "pid": session.pid,
                        "cwd": session.cwd,
                        "entrypoint": session.entrypoint,
                        "title": session.display_title,
                    }),
                };

                if !active_sessions.contains(&session_id)
                    && matches!(store.insert_event(&envelope), Ok(true))
                {
                    broadcast_envelope(&live_state, &sender, &envelope);
                }

                tracked.insert(
                    session_id.clone(),
                    TrackedSession {
                        session,
                        missed_discovery_cycles: 0,
                        file_offset: load_u64_offset(
                            &store,
                            &transcript_offset_key(&workspace_id, &session_id),
                        ),
                        codex_item_offset: load_usize_offset(
                            &store,
                            &codex_history_offset_key(&workspace_id, &session_id),
                        ),
                        codex_log_offset: load_i64_offset(
                            &store,
                            &codex_log_offset_key(&workspace_id, &session_id),
                        ),
                        codex_next_poll_at_ms: 0,
                        recent_codex_signatures: Vec::new(),
                        gemini_log_offset: load_usize_offset(
                            &store,
                            &gemini_log_offset_key(&workspace_id, &session_id),
                        ),
                        recent_gemini_signatures: Vec::new(),
                        recent_cursor_signatures: Vec::new(),
                        known_subagents: Vec::new(),
                        tool_name_map: HashMap::new(),
                    },
                );
            }

            // Detect removed sessions with a short grace window so
            // process-backed runtimes do not flap on transient discovery misses.
            for (session_id, tracked_session) in &mut tracked {
                if !current_ids.contains(session_id) {
                    tracked_session.missed_discovery_cycles =
                        tracked_session.missed_discovery_cycles.saturating_add(1);
                }
            }
            let removed_ids: Vec<String> = tracked
                .iter()
                .filter_map(|(id, session)| {
                    should_remove_after_missed_discovery(session.missed_discovery_cycles)
                        .then(|| id.clone())
                })
                .collect();

            for session_id in removed_ids {
                if let Some(ts) = tracked.remove(&session_id) {
                    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
                    let now_ms = now_millis();

                    let envelope = EventEnvelope {
                        runtime_source: ts.session.runtime_source.clone(),
                        acquisition_mode: AcquisitionMode::Observed,
                        event_kind: EventKind::SessionEnded,
                        session: SessionRef {
                            host_id: "local".to_string(),
                            workspace_id,
                            session_id,
                        },
                        agent_id: None,
                        occurred_at_ms: now_ms,
                        capabilities: observed_capabilities(),
                        title: "session ended".to_string(),
                        payload: json!({}),
                    };

                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(&live_state, &sender, &envelope);
                    }
                }
            }

            // Re-resolve paths for tracked sessions that are missing transcript/subagent paths.
            // This handles the case where the session file appears before the JSONL transcript.
            for (_, ts) in &mut tracked {
                if ts.session.transcript_path.is_none() {
                    let new_path = claude_profile.as_ref().and_then(|profile| {
                        profile.resolve_transcript_path(&ts.session.cwd, &ts.session.session_id)
                    });
                    if new_path.is_some() {
                        ts.session.subagents_dir = new_path.as_ref().and_then(|tp| {
                            tp.parent()
                                .map(|p| p.join(&ts.session.session_id).join("subagents"))
                        });
                        ts.session.transcript_path = new_path;
                    }
                }
            }
        }

        // Tail transcripts and scan subagents for existing sessions
        let session_ids: Vec<String> = tracked.keys().cloned().collect();
        for session_id in session_ids {
            if let Some(ts) = tracked.get_mut(&session_id) {
                match ts.session.runtime_source {
                    RuntimeSource::ClaudeCode => {
                        tail_transcript(ts, &store, &live_state, &sender);
                        scan_subagents(ts, &store, &live_state, &sender);
                    }
                    RuntimeSource::CodexCli => {
                        if let Some(profile) = codex_profile.as_ref() {
                            tail_codex_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    RuntimeSource::GeminiCli => {
                        if let Some(profile) = gemini_profile.as_ref() {
                            tail_gemini_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    RuntimeSource::CursorAgent => {
                        if let Some(profile) = cursor_profile.as_ref() {
                            tail_cursor_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::live_state::LiveState;
    use crate::model::RuntimeSource;
    use crate::profiles::{DetectedSession, codex::CodexSessionEvent, gemini::GeminiProfile};
    use crate::store::Store;
    use tempfile::tempdir;
    use tokio::sync::broadcast;

    use super::{
        TrackedSession, codex_signature, gemini_signature, remember_codex_signature,
        remember_gemini_signature, should_remove_after_missed_discovery, tail_gemini_activity,
    };

    #[test]
    fn discovery_grace_window_requires_three_misses() {
        assert!(!should_remove_after_missed_discovery(0));
        assert!(!should_remove_after_missed_discovery(1));
        assert!(!should_remove_after_missed_discovery(2));
        assert!(should_remove_after_missed_discovery(3));
        assert!(should_remove_after_missed_discovery(4));
    }

    #[test]
    fn codex_signatures_dedupe_identical_live_events() {
        let mut tracked = TrackedSession {
            session: DetectedSession {
                runtime_source: RuntimeSource::CodexCli,
                session_id: "proc-1".to_string(),
                native_session_id: Some("thread-1".to_string()),
                pid: Some(1),
                cwd: "/tmp/project".to_string(),
                started_at_ms: 0,
                entrypoint: "codex".to_string(),
                display_title: None,
                history_path: None,
                transcript_path: None,
                subagents_dir: None,
            },
            missed_discovery_cycles: 0,
            file_offset: 0,
            codex_item_offset: 0,
            codex_log_offset: 0,
            codex_next_poll_at_ms: 0,
            recent_codex_signatures: Vec::new(),
            gemini_log_offset: 0,
            recent_gemini_signatures: Vec::new(),
            recent_cursor_signatures: Vec::new(),
            known_subagents: Vec::new(),
            tool_name_map: HashMap::new(),
        };

        let event = CodexSessionEvent::ToolUse {
            tool_name: "exec_command".to_string(),
            tool_use_id: "turn-1".to_string(),
            input: serde_json::json!({"cmd":"pwd"}),
            model: None,
        };

        assert!(remember_codex_signature(&mut tracked, &event));
        assert!(!remember_codex_signature(&mut tracked, &event));
        assert_eq!(
            codex_signature(&event),
            "tool_use:turn-1:exec_command:{\"cmd\":\"pwd\"}"
        );
    }

    #[test]
    fn codex_signatures_dedupe_history_and_live_sources_together() {
        let mut tracked = TrackedSession {
            session: DetectedSession {
                runtime_source: RuntimeSource::CodexCli,
                session_id: "proc-1".to_string(),
                native_session_id: Some("thread-1".to_string()),
                pid: Some(1),
                cwd: "/tmp/project".to_string(),
                started_at_ms: 0,
                entrypoint: "codex".to_string(),
                display_title: None,
                history_path: None,
                transcript_path: None,
                subagents_dir: None,
            },
            missed_discovery_cycles: 0,
            file_offset: 0,
            codex_item_offset: 0,
            codex_log_offset: 0,
            codex_next_poll_at_ms: 0,
            recent_codex_signatures: Vec::new(),
            gemini_log_offset: 0,
            recent_gemini_signatures: Vec::new(),
            recent_cursor_signatures: Vec::new(),
            known_subagents: Vec::new(),
            tool_name_map: HashMap::new(),
        };

        let history_event = CodexSessionEvent::AssistantText {
            text: "Repository is a single-package Vite app.".to_string(),
            model: None,
        };
        let live_event = CodexSessionEvent::AssistantText {
            text: "Repository is a single-package Vite app.".to_string(),
            model: None,
        };

        assert!(remember_codex_signature(&mut tracked, &history_event));
        assert!(!remember_codex_signature(&mut tracked, &live_event));
    }

    #[test]
    fn gemini_scanner_tails_logs_json_once() {
        let temp = tempdir().expect("tempdir");
        let logs_dir = temp.path().join("tmp").join("pharos");
        std::fs::create_dir_all(&logs_dir).expect("logs dir");
        std::fs::write(
            logs_dir.join("logs.json"),
            r#"[
              {
                "sessionId": "gem-live",
                "type": "user",
                "message": { "role": "user", "content": "build the feature" },
                "timestamp": "2026-04-03T11:35:03.467Z"
              },
              {
                "sessionId": "gem-live",
                "type": "assistant",
                "message": {
                  "role": "assistant",
                  "content": [
                    { "type": "text", "text": "Working on it" },
                    {
                      "type": "tool_use",
                      "id": "tool-1",
                      "name": "shell",
                      "input": { "command": "cargo test" }
                    }
                  ]
                },
                "timestamp": "2026-04-03T11:35:04.467Z"
              },
              {
                "sessionId": "gem-live",
                "type": "user",
                "message": {
                  "role": "user",
                  "content": [
                    {
                      "type": "tool_result",
                      "tool_use_id": "tool-1",
                      "content": "ok",
                      "is_error": false
                    }
                  ]
                },
                "timestamp": "2026-04-03T11:35:05.467Z"
              },
              {
                "sessionId": "gem-live",
                "type": "queue-operation",
                "message": { "role": "system", "content": "ignore me" },
                "timestamp": "2026-04-03T11:35:06.467Z"
              }
            ]"#,
        )
        .expect("write logs");

        let mut tracked = TrackedSession {
            session: DetectedSession {
                runtime_source: RuntimeSource::GeminiCli,
                session_id: "gem-live".to_string(),
                native_session_id: Some("gem-live".to_string()),
                pid: Some(42),
                cwd: "/Users/tester/workspace/pharos".to_string(),
                started_at_ms: 0,
                entrypoint: "gemini".to_string(),
                display_title: None,
                history_path: Some(logs_dir.join("logs.json")),
                transcript_path: None,
                subagents_dir: None,
            },
            missed_discovery_cycles: 0,
            file_offset: 0,
            codex_item_offset: 0,
            codex_log_offset: 0,
            codex_next_poll_at_ms: 0,
            recent_codex_signatures: Vec::new(),
            gemini_log_offset: 0,
            recent_gemini_signatures: Vec::new(),
            recent_cursor_signatures: Vec::new(),
            known_subagents: Vec::new(),
            tool_name_map: HashMap::new(),
        };

        let profile = GeminiProfile::new(temp.path().to_path_buf());
        let store = Store::open_in_memory().expect("store");
        let live_state = LiveState::default();
        let (sender, _receiver) = broadcast::channel(8);

        tail_gemini_activity(&mut tracked, &profile, &store, &live_state, &sender);
        tail_gemini_activity(&mut tracked, &profile, &store, &live_state, &sender);

        let events = store.list_events().expect("events");
        assert_eq!(events.len(), 4);
        assert_eq!(
            events[0].event_kind,
            crate::model::EventKind::UserPromptSubmitted
        );
        assert_eq!(
            events[1].event_kind,
            crate::model::EventKind::AssistantResponse
        );
        assert_eq!(
            events[2].event_kind,
            crate::model::EventKind::ToolCallStarted
        );
        assert_eq!(
            events[3].event_kind,
            crate::model::EventKind::ToolCallCompleted
        );
        assert_eq!(tracked.gemini_log_offset, 3);
        assert_eq!(
            gemini_signature(&crate::profiles::gemini::GeminiSessionEvent::UserPrompt {
                text: "build the feature".to_string(),
            }),
            "prompt:build the feature"
        );
        assert!(!remember_gemini_signature(
            &mut tracked,
            &crate::profiles::gemini::GeminiSessionEvent::UserPrompt {
                text: "build the feature".to_string(),
            }
        ));
    }
}

fn tail_codex_activity(
    ts: &mut TrackedSession,
    profile: &CodexProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let now_ms = now_millis();
    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);

    if let Some(history_path) = &ts.session.history_path {
        let events = profile.read_session_events(history_path);
        if ts.codex_item_offset < events.len() {
            for event in &events[ts.codex_item_offset..] {
                if !remember_codex_signature(ts, event) {
                    continue;
                }
                let envelope =
                    codex_event_to_envelope(event, &workspace_id, &ts.session.session_id, now_ms);
                if let Ok(true) = store.insert_event(&envelope) {
                    broadcast_envelope(live_state, sender, &envelope);
                }
            }

            ts.codex_item_offset = events.len();
            let _ = store.save_scanner_offset(
                &codex_history_offset_key(&workspace_id, &ts.session.session_id),
                i64::try_from(ts.codex_item_offset).unwrap_or(i64::MAX),
            );
        }
    }

    if now_ms < ts.codex_next_poll_at_ms {
        return;
    }

    let Some(thread_id) = ts.session.native_session_id.as_deref() else {
        return;
    };

    let events = profile.read_live_events(thread_id, ts.codex_log_offset);
    for live_event in &events {
        if !remember_codex_signature(ts, &live_event.event) {
            continue;
        }
        let envelope = codex_event_to_envelope(
            &live_event.event,
            &workspace_id,
            &ts.session.session_id,
            live_event.occurred_at_ms,
        );
        if let Ok(true) = store.insert_event(&envelope) {
            broadcast_envelope(live_state, sender, &envelope);
        }
    }
    if let Some(last) = events.last() {
        ts.codex_log_offset = last.row_id;
        let _ = store.save_scanner_offset(
            &codex_log_offset_key(&workspace_id, &ts.session.session_id),
            ts.codex_log_offset,
        );
    }
    ts.codex_next_poll_at_ms = if events.is_empty() {
        now_ms.saturating_add(2_000)
    } else {
        now_ms.saturating_add(750)
    };
}

fn tail_gemini_activity(
    ts: &mut TrackedSession,
    profile: &GeminiProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let now_ms = now_millis();
    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);

    let Some(logs_path) = ts.session.history_path.as_ref() else {
        return;
    };

    let events = profile.read_live_events(logs_path, ts.gemini_log_offset);
    for live_event in &events {
        if !remember_gemini_signature(ts, &live_event.event) {
            continue;
        }

        let envelope = crate::envelope::gemini_event_to_envelope(
            &live_event.event,
            &workspace_id,
            &ts.session.session_id,
            if live_event.occurred_at_ms > 0 {
                live_event.occurred_at_ms
            } else {
                now_ms
            },
        );
        if let Ok(true) = store.insert_event(&envelope) {
            broadcast_envelope(live_state, sender, &envelope);
        }
    }

    if let Some(last) = events.last() {
        ts.gemini_log_offset = last.row_id;
        let _ = store.save_scanner_offset(
            &gemini_log_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(ts.gemini_log_offset).unwrap_or(i64::MAX),
        );
    }
}

fn tail_cursor_activity(
    ts: &mut TrackedSession,
    _profile: &CursorProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(transcript_path) = ts.session.transcript_path.as_ref() else {
        return;
    };
    let Ok(file) = std::fs::File::open(transcript_path) else {
        return;
    };

    let mut reader = BufReader::new(file);
    if reader.seek(SeekFrom::Start(ts.file_offset)).is_err() {
        return;
    }

    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    let now_ms = now_millis();
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                for event in crate::profiles::cursor::parse_cursor_jsonl_line(trimmed) {
                    if !remember_cursor_signature(ts, &event) {
                        continue;
                    }

                    let envelope = cursor_event_to_envelope(
                        &event,
                        &workspace_id,
                        &ts.session.session_id,
                        now_ms,
                    );
                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(live_state, sender, &envelope);
                    }
                }
            }
        }
    }

    if let Ok(pos) = reader.stream_position() {
        ts.file_offset = pos;
        let _ = store.save_scanner_offset(
            &transcript_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(pos).unwrap_or(i64::MAX),
        );
    }
}

const MAX_CODEX_SIGNATURES: usize = 256;

fn remember_codex_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::codex::CodexSessionEvent,
) -> bool {
    let signature = codex_signature(event);
    if session.recent_codex_signatures.contains(&signature) {
        return false;
    }
    session.recent_codex_signatures.push(signature);
    if session.recent_codex_signatures.len() > MAX_CODEX_SIGNATURES {
        session.recent_codex_signatures.remove(0);
    }
    true
}

const MAX_GEMINI_SIGNATURES: usize = 256;

fn remember_gemini_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::gemini::GeminiSessionEvent,
) -> bool {
    let signature = gemini_signature(event);
    if session.recent_gemini_signatures.contains(&signature) {
        return false;
    }
    session.recent_gemini_signatures.push(signature);
    if session.recent_gemini_signatures.len() > MAX_GEMINI_SIGNATURES {
        session.recent_gemini_signatures.remove(0);
    }
    true
}

const MAX_CURSOR_SIGNATURES: usize = 256;

fn remember_cursor_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::cursor::CursorSessionEvent,
) -> bool {
    let signature = cursor_signature(event);
    if session.recent_cursor_signatures.contains(&signature) {
        return false;
    }
    session.recent_cursor_signatures.push(signature);
    if session.recent_cursor_signatures.len() > MAX_CURSOR_SIGNATURES {
        session.recent_cursor_signatures.remove(0);
    }
    true
}

fn gemini_signature(event: &crate::profiles::gemini::GeminiSessionEvent) -> String {
    match event {
        crate::profiles::gemini::GeminiSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::gemini::GeminiSessionEvent::AssistantText { text } => {
            format!("assistant:{text}")
        }
        crate::profiles::gemini::GeminiSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::gemini::GeminiSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
    }
}

fn cursor_signature(event: &crate::profiles::cursor::CursorSessionEvent) -> String {
    match event {
        crate::profiles::cursor::CursorSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::cursor::CursorSessionEvent::AssistantText { text } => {
            format!("assistant:{text}")
        }
        crate::profiles::cursor::CursorSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::cursor::CursorSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
        crate::profiles::cursor::CursorSessionEvent::SubagentStart {
            agent_id,
            display_name,
            description,
        } => format!(
            "subagent:{agent_id}:{display_name}:{}",
            description.clone().unwrap_or_default()
        ),
    }
}

fn codex_signature(event: &crate::profiles::codex::CodexSessionEvent) -> String {
    match event {
        crate::profiles::codex::CodexSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::codex::CodexSessionEvent::AssistantText { text, .. } => {
            format!("assistant:{text}")
        }
        crate::profiles::codex::CodexSessionEvent::SessionTitleChanged { title } => {
            format!("title:{title}")
        }
        crate::profiles::codex::CodexSessionEvent::SubagentStart {
            agent_type,
            display_name,
            description,
            model,
            reasoning_effort,
            agent_id,
        } => format!(
            "subagent:{agent_id}:{agent_type}:{display_name}:{}:{}:{}",
            description.clone().unwrap_or_default(),
            model.clone().unwrap_or_default(),
            reasoning_effort.clone().unwrap_or_default()
        ),
        crate::profiles::codex::CodexSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
            ..
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::codex::CodexSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
            ..
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
    }
}

fn tail_transcript(
    ts: &mut TrackedSession,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(transcript_path) = &ts.session.transcript_path else {
        return;
    };
    let transcript_path = transcript_path.clone();

    let Ok(file) = std::fs::File::open(&transcript_path) else {
        return;
    };

    let mut reader = BufReader::new(file);
    if reader.seek(SeekFrom::Start(ts.file_offset)).is_err() {
        return;
    }

    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    let now_ms = now_millis();

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                for mut te in parse_jsonl_line(trimmed) {
                    // Track tool_use_id → tool_name from ToolUse events
                    if let crate::tailer::TranscriptEvent::ToolUse {
                        ref tool_name,
                        ref tool_use_id,
                        ..
                    } = te.event
                    {
                        ts.tool_name_map
                            .insert(tool_use_id.clone(), tool_name.clone());
                    }
                    // Enrich ToolResult with tool_name from the map
                    if let crate::tailer::TranscriptEvent::ToolResult {
                        ref tool_use_id,
                        ref mut tool_name,
                        ..
                    } = te.event
                    {
                        if tool_name.is_none() {
                            *tool_name = ts.tool_name_map.get(tool_use_id).cloned();
                        }
                    }

                    // Use actual JSONL timestamp, fall back to scan time
                    let event_time = te.timestamp_ms.unwrap_or(now_ms);

                    let envelope = transcript_event_to_envelope(
                        &te.event,
                        ts.session.runtime_source.clone(),
                        &workspace_id,
                        &ts.session.session_id,
                        None,
                        event_time,
                    );
                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(live_state, sender, &envelope);
                    }
                }
            }
        }
    }

    if let Ok(pos) = reader.stream_position() {
        ts.file_offset = pos;
        let _ = store.save_scanner_offset(
            &transcript_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(pos).unwrap_or(i64::MAX),
        );
    }
}

fn scan_subagents(
    ts: &mut TrackedSession,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(subagents_dir) = &ts.session.subagents_dir else {
        return;
    };
    let subagents_dir = subagents_dir.clone();

    let Ok(entries) = std::fs::read_dir(&subagents_dir) else {
        return;
    };

    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    let now_ms = now_millis();
    let active_subagents = active_subagent_ids(live_state, &ts.session.session_id);

    // Discover new subagents from .meta.json files
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let file_name = file_name.to_string();

        if !file_name.ends_with(".meta.json") {
            continue;
        }

        let subagent_id = file_name.trim_end_matches(".meta.json").to_string();
        if ts.known_subagents.iter().any(|s| s.agent_id == subagent_id) {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };

        let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        let agent_type = meta
            .get("agentType")
            .and_then(|v| v.as_str())
            .unwrap_or("Agent")
            .to_string();
        let description = meta
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let envelope = EventEnvelope {
            runtime_source: ts.session.runtime_source.clone(),
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SubagentStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: workspace_id.clone(),
                session_id: ts.session.session_id.clone(),
            },
            agent_id: Some(subagent_id.clone()),
            occurred_at_ms: now_ms,
            capabilities: observed_capabilities(),
            title: format!("subagent started: {agent_type}"),
            payload: json!({
                "agent_type": agent_type,
                "description": description,
                "agent_name": agent_type,
                "parent_agent_id": "main",
            }),
        };

        if !active_subagents.contains(&subagent_id)
            && matches!(store.insert_event(&envelope), Ok(true))
        {
            broadcast_envelope(live_state, sender, &envelope);
        }

        // Track subagent for JSONL tailing
        let jsonl_path = subagents_dir.join(format!("{subagent_id}.jsonl"));
        ts.known_subagents.push(TrackedSubagent {
            agent_id: subagent_id.clone(),
            jsonl_path,
            file_offset: load_u64_offset(
                store,
                &subagent_offset_key(
                    &workspace_id,
                    &ts.session.session_id,
                    &format!("{subagent_id}.jsonl"),
                ),
            ),
            tool_name_map: HashMap::new(),
        });
    }

    // Tail each subagent's JSONL
    for subagent in &mut ts.known_subagents {
        if !subagent.jsonl_path.exists() {
            continue;
        }
        let Ok(file) = std::fs::File::open(&subagent.jsonl_path) else {
            continue;
        };
        let mut reader = BufReader::new(file);
        if reader.seek(SeekFrom::Start(subagent.file_offset)).is_err() {
            continue;
        }

        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    for mut te in parse_jsonl_line(trimmed) {
                        // Track tool names for this subagent
                        if let crate::tailer::TranscriptEvent::ToolUse {
                            ref tool_name,
                            ref tool_use_id,
                            ..
                        } = te.event
                        {
                            subagent
                                .tool_name_map
                                .insert(tool_use_id.clone(), tool_name.clone());
                        }
                        if let crate::tailer::TranscriptEvent::ToolResult {
                            ref tool_use_id,
                            ref mut tool_name,
                            ..
                        } = te.event
                        {
                            if tool_name.is_none() {
                                *tool_name = subagent.tool_name_map.get(tool_use_id).cloned();
                            }
                        }

                        let event_time = te.timestamp_ms.unwrap_or(now_ms);
                        let envelope = transcript_event_to_envelope(
                            &te.event,
                            ts.session.runtime_source.clone(),
                            &workspace_id,
                            &ts.session.session_id,
                            Some(&subagent.agent_id),
                            event_time,
                        );
                        if let Ok(true) = store.insert_event(&envelope) {
                            broadcast_envelope(live_state, sender, &envelope);
                        }
                    }
                }
            }
        }

        if let Ok(pos) = reader.stream_position() {
            subagent.file_offset = pos;
            let _ = store.save_scanner_offset(
                &subagent_offset_key(
                    &workspace_id,
                    &ts.session.session_id,
                    &format!("{}.jsonl", subagent.agent_id),
                ),
                i64::try_from(pos).unwrap_or(i64::MAX),
            );
        }
    }
}

fn broadcast_envelope(
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
    envelope: &EventEnvelope,
) {
    let Ok(compat_event) = live_state.record_envelope(envelope) else {
        return;
    };

    let Ok(event_payload) = serde_json::to_value(compat_event) else {
        return;
    };

    let _ = sender.send(OutboundWsMessage {
        message_type: "event",
        payload: event_payload,
    });

    if !should_broadcast_registry(&envelope.event_kind) {
        return;
    }

    let Ok(registry) = live_state.list_agent_registry() else {
        return;
    };
    let Ok(registry_payload) = serde_json::to_value(registry) else {
        return;
    };
    let _ = sender.send(OutboundWsMessage {
        message_type: "agent_registry",
        payload: registry_payload,
    });
}

fn active_session_ids(live_state: &LiveState) -> HashSet<String> {
    live_state
        .list_sessions()
        .unwrap_or_default()
        .into_iter()
        .filter(|session| session.is_active)
        .map(|session| session.session_id)
        .collect()
}

fn active_subagent_ids(live_state: &LiveState, session_id: &str) -> HashSet<String> {
    live_state
        .list_agent_registry()
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| entry.session_id == session_id)
        .filter(|entry| entry.lifecycle_status == "active")
        .filter_map(|entry| entry.agent_id)
        .collect()
}

fn load_i64_offset(store: &Store, cursor_key: &str) -> i64 {
    store.load_scanner_offset(cursor_key).unwrap_or(0)
}

fn load_u64_offset(store: &Store, cursor_key: &str) -> u64 {
    u64::try_from(load_i64_offset(store, cursor_key)).unwrap_or(0)
}

fn load_usize_offset(store: &Store, cursor_key: &str) -> usize {
    usize::try_from(load_i64_offset(store, cursor_key)).unwrap_or(0)
}

fn transcript_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("transcript:{workspace_id}:{session_id}")
}

fn codex_history_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("codex_history:{workspace_id}:{session_id}")
}

fn codex_log_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("codex_log:{workspace_id}:{session_id}")
}

fn gemini_log_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("gemini_log:{workspace_id}:{session_id}")
}

fn subagent_offset_key(workspace_id: &str, session_id: &str, file_name: &str) -> String {
    format!("subagent:{workspace_id}:{session_id}:{file_name}")
}

fn workspace_id_from_cwd(cwd: &str) -> String {
    std::path::Path::new(cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn observed_capabilities() -> CapabilitySet {
    CapabilitySet {
        can_observe: true,
        can_start: false,
        can_stop: false,
        can_retry: false,
        can_respond: false,
    }
}

fn now_millis() -> i64 {
    i64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_millis(),
    )
    .unwrap_or(0)
}
