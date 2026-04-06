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
    #[error("host id is empty")]
    EmptyHostId,
    #[error("host id exceeds max length ({max} bytes)")]
    HostIdTooLong { max: usize },
    #[error("registry entry id is empty")]
    EmptyRegistryEntryId,
    #[error("source_app is empty")]
    EmptySourceApp,
    #[error("lifecycle_status is empty")]
    EmptyLifecycleStatus,
    #[error("registry timestamps invalid: first_seen_at ({first}) is after last_seen_at ({last})")]
    RegistryTimestampsOutOfOrder { first: i64, last: i64 },
    #[error("parent and child agent ids must differ")]
    InvalidAgentRelationship,
    #[error("value exceeds max length ({max} bytes)")]
    ValueTooLong { max: usize },
}
