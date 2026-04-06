//! Core domain types for Pharos — **no** database, HTTP, or filesystem.
//!
//! Canonical event / registry shapes and validated IDs live here; `pharos-daemon::model`
//! re-exports them for a gradual migration.

mod agent;
mod envelope;
mod error;
mod ids;
mod legacy_hook;
mod relationship;
mod run;

pub use agent::AgentRegistryEntry;
pub use envelope::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
pub use error::DomainError;
pub use ids::{AgentId, HostId, SessionId, WorkspaceId, MAX_ID_LEN};
pub use legacy_hook::LegacyHookEvent;
pub use relationship::AgentHierarchyEdge;
pub use run::RunId;
