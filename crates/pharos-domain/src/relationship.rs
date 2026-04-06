use crate::error::DomainError;
use crate::ids::{AgentId, RelationshipId, RunId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Durable edge between agents (delegation or spawn); matches architecture plan §4 (agent relationships).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipKind {
    DelegatesTo,
    SpawnedSubAgent,
}

/// Explicit relationship row: `from_agent_id` → `to_agent_id` with audit metadata.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Relationship {
    pub id: RelationshipId,
    pub from_agent_id: AgentId,
    pub to_agent_id: AgentId,
    pub kind: RelationshipKind,
    /// Run that authorized creating this edge (required for [`RelationshipKind::SpawnedSubAgent`]).
    pub created_in_run_id: Option<RunId>,
    pub created_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

impl Relationship {
    pub fn validate(&self) -> Result<(), DomainError> {
        if self.from_agent_id == self.to_agent_id {
            return Err(DomainError::validation(
                "to_agent_id",
                "must differ from from_agent_id",
            ));
        }

        if let Some(end) = self.ended_at {
            if end < self.created_at {
                return Err(DomainError::invariant(
                    "ended_at must be greater than or equal to created_at",
                ));
            }
        }

        if self.kind == RelationshipKind::SpawnedSubAgent && self.created_in_run_id.is_none() {
            return Err(DomainError::invariant(
                "spawned_sub_agent relationship requires created_in_run_id for audit",
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn base_rel() -> Relationship {
        Relationship {
            id: RelationshipId::new_v4(),
            from_agent_id: AgentId::from_uuid(Uuid::from_u128(1)),
            to_agent_id: AgentId::from_uuid(Uuid::from_u128(2)),
            kind: RelationshipKind::DelegatesTo,
            created_in_run_id: None,
            created_at: Utc::now(),
            ended_at: None,
        }
    }

    #[test]
    fn delegates_to_ok_without_run() {
        base_rel().validate().unwrap();
    }

    #[test]
    fn spawn_requires_run() {
        let mut r = base_rel();
        r.kind = RelationshipKind::SpawnedSubAgent;
        assert!(r.validate().is_err());
        r.created_in_run_id = Some(RunId::new_v4());
        r.validate().unwrap();
    }

    #[test]
    fn rejects_loop() {
        let id = AgentId::from_uuid(Uuid::from_u128(99));
        let mut r = base_rel();
        r.from_agent_id = id;
        r.to_agent_id = id;
        assert!(r.validate().is_err());
    }
}
