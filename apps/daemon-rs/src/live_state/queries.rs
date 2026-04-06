use std::collections::{BTreeSet, HashMap};

use crate::model::{
    AgentSnapshot, LegacyHookEvent, ProjectSnapshot, SessionSnapshot,
};

use super::avatars::{resolve_agent_avatar_url, resolve_project_icon_url};
use super::constants::{SESSION_ACTIVE_WINDOW_MS, SUBAGENT_ACTIVE_WINDOW_MS};
use super::data::{LiveStateData, RegistryState, SessionState};
use super::labels::{
    resolve_agent_name, resolve_assignment, resolve_current_action_from_refs, resolve_project_summary,
    resolve_runtime_label, resolve_session_label, resolve_session_summary,
};
use super::util::current_time_ms;

impl LiveStateData {
    pub(crate) fn build_projects(&self) -> Vec<ProjectSnapshot> {
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
            let icon_url = resolve_project_icon_url(&name);
            projects.push(ProjectSnapshot {
                name,
                icon_url,
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

    pub(crate) fn build_session_snapshot(&self, session_id: &str) -> Option<SessionSnapshot> {
        let session = self.sessions.get(session_id)?;
        let events = self
            .session_events
            .get(session_id)
            .cloned()
            .unwrap_or_default();
        let now_ms = current_time_ms();
        let recent_session_activity =
            now_ms.saturating_sub(session.summary.last_event_at) <= SESSION_ACTIVE_WINDOW_MS;
        let is_active = session.summary.is_active && recent_session_activity;
        let agents = self.build_agents(&events, is_active);
        let active_agent_count = agents.iter().filter(|agent| agent.is_active).count();
        let runtime_label = resolve_runtime_label(&events);

        Some(SessionSnapshot {
            session_id: session.summary.session_id.clone(),
            label: resolve_session_label(&events, &session.summary.source_app),
            runtime_label,
            summary: resolve_session_summary(&events, &agents),
            current_action: {
                let refs: Vec<_> = events.iter().collect();
                resolve_current_action_from_refs(&refs)
            },
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
        let session_latest_at = events.iter().map(|event| event.timestamp).max().unwrap_or(0);
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
                .find_map(|event| super::util::payload_string(&event.payload, "runtime_label"));
            let display_name = resolve_agent_name(&grouped_events, agent_key == "__main__");
            let is_main_agent = agent_key == "__main__";
            let explicitly_active = session_is_active
                && resolve_agent_active(
                    &sample.session_id,
                    if is_main_agent {
                        None
                    } else {
                        Some(&agent_key)
                    },
                    &self.registry,
                );
            let recently_active =
                session_latest_at.saturating_sub(latest_at) <= SUBAGENT_ACTIVE_WINDOW_MS;
            agents.push(AgentSnapshot {
                agent_id: if is_main_agent {
                    None
                } else {
                    Some(agent_key.clone())
                },
                display_name: display_name.clone(),
                avatar_url: resolve_agent_avatar_url(&grouped_events, &display_name),
                runtime_label,
                assignment: resolve_assignment(&grouped_events),
                current_action: resolve_current_action_from_refs(&grouped_events),
                agent_type: sample.agent_type.clone(),
                model_name: sample.model_name.clone(),
                event_count: grouped_events.len(),
                last_event_at: latest_at,
                is_active: explicitly_active && (is_main_agent || recently_active),
                parent_id: grouped_events.iter().find_map(|event| {
                    crate::agent_identity::payload_parent_agent_id(&event.payload)
                }),
            });
        }

        agents.sort_by(|left, right| right.event_count.cmp(&left.event_count));
        agents
    }
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
