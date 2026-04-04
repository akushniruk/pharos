use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};

use crate::model::{
    AgentRegistryEntry, AgentSnapshot, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent,
    ProjectSnapshot, SessionSnapshot, SessionSummary,
};
use crate::store::{Store, StoreError, legacy_event_from_envelope};

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

    pub fn list_projects(&self) -> Result<Vec<ProjectSnapshot>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(inner.build_projects())
    }

    pub fn project(&self, project_name: &str) -> Result<Option<ProjectSnapshot>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(inner
            .build_projects()
            .into_iter()
            .find(|project| project.name == project_name))
    }

    pub fn session_snapshot(
        &self,
        session_id: &str,
    ) -> Result<Option<SessionSnapshot>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        Ok(inner.build_session_snapshot(session_id))
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

    fn build_projects(&self) -> Vec<ProjectSnapshot> {
        let mut grouped = HashMap::<String, Vec<&SessionState>>::new();
        for session in self.sessions.values() {
            grouped
                .entry(session.summary.source_app.clone())
                .or_default()
                .push(session);
        }

        let mut projects = Vec::new();
        for (name, sessions) in grouped {
            let mut runtime_labels = BTreeSet::new();
            let mut session_snaps = Vec::new();
            let mut project_event_count = 0_usize;
            let mut project_agent_count = 0_usize;
            let mut active_session_count = 0_usize;
            let mut last_event_at = 0_i64;

            for session in sessions {
                project_event_count += session.summary.event_count;
                project_agent_count += session.summary.agent_count;
                last_event_at = last_event_at.max(session.summary.last_event_at);

                if let Some(snapshot) = self.build_session_snapshot(&session.summary.session_id) {
                    if let Some(label) = &snapshot.runtime_label {
                        runtime_labels.insert(label.clone());
                    }
                    if snapshot.is_active {
                        active_session_count += 1;
                    }
                    session_snaps.push(snapshot);
                }
            }

            session_snaps.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
            let summary =
                resolve_project_summary(&session_snaps, &runtime_labels, active_session_count);
            projects.push(ProjectSnapshot {
                name,
                runtime_labels: runtime_labels.into_iter().collect(),
                sessions: session_snaps,
                summary,
                event_count: project_event_count,
                agent_count: project_agent_count,
                active_session_count,
                last_event_at,
                is_active: active_session_count > 0,
            });
        }

        projects.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
        projects
    }

    fn build_session_snapshot(&self, session_id: &str) -> Option<SessionSnapshot> {
        let session = self.sessions.get(session_id)?;
        let events = self
            .session_events
            .get(session_id)
            .cloned()
            .unwrap_or_default();
        let is_active = session.summary.is_active;
        let agents = self.build_agents(&events, is_active);
        let active_agent_count = agents.iter().filter(|agent| agent.is_active).count();
        let runtime_label = resolve_runtime_label(&events);

        Some(SessionSnapshot {
            session_id: session.summary.session_id.clone(),
            label: resolve_session_label(&events, &session.summary.source_app),
            runtime_label,
            summary: resolve_session_summary(&events, &agents),
            current_action: resolve_current_action(&events),
            event_count: session.summary.event_count,
            agents,
            active_agent_count,
            last_event_at: session.summary.last_event_at,
            is_active,
        })
    }

    fn build_agents(
        &self,
        events: &[LegacyHookEvent],
        session_is_active: bool,
    ) -> Vec<AgentSnapshot> {
        let mut grouped = HashMap::<String, Vec<&LegacyHookEvent>>::new();
        for event in events {
            let key = event
                .agent_id
                .clone()
                .unwrap_or_else(|| "__main__".to_string());
            grouped.entry(key).or_default().push(event);
        }

        let mut agents = Vec::new();
        for (agent_key, grouped_events) in grouped {
            let latest_at = grouped_events
                .iter()
                .map(|event| event.timestamp)
                .max()
                .unwrap_or(0);
            let sample = grouped_events[0];
            let runtime_label = grouped_events
                .iter()
                .find_map(|event| payload_string(&event.payload, "runtime_label"));
            agents.push(AgentSnapshot {
                agent_id: if agent_key == "__main__" {
                    None
                } else {
                    Some(agent_key.clone())
                },
                display_name: resolve_agent_name(&grouped_events, agent_key == "__main__"),
                runtime_label,
                assignment: resolve_assignment(&grouped_events),
                current_action: resolve_current_action_from_refs(&grouped_events),
                agent_type: sample.agent_type.clone(),
                model_name: sample.model_name.clone(),
                event_count: grouped_events.len(),
                last_event_at: latest_at,
                is_active: session_is_active
                    && resolve_agent_active(
                        &sample.session_id,
                        if agent_key == "__main__" {
                            None
                        } else {
                            Some(&agent_key)
                        },
                        &self.registry,
                    ),
                parent_id: grouped_events
                    .iter()
                    .find_map(|event| payload_string(&event.payload, "parent_agent_id")),
            });
        }

        agents.sort_by(|left, right| right.event_count.cmp(&left.event_count));
        agents
    }

    fn update_registry(&mut self, event: &LegacyHookEvent) {
        let agent_id = event.agent_id.clone();
        let entry_id = build_registry_id(&event.source_app, &event.session_id, agent_id.as_deref());
        let display_name = display_name_candidate_for_legacy_event(event);

        let state = self
            .registry
            .entry(entry_id.clone())
            .or_insert_with(|| RegistryState {
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
                    is_active: resolve_lifecycle_status(&event.hook_event_type) == "active",
                },
                seen_agents: BTreeSet::new(),
            });

        if should_upgrade_project_label(&state.summary.source_app, &event.source_app) {
            state.summary.source_app = event.source_app.clone();
        }

        state.summary.last_event_at = state.summary.last_event_at.max(event.timestamp);
        state.summary.started_at = state.summary.started_at.min(event.timestamp);
        state.summary.event_count += 1;
        state.summary.is_active = resolve_lifecycle_status(&event.hook_event_type) == "active";

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

fn should_upgrade_project_label(current: &str, candidate: &str) -> bool {
    let current_is_project = is_project_like_name(current);
    let candidate_is_project = is_project_like_name(candidate);

    candidate_is_project && (!current_is_project || current.eq_ignore_ascii_case("unknown"))
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
                | "workbench"
                | "app"
                | "out"
        )
}

fn resolve_agent_active(
    session_id: &str,
    agent_id: Option<&str>,
    registry: &HashMap<String, RegistryState>,
) -> bool {
    registry.values().any(|state| {
        state.entry.session_id == session_id
            && state.entry.agent_id.as_deref() == agent_id
            && state.entry.lifecycle_status == "active"
    })
}

fn resolve_runtime_label(events: &[LegacyHookEvent]) -> Option<String> {
    events
        .iter()
        .find_map(|event| payload_string(&event.payload, "runtime_label"))
}

fn resolve_agent_name(events: &[&LegacyHookEvent], is_main: bool) -> String {
    for event in events {
        if let Some(display_name) = &event.display_name {
            return display_name.clone();
        }
        if let Some(agent_name) = &event.agent_name {
            return agent_name.clone();
        }
        if let Some(display_name) = payload_string(&event.payload, "display_name") {
            return display_name;
        }
        if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
            return agent_name;
        }
        if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
            if agent_type != "main" {
                return agent_type;
            }
        }
        if is_main {
            if let Some(title) = payload_string(&event.payload, "title") {
                return title;
            }
            if let Some(description) = payload_string(&event.payload, "description") {
                return description;
            }
            if let Some(cwd) = payload_string(&event.payload, "cwd") {
                if let Some(workspace) = workspace_name_from_cwd(&cwd) {
                    return workspace;
                }
            }
        }
    }
    if is_main {
        "Session".to_string()
    } else {
        "Agent".to_string()
    }
}

fn resolve_session_label(events: &[LegacyHookEvent], workspace_name: &str) -> String {
    if let Some(title) = events
        .iter()
        .find(|event| event.hook_event_type == "SessionTitleChanged")
        .and_then(|event| payload_string(&event.payload, "title"))
    {
        return title;
    }

    let main_events: Vec<_> = events
        .iter()
        .filter(|event| event.agent_id.is_none())
        .collect();
    let main_name = resolve_agent_name(&main_events, true);
    if main_name != "Session" && main_name != "Agent" {
        return main_name;
    }
    workspace_name.to_string()
}

fn resolve_assignment(events: &[&LegacyHookEvent]) -> Option<String> {
    let subagent = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "SubagentStart")
        .and_then(|event| payload_string(&event.payload, "description"));
    if let Some(description) = subagent.filter(|value| !value.trim().is_empty()) {
        return Some(truncate(&description, 100));
    }

    let delegated = events
        .iter()
        .rev()
        .find(|event| {
            event.hook_event_type == "PreToolUse"
                && payload_string(&event.payload, "tool_name").as_deref() == Some("Agent")
        })
        .and_then(|event| {
            event
                .payload
                .get("tool_input")
                .and_then(|value| value.get("description"))
                .and_then(serde_json::Value::as_str)
                .map(ToString::to_string)
        });
    if let Some(description) = delegated.filter(|value| !value.trim().is_empty()) {
        return Some(truncate(&description, 100));
    }

    let prompt = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "UserPromptSubmit")
        .and_then(|event| {
            payload_string(&event.payload, "prompt")
                .or_else(|| payload_string(&event.payload, "message"))
        });
    prompt.map(|value| truncate(&value, 100))
}

fn resolve_current_action(events: &[LegacyHookEvent]) -> Option<String> {
    let refs: Vec<_> = events.iter().collect();
    resolve_current_action_from_refs(&refs)
}

fn resolve_current_action_from_refs(events: &[&LegacyHookEvent]) -> Option<String> {
    let latest = events.iter().rev().find(|event| {
        !matches!(
            event.hook_event_type.as_str(),
            "SessionStart" | "SessionEnd" | "SessionTitleChanged"
        )
    })?;
    if latest.hook_event_type == "SubagentStart" {
        return None;
    }
    Some(describe_legacy_event(latest))
}

fn resolve_session_summary(events: &[LegacyHookEvent], agents: &[AgentSnapshot]) -> Option<String> {
    let active_workers: Vec<_> = agents
        .iter()
        .filter(|agent| agent.agent_id.is_some() && agent.is_active)
        .filter_map(summarize_agent)
        .take(2)
        .collect();
    if !active_workers.is_empty() {
        return Some(active_workers.join(" · "));
    }

    let recent_workers: Vec<_> = agents
        .iter()
        .filter(|agent| agent.agent_id.is_some())
        .filter_map(summarize_agent)
        .take(2)
        .collect();
    if !recent_workers.is_empty() {
        return Some(recent_workers.join(" · "));
    }

    if let Some(summary) = latest_useful_event_summary(events) {
        return Some(summary);
    }

    let refs: Vec<_> = events.iter().collect();
    resolve_assignment(&refs)
        .or_else(|| resolve_current_action(events))
        .or_else(|| active_runtime_summary(events))
}

fn resolve_project_summary(
    sessions: &[SessionSnapshot],
    runtime_labels: &BTreeSet<String>,
    active_session_count: usize,
) -> Option<String> {
    if let Some(summary) = sessions
        .iter()
        .find(|session| session.is_active)
        .and_then(|session| session.summary.clone())
    {
        return Some(summary);
    }
    if let Some(summary) = sessions.iter().find_map(|session| session.summary.clone()) {
        return Some(summary);
    }
    if active_session_count > 0 && !runtime_labels.is_empty() {
        return Some(format!(
            "{} active",
            runtime_labels
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if !runtime_labels.is_empty() {
        return Some(
            runtime_labels
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join(", "),
        );
    }
    None
}

fn summarize_agent(agent: &AgentSnapshot) -> Option<String> {
    let action = agent
        .current_action
        .as_ref()
        .filter(|action| Some((*action).clone()) != agent.assignment)
        .cloned()
        .or_else(|| agent.assignment.clone());
    match action {
        Some(action) => Some(format!("{}: {}", agent.display_name, truncate(&action, 72))),
        None => Some(agent.display_name.clone()),
    }
}

fn latest_useful_event_summary(events: &[LegacyHookEvent]) -> Option<String> {
    events
        .iter()
        .rev()
        .find_map(|event| match event.hook_event_type.as_str() {
            "AssistantResponse" => payload_string(&event.payload, "text")
                .map(|text| format!("Responded: {}", truncate(&text, 96))),
            "PostToolUse" | "PostToolUseFailure" => {
                let tool_name = payload_string(&event.payload, "tool_name")
                    .unwrap_or_else(|| "tool".to_string());
                let preview = payload_string(&event.payload, "content")
                    .and_then(|content| content_preview(&content));
                match (event.hook_event_type.as_str(), preview) {
                    ("PostToolUse", Some(content)) => {
                        if tool_name == "exec_command" {
                            Some(format!("Command completed: {}", truncate(&content, 96)))
                        } else {
                            Some(format!("{tool_name} completed: {}", truncate(&content, 96)))
                        }
                    }
                    ("PostToolUseFailure", Some(content)) => {
                        Some(format!("{tool_name} failed: {}", truncate(&content, 96)))
                    }
                    ("PostToolUse", None) => Some(format!("{tool_name} completed")),
                    ("PostToolUseFailure", None) => Some(format!("{tool_name} failed")),
                    _ => None,
                }
            }
            "UserPromptSubmit" => payload_string(&event.payload, "prompt")
                .or_else(|| payload_string(&event.payload, "message"))
                .map(|prompt| format!("Prompted: {}", truncate(&prompt, 96))),
            _ => None,
        })
}

fn active_runtime_summary(events: &[LegacyHookEvent]) -> Option<String> {
    let latest = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "SessionStart")?;
    let runtime = payload_string(&latest.payload, "runtime_label")
        .or_else(|| payload_string(&latest.payload, "runtime_source"))
        .unwrap_or_else(|| "Agent".to_string());
    let cwd =
        payload_string(&latest.payload, "cwd").and_then(|value| workspace_name_from_cwd(&value));
    match cwd {
        Some(workspace) => Some(format!("{runtime} active in {workspace}")),
        None => Some(format!("{runtime} active")),
    }
}

fn describe_legacy_event(event: &LegacyHookEvent) -> String {
    let tool_name =
        payload_string(&event.payload, "tool_name").unwrap_or_else(|| "unknown".to_string());
    match event.hook_event_type.as_str() {
        "PreToolUse" => {
            if let Some(tool_input) = event.payload.get("tool_input") {
                if (tool_name == "Bash" || tool_name == "exec_command")
                    && extract_command(tool_input).is_some()
                {
                    let command = extract_command(tool_input).unwrap_or_default();
                    if let Some(workdir) = tool_input
                        .get("workdir")
                        .and_then(serde_json::Value::as_str)
                        .and_then(basename_from_path)
                    {
                        return format!("Running {} in {workdir}", truncate(&command, 64));
                    }
                    return format!("Running {}", truncate(&command, 72));
                }
                if ["Read", "Edit", "Write"].contains(&tool_name.as_str())
                    && extract_file_target(tool_input).is_some()
                {
                    let target = extract_file_target(tool_input).unwrap_or_default();
                    let verb = match tool_name.as_str() {
                        "Read" => "Reading",
                        "Edit" => "Editing",
                        _ => "Writing",
                    };
                    return format!("{verb} {target}");
                }
                if tool_name == "apply_patch" {
                    let patch = tool_input
                        .get("patch")
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| tool_input.get("input").and_then(serde_json::Value::as_str))
                        .unwrap_or_default();
                    if let Some(target) = extract_patched_file(patch) {
                        return format!("Patching {target}");
                    }
                    return "Applying patch".to_string();
                }
            }
            format!("Using {tool_name}")
        }
        "PostToolUse" => {
            if let Some(content) = event
                .payload
                .get("content")
                .and_then(serde_json::Value::as_str)
                .and_then(content_preview)
            {
                if tool_name == "exec_command" {
                    return format!("Command completed: {}", truncate(&content, 72));
                }
                return format!("{tool_name} completed: {}", truncate(&content, 72));
            }
            format!("{tool_name} completed")
        }
        "PostToolUseFailure" => {
            if let Some(content) = event
                .payload
                .get("content")
                .and_then(serde_json::Value::as_str)
                .and_then(content_preview)
            {
                return format!("{tool_name} failed: {}", truncate(&content, 72));
            }
            format!("{tool_name} failed")
        }
        "SessionStart" => payload_string(&event.payload, "title")
            .map(|title| format!("Watching {}", truncate(&title, 80)))
            .unwrap_or_else(|| "Session observed".to_string()),
        "SessionEnd" => "Session ended".to_string(),
        "SubagentStart" => {
            let label = payload_string(&event.payload, "display_name")
                .or_else(|| payload_string(&event.payload, "agent_name"))
                .or_else(|| payload_string(&event.payload, "agent_type"))
                .or_else(|| event.agent_name.clone())
                .unwrap_or_else(|| "Agent".to_string());
            if let Some(description) = payload_string(&event.payload, "description") {
                return format!("Spawned {} to {}", label, truncate(&description, 72));
            }
            format!("Spawned {label}")
        }
        "SubagentStop" => "Subagent finished".to_string(),
        "UserPromptSubmit" => payload_string(&event.payload, "prompt")
            .or_else(|| payload_string(&event.payload, "message"))
            .map(|prompt| format!("Prompted: {}", truncate(&prompt, 72)))
            .unwrap_or_else(|| "User prompt".to_string()),
        "AssistantResponse" => payload_string(&event.payload, "text")
            .map(|text| format!("Responded: {}", truncate(&text, 72)))
            .unwrap_or_else(|| "Response".to_string()),
        "SessionTitleChanged" => {
            payload_string(&event.payload, "title").unwrap_or_else(|| "Title changed".to_string())
        }
        _ => event.hook_event_type.clone(),
    }
}

fn extract_command(tool_input: &serde_json::Value) -> Option<String> {
    if let Some(command) = tool_input.get("cmd").and_then(serde_json::Value::as_str) {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(command) = tool_input
        .get("command")
        .and_then(serde_json::Value::as_str)
    {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(parts) = tool_input
        .get("command")
        .and_then(serde_json::Value::as_array)
    {
        let joined = parts
            .iter()
            .filter_map(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        if !joined.is_empty() {
            return Some(joined);
        }
    }
    None
}

fn extract_file_target(tool_input: &serde_json::Value) -> Option<String> {
    ["file_path", "path", "file"]
        .iter()
        .find_map(|key| tool_input.get(*key).and_then(serde_json::Value::as_str))
        .and_then(short_path)
}

fn extract_patched_file(patch: &str) -> Option<String> {
    let marker = ["*** Add File: ", "*** Update File: ", "*** Delete File: "];
    for prefix in marker {
        if let Some(rest) = patch.lines().find_map(|line| line.strip_prefix(prefix)) {
            return short_path(rest);
        }
    }
    None
}

fn content_preview(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

fn short_path(path: &str) -> Option<String> {
    let parts = path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty() {
        None
    } else {
        Some(
            parts
                .into_iter()
                .rev()
                .take(3)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("/"),
        )
    }
}

fn basename_from_path(path: &str) -> Option<String> {
    path.split('/')
        .filter(|part| !part.is_empty())
        .next_back()
        .map(ToString::to_string)
}

fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    if max == 0 {
        return String::new();
    }

    let mut end = max.saturating_sub(1);
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }

    format!("{}…", &text[..end])
}

fn workspace_name_from_cwd(cwd: &str) -> Option<String> {
    cwd.split('/')
        .filter(|part| !part.is_empty())
        .next_back()
        .map(ToString::to_string)
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
        Some(agent_id) if !agent_id.is_empty() => {
            format!("{source_app}:{session_prefix}:{agent_id}")
        }
        _ => format!("{source_app}:{session_prefix}"),
    }
}

fn resolve_lifecycle_status(hook_event_type: &str) -> &'static str {
    match hook_event_type {
        "SessionEnd" | "SubagentStop" => "inactive",
        _ => "active",
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{AgentSnapshot, LiveState, resolve_session_summary, truncate};
    use crate::model::{
        AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, LegacyHookEvent, RuntimeSource,
        SessionRef,
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
                && project.sessions.iter().any(|session| session.session_id == "sess-unknown")
        }));
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
