use serde_json::json;

use super::avatars::{default_agent_avatar_data_uri, resolve_project_icon_url};
use super::constants::SUBAGENT_ACTIVE_WINDOW_MS;
use super::labels::{resolve_agent_name, resolve_session_summary};
use super::util::truncate;
use super::LiveState;
use crate::model::{
    AcquisitionMode, AgentSnapshot, CapabilitySet, EventEnvelope, EventKind, LegacyHookEvent,
    RuntimeSource, SessionRef,
};

#[test]
fn prefers_assistant_response_for_session_summary() {
    let events = vec![
        LegacyHookEvent {
            source_app: "signal".to_string(),
            session_id: "sess-1".to_string(),
            hook_event_type: "SessionStart".to_string(),
            payload: json!({
                "runtime_label": "Codex",
                "cwd": "/tmp/signal",
            }),
            timestamp: 10,
            agent_id: None,
            agent_type: None,
            model_name: None,
            display_name: None,
            agent_name: None,
        },
        LegacyHookEvent {
            source_app: "signal".to_string(),
            session_id: "sess-1".to_string(),
            hook_event_type: "AssistantResponse".to_string(),
            payload: json!({
                "text": "Repository is a single-package Vite app with a React frontend.",
            }),
            timestamp: 20,
            agent_id: None,
            agent_type: None,
            model_name: Some("codex".to_string()),
            display_name: None,
            agent_name: None,
        },
    ];

    let summary = resolve_session_summary(&events, &[]);
    assert_eq!(
        summary.as_deref(),
        Some("Responded: Repository is a single-package Vite app with a React frontend.")
    );
}

#[test]
fn falls_back_to_active_runtime_summary_when_no_better_signal_exists() {
    let events = vec![LegacyHookEvent {
        source_app: "signal".to_string(),
        session_id: "sess-1".to_string(),
        hook_event_type: "SessionStart".to_string(),
        payload: json!({
            "runtime_label": "Codex",
            "cwd": "/Users/test/work/signal",
        }),
        timestamp: 10,
        agent_id: None,
        agent_type: None,
        model_name: None,
        display_name: None,
        agent_name: None,
    }];

    let summary = resolve_session_summary(
        &events,
        &[AgentSnapshot {
            agent_id: None,
            display_name: "signal".to_string(),
            avatar_url: None,
            runtime_label: Some("Codex".to_string()),
            assignment: None,
            current_action: None,
            agent_type: None,
            model_name: None,
            event_count: 1,
            last_event_at: 10,
            is_active: true,
            parent_id: None,
        }],
    );
    assert_eq!(summary.as_deref(), Some("Codex active in signal"));
}

#[test]
fn truncate_handles_unicode_char_boundaries() {
    let text = "You’re right — thanks for the screenshot";
    let truncated = truncate(text, 12);
    assert!(truncated.ends_with('…'));
}

#[test]
fn summarize_prompt_strips_markup_wrappers() {
    let events = vec![LegacyHookEvent {
        source_app: "yellow".to_string(),
        session_id: "sess-1".to_string(),
        hook_event_type: "UserPromptSubmit".to_string(),
        payload: json!({
            "prompt": "<local-command-stdout>Goodbye!</local-command-stdout>"
        }),
        timestamp: 10,
        agent_id: None,
        agent_type: None,
        model_name: None,
        display_name: None,
        agent_name: None,
    }];

    let summary = resolve_session_summary(&events, &[]);
    assert_eq!(summary.as_deref(), Some("Prompted: Goodbye!"));
}

#[test]
fn generated_agent_avatar_uses_data_uri() {
    let state = LiveState::default();
    let event = EventEnvelope {
        runtime_source: RuntimeSource::CodexCli,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::ToolCallStarted,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: "pharos".to_string(),
            session_id: "sess-avatar".to_string(),
        },
        agent_id: Some("subagent-1".to_string()),
        occurred_at_ms: 123,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "tool".to_string(),
        payload: json!({
            "runtime_label": "Codex",
            "display_name": "Research Agent",
            "tool_name": "ReadFile"
        }),
    };

    state.record_envelope(&event).expect("event recorded");
    let project = state
        .project("pharos")
        .expect("project listing")
        .expect("project exists");
    let avatar = project
        .sessions
        .iter()
        .flat_map(|session| session.agents.iter())
        .find_map(|agent| agent.avatar_url.as_ref())
        .expect("avatar generated");
    assert!(avatar.starts_with("data:image/svg+xml,"));
}

#[test]
fn project_icon_uses_project_initials() {
    let icon_url = resolve_project_icon_url("pharos").expect("project icon");
    assert!(icon_url.starts_with("data:image/svg+xml,"));
    assert!(icon_url.contains("%3EPH%3C%2Ftext%3E"));
}

#[test]
fn generated_agent_avatar_escapes_svg_text() {
    let avatar = default_agent_avatar_data_uri("Cursor", "[<");
    assert!(avatar.contains("data:image/svg+xml,"));
    assert!(avatar.contains("%3EA%3C%2Ftext%3E"));
    assert!(!avatar.contains("%3C%3C%2Ftext%3E"));
}

#[test]
fn session_project_upgrades_from_unknown_to_real_project() {
    let state = LiveState::default();
    let base_session = SessionRef {
        host_id: "local".to_string(),
        workspace_id: "unknown".to_string(),
        session_id: "sess-unknown".to_string(),
    };

    let unknown_event = EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::SessionStarted,
        session: base_session.clone(),
        agent_id: None,
        occurred_at_ms: 10,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "session started".to_string(),
        payload: json!({}),
    };
    let improved_event = EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::AssistantResponse,
        session: base_session,
        agent_id: None,
        occurred_at_ms: 20,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "assistant response".to_string(),
        payload: json!({
            "cwd": "/Users/tester/home_projects/pharos",
            "text": "runtime update",
        }),
    };

    state
        .record_envelope(&unknown_event)
        .expect("first event recorded");
    state
        .record_envelope(&improved_event)
        .expect("second event recorded");

    let projects = state.list_projects().expect("projects");
    assert!(projects.iter().any(|project| project.name == "pharos"));
    assert!(!projects.iter().any(|project| {
        project.name == "unknown"
            && project
                .sessions
                .iter()
                .any(|session| session.session_id == "sess-unknown")
    }));
}

#[test]
fn resolve_agent_name_prefers_agent_identity_over_task_text() {
    let event = LegacyHookEvent {
        source_app: "pharos".to_string(),
        session_id: "sess-1".to_string(),
        hook_event_type: "SubagentStart".to_string(),
        payload: json!({
            "agent_type": "cursor_subagent",
            "responsibility": "Build client and then review backend integration details with exhaustive checks"
        }),
        timestamp: 10,
        agent_id: Some("agent-1".to_string()),
        agent_type: Some("cursor_subagent".to_string()),
        model_name: None,
        display_name: None,
        agent_name: None,
    };
    let refs = vec![&event];
    assert_eq!(resolve_agent_name(&refs, false), "Cursor Helper");
}

#[test]
fn stale_subagent_becomes_inactive_without_explicit_stop_event() {
    let state = LiveState::default();
    let session = SessionRef {
        host_id: "local".to_string(),
        workspace_id: "pharos".to_string(),
        session_id: "sess-stale".to_string(),
    };

    let subagent_start = EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::SubagentStarted,
        session: session.clone(),
        agent_id: Some("agent-old".to_string()),
        occurred_at_ms: 1_000,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "subagent started".to_string(),
        payload: json!({
            "agent_type": "cursor_subagent",
            "display_name": "Cursor Subagent"
        }),
    };
    let recent_main_event = EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::AssistantResponse,
        session,
        agent_id: None,
        occurred_at_ms: 1_000 + SUBAGENT_ACTIVE_WINDOW_MS + 1_000,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "assistant response".to_string(),
        payload: json!({
            "text": "still working"
        }),
    };

    state
        .record_envelope(&subagent_start)
        .expect("subagent recorded");
    state
        .record_envelope(&recent_main_event)
        .expect("main event recorded");

    let project = state
        .project("pharos")
        .expect("project listing")
        .expect("project exists");
    let agent = project
        .sessions
        .iter()
        .flat_map(|session| session.agents.iter())
        .find(|agent| agent.agent_id.as_deref() == Some("agent-old"))
        .expect("agent snapshot exists");
    assert!(!agent.is_active);
}

#[test]
fn stale_session_becomes_inactive_without_session_end() {
    let state = LiveState::default();
    let event = EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::AssistantResponse,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: "pharos".to_string(),
            session_id: "sess-old".to_string(),
        },
        agent_id: None,
        occurred_at_ms: 1_000,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title: "assistant response".to_string(),
        payload: json!({
            "text": "old activity"
        }),
    };
    state.record_envelope(&event).expect("event recorded");

    let project = state
        .project("pharos")
        .expect("project listing")
        .expect("project exists");
    let session = project
        .sessions
        .iter()
        .find(|session| session.session_id == "sess-old")
        .expect("session snapshot exists");
    assert!(!session.is_active);
    assert!(!project.is_active);
}
