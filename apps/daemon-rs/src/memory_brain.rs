use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use reqwest::Client;
use serde_json::{Value, json};
use tokio::sync::broadcast;
use tokio::time;

use crate::api::OutboundWsMessage;
use crate::model::{
    AcquisitionMode, CapabilitySet, ConnectivityState, EventEnvelope, EventKind, IntegrationState,
    MemoryBrainIntegrationStatus, RuntimeSource, SessionRef, SinkHealth,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryBrainConfig {
    pub enabled: bool,
    pub base_url: Option<String>,
    pub ollama_base_url: Option<String>,
    pub helper_model_hint: Option<String>,
    pub timeout_ms: u64,
    pub poll_interval_ms: u64,
    pub repair_path: String,
}

impl Default for MemoryBrainConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: None,
            ollama_base_url: None,
            helper_model_hint: None,
            timeout_ms: 3_000,
            poll_interval_ms: 15_000,
            repair_path: "/ops/repair-graph".to_string(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct MemoryBrainService {
    config: MemoryBrainConfig,
    client: Client,
    status: Arc<RwLock<MemoryBrainIntegrationStatus>>,
    circuit: Arc<RwLock<CircuitState>>,
    observed: Arc<RwLock<ObservedState>>,
    last_ollama_digest: Arc<RwLock<Option<String>>>,
    pending_integration_events: Arc<Mutex<Vec<EventEnvelope>>>,
    last_observed_workspace: Arc<RwLock<Option<String>>>,
}

#[derive(Debug, Clone, Default)]
struct CircuitState {
    consecutive_failures: u32,
    open_until_ms: Option<i64>,
}

#[derive(Debug, Clone, Default)]
struct ObservedState {
    has_mcp_activity: bool,
    recent_writes_count: usize,
    last_write_at: Option<i64>,
    last_graph_write_at: Option<i64>,
    helper_enabled: Option<bool>,
    helper_model: Option<String>,
    helper_last_ok_at: Option<i64>,
}

#[derive(Debug, Clone, Default)]
struct OllamaProbeDetail {
    digest: String,
    helper_enabled: Option<bool>,
    helper_model: Option<String>,
    helper_error: Option<String>,
    helper_last_ok_at: Option<i64>,
    gemma_models: Vec<String>,
    all_models: Vec<String>,
}

impl MemoryBrainService {
    #[must_use]
    pub fn new(config: MemoryBrainConfig) -> Self {
        let now = now_ms();
        let initial = if !config.enabled {
            MemoryBrainIntegrationStatus::disabled(now)
        } else if config.base_url.is_none() {
            MemoryBrainIntegrationStatus::not_configured(now)
        } else {
            MemoryBrainIntegrationStatus::not_configured(now)
        };
        let client = Client::builder()
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            config,
            client,
            status: Arc::new(RwLock::new(initial)),
            circuit: Arc::new(RwLock::new(CircuitState::default())),
            observed: Arc::new(RwLock::new(ObservedState::default())),
            last_ollama_digest: Arc::new(RwLock::new(None)),
            pending_integration_events: Arc::new(Mutex::new(Vec::new())),
            last_observed_workspace: Arc::new(RwLock::new(None)),
        }
    }

    #[must_use]
    pub fn snapshot(&self) -> MemoryBrainIntegrationStatus {
        self.status
            .read()
            .map(|guard| guard.clone())
            .unwrap_or_else(|_| MemoryBrainIntegrationStatus::disabled(now_ms()))
    }

    pub async fn refresh_now(&self) -> MemoryBrainIntegrationStatus {
        if !self.config.enabled {
            if self.config.ollama_base_url.is_some() {
                let detail = self.probe_ollama_tags().await;
                self.maybe_queue_ollama_signal(&detail);
            }
            return self.snapshot();
        }
        let next = self.reconcile_status(self.fetch_status().await);
        if let Ok(mut guard) = self.status.write() {
            *guard = next.clone();
        }
        next
    }

    pub fn observe_event(&self, event: &EventEnvelope) {
        let payload = &event.payload;
        let call_tool = payload
            .get("tool_name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase();
        let (mut server, memory_tool) = if call_tool == "callmcptool" {
            let tool_input = payload.get("tool_input").cloned().unwrap_or(Value::Null);
            let (s, t) = crate::cursor_callmcp::extract_server_tool(&tool_input);
            (s, t)
        } else {
            let srv = payload
                .get("server")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_lowercase();
            let mt = payload
                .get("tool_name")
                .and_then(Value::as_str)
                .or_else(|| payload.get("toolName").and_then(Value::as_str))
                .unwrap_or_default()
                .to_lowercase();
            (srv, mt)
        };
        if server.is_empty() {
            server = payload
                .get("server")
                .or_else(|| payload.get("tool_input").and_then(|value| value.get("server")))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_lowercase();
        }
        let from_memory_mcp = server == "user-ai-memory-brain"
            || server == "ai-memory-brain"
            || server.ends_with("ai-memory-brain")
            || server.contains("librarian")
            || (call_tool == "callmcptool" && memory_tool.starts_with("memory_"));
        if !from_memory_mcp {
            return;
        }
        let workspace = event.session.workspace_id.trim();
        if !workspace.is_empty() {
            if let Ok(mut guard) = self.last_observed_workspace.write() {
                *guard = Some(workspace.to_string());
            }
        }
        if let Ok(mut observed) = self.observed.write() {
            observed.has_mcp_activity = true;
            let occurred_at = event.occurred_at_ms;
            if memory_tool == "memory_add" || memory_tool == "memory_store_summary" {
                observed.recent_writes_count = observed.recent_writes_count.saturating_add(1);
                observed.last_write_at = Some(occurred_at);
            }
            if memory_tool.contains("graph") {
                observed.last_graph_write_at = Some(occurred_at);
            }
            if let Some(enabled) = find_bool_in_payload(payload, "helper_enabled") {
                observed.helper_enabled = Some(enabled);
            }
            if let Some(model) = find_string_in_payload(payload, "helper_model") {
                observed.helper_model = Some(model);
            } else if let Some(model) = infer_model_from_payload(payload) {
                observed.helper_model = Some(model);
            }
            if observed.helper_model.is_some() {
                observed.helper_last_ok_at = Some(occurred_at);
                if observed.helper_enabled.is_none() {
                    observed.helper_enabled = Some(true);
                }
            }
        }
        if let Ok(mut guard) = self.status.write() {
            let reconciled = self.reconcile_status(guard.clone());
            *guard = reconciled;
        }
    }

    pub fn spawn_poller<F>(&self, sender: broadcast::Sender<OutboundWsMessage>, persist: F)
    where
        F: Fn(Vec<EventEnvelope>) + Send + Sync + 'static,
    {
        let service = self.clone();
        let persist = Arc::new(persist);
        tokio::spawn(async move {
            if !service.config.enabled && service.config.ollama_base_url.is_none() {
                return;
            }
            loop {
                let next = service.refresh_now().await;
                let pending = service.drain_pending_integration_events();
                if !pending.is_empty() {
                    persist(pending);
                }
                if let Ok(payload) = serde_json::to_value(&next) {
                    let _ = sender.send(OutboundWsMessage {
                        message_type: "memory_brain_status",
                        payload,
                    });
                }
                let base = service.config.poll_interval_ms.max(1_000);
                let next_delay = if service.config.enabled {
                    if next.connectivity == ConnectivityState::Online {
                        base
                    } else {
                        (base / 3).max(3_000)
                    }
                } else {
                    base.max(10_000)
                };
                let jitter = (now_ms().unsigned_abs() % 400) + 100;
                time::sleep(Duration::from_millis(next_delay + jitter)).await;
            }
        });
    }

    pub fn drain_pending_integration_events(&self) -> Vec<EventEnvelope> {
        self.pending_integration_events
            .lock()
            .map(|mut guard| std::mem::take(&mut *guard))
            .unwrap_or_default()
    }

    pub async fn trigger_repair_graph(&self) -> Result<Value, String> {
        if !self.config.enabled {
            return Err("memory-brain integration disabled".to_string());
        }
        let Some(base_url) = &self.config.base_url else {
            return Err("memory-brain base url not configured".to_string());
        };
        let url = format!("{}{}", trim_slash(base_url), self.config.repair_path);
        let response = self
            .client
            .post(url)
            .send()
            .await
            .map_err(|error| error.to_string())?;
        let status = response.status();
        let payload = response.json::<Value>().await.unwrap_or(Value::Null);
        if status.is_success() {
            Ok(payload)
        } else {
            Err(format!("repair request failed with status {status}"))
        }
    }

    async fn fetch_status(&self) -> MemoryBrainIntegrationStatus {
        let now = now_ms();
        if !self.config.enabled {
            return MemoryBrainIntegrationStatus::disabled(now);
        }
        let Some(base_url) = &self.config.base_url else {
            return MemoryBrainIntegrationStatus::not_configured(now);
        };
        if self.circuit_is_open(now) {
            let mut status = MemoryBrainIntegrationStatus::disabled(now);
            status.state = IntegrationState::Degraded;
            status.connectivity = ConnectivityState::Offline;
            status.helper.last_error = Some("circuit_open".to_string());
            return status;
        }

        let url = format!("{}/health", trim_slash(base_url));
        match self.client.get(url).send().await {
            Ok(response) if response.status().is_success() => {
                self.mark_probe_success();
                let mut status = MemoryBrainIntegrationStatus::disabled(now);
                status.state = IntegrationState::Healthy;
                status.connectivity = ConnectivityState::Online;
                status.status_source = "health_endpoint".to_string();
                status.sinks.jsonl = SinkHealth::Ok;
                status.sinks.vault = SinkHealth::Unknown;
                status.sinks.postgres = SinkHealth::Unknown;
                status.sinks.neo4j = SinkHealth::Unknown;
                let detail = self.probe_ollama_tags().await;
                self.maybe_queue_ollama_signal(&detail);
                if let Some(enabled) = detail.helper_enabled {
                    status.helper.enabled = enabled;
                }
                if let Some(model) = detail.helper_model.clone() {
                    status.helper.model = Some(model);
                }
                if let Some(error) = detail.helper_error.clone() {
                    status.helper.last_error = Some(error);
                }
                if let Some(last_ok_at) = detail.helper_last_ok_at {
                    status.helper.last_ok_at = Some(last_ok_at);
                }
                status
            }
            Ok(_) => {
                self.mark_probe_failure(now);
                let mut status = MemoryBrainIntegrationStatus::disabled(now);
                status.state = IntegrationState::Degraded;
                status.connectivity = ConnectivityState::Degraded;
                status.status_source = "health_endpoint".to_string();
                status.helper.last_error = Some("health probe failed".to_string());
                status
            }
            Err(error) => {
                self.mark_probe_failure(now);
                let mut status = MemoryBrainIntegrationStatus::disabled(now);
                status.state = IntegrationState::Degraded;
                status.connectivity = ConnectivityState::Offline;
                status.status_source = "health_endpoint".to_string();
                status.helper.last_error = Some(error.to_string());
                status
            }
        }
    }

    fn reconcile_status(&self, mut status: MemoryBrainIntegrationStatus) -> MemoryBrainIntegrationStatus {
        let observed = self.observed.read().ok().map_or_else(ObservedState::default, |value| value.clone());
        status.observed_mcp_activity = observed.has_mcp_activity;
        status.activity.recent_writes_count = observed
            .recent_writes_count
            .max(status.activity.recent_writes_count);
        status.activity.last_write_at = observed.last_write_at.or(status.activity.last_write_at);
        status.activity.last_graph_write_at = observed
            .last_graph_write_at
            .or(status.activity.last_graph_write_at);
        status.helper.enabled = observed.helper_enabled.unwrap_or(status.helper.enabled);
        status.helper.model = observed.helper_model.or(status.helper.model);
        status.helper.last_ok_at = observed.helper_last_ok_at.or(status.helper.last_ok_at);

        let is_disabled = matches!(
            status.state,
            IntegrationState::Disabled | IntegrationState::NotConfigured
        );
        if observed.has_mcp_activity && is_disabled {
            status.state = IntegrationState::Degraded;
            status.connectivity = ConnectivityState::Degraded;
            status.status_source = "mcp_observed_vs_health_mismatch".to_string();
        }

        status
    }

    fn circuit_is_open(&self, now_ms_value: i64) -> bool {
        self.circuit
            .read()
            .ok()
            .and_then(|state| state.open_until_ms)
            .is_some_and(|until| until > now_ms_value)
    }

    fn mark_probe_success(&self) {
        if let Ok(mut state) = self.circuit.write() {
            state.consecutive_failures = 0;
            state.open_until_ms = None;
        }
    }

    fn mark_probe_failure(&self, now_ms_value: i64) {
        if let Ok(mut state) = self.circuit.write() {
            state.consecutive_failures = state.consecutive_failures.saturating_add(1);
            if state.consecutive_failures >= 3 {
                state.open_until_ms = Some(now_ms_value + 30_000);
            }
        }
    }

    fn maybe_queue_ollama_signal(&self, detail: &OllamaProbeDetail) {
        if self.config.ollama_base_url.is_none() || detail.digest.is_empty() {
            return;
        }
        let prev = self.last_ollama_digest.read().ok().and_then(|g| g.clone());
        if prev.as_ref() == Some(&detail.digest) {
            return;
        }
        if let Ok(mut guard) = self.last_ollama_digest.write() {
            *guard = Some(detail.digest.clone());
        }
        let workspace = self
            .last_observed_workspace
            .read()
            .ok()
            .and_then(|value| value.clone())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "integrations".to_string());
        let envelope = build_ollama_signal_envelope(&workspace, now_ms(), detail);
        if let Ok(mut queue) = self.pending_integration_events.lock() {
            queue.push(envelope);
        }
    }

    async fn probe_ollama_tags(&self) -> OllamaProbeDetail {
        let Some(ollama_base_url) = &self.config.ollama_base_url else {
            return OllamaProbeDetail::default();
        };
        let url = format!("{}/api/tags", trim_slash(ollama_base_url));
        let response = match self.client.get(url).send().await {
            Ok(response) => response,
            Err(error) => {
                return OllamaProbeDetail {
                    digest: format!("error|{}", error),
                    helper_enabled: Some(false),
                    helper_model: None,
                    helper_error: Some(error.to_string()),
                    helper_last_ok_at: None,
                    gemma_models: Vec::new(),
                    all_models: Vec::new(),
                };
            }
        };
        if !response.status().is_success() {
            let message = format!("ollama tags probe failed: {}", response.status());
            return OllamaProbeDetail {
                digest: format!("http|{}", response.status()),
                helper_enabled: Some(false),
                helper_model: None,
                helper_error: Some(message.clone()),
                helper_last_ok_at: None,
                gemma_models: Vec::new(),
                all_models: Vec::new(),
            };
        }
        let payload = match response.json::<Value>().await {
            Ok(payload) => payload,
            Err(error) => {
                return OllamaProbeDetail {
                    digest: format!("json|{}", error),
                    helper_enabled: Some(false),
                    helper_model: None,
                    helper_error: Some(error.to_string()),
                    helper_last_ok_at: None,
                    gemma_models: Vec::new(),
                    all_models: Vec::new(),
                };
            }
        };
        let mut models: Vec<String> = Vec::new();
        if let Some(entries) = payload.get("models").and_then(Value::as_array) {
            for entry in entries {
                if let Some(name) = entry.get("name").and_then(Value::as_str) {
                    let trimmed = name.trim();
                    if !trimmed.is_empty() {
                        models.push(trimmed.to_string());
                    }
                }
            }
        }
        models.sort();
        let gemma_models: Vec<String> = models
            .iter()
            .filter(|name| name.to_ascii_lowercase().starts_with("gemma"))
            .cloned()
            .collect();
        let helper_hint = self
            .config
            .helper_model_hint
            .as_ref()
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty());
        let mut helper_enabled = None;
        let mut helper_model = None;
        let mut helper_last_ok_at = None;
        if let Some(hint) = helper_hint {
            if let Some(found) = models.iter().find(|name| name.to_lowercase() == hint) {
                helper_enabled = Some(true);
                helper_model = Some(found.clone());
                helper_last_ok_at = Some(now_ms());
            }
        }
        if helper_model.is_none() {
            if let Some(found) = models.iter().find(|name| name.to_ascii_lowercase().starts_with("gemma")) {
                helper_enabled = Some(true);
                helper_model = Some(found.clone());
                helper_last_ok_at = Some(now_ms());
            }
        }
        if helper_enabled.is_none() && helper_model.is_none() {
            helper_enabled = Some(false);
        }
        let digest = format!(
            "ok|{}|{}|{}",
            models.join(","),
            helper_model.clone().unwrap_or_default(),
            gemma_models.join(",")
        );
        OllamaProbeDetail {
            digest,
            helper_enabled,
            helper_model,
            helper_error: None,
            helper_last_ok_at,
            gemma_models,
            all_models: models,
        }
    }
}

fn build_ollama_signal_envelope(workspace_id: &str, occurred_at_ms: i64, detail: &OllamaProbeDetail) -> EventEnvelope {
    let gemma_label = if detail.gemma_models.is_empty() {
        "none".to_string()
    } else {
        detail.gemma_models.join(", ")
    };
    let text = if let Some(err) = &detail.helper_error {
        format!("Ollama / Gemma: probe failed ({err})")
    } else if !detail.gemma_models.is_empty() {
        format!(
            "Ollama reachable; Gemma models available: {gemma_label} ({} total tags)",
            detail.all_models.len()
        )
    } else {
        format!(
            "Ollama reachable; no Gemma-tagged models yet ({} local models).",
            detail.all_models.len()
        )
    };
    let primary_model = detail
        .helper_model
        .clone()
        .or_else(|| detail.gemma_models.first().cloned());
    EventEnvelope {
        runtime_source: RuntimeSource::Ollama,
        acquisition_mode: AcquisitionMode::Managed,
        event_kind: EventKind::AssistantResponse,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: "pharos-runtime-integrations".to_string(),
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
        title: "Ollama / Gemma (runtime)".to_string(),
        payload: json!({
            "display_name": "Gemma",
            "runtime_label": "Ollama",
            "runtime_source": "Ollama",
            "text": text,
            "producer": "pharos_ollama_probe",
            "gemma_models": detail.gemma_models,
            "ollama_model_count": detail.all_models.len(),
            "helper_error": detail.helper_error,
            "model": primary_model,
        }),
    }
}

fn find_string_in_payload(payload: &Value, key: &str) -> Option<String> {
    match payload {
        Value::Object(map) => {
            if let Some(value) = map.get(key).and_then(Value::as_str) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
            map.values()
                .find_map(|child| find_string_in_payload(child, key))
        }
        Value::Array(items) => items
            .iter()
            .find_map(|child| find_string_in_payload(child, key)),
        _ => None,
    }
}

fn find_bool_in_payload(payload: &Value, key: &str) -> Option<bool> {
    match payload {
        Value::Object(map) => {
            if let Some(value) = map.get(key).and_then(Value::as_bool) {
                return Some(value);
            }
            map.values()
                .find_map(|child| find_bool_in_payload(child, key))
        }
        Value::Array(items) => items
            .iter()
            .find_map(|child| find_bool_in_payload(child, key)),
        _ => None,
    }
}

fn infer_model_from_payload(payload: &Value) -> Option<String> {
    let raw = payload.to_string().to_lowercase();
    if let Some(token) = raw
        .split(|ch: char| !(ch.is_ascii_alphanumeric() || ch == ':' || ch == '-' || ch == '_'))
        .find(|token| token.starts_with("gemma"))
    {
        return Some(token.to_string());
    }
    if raw.contains("ollama") {
        return Some("ollama".to_string());
    }
    None
}

fn trim_slash(value: &str) -> &str {
    value.trim_end_matches('/')
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as i64)
}
