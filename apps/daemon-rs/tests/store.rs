use pharos_daemon::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use pharos_daemon::store::Store;
use serde_json::json;

fn observed_capabilities() -> CapabilitySet {
    CapabilitySet {
        can_observe: true,
        can_start: false,
        can_stop: false,
        can_retry: false,
        can_respond: false,
    }
}

fn event(
    event_kind: EventKind,
    occurred_at_ms: i64,
    agent_id: Option<&str>,
    payload: serde_json::Value,
) -> EventEnvelope {
    EventEnvelope {
        runtime_source: RuntimeSource::ClaudeCode,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: "demo-project".to_string(),
            session_id: "sess-1234".to_string(),
        },
        agent_id: agent_id.map(ToString::to_string),
        occurred_at_ms,
        capabilities: observed_capabilities(),
        title: "test event".to_string(),
        payload,
    }
}

#[test]
fn registry_upgrades_main_agent_name_when_session_title_arrives() {
    let store = Store::open_in_memory().expect("store");

    store
        .insert_event(&event(
            EventKind::SessionStarted,
            100,
            None,
            json!({
                "cwd": "/Users/testuser/demo-project",
                "entrypoint": "claude"
            }),
        ))
        .expect("insert session start");

    store
        .insert_event(&event(
            EventKind::SessionTitleChanged,
            200,
            None,
            json!({
                "title": "Refactor billing worker"
            }),
        ))
        .expect("insert session title");

    let registry = store.list_agent_registry().expect("registry");
    assert_eq!(registry.len(), 1);
    assert_eq!(registry[0].display_name, "Refactor billing worker");
}

#[test]
fn registry_and_legacy_events_use_subagent_description_for_names() {
    let store = Store::open_in_memory().expect("store");

    store
        .insert_event(&event(
            EventKind::SubagentStarted,
            100,
            Some("agent-123"),
            json!({
                "agent_type": "Explore",
                "agent_name": "Explore",
                "description": "Audit auth flow"
            }),
        ))
        .expect("insert subagent start");

    let registry = store.list_agent_registry().expect("registry");
    assert_eq!(registry.len(), 1);
    assert_eq!(registry[0].display_name, "Explore · Audit auth flow");

    let legacy_events = store.list_legacy_events().expect("legacy events");
    assert_eq!(legacy_events.len(), 1);
    assert_eq!(
        legacy_events[0].display_name.as_deref(),
        Some("Explore · Audit auth flow")
    );
    assert_eq!(legacy_events[0].agent_name.as_deref(), Some("Explore"));
}

#[test]
fn legacy_events_fallback_to_runtime_label_when_workspace_is_not_project_like() {
    let store = Store::open_in_memory().expect("store");

    store
        .insert_event(&EventEnvelope {
            runtime_source: RuntimeSource::GeminiCli,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SessionStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "MacOS".to_string(),
                session_id: "sess-gemini".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 100,
            capabilities: observed_capabilities(),
            title: "session started".to_string(),
            payload: json!({
                "cwd": "/Applications/SomeApp.app/Contents/MacOS",
                "entrypoint": "gemini"
            }),
        })
        .expect("insert session start");

    let legacy_events = store.list_legacy_events().expect("legacy events");
    assert_eq!(legacy_events[0].source_app, "Gemini");
}

#[test]
fn legacy_events_prefix_project_labels_with_runtime_name() {
    let store = Store::open_in_memory().expect("store");

    store
        .insert_event(&EventEnvelope {
            runtime_source: RuntimeSource::CodexCli,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SessionStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "sess-codex".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 100,
            capabilities: observed_capabilities(),
            title: "session started".to_string(),
            payload: json!({
                "cwd": "/Users/tester/home_projects/pharos",
                "entrypoint": "codex"
            }),
        })
        .expect("insert session start");

    let legacy_events = store.list_legacy_events().expect("legacy events");
    assert_eq!(legacy_events[0].source_app, "pharos");
    assert_eq!(
        legacy_events[0].payload.get("runtime_label").and_then(serde_json::Value::as_str),
        Some("Codex")
    );
}
