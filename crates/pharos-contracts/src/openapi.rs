use crate::models::{
    AgentGraphEdge, AgentGraphNode, AgentListItem, AgentListPage, GraphEdgeKind,
    RelationshipGraphPayload,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Pharos contracts",
        description = "Read models and schemas for Pharos list/graph APIs (Rust source of truth).",
        version = "0.1.0"
    ),
    components(schemas(
        AgentListItem,
        AgentListPage,
        AgentGraphNode,
        AgentGraphEdge,
        GraphEdgeKind,
        RelationshipGraphPayload
    ))
)]
pub struct PharosApiDoc;

/// OpenAPI 3.x JSON document (includes `components.schemas` for TS codegen).
#[must_use]
pub fn openapi_json() -> String {
    PharosApiDoc::openapi().to_pretty_json().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openapi_contains_schema_titles() {
        let raw = openapi_json();
        assert!(raw.contains("AgentListItem"));
        assert!(raw.contains("AgentListPage"));
        assert!(raw.contains("RelationshipGraphPayload"));
    }
}
