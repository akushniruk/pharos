use thiserror::Error;

/// Validation or invariant violation in the domain layer.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("workspace id is empty")]
    EmptyWorkspaceId,
    #[error("workspace id exceeds max length ({max} bytes)")]
    WorkspaceIdTooLong { max: usize },
    #[error("session id is empty")]
    EmptySessionId,
    #[error("session id exceeds max length ({max} bytes)")]
    SessionIdTooLong { max: usize },
    #[error("agent id is empty")]
    EmptyAgentId,
    #[error("agent id exceeds max length ({max} bytes)")]
    AgentIdTooLong { max: usize },
}
