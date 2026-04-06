//! Core domain types for Pharos — **no** database, HTTP, or filesystem.
//!
//! This crate is the home for validated IDs and future `Agent` / `Run` / `Event`
//! invariants as we peel them out of `pharos-daemon::model`.

mod error;
mod ids;
mod run;

pub use error::DomainError;
pub use ids::{AgentId, SessionId, WorkspaceId};
pub use run::RunId;
