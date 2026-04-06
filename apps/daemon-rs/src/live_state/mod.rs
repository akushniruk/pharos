//! In-memory projection of stored events for API responses and live updates.

mod avatars;
mod constants;
mod data;
mod describe;
mod labels;
mod queries;
mod util;

use std::sync::{Arc, Mutex};

use crate::model::{
    AgentRegistryEntry, EventEnvelope, EventKind, FilterOptions, LegacyHookEvent, ProjectSnapshot,
    SessionSnapshot, SessionSummary,
};
use crate::store::{Store, StoreError, legacy_event_from_envelope};

use self::data::LiveStateData;
use self::util::legacy_event_search_text;

#[derive(Clone, Default)]
pub struct LiveState {
    inner: Arc<Mutex<LiveStateData>>,
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

    pub fn search_legacy_events(
        &self,
        query: &str,
        source_app: Option<&str>,
        session_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<LegacyHookEvent>, StoreError> {
        let inner = self.inner.lock().map_err(|_| StoreError::Poisoned)?;
        let needle = query.trim().to_ascii_lowercase();
        if needle.is_empty() {
            return Ok(Vec::new());
        }

        let mut matches = Vec::new();
        for event in inner.events.iter().rev() {
            if let Some(source) = source_app {
                if event.source_app != source {
                    continue;
                }
            }
            if let Some(session) = session_id {
                if event.session_id != session {
                    continue;
                }
            }

            if legacy_event_search_text(event).contains(&needle) {
                matches.push(event.clone());
                if matches.len() >= limit {
                    break;
                }
            }
        }
        matches.reverse();
        Ok(matches)
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

#[cfg(test)]
mod tests;
