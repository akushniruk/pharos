use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};

use rusqlite::{Connection, OptionalExtension, params};
use thiserror::Error;

use std::collections::BTreeSet;
use std::collections::HashMap;

use crate::model::{
    AcquisitionMode, AgentRegistryEntry, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent,
    SessionSummary,
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
                event_fingerprint TEXT NOT NULL UNIQUE,
                json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS scanner_offsets (
                cursor_key TEXT PRIMARY KEY,
                offset_value INTEGER NOT NULL
            );",
        )?;

        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    pub fn insert_event(&self, event: &EventEnvelope) -> Result<bool, StoreError> {
        let runtime_source = serde_json::to_string(&event.runtime_source)?;
        let event_kind = serde_json::to_string(&event.event_kind)?;
        let json = serde_json::to_string(event)?;
        let event_fingerprint = event_fingerprint(&json);
        let connection = self.connection.lock().map_err(|_| StoreError::Poisoned)?;

        let inserted = connection.execute(
            "INSERT OR IGNORE INTO events (
                runtime_source,
                workspace_id,
                session_id,
                event_kind,
                occurred_at_ms,
                event_fingerprint,
                json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                runtime_source,
                event.session.workspace_id,
                event.session.session_id,
                event_kind,
                event.occurred_at_ms,
                event_fingerprint,
                json
            ],
        )?;

        Ok(inserted > 0)
    }

    pub fn load_scanner_offset(&self, cursor_key: &str) -> Result<i64, StoreError> {
        let connection = self.connection.lock().map_err(|_| StoreError::Poisoned)?;
        let offset = connection
            .query_row(
                "SELECT offset_value FROM scanner_offsets WHERE cursor_key = ?1",
                [cursor_key],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
            .unwrap_or(0);
        Ok(offset)
    }

    pub fn save_scanner_offset(
        &self,
        cursor_key: &str,
        offset_value: i64,
    ) -> Result<(), StoreError> {
        let connection = self.connection.lock().map_err(|_| StoreError::Poisoned)?;
        connection.execute(
            "INSERT INTO scanner_offsets (cursor_key, offset_value)
             VALUES (?1, ?2)
             ON CONFLICT(cursor_key) DO UPDATE SET offset_value = excluded.offset_value",
            params![cursor_key, offset_value],
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
        let mut entries = HashMap::<String, AgentRegistryAccumulator>::new();

        for event in events {
            let agent_id = event.agent_id.clone();
            let entry_id = build_registry_id(
                &event.session.workspace_id,
                &event.session.session_id,
                agent_id.as_deref(),
            );
            let display_name = display_name_candidate_for_event(&event);

            let accumulator =
                entries
                    .entry(entry_id.clone())
                    .or_insert_with(|| AgentRegistryAccumulator {
                        id: entry_id.clone(),
                        source_app: event.session.workspace_id.clone(),
                        session_id: event.session.session_id.clone(),
                        agent_id: agent_id.clone(),
                        display_name: display_name.value.clone(),
                        display_name_score: display_name.score,
                        agent_type: payload_string(&event.payload, "agent_type"),
                        model_name: payload_string(&event.payload, "model"),
                        parent_id: payload_string(&event.payload, "parent_agent_id"),
                        team_name: payload_string(&event.payload, "team_name"),
                        lifecycle_status: resolve_lifecycle_status(&event.event_kind).to_string(),
                        first_seen_at: event.occurred_at_ms,
                        last_seen_at: event.occurred_at_ms,
                        event_count: 0,
                    });

            accumulator.last_seen_at = accumulator.last_seen_at.max(event.occurred_at_ms);
            accumulator.first_seen_at = accumulator.first_seen_at.min(event.occurred_at_ms);
            accumulator.event_count += 1;
            accumulator.lifecycle_status = resolve_lifecycle_status(&event.event_kind).to_string();

            if display_name.score >= accumulator.display_name_score {
                accumulator.display_name = display_name.value;
                accumulator.display_name_score = display_name.score;
            }

            if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
                accumulator.agent_type = Some(agent_type);
            }
            if let Some(model_name) = payload_string(&event.payload, "model") {
                accumulator.model_name = Some(model_name);
            }
            if let Some(parent_id) = payload_string(&event.payload, "parent_agent_id") {
                accumulator.parent_id = Some(parent_id);
            }
            if let Some(team_name) = payload_string(&event.payload, "team_name") {
                accumulator.team_name = Some(team_name);
            }
        }

        let mut entries: Vec<AgentRegistryEntry> = entries
            .into_values()
            .map(AgentRegistryAccumulator::into_entry)
            .collect();
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
            if let Some(existing) = sessions
                .iter_mut()
                .find(|entry| entry.session_id == event.session_id)
            {
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
                is_active: event.hook_event_type != "SessionEnd",
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

fn event_fingerprint(json: &str) -> String {
    let mut hasher = DefaultHasher::new();
    json.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn build_registry_id(source_app: &str, session_id: &str, agent_id: Option<&str>) -> String {
    let session_prefix: String = session_id.chars().take(8).collect();
    match agent_id {
        Some(agent_id) if !agent_id.is_empty() => {
            format!("{source_app}:{session_prefix}:{agent_id}")
        }
        _ => format!("{source_app}:{session_prefix}"),
    }
}

fn resolve_lifecycle_status(event_kind: &EventKind) -> &'static str {
    match event_kind {
        EventKind::SessionEnded | EventKind::SubagentStopped => "inactive",
        _ => "active",
    }
}

struct AgentRegistryAccumulator {
    id: String,
    source_app: String,
    session_id: String,
    agent_id: Option<String>,
    display_name: String,
    display_name_score: u8,
    agent_type: Option<String>,
    model_name: Option<String>,
    parent_id: Option<String>,
    team_name: Option<String>,
    lifecycle_status: String,
    first_seen_at: i64,
    last_seen_at: i64,
    event_count: usize,
}

impl AgentRegistryAccumulator {
    fn into_entry(self) -> AgentRegistryEntry {
        AgentRegistryEntry {
            id: self.id,
            source_app: self.source_app,
            session_id: self.session_id,
            agent_id: self.agent_id,
            display_name: self.display_name,
            agent_type: self.agent_type,
            model_name: self.model_name,
            parent_id: self.parent_id,
            team_name: self.team_name,
            lifecycle_status: self.lifecycle_status,
            first_seen_at: self.first_seen_at,
            last_seen_at: self.last_seen_at,
            event_count: self.event_count,
        }
    }
}

struct DisplayNameCandidate {
    value: String,
    score: u8,
}

fn display_name_candidate_for_event(event: &EventEnvelope) -> DisplayNameCandidate {
    if let Some(responsibility) = payload_responsibility(&event.payload) {
        return DisplayNameCandidate {
            value: responsibility,
            score: 8,
        };
    }

    if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
        if let Some(mapped) = mapped_agent_type_label(&agent_type) {
            if mapped != "Session" {
                return DisplayNameCandidate {
                    value: mapped,
                    score: 7,
                };
            }
        }
    }

    if let Some(display_name) = payload_string(&event.payload, "display_name") {
        return DisplayNameCandidate {
            value: display_name,
            score: 6,
        };
    }

    if event.agent_id.is_none() {
        if let Some(title) = payload_string(&event.payload, "title") {
            return DisplayNameCandidate {
                value: title,
                score: 5,
            };
        }
    }

    if let Some(description) = payload_string(&event.payload, "description") {
        let trimmed = description.trim();
        if !trimmed.is_empty() {
            let label = match payload_string(&event.payload, "agent_type") {
                Some(agent_type)
                    if !agent_type.eq_ignore_ascii_case("main")
                        && !trimmed
                            .to_ascii_lowercase()
                            .starts_with(&agent_type.to_ascii_lowercase()) =>
                {
                    format!("{agent_type} · {trimmed}")
                }
                _ => trimmed.to_string(),
            };

            return DisplayNameCandidate {
                value: label,
                score: 4,
            };
        }
    }

    if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
        return DisplayNameCandidate {
            value: agent_name,
            score: 3,
        };
    }

    if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
        if agent_type != "main" {
            return DisplayNameCandidate {
                value: agent_type,
                score: 2,
            };
        }
    }

    if let Some(cwd) = payload_string(&event.payload, "cwd") {
        if let Some(workspace_name) = workspace_name_from_cwd(&cwd) {
            return DisplayNameCandidate {
                value: workspace_name,
                score: 1,
            };
        }
    }

    if event.agent_id.is_none() {
        DisplayNameCandidate {
            value: event.session.workspace_id.clone(),
            score: 0,
        }
    } else {
        DisplayNameCandidate {
            value: "Agent".to_string(),
            score: 0,
        }
    }
}

fn payload_responsibility(payload: &serde_json::Value) -> Option<String> {
    payload_string(payload, "responsibility")
        .or_else(|| payload_string(payload, "description"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn mapped_agent_type_label(agent_type: &str) -> Option<String> {
    let normalized = agent_type.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    let mapped = match normalized.as_str() {
        "team-reviewer" | "code-reviewer" | "reviewer" => Some("Code Reviewer"),
        "pr-review-toolkit" => Some("PR Review Toolkit"),
        "full-stack-orchestrator" => Some("Full Stack Orchestrator"),
        "general-purpose" => Some("General Purpose"),
        "orchestrator" => Some("Orchestrator"),
        "explorer" | "explore" => Some("Explorer"),
        "cursor_subagent" => Some("Cursor Helper"),
        "main" => Some("Session"),
        _ => None,
    };
    if let Some(value) = mapped {
        return Some(value.to_string());
    }
    let words = normalized
        .replace('_', "-")
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            if let Some(first) = chars.next() {
                format!("{}{}", first.to_uppercase(), chars.as_str())
            } else {
                String::new()
            }
        })
        .collect::<Vec<_>>();
    if words.is_empty() {
        None
    } else {
        Some(words.join(" "))
    }
}

fn workspace_name_from_cwd(cwd: &str) -> Option<String> {
    let trimmed = cwd.trim();
    if trimmed.is_empty() {
        return None;
    }

    std::path::Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .map(ToString::to_string)
}

fn payload_string(payload: &serde_json::Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string)
}

pub fn legacy_event_from_envelope(event: &EventEnvelope) -> Result<LegacyHookEvent, StoreError> {
    let display_name = display_name_candidate_for_event(event);
    let source_app = project_label_for_event(event);
    let mut payload = event.payload.clone();
    if let Some(object) = payload.as_object_mut() {
        object
            .entry("runtime_source".to_string())
            .or_insert_with(|| serde_json::Value::String(format!("{:?}", event.runtime_source)));
        object
            .entry("runtime_label".to_string())
            .or_insert_with(|| {
                serde_json::Value::String(runtime_source_label(&event.runtime_source).to_string())
            });
        object
            .entry("project_name".to_string())
            .or_insert_with(|| serde_json::Value::String(source_app.clone()));
        object.insert(
            "acquisition_mode".to_string(),
            serde_json::Value::String(match event.acquisition_mode {
                AcquisitionMode::Managed => "managed",
                AcquisitionMode::Observed => "observed",
            }
            .to_string()),
        );
    }

    Ok(LegacyHookEvent {
        source_app,
        session_id: event.session.session_id.clone(),
        hook_event_type: hook_event_type_for_kind(&event.event_kind).to_string(),
        payload,
        timestamp: event.occurred_at_ms,
        agent_id: event.agent_id.clone(),
        agent_type: payload_string(&event.payload, "agent_type"),
        model_name: payload_string(&event.payload, "model"),
        display_name: Some(display_name.value),
        agent_name: payload_string(&event.payload, "agent_name"),
    })
}

fn project_label_for_event(event: &EventEnvelope) -> String {
    if let Some(project_name) = payload_string(&event.payload, "project_name")
        .and_then(normalize_project_label)
    {
        return project_name;
    }

    if let Some(project_name) = normalize_project_label(event.session.workspace_id.clone()) {
        return project_name;
    }

    if let Some(cwd) = payload_string(&event.payload, "cwd") {
        if let Some(workspace_name) = workspace_name_from_cwd(&cwd) {
            if let Some(project_name) = normalize_project_label(workspace_name) {
                return project_name;
            }
        }
    }

    "unknown".to_string()
}

fn normalize_project_label(value: String) -> Option<String> {
    if let Some(workspace_hint) = normalize_workspace_hint(&value) {
        return Some(workspace_hint);
    }

    if is_project_like_name(&value) {
        return Some(value);
    }

    None
}

fn normalize_workspace_hint(value: &str) -> Option<String> {
    if !value.contains("-home_projects-") {
        return None;
    }
    let candidate = value.split('-').next_back()?.trim();
    if is_project_like_name(candidate) {
        Some(candidate.to_string())
    } else {
        None
    }
}

fn is_project_like_name(value: &str) -> bool {
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
        )
}

fn runtime_source_label(runtime_source: &crate::model::RuntimeSource) -> &'static str {
    match runtime_source {
        crate::model::RuntimeSource::ClaudeCode => "Claude",
        crate::model::RuntimeSource::CodexCli => "Codex",
        crate::model::RuntimeSource::GeminiCli => "Gemini",
        crate::model::RuntimeSource::CursorAgent => "Cursor",
        crate::model::RuntimeSource::PiCli => "Pi",
        crate::model::RuntimeSource::OpenCode => "OpenCode",
        crate::model::RuntimeSource::Aider => "Aider",
        crate::model::RuntimeSource::GenericAgentCli => "Agent CLI",
        crate::model::RuntimeSource::CustomCli => "Custom CLI",
    }
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
