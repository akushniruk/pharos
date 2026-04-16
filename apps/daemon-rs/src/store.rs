use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};

use rusqlite::{Connection, OptionalExtension, params};
use thiserror::Error;

use std::collections::BTreeSet;
use std::collections::HashMap;

use crate::agent_identity::{control_plane_agent_label, infer_agent_role, payload_parent_agent_id};
use crate::model::{
    AcquisitionMode, AgentRegistryEntry, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent,
    RuntimeSource, SessionSummary,
};

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("domain validation error: {0}")]
    Domain(#[from] crate::model::DomainError),
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
        event.validate()?;
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
                        parent_id: payload_parent_agent_id(&event.payload),
                        team_name: payload_string(&event.payload, "team_name"),
                        lifecycle_status: resolve_lifecycle_status(&event.event_kind).to_string(),
                        first_seen_at: event.occurred_at_ms,
                        last_seen_at: event.occurred_at_ms,
                        event_count: 0,
                        tool_counts: HashMap::new(),
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
            if let Some(parent_id) = payload_parent_agent_id(&event.payload) {
                accumulator.parent_id = Some(parent_id);
            }
            if let Some(team_name) = payload_string(&event.payload, "team_name") {
                accumulator.team_name = Some(team_name);
            }

            if event.event_kind == EventKind::ToolCallStarted {
                if let Some(tool_name) = payload_string(&event.payload, "tool_name") {
                    *accumulator.tool_counts.entry(tool_name).or_insert(0) += 1;
                }
            }

            if accumulator.agent_type.is_none() && accumulator.parent_id.is_some() {
                accumulator.agent_type = infer_agent_role(&accumulator.tool_counts);
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
        EventKind::SessionEnded | EventKind::SubagentStopped => "stopped",
        EventKind::ToolCallFailed => "error",
        EventKind::AssistantResponse
        | EventKind::ToolCallCompleted
        | EventKind::SessionTitleChanged => "idle",
        EventKind::ToolCallStarted
        | EventKind::UserPromptSubmitted
        | EventKind::SubagentStarted
        | EventKind::SessionStarted => "active",
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
    tool_counts: HashMap<String, usize>,
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

fn integration_probe_row_label(event: &EventEnvelope) -> Option<String> {
    let producer = payload_string(&event.payload, "producer")?;
    if producer != "pharos_ollama_probe" {
        return None;
    }
    if let Some(model) = payload_string(&event.payload, "model") {
        let lower = model.to_ascii_lowercase();
        if lower.contains("gemma") {
            let compact = model.replace(':', " ").trim().to_string();
            let short = if compact.len() > 22 {
                format!("{}…", compact.chars().take(21).collect::<String>())
            } else {
                compact
            };
            return Some(format!("Gemma · {short}"));
        }
    }
    Some("Ollama".to_string())
}

fn ollama_runtime_row_label(event: &EventEnvelope) -> Option<String> {
    if event.runtime_source != RuntimeSource::Ollama {
        return None;
    }
    // Memory-brain Ollama probe uses `pharos_ollama_probe` + `model`; keep that path in `integration_probe_row_label`.
    if payload_string(&event.payload, "producer").as_deref() == Some("pharos_ollama_probe") {
        return None;
    }
    if let Some(arr) = event.payload.get("running_models").and_then(|v| v.as_array()) {
        for v in arr {
            if let Some(s) = v.as_str() {
                let lower = s.to_ascii_lowercase();
                if lower.contains("gemma") {
                    let compact = s.replace(':', " ").trim().to_string();
                    let short = if compact.len() > 22 {
                        format!("{}…", compact.chars().take(21).collect::<String>())
                    } else {
                        compact
                    };
                    return Some(format!("Gemma · {short}"));
                }
            }
        }
    }
    Some("Ollama".to_string())
}

fn cursor_runtime_row_label(event: &EventEnvelope) -> Option<String> {
    if event.runtime_source != RuntimeSource::CursorAgent {
        return None;
    }
    match event.event_kind {
        EventKind::AssistantResponse => Some("Team".to_string()),
        EventKind::ToolCallStarted | EventKind::ToolCallCompleted | EventKind::ToolCallFailed => {
            cursor_tool_identity_label(&event.payload)
        }
        _ => None,
    }
}

fn cursor_tool_identity_label(payload: &serde_json::Value) -> Option<String> {
    let tool_input = payload.get("tool_input").cloned().unwrap_or(serde_json::json!({}));
    if let Some(agent_type) = tool_input
        .get("subagent_type")
        .and_then(serde_json::Value::as_str)
        .or_else(|| tool_input.get("agent_type").and_then(serde_json::Value::as_str))
    {
        if let Some(mapped) = mapped_agent_type_label(agent_type) {
            if mapped != "Session" {
                return Some(mapped);
            }
        }
    }

    let tool = payload
        .get("tool_name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();

    if tool == "callmcptool" {
        let (server, mcp_tool) = crate::cursor_callmcp::extract_server_tool(&tool_input);
        if server.contains("librarian") {
            return Some("Librarian".to_string());
        }
        if server.contains("memory") || mcp_tool.starts_with("memory_") {
            return Some("Memory brain".to_string());
        }
        if mcp_tool.contains("svelte")
            || server.contains("svelte")
            || tool_input.to_string().to_ascii_lowercase().contains("svelte")
        {
            return Some("Svelte Editor".to_string());
        }
        if mcp_tool.contains("explorer") || server.contains("explorer") {
            return Some("Explorer".to_string());
        }
        if !mcp_tool.is_empty() {
            return Some(format!("MCP · {mcp_tool}"));
        }
    }

    let args_blob = tool_input
        .get("arguments")
        .map(|v| v.to_string())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if args_blob.contains("svelte") || args_blob.contains("landing-svelte") {
        return Some("Svelte Editor".to_string());
    }

    match tool.as_str() {
        "codebase_search"
        | "semantic_search"
        | "folder_search"
        | "list_dir"
        | "glob_file_search"
        | "file_search"
        | "web_search"
        | "glob" => Some("Explorer".to_string()),
        "read_file" | "readfile" | "open_file" | "read" => Some("File read".to_string()),
        "grep" | "ripgrep" | "rg" => Some("Search".to_string()),
        "run_terminal_cmd" | "run_command" | "terminal" => Some("Shell".to_string()),
        "search_replace"
        | "write"
        | "edit"
        | "apply_patch"
        | "str_replace"
        | "strreplace"
        | "multiedit"
        | "single_edit" => Some("Editor".to_string()),
        "todowrite" | "todo_write" | "plan" => Some("Planner".to_string()),
        _ => None,
    }
    .or_else(|| {
        if tool.contains("replace") || tool.contains("write") || tool.contains("patch") {
            return Some("Editor".to_string());
        }
        if tool.starts_with("read") {
            return Some("File read".to_string());
        }
        if tool.contains("glob") {
            return Some("Explorer".to_string());
        }
        None
    })
}

fn display_name_candidate_for_event(event: &EventEnvelope) -> DisplayNameCandidate {
    if let Some(label) = control_plane_agent_label(&event.payload) {
        return DisplayNameCandidate {
            value: label,
            score: 15,
        };
    }

    if let Some(label) = ollama_runtime_row_label(event) {
        return DisplayNameCandidate {
            value: label,
            score: 14,
        };
    }

    if let Some(label) = integration_probe_row_label(event) {
        return DisplayNameCandidate {
            value: label,
            score: 13,
        };
    }

    if let Some(label) = cursor_runtime_row_label(event) {
        return DisplayNameCandidate {
            value: label,
            score: 12,
        };
    }

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
        "team-reviewer" | "code-reviewer" => Some("Code Reviewer"),
        "reviewer" => Some("Reviewer"),
        "architect" => Some("Architect"),
        "coder" => Some("Coder"),
        "security-architect" => Some("Security Architect"),
        "researcher" => Some("Researcher"),
        "optimizer" => Some("Optimizer"),
        "documenter" => Some("Documenter"),
        "queen-coordinator" => Some("Queen Coordinator"),
        "memory-specialist" => Some("Memory Specialist"),
        "perf-engineer" => Some("Perf Engineer"),
        "pr-review-toolkit" => Some("PR Review Toolkit"),
        "full-stack-orchestrator" => Some("Full Stack Orchestrator"),
        "general-purpose" => Some("General Purpose"),
        "orchestrator" => Some("Orchestrator"),
        "explorer" | "explore" => Some("Explorer"),
        "svelte-file-editor" | "svelte_file_editor" => Some("Svelte Editor"),
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
        crate::model::RuntimeSource::Ollama => "Ollama",
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

#[cfg(test)]
mod cursor_identity_tests {
    use serde_json::json;

    use crate::model::{
        AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
    };

    use super::legacy_event_from_envelope;

    fn observed_capabilities() -> CapabilitySet {
        CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        }
    }

    #[test]
    fn cursor_assistant_uses_team_label_not_workspace() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::AssistantResponse,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 1,
            capabilities: observed_capabilities(),
            title: "assistant response".to_string(),
            payload: json!({ "text": "hi", "model": "cursor-agent" }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Team"));
    }

    #[test]
    fn cursor_callmcptool_memory_uses_memory_brain_label() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::ToolCallStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 2,
            capabilities: observed_capabilities(),
            title: "tool call started: CallMcpTool".to_string(),
            payload: json!({
                "tool_name": "CallMcpTool",
                "tool_input": {
                    "server": "user-ai-memory-brain",
                    "toolName": "memory_add"
                }
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Memory brain"));
    }

    #[test]
    fn cursor_callmcptool_snake_case_tool_name_maps_memory_brain() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::ToolCallStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 2,
            capabilities: observed_capabilities(),
            title: "tool call started: CallMcpTool".to_string(),
            payload: json!({
                "tool_name": "CallMcpTool",
                "tool_input": {
                    "server": "user-ai-memory-brain",
                    "tool_name": "memory_add"
                }
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Memory brain"));
    }

    #[test]
    fn cursor_callmcptool_librarian_server_maps_librarian_label() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::ToolCallStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 2,
            capabilities: observed_capabilities(),
            title: "tool call started: CallMcpTool".to_string(),
            payload: json!({
                "tool_name": "CallMcpTool",
                "tool_input": {
                    "server": "user-librarian",
                    "toolName": "memory_add"
                }
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Librarian"));
    }

    #[test]
    fn cursor_codebase_search_uses_explorer_label() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::ToolCallStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 3,
            capabilities: observed_capabilities(),
            title: "tool call started: codebase_search".to_string(),
            payload: json!({
                "tool_name": "codebase_search",
                "tool_input": { "query": "auth" }
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Explorer"));
    }

    #[test]
    fn cursor_strreplace_maps_to_editor() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::CursorAgent,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::ToolCallStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "s1".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 4,
            capabilities: observed_capabilities(),
            title: "tool call started: StrReplace".to_string(),
            payload: json!({
                "tool_name": "StrReplace",
                "tool_input": { "path": "x.md" }
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(legacy.display_name.as_deref(), Some("Editor"));
    }

    #[test]
    fn ollama_scanner_running_models_labels_gemma_row() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::Ollama,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::AssistantResponse,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "integrations".to_string(),
                session_id: "ollama-ps".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 6,
            capabilities: observed_capabilities(),
            title: "ollama ps".to_string(),
            payload: json!({
                "producer": "pharos_ollama_scanner",
                "running_models": ["gemma3:4b"],
                "runtime_label": "Ollama",
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(
            legacy.display_name.as_deref(),
            Some("Gemma · gemma3 4b")
        );
    }

    #[test]
    fn ollama_probe_event_labels_gemma_row() {
        let event = EventEnvelope {
            runtime_source: RuntimeSource::Ollama,
            acquisition_mode: AcquisitionMode::Managed,
            event_kind: EventKind::AssistantResponse,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: "pharos".to_string(),
                session_id: "pharos-runtime-integrations".to_string(),
            },
            agent_id: None,
            occurred_at_ms: 5,
            capabilities: observed_capabilities(),
            title: "Ollama / Gemma (runtime)".to_string(),
            payload: json!({
                "producer": "pharos_ollama_probe",
                "display_name": "Gemma",
                "runtime_label": "Ollama",
                "text": "probe ok",
                "model": "gemma4:e2b"
            }),
        };
        let legacy = legacy_event_from_envelope(&event).expect("legacy");
        assert_eq!(
            legacy.display_name.as_deref(),
            Some("Gemma · gemma4 e2b")
        );
    }
}
