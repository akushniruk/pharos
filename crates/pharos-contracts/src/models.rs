use pharos_domain::Agent;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// Roster / table row: identity, display, and a dedicated stable sort key.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct AgentListItem {
    /// Stable agent identity (UUID).
    #[schema(value_type = String, format = "uuid")]
    pub agent_id: Uuid,
    /// Organization / tenant scope (`OrgId` in domain).
    #[schema(value_type = String, format = "uuid")]
    pub org_id: Uuid,
    /// Stable slug for URLs and APIs; maps from persistence `url_key`.
    pub canonical_key: String,
    /// Human-facing name (may change without breaking URLs if `canonical_key` stays fixed).
    pub display_name: String,
    /// Optional adapter label (`cursor`, `codex_local`, …).
    pub adapter_type: Option<String>,
    /// Sort by ascending UTF-8 `sort_key` for deterministic UI lists. For valid agents equals `canonical_key`.
    pub sort_key: String,
}

impl From<&Agent> for AgentListItem {
    fn from(agent: &Agent) -> Self {
        let canonical_key = agent.url_key.clone();
        Self {
            agent_id: agent.id.as_uuid(),
            org_id: agent.org_id.as_uuid(),
            canonical_key: canonical_key.clone(),
            display_name: agent.display_name.clone(),
            adapter_type: agent.adapter_type.clone(),
            sort_key: canonical_key,
        }
    }
}

/// Graph node card: same projections as list plus optional parent link for hierarchy.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct AgentGraphNode {
    #[schema(value_type = String, format = "uuid")]
    pub agent_id: Uuid,
    #[schema(value_type = String, format = "uuid")]
    pub org_id: Uuid,
    pub canonical_key: String,
    pub display_name: String,
    pub adapter_type: Option<String>,
    pub sort_key: String,
    #[schema(value_type = Option<String>, format = "uuid", nullable = true)]
    pub parent_agent_id: Option<Uuid>,
}

impl From<&Agent> for AgentGraphNode {
    fn from(agent: &Agent) -> Self {
        let canonical_key = agent.url_key.clone();
        Self {
            agent_id: agent.id.as_uuid(),
            org_id: agent.org_id.as_uuid(),
            canonical_key: canonical_key.clone(),
            display_name: agent.display_name.clone(),
            adapter_type: agent.adapter_type.clone(),
            sort_key: canonical_key,
            parent_agent_id: agent.parent_agent_id.map(|id| id.as_uuid()),
        }
    }
}

/// Edge kinds align with durable `agent_relationships.relationship_kind` (snake_case JSON).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum GraphEdgeKind {
    DelegatesTo,
    SpawnedSubAgent,
}

/// One directed edge in the agent relationship graph.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct AgentGraphEdge {
    #[schema(value_type = String, format = "uuid")]
    pub from_agent_id: Uuid,
    #[schema(value_type = String, format = "uuid")]
    pub to_agent_id: Uuid,
    pub kind: GraphEdgeKind,
    /// Deterministic ordering: `from_agent_id`, kind string, `to_agent_id` (tab-separated UUID strings).
    pub sort_key: String,
}

impl AgentGraphEdge {
    #[must_use]
    pub fn new(from_agent_id: Uuid, to_agent_id: Uuid, kind: GraphEdgeKind) -> Self {
        let sort_key = edge_sort_key(from_agent_id, to_agent_id, kind);
        Self {
            from_agent_id,
            to_agent_id,
            kind,
            sort_key,
        }
    }
}

/// Typical graph read payload: nodes and edges sorted for stable snapshots.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct RelationshipGraphPayload {
    pub nodes: Vec<AgentGraphNode>,
    pub edges: Vec<AgentGraphEdge>,
}

/// Paginated roster view: items are sorted by [`AgentListItem::sort_key`]; `next_cursor` is the
/// last row's `sort_key` when more pages exist (pass as `after_sort_key` on the next request).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, ToSchema, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct AgentListPage {
    pub items: Vec<AgentListItem>,
    /// Opaque cursor: UTF-8 `sort_key` of the final item in this page; `None` if no further pages.
    pub next_cursor: Option<String>,
}

/// Stable edge ordering key (do not parse; compare as opaque UTF-8).
#[must_use]
pub fn edge_sort_key(from: Uuid, to: Uuid, kind: GraphEdgeKind) -> String {
    let kind_str = match kind {
        GraphEdgeKind::DelegatesTo => "delegates_to",
        GraphEdgeKind::SpawnedSubAgent => "spawned_sub_agent",
    };
    format!("{from}\t{kind_str}\t{to}")
}

/// Sort list rows by [`AgentListItem::sort_key`].
pub fn sort_list_items(items: &mut [AgentListItem]) {
    items.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));
}

/// Sort graph nodes by [`AgentGraphNode::sort_key`].
pub fn sort_graph_nodes(nodes: &mut [AgentGraphNode]) {
    nodes.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));
}

/// Sort edges by [`AgentGraphEdge::sort_key`].
pub fn sort_graph_edges(edges: &mut [AgentGraphEdge]) {
    edges.sort_by(|a, b| a.sort_key.cmp(&b.sort_key));
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use pharos_domain::{AgentId, AgentLifecycle, OrgId};

    #[test]
    fn list_item_sort_key_matches_canonical_key() {
        let now = Utc::now();
        let agent = Agent {
            id: AgentId::from_uuid(Uuid::nil()),
            org_id: OrgId::from_uuid(Uuid::nil()),
            url_key: "zebra".into(),
            display_name: "Z".into(),
            adapter_type: None,
            parent_agent_id: None,
            lifecycle: AgentLifecycle::Active,
            created_at: now,
            retired_at: None,
        };
        let row = AgentListItem::from(&agent);
        assert_eq!(row.sort_key, row.canonical_key);
    }

    #[test]
    fn sort_list_is_deterministic() {
        let a = AgentListItem {
            agent_id: Uuid::nil(),
            org_id: Uuid::nil(),
            canonical_key: "b".into(),
            display_name: "B".into(),
            adapter_type: None,
            sort_key: "b".into(),
        };
        let b = AgentListItem {
            agent_id: Uuid::from_u128(1),
            org_id: Uuid::nil(),
            canonical_key: "a".into(),
            display_name: "A".into(),
            adapter_type: None,
            sort_key: "a".into(),
        };
        let mut v = vec![a, b];
        sort_list_items(&mut v);
        assert_eq!(v[0].canonical_key, "a");
        assert_eq!(v[1].canonical_key, "b");
    }

    #[test]
    fn edge_sort_key_orders_kind_before_to_id() {
        let from = Uuid::from_u128(10);
        let to_a = Uuid::from_u128(1);
        let to_b = Uuid::from_u128(2);
        let e1 = AgentGraphEdge::new(from, to_b, GraphEdgeKind::DelegatesTo);
        let e2 = AgentGraphEdge::new(from, to_a, GraphEdgeKind::DelegatesTo);
        assert!(e2.sort_key < e1.sort_key);
    }
}
