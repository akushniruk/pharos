//! Persistence boundary for Pharos: **durable** SQLite schema, versioned migrations, and repository traits.
//!
//! ## Durability (architecture plan §5 — persistence)
//!
//! **Durable here (WAL-backed when using a file path):** agent registry, run headers, append-only
//! audit events, and explicit agent relationships. These survive process restarts.
//!
//! **Out of scope / ephemeral:** live WebSocket session state, derived graph layouts, aggregations —
//! rebuild from stored runs and the tail of `audit_events` after reconnect.
//!
//! Event kinds are stored as JSON (`kind_json`) so payload envelopes can version independently of
//! SQL migrations.
//!
//! **Hierarchy (plan §8.4):** [`SqliteStore::record_sub_agent_spawn`] and
//! [`SqliteStore::record_delegated_run`] persist parent/child agent linkage, `parent_run_id`, and
//! relationship rows in a single SQLite transaction.
//!
//! **Projections (plan §8.5):** [`SqliteStore::project_agent_list_page`] and
//! [`SqliteStore::project_relationship_graph`] build contract read models with stable ordering and
//! keyset cursors. **Observability (§8.6):** spawn/delegation paths are `tracing` spans with
//! `pharos.run_id` / `pharos.agent_id` fields for downstream subscribers.

mod contracts_bridge;
mod error;
mod migrate;
mod projections;
mod relationship;
mod repos;
mod sqlite_store;

pub use contracts_bridge::graph_edge_from_relationship;
pub use error::PersistenceError;
pub use migrate::migrate;
pub use projections::MAX_AGENT_LIST_PAGE;
pub use relationship::{RelationshipKind, RelationshipRecord};
pub use repos::{AgentRepository, AuditEventRepository, RelationshipRepository, RunRepository};
pub use sqlite_store::SqliteStore;
