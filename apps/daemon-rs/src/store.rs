use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use thiserror::Error;

use std::collections::BTreeSet;

use crate::model::{
    AgentRegistryEntry, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent, SessionSummary,
};

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("store mutex poisoned")]
    Poisoned,
}

#[derive(Clone)]
pub struct Store {
    connection: Arc<Mutex<Connection>>,
}

impl Store {
    pub fn open(path: &str) -> Result<Self, StoreError> {
        let connection = Connection::open(path)?;
        Self::init(connection)
    }

    pub fn open_in_memory() -> Result<Self, StoreError> {
        let connection = Connection::open_in_memory()?;
        Self::init(connection)
    }

    fn init(connection: Connection) -> Result<Self, StoreError> {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                runtime_source TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                event_kind TEXT NOT NULL,
                occurred_at_ms INTEGER NOT NULL,
                json TEXT NOT NULL
            );",
        )?;

        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    pub fn insert_event(&self, event: &EventEnvelope) -> Result<(), StoreError> {
        let runtime_source = serde_json::to_string(&event.runtime_source)?;
        let event_kind = serde_json::to_string(&event.event_kind)?;
        let json = serde_json::to_string(event)?;
        let connection = self.connection.lock().map_err(|_| StoreError::Poisoned)?;

        connection.execute(
            "INSERT INTO events (
                runtime_source,
                workspace_id,
                session_id,
                event_kind,
                occurred_at_ms,
                json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                runtime_source,
                event.session.workspace_id,
                event.session.session_id,
                event_kind,
                event.occurred_at_ms,
                json
            ],
        )?;

        Ok(())
    }

    pub fn list_events(&self) -> Result<Vec<EventEnvelope>, StoreError> {
        let connection = self.connection.lock().map_err(|_| StoreError::Poisoned)?;
        let mut statement =
            connection.prepare("SELECT json FROM events ORDER BY occurred_at_ms ASC, id ASC")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;

        rows.map(|row| {
            let json = row?;
            let event = serde_json::from_str::<EventEnvelope>(&json)?;
            Ok(event)
        })
        .collect()
    }

    pub fn list_agent_registry(&self) -> Result<Vec<AgentRegistryEntry>, StoreError> {
        let events = self.list_events()?;
        let mut entries: Vec<AgentRegistryEntry> = Vec::new();

        for event in events {
            let agent_id = event.agent_id.clone();
            let entry_id = build_registry_id(&event.session.workspace_id, &event.session.session_id, agent_id.as_deref());

            if let Some(existing) = entries.iter_mut().find(|entry| entry.id == entry_id) {
                existing.last_seen_at = existing.last_seen_at.max(event.occurred_at_ms);
                existing.event_count += 1;
                existing.lifecycle_status = resolve_lifecycle_status(&event.event_kind).to_string();
                continue;
            }

            entries.push(AgentRegistryEntry {
                id: entry_id,
                source_app: event.session.workspace_id.clone(),
                session_id: event.session.session_id.clone(),
                agent_id,
                display_name: display_name_for_event(&event),
                agent_type: payload_string(&event.payload, "agent_type"),
                model_name: payload_string(&event.payload, "model"),
                parent_id: None,
                team_name: payload_string(&event.payload, "team_name"),
                lifecycle_status: resolve_lifecycle_status(&event.event_kind).to_string(),
                first_seen_at: event.occurred_at_ms,
                last_seen_at: event.occurred_at_ms,
                event_count: 1,
            });
        }

        entries.sort_by(|left, right| right.last_seen_at.cmp(&left.last_seen_at));
        Ok(entries)
    }

    pub fn list_legacy_events(&self) -> Result<Vec<LegacyHookEvent>, StoreError> {
        self.list_events()?
            .into_iter()
            .map(|event| legacy_event_from_envelope(&event))
            .collect()
    }

    pub fn filter_options(&self) -> Result<FilterOptions, StoreError> {
        let events = self.list_legacy_events()?;
        let mut source_apps = BTreeSet::new();
        let mut session_ids = BTreeSet::new();
        let mut hook_event_types = BTreeSet::new();
        let mut agent_ids = BTreeSet::new();
        let mut agent_types = BTreeSet::new();

        for event in events {
            source_apps.insert(event.source_app);
            session_ids.insert(event.session_id);
            hook_event_types.insert(event.hook_event_type);

            if let Some(agent_id) = event.agent_id {
                agent_ids.insert(agent_id);
            }
            if let Some(agent_type) = event.agent_type {
                agent_types.insert(agent_type);
            }
        }

        Ok(FilterOptions {
            source_apps: source_apps.into_iter().collect(),
            session_ids: session_ids.into_iter().collect(),
            hook_event_types: hook_event_types.into_iter().collect(),
            agent_ids: agent_ids.into_iter().collect(),
            agent_types: agent_types.into_iter().collect(),
        })
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionSummary>, StoreError> {
        let events = self.list_legacy_events()?;
        let mut sessions: Vec<SessionSummary> = Vec::new();

        for event in events {
            if let Some(existing) = sessions.iter_mut().find(|entry| entry.session_id == event.session_id) {
                existing.last_event_at = existing.last_event_at.max(event.timestamp);
                existing.event_count += 1;
                if !existing.agents.contains(&existing.source_app) {
                    existing.agents.push(existing.source_app.clone());
                }
                continue;
            }

            sessions.push(SessionSummary {
                session_id: event.session_id.clone(),
                source_app: event.source_app.clone(),
                started_at: event.timestamp,
                last_event_at: event.timestamp,
                event_count: 1,
                agent_count: 1,
                agents: vec![event.source_app],
            });
        }

        sessions.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
        Ok(sessions)
    }

    pub fn session_events(&self, session_id: &str) -> Result<Vec<LegacyHookEvent>, StoreError> {
        let events = self.list_legacy_events()?;
        Ok(events
            .into_iter()
            .filter(|event| event.session_id == session_id)
            .collect())
    }
}

fn build_registry_id(source_app: &str, session_id: &str, agent_id: Option<&str>) -> String {
    let session_prefix: String = session_id.chars().take(8).collect();
    match agent_id {
        Some(agent_id) if !agent_id.is_empty() => format!("{source_app}:{session_prefix}:{agent_id}"),
        _ => format!("{source_app}:{session_prefix}"),
    }
}

fn resolve_lifecycle_status(event_kind: &EventKind) -> &'static str {
    match event_kind {
        EventKind::SessionEnded | EventKind::SubagentStopped => "inactive",
        _ => "active",
    }
}

fn display_name_for_event(event: &EventEnvelope) -> String {
    if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
        return agent_name;
    }
    if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
        if agent_type != "main" {
            return agent_type;
        }
    }
    if event.agent_id.is_none() {
        return "Orchestrator".to_string();
    }
    "Agent".to_string()
}

fn payload_string(payload: &serde_json::Value, key: &str) -> Option<String> {
    payload.get(key).and_then(serde_json::Value::as_str).map(ToString::to_string)
}

pub fn legacy_event_from_envelope(event: &EventEnvelope) -> Result<LegacyHookEvent, StoreError> {
    Ok(LegacyHookEvent {
        source_app: event.session.workspace_id.clone(),
        session_id: event.session.session_id.clone(),
        hook_event_type: hook_event_type_for_kind(&event.event_kind).to_string(),
        payload: event.payload.clone(),
        timestamp: event.occurred_at_ms,
        agent_id: event.agent_id.clone(),
        agent_type: payload_string(&event.payload, "agent_type"),
        model_name: payload_string(&event.payload, "model"),
    })
}

fn hook_event_type_for_kind(event_kind: &EventKind) -> &'static str {
    match event_kind {
        EventKind::SessionStarted => "SessionStart",
        EventKind::SessionEnded => "SessionEnd",
        EventKind::UserPromptSubmitted => "UserPromptSubmit",
        EventKind::ToolCallStarted => "PreToolUse",
        EventKind::ToolCallCompleted => "PostToolUse",
        EventKind::ToolCallFailed => "PostToolUseFailure",
        EventKind::SubagentStarted => "SubagentStart",
        EventKind::SubagentStopped => "SubagentStop",
        EventKind::SessionTitleChanged => "SessionTitleChanged",
        EventKind::AssistantResponse => "AssistantResponse",
    }
}
