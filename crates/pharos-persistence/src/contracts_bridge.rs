//! Maps durable rows to API read models ([`pharos_contracts`]) without orphan-rule `impl From` on external types.

use crate::relationship::{RelationshipKind, RelationshipRecord};
use pharos_contracts::{AgentGraphEdge, GraphEdgeKind};

#[must_use]
pub fn graph_edge_from_relationship(record: &RelationshipRecord) -> AgentGraphEdge {
    let kind = match record.kind {
        RelationshipKind::DelegatesTo => GraphEdgeKind::DelegatesTo,
        RelationshipKind::SpawnedSubAgent => GraphEdgeKind::SpawnedSubAgent,
    };
    AgentGraphEdge::new(
        record.from_agent_id.as_uuid(),
        record.to_agent_id.as_uuid(),
        kind,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use pharos_domain::{AgentId, RelationshipId};
    use uuid::Uuid;

    #[test]
    fn graph_edge_matches_relationship_kind_json() {
        let from = AgentId::from_uuid(Uuid::from_u128(1));
        let to = AgentId::from_uuid(Uuid::from_u128(2));
        let row = RelationshipRecord {
            id: RelationshipId::new_v4(),
            from_agent_id: from,
            to_agent_id: to,
            kind: RelationshipKind::DelegatesTo,
            created_in_run_id: None,
            created_at: Utc::now(),
            ended_at: None,
        };
        let edge = graph_edge_from_relationship(&row);
        assert_eq!(edge.kind, GraphEdgeKind::DelegatesTo);
        assert_eq!(edge.from_agent_id, from.as_uuid());
        assert_eq!(edge.to_agent_id, to.as_uuid());
    }
}
