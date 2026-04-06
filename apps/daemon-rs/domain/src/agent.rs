//! Agent registry row — persisted and served via the daemon API.

use serde::{Deserialize, Serialize};

use crate::DomainError;
use crate::ids::MAX_ID_LEN;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentRegistryEntry {
    pub id: String,
    pub source_app: String,
    pub session_id: String,
    pub agent_id: Option<String>,
    pub display_name: String,
    pub agent_type: Option<String>,
    pub model_name: Option<String>,
    pub parent_id: Option<String>,
    pub team_name: Option<String>,
    pub lifecycle_status: String,
    pub first_seen_at: i64,
    pub last_seen_at: i64,
    pub event_count: usize,
}

impl AgentRegistryEntry {
    /// Structural checks for a registry row (timestamps, required string fields).
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_nonempty_bounded(
            &self.id,
            DomainError::EmptyRegistryEntryId,
            DomainError::ValueTooLong { max: MAX_ID_LEN },
        )?;
        validate_nonempty_bounded(
            &self.source_app,
            DomainError::EmptySourceApp,
            DomainError::ValueTooLong { max: MAX_ID_LEN },
        )?;
        validate_nonempty_bounded(
            &self.session_id,
            DomainError::EmptySessionId,
            DomainError::SessionIdTooLong { max: MAX_ID_LEN },
        )?;
        validate_nonempty_bounded(
            &self.lifecycle_status,
            DomainError::EmptyLifecycleStatus,
            DomainError::ValueTooLong { max: MAX_ID_LEN },
        )?;
        if let Some(agent) = &self.agent_id {
            validate_nonempty_bounded(
                agent,
                DomainError::EmptyAgentId,
                DomainError::AgentIdTooLong { max: MAX_ID_LEN },
            )?;
        }
        if let Some(parent) = &self.parent_id {
            validate_nonempty_bounded(
                parent,
                DomainError::EmptyAgentId,
                DomainError::AgentIdTooLong { max: MAX_ID_LEN },
            )?;
        }
        if self.first_seen_at > self.last_seen_at {
            return Err(DomainError::RegistryTimestampsOutOfOrder {
                first: self.first_seen_at,
                last: self.last_seen_at,
            });
        }
        Ok(())
    }
}

fn validate_nonempty_bounded(
    value: &str,
    empty: DomainError,
    too_long: DomainError,
) -> Result<(), DomainError> {
    let t = value.trim();
    if t.is_empty() {
        return Err(empty);
    }
    if t.len() > MAX_ID_LEN {
        return Err(too_long);
    }
    Ok(())
}
