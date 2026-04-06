//! HTTP/API read models and machine-readable contracts for Pharos.
//!
//! List and graph views use explicit fields so clients never confuse:
//! - **`agent_id`** — stable UUID identity
//! - **`canonical_key`** — slug for URLs/APIs (maps from domain [`pharos_domain::Agent::url_key`])
//! - **`display_name`** — human-facing label
//! - **`sort_key`** — stable lexicographic ordering (UTF-8 byte compare)

mod models;
mod openapi;

pub use models::{
    edge_sort_key, sort_graph_edges, sort_graph_nodes, sort_list_items, AgentGraphEdge,
    AgentGraphNode, AgentListItem, AgentListPage, GraphEdgeKind, RelationshipGraphPayload,
};
pub use openapi::{openapi_json, PharosApiDoc};
