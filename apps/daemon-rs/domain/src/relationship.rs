//! Typed parent / child linkage between agent identities (domain graph edge).

use serde::{Deserialize, Serialize};

use crate::ids::AgentId;
use crate::DomainError;

/// Directed edge: `child` reports to `parent` within an observed hierarchy.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentHierarchyEdge {
    pub parent_agent_id: AgentId,
    pub child_agent_id: AgentId,
}

impl AgentHierarchyEdge {
    pub fn new(parent_agent_id: AgentId, child_agent_id: AgentId) -> Result<Self, DomainError> {
        if parent_agent_id == child_agent_id {
            return Err(DomainError::InvalidAgentRelationship);
        }
        Ok(Self {
            parent_agent_id,
            child_agent_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_self_parent() {
        let id = AgentId::new("same").unwrap();
        assert_eq!(
            AgentHierarchyEdge::new(id.clone(), id),
            Err(DomainError::InvalidAgentRelationship)
        );
    }
}
