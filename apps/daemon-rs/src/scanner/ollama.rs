//! Poll Ollama `GET /api/ps` and emit observed events when loaded models change.

use serde_json::json;
use tokio::sync::broadcast;

use crate::api::OutboundWsMessage;
use crate::live_state::LiveState;
use crate::model::{
    AcquisitionMode, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::store::Store;

use super::helpers::{broadcast_envelope, observed_capabilities, now_millis};

#[derive(Default)]
pub(crate) struct OllamaScannerState {
    pub(crate) last_digest: Option<String>,
    /// Emit `SessionStarted` once after first successful `/api/ps` (mirrors Codex discovery UX).
    pub(crate) announced_session: bool,
}

fn trim_slash(s: &str) -> &str {
    s.trim().trim_end_matches('/')
}

pub(crate) async fn poll_ollama_running_models(
    http: &reqwest::Client,
    base_url: &str,
    workspace_id: &str,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
    state: &mut OllamaScannerState,
) {
    let url = format!("{}/api/ps", trim_slash(base_url));
    let Ok(resp) = http.get(url).send().await else {
        return;
    };
    if !resp.status().is_success() {
        return;
    }
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return;
    };

    let mut names = Vec::new();
    if let Some(items) = body.get("models").and_then(|v| v.as_array()) {
        for item in items {
            let n = item
                .get("model")
                .and_then(serde_json::Value::as_str)
                .or_else(|| item.get("name").and_then(serde_json::Value::as_str));
            if let Some(name) = n {
                let t = name.trim();
                if !t.is_empty() {
                    names.push(t.to_string());
                }
            }
        }
    }
    names.sort();
    names.dedup();
    let digest = names.join("|");

    if !state.announced_session {
        state.announced_session = true;
        let now_ms = now_millis();
        let start = EventEnvelope {
            runtime_source: RuntimeSource::Ollama,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SessionStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: workspace_id.to_string(),
                session_id: "ollama-ps".to_string(),
            },
            agent_id: None,
            occurred_at_ms: now_ms,
            capabilities: observed_capabilities(),
            title: "ollama session".to_string(),
            payload: json!({
                "runtime_label": "Ollama",
                "runtime_source": "Ollama",
                "project_name": workspace_id,
                "entrypoint": "ollama",
                "cwd": base_url,
                "title": "Ollama server",
                "producer": "pharos_ollama_scanner",
            }),
        };
        if let Ok(true) = store.insert_event(&start) {
            broadcast_envelope(live_state, sender, &start);
        }
    }

    if state.last_digest.as_deref() == Some(digest.as_str()) {
        return;
    }
    state.last_digest = Some(digest.clone());

    let now_ms = now_millis();
    let text = if names.is_empty() {
        "Ollama: no models loaded in VRAM (idle).".to_string()
    } else {
        format!("Ollama: loaded / running — {}", names.join(", "))
    };

    let envelope = EventEnvelope {
        runtime_source: RuntimeSource::Ollama,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind: EventKind::AssistantResponse,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: "ollama-ps".to_string(),
        },
        agent_id: None,
        occurred_at_ms: now_ms,
        capabilities: observed_capabilities(),
        title: "ollama ps".to_string(),
        payload: json!({
            "runtime_label": "Ollama",
            "runtime_source": "Ollama",
            "text": text,
            "running_models": names,
            "producer": "pharos_ollama_scanner",
            "project_name": workspace_id,
        }),
    };

    if let Ok(true) = store.insert_event(&envelope) {
        broadcast_envelope(live_state, sender, &envelope);
    }
}
