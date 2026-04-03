use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};

use crate::model::{
    AgentRegistryEntry, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent, SessionSummary,
};
use crate::store::{legacy_event_from_envelope, Store, StoreError};

#[derive(Clone, Default)]
pub struct LiveState {
    inner: Arc<Mutex<LiveStateData>>,
}

#[derive(Default)]
struct LiveStateData {
    events: Vec<LegacyHookEvent>,
    session_events: HashMap<String, Vec<LegacyHookEvent>>,
    registry: HashMap<String, RegistryState>,
    sessions: HashMap<String, SessionState>,
    source_apps: BTreeSet<String>,
    session_ids: BTreeSet<String>,
    hook_event_types: BTreeSet<String>,
    agent_ids: BTreeSet<String>,
    agent_types: BTreeSet<String>,
}

#[derive(Clone)]
struct RegistryState {
    entry: AgentRegistryEntry,
    display_name_score: u8,
}

#[derive(Clone)]
struct SessionState {
    summary: SessionSummary,
    seen_agents: BTreeSet<String>,
}

impl LiveState {
    pub fn bootstrap(store: &Store) -> Result<Self, StoreError> {
        let state = Self::default();
        let events = store.list_events()?;
        for event in events {
            state.record_envelope(&event)?;
        }
        Ok(state)
    }

    pub fn record_envelope(&self, event: &EventEnvelope) -> Result<LegacyHookEvent, StoreError> {
        let compat_event = legacy_event_from_envelope(event)?;
        let mut inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        inner.apply_legacy_event(compat_event.clone());
        Ok(compat_event)
    }

    pub fn list_legacy_events(&self) -> Result<Vec<LegacyHookEvent>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(inner.events.clone())
    }

    pub fn list_agent_registry(&self) -> Result<Vec<AgentRegistryEntry>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        let mut entries: Vec<_> = inner
            .registry
            .values()
            .map(|state| state.entry.clone())
            .collect();
        entries.sort_by(|left, right| right.last_seen_at.cmp(&left.last_seen_at));
        Ok(entries)
    }

    pub fn filter_options(&self) -> Result<FilterOptions, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(FilterOptions {
            source_apps: inner.source_apps.iter().cloned().collect(),
            session_ids: inner.session_ids.iter().cloned().collect(),
            hook_event_types: inner.hook_event_types.iter().cloned().collect(),
            agent_ids: inner.agent_ids.iter().cloned().collect(),
            agent_types: inner.agent_types.iter().cloned().collect(),
        })
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionSummary>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        let mut sessions: Vec<_> = inner
            .sessions
            .values()
            .map(|state| state.summary.clone())
            .collect();
        sessions.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
        Ok(sessions)
    }

    pub fn session_events(&self, session_id: &str) -> Result<Vec<LegacyHookEvent>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(inner
            .session_events
            .get(session_id)
            .cloned()
            .unwrap_or_default())
    }
}

impl LiveStateData {
    fn apply_legacy_event(&mut self, event: LegacyHookEvent) {
        self.source_apps.insert(event.source_app.clone());
        self.session_ids.insert(event.session_id.clone());
        self.hook_event_types.insert(event.hook_event_type.clone());
        if let Some(agent_id) = &event.agent_id {
            self.agent_ids.insert(agent_id.clone());
        }
        if let Some(agent_type) = &event.agent_type {
            self.agent_types.insert(agent_type.clone());
        }

        self.events.push(event.clone());
        self.session_events
            .entry(event.session_id.clone())
            .or_default()
            .push(event.clone());
        self.update_registry(&event);
        self.update_session_summary(&event);
    }

    fn update_registry(&mut self, event: &LegacyHookEvent) {
        let agent_id = event.agent_id.clone();
        let entry_id = build_registry_id(
            &event.source_app,
            &event.session_id,
            agent_id.as_deref(),
        );
        let display_name = display_name_candidate_for_legacy_event(event);

        let state = self.registry.entry(entry_id.clone()).or_insert_with(|| RegistryState {
            entry: AgentRegistryEntry {
                id: entry_id,
                source_app: event.source_app.clone(),
                session_id: event.session_id.clone(),
                agent_id: agent_id.clone(),
                display_name: display_name.value.clone(),
                agent_type: event.agent_type.clone(),
                model_name: event.model_name.clone(),
                parent_id: payload_string(&event.payload, "parent_agent_id"),
                team_name: payload_string(&event.payload, "team_name"),
                lifecycle_status: resolve_lifecycle_status(&event.hook_event_type).to_string(),
                first_seen_at: event.timestamp,
                last_seen_at: event.timestamp,
                event_count: 0,
            },
            display_name_score: display_name.score,
        });

        state.entry.last_seen_at = state.entry.last_seen_at.max(event.timestamp);
        state.entry.first_seen_at = state.entry.first_seen_at.min(event.timestamp);
        state.entry.event_count += 1;
        state.entry.lifecycle_status = resolve_lifecycle_status(&event.hook_event_type).to_string();

        if display_name.score >= state.display_name_score {
            state.entry.display_name = display_name.value;
            state.display_name_score = display_name.score;
        }
        if let Some(agent_type) = &event.agent_type {
            state.entry.agent_type = Some(agent_type.clone());
        }
        if let Some(model_name) = &event.model_name {
            state.entry.model_name = Some(model_name.clone());
        }
        if let Some(parent_id) = payload_string(&event.payload, "parent_agent_id") {
            state.entry.parent_id = Some(parent_id);
        }
        if let Some(team_name) = payload_string(&event.payload, "team_name") {
            state.entry.team_name = Some(team_name);
        }
    }

    fn update_session_summary(&mut self, event: &LegacyHookEvent) {
        let state = self
            .sessions
            .entry(event.session_id.clone())
            .or_insert_with(|| SessionState {
                summary: SessionSummary {
                    session_id: event.session_id.clone(),
                    source_app: event.source_app.clone(),
                    started_at: event.timestamp,
                    last_event_at: event.timestamp,
                    event_count: 0,
                    agent_count: 0,
                    agents: Vec::new(),
                },
                seen_agents: BTreeSet::new(),
            });

        state.summary.last_event_at = state.summary.last_event_at.max(event.timestamp);
        state.summary.started_at = state.summary.started_at.min(event.timestamp);
        state.summary.event_count += 1;

        let agent_key = event
            .agent_id
            .clone()
            .unwrap_or_else(|| event.source_app.clone());
        if state.seen_agents.insert(agent_key) {
            state.summary.agent_count = state.seen_agents.len();
        }
        if !state.summary.agents.contains(&event.source_app) {
            state.summary.agents.push(event.source_app.clone());
        }
    }
}

struct DisplayNameCandidate {
    value: String,
    score: u8,
}

fn display_name_candidate_for_legacy_event(event: &LegacyHookEvent) -> DisplayNameCandidate {
    if let Some(display_name) = &event.display_name {
        return DisplayNameCandidate {
            value: display_name.clone(),
            score: 7,
        };
    }
    if let Some(display_name) = payload_string(&event.payload, "display_name") {
        return DisplayNameCandidate {
            value: display_name,
            score: 6,
        };
    }
    if let Some(description) = payload_string(&event.payload, "description") {
        let trimmed = description.trim();
        if !trimmed.is_empty() {
            return DisplayNameCandidate {
                value: trimmed.to_string(),
                score: 5,
            };
        }
    }
    if let Some(agent_name) = &event.agent_name {
        return DisplayNameCandidate {
            value: agent_name.clone(),
            score: 4,
        };
    }
    if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
        return DisplayNameCandidate {
            value: agent_name,
            score: 3,
        };
    }
    if let Some(title) = payload_string(&event.payload, "title") {
        return DisplayNameCandidate {
            value: title,
            score: 2,
        };
    }
    if event.agent_id.is_none() {
        return DisplayNameCandidate {
            value: event.source_app.clone(),
            score: 1,
        };
    }
    DisplayNameCandidate {
        value: "Agent".to_string(),
        score: 0,
    }
}

fn build_registry_id(source_app: &str, session_id: &str, agent_id: Option<&str>) -> String {
    let session_prefix: String = session_id.chars().take(8).collect();
    match agent_id {
        Some(agent_id) if !agent_id.is_empty() => format!("{source_app}:{session_prefix}:{agent_id}"),
        _ => format!("{source_app}:{session_prefix}"),
    }
}

fn resolve_lifecycle_status(hook_event_type: &str) -> &'static str {
    match hook_event_type {
        "SessionEnd" | "SubagentStop" => "inactive",
        _ => "active",
    }
}

fn payload_string(payload: &serde_json::Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string)
}

pub fn should_broadcast_registry(event_kind: &EventKind) -> bool {
    matches!(
        event_kind,
        EventKind::SessionStarted
            | EventKind::SessionEnded
            | EventKind::SubagentStarted
            | EventKind::SubagentStopped
            | EventKind::SessionTitleChanged
    )
}
