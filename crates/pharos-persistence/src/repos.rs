use crate::error::PersistenceError;
use crate::relationship::RelationshipRecord;
use pharos_domain::{Agent, AgentId, AuditEvent, Run, RunId};

/// Durable agent registry rows (survives restarts). See crate-level durability notes.
pub trait AgentRepository {
    fn upsert_agent(&mut self, agent: &Agent) -> Result<(), PersistenceError>;
    fn get_agent(&mut self, id: AgentId) -> Result<Option<Agent>, PersistenceError>;
    fn get_agent_by_url_key(&mut self, url_key: &str) -> Result<Option<Agent>, PersistenceError>;
}

/// Run headers and terminal lifecycle (durable).
pub trait RunRepository {
    fn upsert_run(&mut self, run: &Run) -> Result<(), PersistenceError>;
    fn get_run(&mut self, id: RunId) -> Result<Option<Run>, PersistenceError>;
}

/// Append-only audit stream per run (`AuditEvent` JSON envelope in `kind_json`).
pub trait AuditEventRepository {
    fn append_audit_event(&mut self, event: &AuditEvent) -> Result<(), PersistenceError>;
    fn list_audit_events_for_run(
        &mut self,
        run_id: RunId,
    ) -> Result<Vec<AuditEvent>, PersistenceError>;
}

/// Explicit agent-to-agent edges (delegation / spawn), durable for graph replay.
pub trait RelationshipRepository {
    fn insert_relationship(&mut self, record: &RelationshipRecord) -> Result<(), PersistenceError>;
    fn list_outgoing(
        &mut self,
        from_agent_id: AgentId,
    ) -> Result<Vec<RelationshipRecord>, PersistenceError>;
}
