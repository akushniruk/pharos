use std::collections::{BTreeSet, HashMap};

use crate::model::{
    AgentRegistryEntry, LegacyHookEvent, SessionSummary,
};

use super::labels::{
    display_name_candidate_for_legacy_event, should_upgrade_project_label,
};
use crate::agent_identity::{infer_agent_role, payload_parent_agent_id};

use super::util::{build_registry_id, payload_string, resolve_lifecycle_status};

#[derive(Default)]
pub(crate) struct LiveStateData {
    pub(crate) events: Vec<LegacyHookEvent>,
    pub(crate) session_events: HashMap<String, Vec<LegacyHookEvent>>,
    pub(crate) registry: HashMap<String, RegistryState>,
    pub(crate) sessions: HashMap<String, SessionState>,
    pub(crate) source_apps: BTreeSet<String>,
    pub(crate) session_ids: BTreeSet<String>,
    pub(crate) hook_event_types: BTreeSet<String>,
    pub(crate) agent_ids: BTreeSet<String>,
    pub(crate) agent_types: BTreeSet<String>,
}

#[derive(Clone)]
pub(crate) struct RegistryState {
    pub(crate) entry: AgentRegistryEntry,
    pub(crate) display_name_score: u8,
    pub(crate) tool_counts: HashMap<String, usize>,
}

#[derive(Clone)]
pub(crate) struct SessionState {
    pub(crate) summary: SessionSummary,
    pub(crate) seen_agents: BTreeSet<String>,
}

impl LiveStateData {
    pub(crate) fn apply_legacy_event(&mut self, event: LegacyHookEvent) {
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
                    parent_id: payload_parent_agent_id(&event.payload),
                    team_name: payload_string(&event.payload, "team_name"),
                    lifecycle_status: resolve_lifecycle_status(&event.hook_event_type).to_string(),
                    first_seen_at: event.timestamp,
                    last_seen_at: event.timestamp,
                    event_count: 0,
                },
                display_name_score: display_name.score,
                tool_counts: HashMap::new(),
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
        if let Some(parent_id) = payload_parent_agent_id(&event.payload) {
            state.entry.parent_id = Some(parent_id);
        }
        if let Some(team_name) = payload_string(&event.payload, "team_name") {
            state.entry.team_name = Some(team_name);
        }

        if event.hook_event_type == "PreToolUse" || event.hook_event_type == "ToolCallStarted" {
            if let Some(tool_name) = payload_string(&event.payload, "tool_name") {
                *state.tool_counts.entry(tool_name).or_insert(0) += 1;
            }
        }

        if state.entry.agent_type.is_none() && state.entry.parent_id.is_some() {
            state.entry.agent_type = infer_agent_role(&state.tool_counts);
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
