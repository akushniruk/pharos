use std::collections::HashSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json;
use tokio::sync::broadcast;

use crate::api::OutboundWsMessage;
use crate::live_state::{LiveState, should_broadcast_registry};
use crate::model::{CapabilitySet, EventEnvelope};
use crate::store::Store;

pub(crate) fn broadcast_envelope(
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

pub(crate) fn active_session_ids(live_state: &LiveState) -> HashSet<String> {
    live_state
        .list_sessions()
        .unwrap_or_default()
        .into_iter()
        .filter(|session| session.is_active)
        .map(|session| session.session_id)
        .collect()
}

pub(crate) fn active_subagent_ids(live_state: &LiveState, session_id: &str) -> HashSet<String> {
    live_state
        .list_agent_registry()
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| entry.session_id == session_id)
        .filter(|entry| entry.lifecycle_status == "active")
        .filter_map(|entry| entry.agent_id)
        .collect()
}

pub(crate) fn load_i64_offset(store: &Store, cursor_key: &str) -> i64 {
    store.load_scanner_offset(cursor_key).unwrap_or(0)
}

pub(crate) fn load_u64_offset(store: &Store, cursor_key: &str) -> u64 {
    u64::try_from(load_i64_offset(store, cursor_key)).unwrap_or(0)
}

pub(crate) fn load_usize_offset(store: &Store, cursor_key: &str) -> usize {
    usize::try_from(load_i64_offset(store, cursor_key)).unwrap_or(0)
}

pub(crate) fn transcript_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("transcript:{workspace_id}:{session_id}")
}

pub(crate) fn codex_history_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("codex_history:{workspace_id}:{session_id}")
}

pub(crate) fn codex_log_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("codex_log:{workspace_id}:{session_id}")
}

pub(crate) fn gemini_log_offset_key(workspace_id: &str, session_id: &str) -> String {
    format!("gemini_log:{workspace_id}:{session_id}")
}

pub(crate) fn subagent_offset_key(workspace_id: &str, session_id: &str, file_name: &str) -> String {
    format!("subagent:{workspace_id}:{session_id}:{file_name}")
}

pub(crate) fn workspace_id_from_cwd(cwd: &str) -> String {
    let raw = std::path::Path::new(cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    if is_project_like_workspace(&raw) {
        return raw;
    }

    let hint = raw.split('-').next_back().unwrap_or("unknown").to_string();
    if is_project_like_workspace(&hint) {
        return hint;
    }

    "unknown".to_string()
}

pub(crate) fn is_project_like_workspace(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    !normalized.is_empty()
        && !matches!(
            normalized.as_str(),
            "unknown"
                | "macos"
                | "resources"
                | "data"
                | "libexec"
                | "sbin"
                | "bin"
                | "system"
                | "contents"
                | "workbench"
                | "app"
                | "out"
        )
}

pub(crate) fn observed_capabilities() -> CapabilitySet {
    CapabilitySet {
        can_observe: true,
        can_start: false,
        can_stop: false,
        can_retry: false,
        can_respond: false,
    }
}

pub(crate) fn now_millis() -> i64 {
    i64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_millis(),
    )
    .unwrap_or(0)
}
