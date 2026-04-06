//! Domain-only crate: core identifiers, [`Agent`], [`Run`], [`AuditEvent`], [`Relationship`], and [`DomainError`].
//! No database or network types.

mod agent;
mod error;
mod event;
mod ids;
mod relationship;
mod run;

pub use agent::{Agent, AgentLifecycle};
pub use error::DomainError;
pub use event::{validate_event_seq_monotonic_for_run, AuditEvent, EventKind};
pub use ids::{
    AgentId, CorrelationId, EventId, OrgId, RelationshipId, RunId, SessionId, WorkspaceId,
};
pub use relationship::{Relationship, RelationshipKind};
pub use run::{Run, RunLifecycle};
