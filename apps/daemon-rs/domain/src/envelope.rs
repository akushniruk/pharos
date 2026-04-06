//! Canonical event envelope and session reference — wire shape matches `pharos-daemon` JSON.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeSource {
    ClaudeCode,
    CodexCli,
    GeminiCli,
    CursorAgent,
    PiCli,
    OpenCode,
    Aider,
    GenericAgentCli,
    CustomCli,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AcquisitionMode {
    Managed,
    Observed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    SessionStarted,
    SessionEnded,
    UserPromptSubmitted,
    ToolCallStarted,
    ToolCallCompleted,
    ToolCallFailed,
    SubagentStarted,
    SubagentStopped,
    SessionTitleChanged,
    AssistantResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionRef {
    pub host_id: String,
    pub workspace_id: String,
    pub session_id: String,
}

impl SessionRef {
    /// Enforce non-empty, bounded identifiers (ingest / domain boundary).
    pub fn validate(&self) -> Result<(), DomainError> {
        validate_bounded_nonempty(
            &self.host_id,
            DomainError::EmptyHostId,
            DomainError::HostIdTooLong { max: crate::ids::MAX_ID_LEN },
        )?;
        validate_bounded_nonempty(
            &self.workspace_id,
            DomainError::EmptyWorkspaceId,
            DomainError::WorkspaceIdTooLong { max: crate::ids::MAX_ID_LEN },
        )?;
        validate_bounded_nonempty(
            &self.session_id,
            DomainError::EmptySessionId,
            DomainError::SessionIdTooLong { max: crate::ids::MAX_ID_LEN },
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapabilitySet {
    pub can_observe: bool,
    pub can_start: bool,
    pub can_stop: bool,
    pub can_retry: bool,
    pub can_respond: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventEnvelope {
    pub runtime_source: RuntimeSource,
    pub acquisition_mode: AcquisitionMode,
    pub event_kind: EventKind,
    pub session: SessionRef,
    pub agent_id: Option<String>,
    pub occurred_at_ms: i64,
    pub capabilities: CapabilitySet,
    pub title: String,
    pub payload: Value,
}

impl EventEnvelope {
    /// Validates session scope and optional `agent_id` when present.
    pub fn validate(&self) -> Result<(), DomainError> {
        self.session.validate()?;
        if let Some(agent) = &self.agent_id {
            validate_bounded_nonempty(
                agent,
                DomainError::EmptyAgentId,
                DomainError::AgentIdTooLong { max: crate::ids::MAX_ID_LEN },
            )?;
        }
        Ok(())
    }
}

fn validate_bounded_nonempty(
    value: &str,
    empty: DomainError,
    too_long: DomainError,
) -> Result<(), DomainError> {
    let t = value.trim();
    if t.is_empty() {
        return Err(empty);
    }
    if t.len() > crate::ids::MAX_ID_LEN {
        return Err(too_long);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn session_ref_rejects_blank_workspace() {
        let s = SessionRef {
            host_id: "h".to_string(),
            workspace_id: "  ".to_string(),
            session_id: "s".to_string(),
        };
        assert_eq!(s.validate(), Err(DomainError::EmptyWorkspaceId));
    }

    #[test]
    fn envelope_rejects_blank_agent_when_some() {
        let e = EventEnvelope {
            runtime_source: RuntimeSource::ClaudeCode,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SessionStarted,
            session: SessionRef {
                host_id: "h".to_string(),
                workspace_id: "w".to_string(),
                session_id: "s".to_string(),
            },
            agent_id: Some("  ".to_string()),
            occurred_at_ms: 1,
            capabilities: CapabilitySet {
                can_observe: true,
                can_start: false,
                can_stop: false,
                can_retry: false,
                can_respond: false,
            },
            title: "t".to_string(),
            payload: json!({}),
        };
        assert_eq!(e.validate(), Err(DomainError::EmptyAgentId));
    }
}
