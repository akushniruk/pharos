use insta::assert_json_snapshot;
use pharos_daemon::connector::resolve_connector;
use pharos_daemon::discovery::discover_claude_sessions;
use pharos_daemon::legacy::claude::normalize_claude_event;
use tempfile::tempdir;

#[test]
fn normalizes_pre_tool_use_fixture_into_event_envelope() {
    let raw = include_str!("../fixtures/claude/pre_tool_use.json");
    let envelope = normalize_claude_event(raw).expect("fixture should normalize");

    assert_json_snapshot!(envelope);
}

#[test]
fn resolves_claude_connector_and_normalizes_fixture() {
    let raw = include_str!("../fixtures/claude/pre_tool_use.json");
    let connector = resolve_connector("claude").expect("claude connector should exist");
    let envelope = connector
        .normalize_raw_event(raw)
        .expect("fixture should normalize through connector");

    assert_eq!(connector.key(), "claude");
    assert_eq!(envelope.title, "tool call started: Bash");
}

#[test]
fn resolves_generic_connector_and_accepts_event_envelope_json() {
    let raw = r#"{
      "runtime_source": "claude_code",
      "acquisition_mode": "observed",
      "event_kind": "session_started",
      "session": {
        "host_id": "local",
        "workspace_id": "generic-project",
        "session_id": "sess-generic"
      },
      "agent_id": null,
      "occurred_at_ms": 1711234567999,
      "capabilities": {
        "can_observe": true,
        "can_start": false,
        "can_stop": false,
        "can_retry": false,
        "can_respond": false
      },
      "title": "generic connector event",
      "payload": { "producer": "manual-test" }
    }"#;
    let connector = resolve_connector("generic").expect("generic connector should exist");
    let envelope = connector
        .normalize_raw_event(raw)
        .expect("generic connector should parse event envelope");

    assert_eq!(connector.key(), "generic");
    assert_eq!(envelope.session.workspace_id, "generic-project");
    assert_eq!(envelope.title, "generic connector event");
}

#[test]
fn discovers_claude_sessions_from_directory() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::write(
        temp_dir.path().join("session-a.json"),
        r#"{
          "session_id": "session-a",
          "prompts": ["first prompt", "second prompt"]
        }"#,
    )
    .expect("write session fixture");

    let sessions = discover_claude_sessions(temp_dir.path()).expect("discover sessions");

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].session_id, "session-a");
    assert_eq!(sessions[0].prompt_count, 2);
    assert_eq!(sessions[0].latest_prompt_preview, "second prompt");
}
