use serde::{Deserialize, Serialize};

use crate::DomainError;

const MAX_ID_LEN: usize = 2048;

fn validate_non_empty(value: &str, empty: DomainError, too_long: DomainError) -> Result<(), DomainError> {
    let t = value.trim();
    if t.is_empty() {
        return Err(empty);
    }
    if t.len() > MAX_ID_LEN {
        return Err(too_long);
    }
    Ok(())
}

/// Tenant / project bucket from the host environment (e.g. Cursor workspace id, repo slug).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct WorkspaceId(String);

impl WorkspaceId {
    /// Construct from a non-empty, bounded string.
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let s = value.into();
        validate_non_empty(
            &s,
            DomainError::EmptyWorkspaceId,
            DomainError::WorkspaceIdTooLong { max: MAX_ID_LEN },
        )?;
        Ok(Self(s.trim().to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for WorkspaceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Stable session identifier from the observed runtime (e.g. Claude session UUID).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SessionId(String);

impl SessionId {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let s = value.into();
        validate_non_empty(
            &s,
            DomainError::EmptySessionId,
            DomainError::SessionIdTooLong { max: MAX_ID_LEN },
        )?;
        Ok(Self(s.trim().to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Sub-agent / worker identity within a session (distinct from the implicit main lane).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct AgentId(String);

impl AgentId {
    pub fn new(value: impl Into<String>) -> Result<Self, DomainError> {
        let s = value.into();
        validate_non_empty(
            &s,
            DomainError::EmptyAgentId,
            DomainError::AgentIdTooLong { max: MAX_ID_LEN },
        )?;
        Ok(Self(s.trim().to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for AgentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_id_rejects_empty() {
        assert_eq!(WorkspaceId::new("  "), Err(DomainError::EmptyWorkspaceId));
    }

    #[test]
    fn session_id_roundtrip() {
        let id = SessionId::new("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(id.as_str(), "550e8400-e29b-41d4-a716-446655440000");
    }
}
