use std::collections::HashMap;

use tempfile::tempdir;
use tokio::sync::broadcast;

use crate::live_state::LiveState;
use crate::model::RuntimeSource;
use crate::profiles::{DetectedSession, codex::CodexSessionEvent, gemini::GeminiProfile};
use crate::store::Store;

use super::session::{TrackedSession, should_remove_after_missed_discovery};
use super::signatures::{
    codex_signature, gemini_signature, remember_codex_signature, remember_gemini_signature,
};
use super::tailing::tail_gemini_activity;

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
