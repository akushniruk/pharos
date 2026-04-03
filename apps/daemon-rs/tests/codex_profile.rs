use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::codex::{
    enrich_detected_sessions,
    parse_codex_items,
    CodexProfile,
    CodexSessionEvent,
};
use pharos_daemon::profiles::DetectedSession;
use tempfile::tempdir;

#[test]
fn codex_profile_discovers_native_session_titles_and_project_roots() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::create_dir_all(temp_dir.path().join("sessions")).expect("sessions dir");
    std::fs::write(
        temp_dir.path().join("session_index.jsonl"),
        r#"{"id":"sess-a","thread_name":"Review pharos runtime design","updated_at":"2026-04-03T11:40:03.467Z"}"#,
    )
    .expect("write index");
    std::fs::write(
        temp_dir.path().join("sessions").join("rollout-sess-a.json"),
        r#"{
          "session": {
            "timestamp": "2026-04-03T11:35:03.467Z",
            "id": "sess-a",
            "instructions": ""
          },
          "items": [
            {
              "type": "message",
              "role": "assistant",
              "content": [
                {
                  "type": "output_text",
                  "text": "Codex CLI initialized.\nProject root: /Users/tester/workspace/pharos\nType `help` for a list of available commands."
                }
              ]
            },
            {
              "type": "message",
              "role": "user",
              "content": [
                {
                  "type": "input_text",
                  "text": "review codebase fully"
                }
              ]
            }
          ]
        }"#,
    )
    .expect("write session");

    let profile = CodexProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_native_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].native_session_id, "sess-a");
    assert_eq!(sessions[0].project_root.as_deref(), Some("/Users/tester/workspace/pharos"));
    assert_eq!(sessions[0].title.as_deref(), Some("review codebase fully"));
    assert!(sessions[0].history_path.is_some());
    assert!(sessions[0].updated_at_ms > 0);
}

#[test]
fn codex_native_session_enrichment_upgrades_detected_process_name() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::CodexCli,
        session_id: "proc-42".to_string(),
        native_session_id: None,
        pid: Some(42),
        cwd: "/Users/tester/workspace/pharos".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "codex".to_string(),
        display_title: None,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let profile = CodexProfile::new(tempdir().expect("tempdir").path().to_path_buf());
    let native_sessions = vec![pharos_daemon::profiles::codex::NativeCodexSession {
        native_session_id: "sess-a".to_string(),
        title: Some("Review pharos runtime design".to_string()),
        updated_at_ms: 1_711_234_569_000,
        project_root: Some("/Users/tester/workspace/pharos".to_string()),
        history_path: Some(std::path::PathBuf::from("/tmp/rollout-sess-a.json")),
    }];

    let _ = profile;
    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert_eq!(
        sessions[0].display_title.as_deref(),
        Some("Review pharos runtime design")
    );
    assert_eq!(sessions[0].native_session_id.as_deref(), Some("sess-a"));
    assert!(sessions[0].history_path.is_some());
}

#[test]
fn codex_session_items_parse_into_user_tool_and_assistant_events() {
    let items = serde_json::from_str::<Vec<serde_json::Value>>(
        r#"[
          {
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": "review codebase"}]
          },
          {
            "id": "fc_1",
            "type": "function_call",
            "status": "completed",
            "arguments": "{\"command\":[\"ls\"]}",
            "call_id": "call_1",
            "name": "exec_command"
          },
          {
            "type": "function_call_output",
            "call_id": "call_1",
            "output": "{\"output\":\"README.md\\n\",\"metadata\":{\"exit_code\":0}}"
          },
          {
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "status": "completed",
            "content": [{"type": "output_text", "text": "I listed the files."}]
          }
        ]"#,
    )
    .expect("items");

    let events = parse_codex_items(&items);

    assert_eq!(
        events,
        vec![
            CodexSessionEvent::UserPrompt {
                text: "review codebase".to_string(),
            },
            CodexSessionEvent::ToolUse {
                tool_name: "exec_command".to_string(),
                tool_use_id: "call_1".to_string(),
                input: serde_json::json!({"command": ["ls"]}),
            },
            CodexSessionEvent::ToolResult {
                tool_use_id: "call_1".to_string(),
                tool_name: Some("exec_command".to_string()),
                is_error: false,
                content: "README.md\n".to_string(),
            },
            CodexSessionEvent::AssistantText {
                text: "I listed the files.".to_string(),
            },
        ]
    );
}

#[test]
fn codex_live_log_body_parses_tool_use_and_workdir() {
    let temp_dir = tempdir().expect("tempdir");
    let profile = CodexProfile::new(temp_dir.path().to_path_buf());
    let db_path = temp_dir.path().join("logs_1.sqlite");
    let connection = rusqlite::Connection::open(db_path).expect("open sqlite");
    connection
        .execute_batch(
            "CREATE TABLE logs (
                id INTEGER PRIMARY KEY,
                ts INTEGER NOT NULL,
                level TEXT,
                target TEXT,
                feedback_log_body TEXT,
                thread_id TEXT
            );",
        )
        .expect("create logs");
    connection
        .execute(
            "INSERT INTO logs (id, ts, level, target, feedback_log_body, thread_id)
             VALUES (?1, ?2, 'INFO', 'codex_core::stream_events_utils', ?3, ?4)",
            rusqlite::params![
                1_i64,
                1_775_226_325_i64,
                "session_loop{thread_id=thread-1}:submission_dispatch{otel.name=\"op.dispatch.user_input\"}:turn{otel.name=\"session_task.turn\" thread.id=thread-1 turn.id=turn-1 model=gpt-5.4}: ToolCall: exec_command {\"cmd\":\"sed -n '1,240p' src/main.tsx\",\"workdir\":\"/Users/tester/work/demo/signal\"}",
                "thread-1",
            ],
        )
        .expect("insert log");

    let sessions = profile.discover_native_sessions();
    let live_session = sessions
        .iter()
        .find(|session| session.native_session_id == "thread-1")
        .expect("live session");
    assert_eq!(
        live_session.project_root.as_deref(),
        Some("/Users/tester/work/demo/signal")
    );
    assert!(
        live_session
            .title
            .as_deref()
            .is_some_and(|title| title.contains("src/main.tsx"))
    );

    let events = profile.read_live_events("thread-1", 0);
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].row_id, 1);
    assert_eq!(events[0].occurred_at_ms, 1_775_226_325_000);
    assert_eq!(
        events[0].event,
        CodexSessionEvent::ToolUse {
            tool_name: "exec_command".to_string(),
            tool_use_id: "turn-1".to_string(),
            input: serde_json::json!({
                "cmd": "sed -n '1,240p' src/main.tsx",
                "workdir": "/Users/tester/work/demo/signal"
            }),
        }
    );
}
