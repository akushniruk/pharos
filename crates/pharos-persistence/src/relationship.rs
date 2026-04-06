//! Re-export domain relationship model for persistence rows (`agent_relationships`).

pub use pharos_domain::{Relationship, RelationshipKind};

/// Back-compat name for durable relationship rows.
pub type RelationshipRecord = Relationship;
