use crate::error::PersistenceError;
use crate::migrate::migrate;
use crate::relationship::{RelationshipKind, RelationshipRecord};
use crate::repos::{AgentRepository, AuditEventRepository, RelationshipRepository, RunRepository};
use chrono::{DateTime, Utc};
use pharos_domain::{
    Agent, AgentId, AgentLifecycle, AuditEvent, CorrelationId, EventId, EventKind, OrgId,
    RelationshipId, Run, RunId, RunLifecycle, SessionId, WorkspaceId,
};
use rusqlite::{params, Connection};
use tracing::instrument;
use uuid::Uuid;

fn uuid_to_blob(u: &Uuid) -> [u8; 16] {
    *u.as_bytes()
}

fn blob_to_uuid(blob: &[u8]) -> Result<Uuid, PersistenceError> {
    Uuid::from_slice(blob).map_err(|e| PersistenceError::Decode(e.to_string()))
}

fn store_invariant(msg: impl Into<String>) -> PersistenceError {
    PersistenceError::Decode(format!("store invariant: {}", msg.into()))
}

fn upsert_agent_conn(conn: &Connection, agent: &Agent) -> Result<(), PersistenceError> {
    agent.validate()?;
    let id = uuid_to_blob(&agent.id.as_uuid());
    let org = uuid_to_blob(&agent.org_id.as_uuid());
    let parent = agent
        .parent_agent_id
        .map(|p| uuid_to_blob(&p.as_uuid()).to_vec());
    let lifecycle = serde_json::to_string(&agent.lifecycle)?;
    conn.execute(
        r#"
            INSERT INTO agents (id, org_id, url_key, display_name, adapter_type, parent_agent_id, lifecycle, created_at, retired_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
              org_id = excluded.org_id,
              url_key = excluded.url_key,
              display_name = excluded.display_name,
              adapter_type = excluded.adapter_type,
              parent_agent_id = excluded.parent_agent_id,
              lifecycle = excluded.lifecycle,
              created_at = excluded.created_at,
              retired_at = excluded.retired_at
            "#,
        params![
            id.as_slice(),
            org.as_slice(),
            agent.url_key,
            agent.display_name,
            agent.adapter_type,
            parent,
            lifecycle,
            agent.created_at.to_rfc3339(),
            agent.retired_at.map(|t| t.to_rfc3339()),
        ],
    )?;
    Ok(())
}

fn upsert_run_conn(conn: &Connection, run: &Run) -> Result<(), PersistenceError> {
    run.validate()?;
    let lifecycle = serde_json::to_string(&run.lifecycle)?;
    let id = uuid_to_blob(&run.id.as_uuid());
    let agent_blob = uuid_to_blob(&run.agent_id.as_uuid());
    let ws = run
        .workspace_id
        .map(|w| uuid_to_blob(&w.as_uuid()).to_vec());
    let sess = run.session_id.map(|s| uuid_to_blob(&s.as_uuid()).to_vec());
    let corr = run
        .correlation_id
        .map(|c| uuid_to_blob(&c.as_uuid()).to_vec());
    let parent_run = run
        .parent_run_id
        .map(|p| uuid_to_blob(&p.as_uuid()).to_vec());
    conn.execute(
        r#"
            INSERT INTO runs (id, agent_id, parent_run_id, workspace_id, workspace_fingerprint, session_id, correlation_id, lifecycle, started_at, ended_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
              agent_id = excluded.agent_id,
              parent_run_id = excluded.parent_run_id,
              workspace_id = excluded.workspace_id,
              workspace_fingerprint = excluded.workspace_fingerprint,
              session_id = excluded.session_id,
              correlation_id = excluded.correlation_id,
              lifecycle = excluded.lifecycle,
              started_at = excluded.started_at,
              ended_at = excluded.ended_at
            "#,
        params![
            id.as_slice(),
            agent_blob.as_slice(),
            parent_run,
            ws,
            run.workspace_fingerprint,
            sess,
            corr,
            lifecycle,
            run.started_at.to_rfc3339(),
            run.ended_at.map(|t| t.to_rfc3339()),
        ],
    )?;
    Ok(())
}

fn append_audit_event_conn(conn: &Connection, event: &AuditEvent) -> Result<(), PersistenceError> {
    event.validate()?;
    let kind_json = serde_json::to_string(&event.kind)?;
    let id = uuid_to_blob(&event.id.as_uuid());
    let run_blob = uuid_to_blob(&event.run_id.as_uuid());
    let agent_blob = uuid_to_blob(&event.agent_id.as_uuid());
    conn.execute(
        r#"
            INSERT INTO audit_events (id, run_id, seq, agent_id, recorded_at, kind_json, payload_ref)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        params![
            id.as_slice(),
            run_blob.as_slice(),
            event.seq,
            agent_blob.as_slice(),
            event.recorded_at.to_rfc3339(),
            kind_json,
            event.payload_ref,
        ],
    )?;
    Ok(())
}

fn insert_relationship_conn(
    conn: &Connection,
    record: &RelationshipRecord,
) -> Result<(), PersistenceError> {
    record.validate()?;
    let id = uuid_to_blob(&record.id.as_uuid());
    let from_b = uuid_to_blob(&record.from_agent_id.as_uuid());
    let to_b = uuid_to_blob(&record.to_agent_id.as_uuid());
    let run_b = record
        .created_in_run_id
        .map(|r| uuid_to_blob(&r.as_uuid()).to_vec());
    let kind_s = serde_json::to_string(&record.kind)?;
    conn.execute(
        r#"
            INSERT INTO agent_relationships
              (id, from_agent_id, to_agent_id, relationship_kind, created_in_run_id, created_at, ended_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        params![
            id.as_slice(),
            from_b.as_slice(),
            to_b.as_slice(),
            kind_s,
            run_b,
            record.created_at.to_rfc3339(),
            record.ended_at.map(|t| t.to_rfc3339()),
        ],
    )?;
    Ok(())
}

fn next_audit_seq_conn(conn: &Connection, run_id: RunId) -> Result<u64, PersistenceError> {
    let mut stmt =
        conn.prepare("SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_events WHERE run_id = ?1")?;
    let run_blob = uuid_to_blob(&run_id.as_uuid());
    let v: i64 = stmt.query_row([run_blob.as_slice()], |row| row.get(0))?;
    u64::try_from(v).map_err(|_| store_invariant("audit seq out of range"))
}

/// SQLite-backed durable store. **Not** for ephemeral session/WebSocket state (rebuild from runs + events).
pub struct SqliteStore {
    conn: Connection,
}

impl SqliteStore {
    pub fn open_in_memory() -> Result<Self, PersistenceError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        migrate(&conn)?;
        Ok(Self { conn })
    }

    pub fn open(path: &str) -> Result<Self, PersistenceError> {
        let conn = Connection::open(path)?;
        // WAL + FK: durable boundary per architecture plan §5 (file-backed only; in-memory stays default).
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;",
        )?;
        migrate(&conn)?;
        Ok(Self { conn })
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    /// Atomic **spawn** path (plan §8.4): persists child agent + child run, `SpawnedSubAgent` relationship,
    /// parent-run `SubAgentSpawned` audit row (next `seq`), and child-run `RunStarted` (`seq` 1).
    ///
    /// Validates cross-references before writing: `child_run.parent_run_id`, `child_agent.parent_agent_id`,
    /// and `child_run.agent_id` must align with the stored parent run header.
    #[instrument(
        skip(self, child_agent, child_run),
        fields(
            pharos.run_id = %child_run.id,
            pharos.agent_id = %child_run.agent_id,
            pharos.parent_run_id = ?child_run.parent_run_id.map(|r| r.to_string())
        )
    )]
    pub fn record_sub_agent_spawn(
        &mut self,
        child_agent: &Agent,
        child_run: &Run,
    ) -> Result<(), PersistenceError> {
        let parent_run_id = child_run.parent_run_id.ok_or_else(|| {
            store_invariant("record_sub_agent_spawn: child_run.parent_run_id must be set")
        })?;
        child_agent.validate()?;
        child_run.validate()?;

        let parent_run = RunRepository::get_run(self, parent_run_id)?
            .ok_or_else(|| store_invariant("record_sub_agent_spawn: parent run not found"))?;

        if child_agent.parent_agent_id != Some(parent_run.agent_id) {
            return Err(store_invariant(
                "record_sub_agent_spawn: child_agent.parent_agent_id must match parent run's agent_id",
            ));
        }
        if child_run.agent_id != child_agent.id {
            return Err(store_invariant(
                "record_sub_agent_spawn: child_run.agent_id must match child_agent.id",
            ));
        }

        let rel = RelationshipRecord {
            id: RelationshipId::new_v4(),
            from_agent_id: parent_run.agent_id,
            to_agent_id: child_agent.id,
            kind: RelationshipKind::SpawnedSubAgent,
            created_in_run_id: Some(parent_run_id),
            created_at: Utc::now(),
            ended_at: None,
        };
        rel.validate()?;

        let tx = self.conn.transaction()?;
        let next_seq = next_audit_seq_conn(&tx, parent_run_id)?;

        let spawn_ev = AuditEvent {
            id: EventId::new_v4(),
            run_id: parent_run_id,
            seq: next_seq,
            agent_id: parent_run.agent_id,
            recorded_at: Utc::now(),
            kind: EventKind::SubAgentSpawned {
                child_agent_id: child_agent.id,
                child_run_id: child_run.id,
            },
            payload_ref: None,
        };
        spawn_ev.validate()?;

        let child_started = AuditEvent {
            id: EventId::new_v4(),
            run_id: child_run.id,
            seq: 1,
            agent_id: child_agent.id,
            recorded_at: Utc::now(),
            kind: EventKind::RunStarted,
            payload_ref: None,
        };
        child_started.validate()?;

        upsert_agent_conn(&tx, child_agent)?;
        upsert_run_conn(&tx, child_run)?;
        insert_relationship_conn(&tx, &rel)?;
        append_audit_event_conn(&tx, &spawn_ev)?;
        append_audit_event_conn(&tx, &child_started)?;
        tx.commit()?;
        Ok(())
    }

    /// Delegation path: durable `DelegatesTo` edge plus a child run whose `parent_run_id` points at the
    /// delegator's run. Persists `delegatee` and `delegated_run` in one transaction.
    #[instrument(
        skip(self, delegatee, delegated_run),
        fields(
            pharos.run_id = %delegated_run.id,
            pharos.agent_id = %delegated_run.agent_id,
            pharos.parent_run_id = ?delegated_run.parent_run_id.map(|r| r.to_string())
        )
    )]
    pub fn record_delegated_run(
        &mut self,
        delegatee: &Agent,
        delegated_run: &Run,
    ) -> Result<(), PersistenceError> {
        let parent_run_id = delegated_run.parent_run_id.ok_or_else(|| {
            store_invariant("record_delegated_run: delegated_run.parent_run_id must be set")
        })?;
        delegatee.validate()?;
        delegated_run.validate()?;

        if delegated_run.agent_id != delegatee.id {
            return Err(store_invariant(
                "record_delegated_run: delegated_run.agent_id must match delegatee.id",
            ));
        }

        let parent_run = RunRepository::get_run(self, parent_run_id)?
            .ok_or_else(|| store_invariant("record_delegated_run: parent run not found"))?;

        let rel = RelationshipRecord {
            id: RelationshipId::new_v4(),
            from_agent_id: parent_run.agent_id,
            to_agent_id: delegatee.id,
            kind: RelationshipKind::DelegatesTo,
            created_in_run_id: Some(parent_run_id),
            created_at: Utc::now(),
            ended_at: None,
        };
        rel.validate()?;

        let tx = self.conn.transaction()?;
        upsert_agent_conn(&tx, delegatee)?;
        upsert_run_conn(&tx, delegated_run)?;
        insert_relationship_conn(&tx, &rel)?;
        tx.commit()?;
        Ok(())
    }
}

impl AgentRepository for SqliteStore {
    fn upsert_agent(&mut self, agent: &Agent) -> Result<(), PersistenceError> {
        upsert_agent_conn(&self.conn, agent)
    }

    fn get_agent(&mut self, id: AgentId) -> Result<Option<Agent>, PersistenceError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, url_key, display_name, adapter_type, parent_agent_id, created_at, org_id, retired_at, lifecycle FROM agents WHERE id = ?1",
        )?;
        let id_blob = uuid_to_blob(&id.as_uuid());
        let mut rows = stmt.query([id_blob.as_slice()])?;
        if let Some(row) = rows.next()? {
            Ok(Some(read_agent_row(&row)?))
        } else {
            Ok(None)
        }
    }

    fn get_agent_by_url_key(&mut self, url_key: &str) -> Result<Option<Agent>, PersistenceError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, url_key, display_name, adapter_type, parent_agent_id, created_at, org_id, retired_at, lifecycle FROM agents WHERE url_key = ?1",
        )?;
        let mut rows = stmt.query([url_key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(read_agent_row(&row)?))
        } else {
            Ok(None)
        }
    }
}

pub(crate) fn read_agent_row(row: &rusqlite::Row<'_>) -> Result<Agent, PersistenceError> {
    let blob: Vec<u8> = row.get(0)?;
    let id = AgentId::from_uuid(blob_to_uuid(&blob)?);
    let url_key: String = row.get(1)?;
    let display_name: String = row.get(2)?;
    let adapter_type: Option<String> = row.get(3)?;
    let parent_blob: Option<Vec<u8>> = row.get(4)?;
    let created_s: String = row.get(5)?;
    let org_blob: Vec<u8> = row.get(6)?;
    let retired_s: Option<String> = row.get(7)?;
    let lifecycle_s: String = row.get(8)?;
    let parent_agent_id = parent_blob
        .map(|b| Ok::<_, PersistenceError>(AgentId::from_uuid(blob_to_uuid(&b)?)))
        .transpose()?;
    let created_at = DateTime::parse_from_rfc3339(&created_s)
        .map_err(|e| PersistenceError::Decode(e.to_string()))?
        .with_timezone(&Utc);
    let org_id = OrgId::from_uuid(blob_to_uuid(&org_blob)?);
    let retired_at = match retired_s {
        Some(s) => Some(
            DateTime::parse_from_rfc3339(&s)
                .map_err(|e| PersistenceError::Decode(e.to_string()))?
                .with_timezone(&Utc),
        ),
        None => None,
    };
    let lifecycle: AgentLifecycle = serde_json::from_str(&lifecycle_s)?;
    Ok(Agent {
        id,
        org_id,
        url_key,
        display_name,
        adapter_type,
        parent_agent_id,
        lifecycle,
        created_at,
        retired_at,
    })
}

impl RunRepository for SqliteStore {
    fn upsert_run(&mut self, run: &Run) -> Result<(), PersistenceError> {
        upsert_run_conn(&self.conn, run)
    }

    fn get_run(&mut self, id: RunId) -> Result<Option<Run>, PersistenceError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, agent_id, parent_run_id, workspace_id, workspace_fingerprint, session_id, correlation_id, lifecycle, started_at, ended_at
            FROM runs WHERE id = ?1
            "#,
        )?;
        let id_blob = uuid_to_blob(&id.as_uuid());
        let mut rows = stmt.query([id_blob.as_slice()])?;
        if let Some(row) = rows.next()? {
            Ok(Some(read_run_row(&row)?))
        } else {
            Ok(None)
        }
    }
}

fn read_run_row(row: &rusqlite::Row<'_>) -> Result<Run, PersistenceError> {
    let id_blob: Vec<u8> = row.get(0)?;
    let agent_blob: Vec<u8> = row.get(1)?;
    let parent_run_blob: Option<Vec<u8>> = row.get(2)?;
    let ws_blob: Option<Vec<u8>> = row.get(3)?;
    let workspace_fingerprint: Option<String> = row.get(4)?;
    let sess_blob: Option<Vec<u8>> = row.get(5)?;
    let corr_blob: Option<Vec<u8>> = row.get(6)?;
    let lifecycle_s: String = row.get(7)?;
    let started_s: String = row.get(8)?;
    let ended_s: Option<String> = row.get(9)?;

    let lifecycle: RunLifecycle = serde_json::from_str(&lifecycle_s)?;
    let started_at = DateTime::parse_from_rfc3339(&started_s)
        .map_err(|e| PersistenceError::Decode(e.to_string()))?
        .with_timezone(&Utc);
    let ended_at = match ended_s {
        Some(s) => Some(
            DateTime::parse_from_rfc3339(&s)
                .map_err(|e| PersistenceError::Decode(e.to_string()))?
                .with_timezone(&Utc),
        ),
        None => None,
    };

    Ok(Run {
        id: RunId::from_uuid(blob_to_uuid(&id_blob)?),
        agent_id: AgentId::from_uuid(blob_to_uuid(&agent_blob)?),
        parent_run_id: parent_run_blob
            .map(|b| Ok::<_, PersistenceError>(RunId::from_uuid(blob_to_uuid(&b)?)))
            .transpose()?,
        workspace_id: ws_blob
            .map(|b| Ok::<_, PersistenceError>(WorkspaceId::from_uuid(blob_to_uuid(&b)?)))
            .transpose()?,
        workspace_fingerprint,
        session_id: sess_blob
            .map(|b| Ok::<_, PersistenceError>(SessionId::from_uuid(blob_to_uuid(&b)?)))
            .transpose()?,
        correlation_id: corr_blob
            .map(|b| Ok::<_, PersistenceError>(CorrelationId::from_uuid(blob_to_uuid(&b)?)))
            .transpose()?,
        lifecycle,
        started_at,
        ended_at,
    })
}

impl AuditEventRepository for SqliteStore {
    fn append_audit_event(&mut self, event: &AuditEvent) -> Result<(), PersistenceError> {
        append_audit_event_conn(&self.conn, event)
    }

    fn list_audit_events_for_run(
        &mut self,
        run_id: RunId,
    ) -> Result<Vec<AuditEvent>, PersistenceError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, run_id, seq, agent_id, recorded_at, kind_json, payload_ref
            FROM audit_events
            WHERE run_id = ?1
            ORDER BY seq ASC, recorded_at ASC, id ASC
            "#,
        )?;
        let run_blob = uuid_to_blob(&run_id.as_uuid());
        let mut rows = stmt.query([run_blob.as_slice()])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(read_audit_event_row(&row)?);
        }
        Ok(out)
    }
}

fn read_audit_event_row(row: &rusqlite::Row<'_>) -> Result<AuditEvent, PersistenceError> {
    let id_blob: Vec<u8> = row.get(0)?;
    let run_blob: Vec<u8> = row.get(1)?;
    let seq: i64 = row.get(2)?;
    let agent_blob: Vec<u8> = row.get(3)?;
    let recorded_s: String = row.get(4)?;
    let kind_json: String = row.get(5)?;
    let payload_ref: Option<String> = row.get(6)?;

    let kind: EventKind = serde_json::from_str(&kind_json)?;
    let recorded_at = DateTime::parse_from_rfc3339(&recorded_s)
        .map_err(|e| PersistenceError::Decode(e.to_string()))?
        .with_timezone(&Utc);
    let seq =
        u64::try_from(seq).map_err(|_| PersistenceError::Decode("seq out of range".into()))?;

    Ok(AuditEvent {
        id: EventId::from_uuid(blob_to_uuid(&id_blob)?),
        run_id: RunId::from_uuid(blob_to_uuid(&run_blob)?),
        seq,
        agent_id: AgentId::from_uuid(blob_to_uuid(&agent_blob)?),
        recorded_at,
        kind,
        payload_ref,
    })
}

impl RelationshipRepository for SqliteStore {
    fn insert_relationship(&mut self, record: &RelationshipRecord) -> Result<(), PersistenceError> {
        insert_relationship_conn(&self.conn, record)
    }

    fn list_outgoing(
        &mut self,
        from_agent_id: AgentId,
    ) -> Result<Vec<RelationshipRecord>, PersistenceError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, from_agent_id, to_agent_id, relationship_kind, created_in_run_id, created_at, ended_at
            FROM agent_relationships
            WHERE from_agent_id = ?1
            ORDER BY created_at ASC, id ASC
            "#,
        )?;
        let from_b = uuid_to_blob(&from_agent_id.as_uuid());
        let mut rows = stmt.query([from_b.as_slice()])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(read_rel_row(&row)?);
        }
        Ok(out)
    }
}

pub(crate) fn read_rel_row(
    row: &rusqlite::Row<'_>,
) -> Result<RelationshipRecord, PersistenceError> {
    let id_blob: Vec<u8> = row.get(0)?;
    let from_blob: Vec<u8> = row.get(1)?;
    let to_blob: Vec<u8> = row.get(2)?;
    let kind_s: String = row.get(3)?;
    let run_blob: Option<Vec<u8>> = row.get(4)?;
    let created_s: String = row.get(5)?;
    let ended_s: Option<String> = row.get(6)?;

    let kind: RelationshipKind = serde_json::from_str(&kind_s)?;
    let created_at = DateTime::parse_from_rfc3339(&created_s)
        .map_err(|e| PersistenceError::Decode(e.to_string()))?
        .with_timezone(&Utc);
    let ended_at = match ended_s {
        Some(s) => Some(
            DateTime::parse_from_rfc3339(&s)
                .map_err(|e| PersistenceError::Decode(e.to_string()))?
                .with_timezone(&Utc),
        ),
        None => None,
    };

    Ok(RelationshipRecord {
        id: RelationshipId::from_uuid(blob_to_uuid(&id_blob)?),
        from_agent_id: AgentId::from_uuid(blob_to_uuid(&from_blob)?),
        to_agent_id: AgentId::from_uuid(blob_to_uuid(&to_blob)?),
        kind,
        created_in_run_id: run_blob
            .map(|b| Ok::<_, PersistenceError>(RunId::from_uuid(blob_to_uuid(&b)?)))
            .transpose()?,
        created_at,
        ended_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PersistenceError;
    use pharos_domain::{EventId, EventKind};
    use uuid::Uuid;

    fn test_agent(url_key: &str, display_name: &str, parent_agent_id: Option<AgentId>) -> Agent {
        let now = Utc::now();
        Agent {
            id: AgentId::from_uuid(Uuid::new_v4()),
            org_id: OrgId::from_uuid(Uuid::nil()),
            url_key: url_key.into(),
            display_name: display_name.into(),
            adapter_type: None,
            parent_agent_id,
            lifecycle: AgentLifecycle::Active,
            created_at: now,
            retired_at: None,
        }
    }

    #[test]
    fn roundtrip_agent_run_event_relationship() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let agent = test_agent("worker", "Worker", None);
        AgentRepository::upsert_agent(&mut store, &agent).unwrap();

        let run = Run {
            id: RunId::new_v4(),
            agent_id: agent.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &run).unwrap();

        let child = test_agent("sub", "Sub", Some(agent.id));
        AgentRepository::upsert_agent(&mut store, &child).unwrap();

        let ev = AuditEvent {
            id: EventId::new_v4(),
            run_id: run.id,
            seq: 1,
            agent_id: agent.id,
            recorded_at: Utc::now(),
            kind: EventKind::HeartbeatStarted,
            payload_ref: None,
        };
        AuditEventRepository::append_audit_event(&mut store, &ev).unwrap();

        let rel = RelationshipRecord {
            id: RelationshipId::new_v4(),
            from_agent_id: agent.id,
            to_agent_id: child.id,
            kind: RelationshipKind::SpawnedSubAgent,
            created_in_run_id: Some(run.id),
            created_at: Utc::now(),
            ended_at: None,
        };
        RelationshipRepository::insert_relationship(&mut store, &rel).unwrap();

        let got = AgentRepository::get_agent(&mut store, agent.id)
            .unwrap()
            .unwrap();
        assert_eq!(got, agent);

        let got_run = RunRepository::get_run(&mut store, run.id).unwrap().unwrap();
        assert_eq!(got_run.id, run.id);
        assert_eq!(got_run.lifecycle, run.lifecycle);

        let events = AuditEventRepository::list_audit_events_for_run(&mut store, run.id).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, EventKind::HeartbeatStarted);

        let edges = RelationshipRepository::list_outgoing(&mut store, agent.id).unwrap();
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].to_agent_id, child.id);
    }

    /// Parent run records `RunStarted` + `SubAgentSpawned`; child run has `parent_run_id`; child agent has `parent_agent_id`.
    #[test]
    fn integration_spawn_links_agents_runs_and_events() {
        let mut store = SqliteStore::open_in_memory().unwrap();

        let parent_agent = test_agent("orchestrator", "Orchestrator", None);
        AgentRepository::upsert_agent(&mut store, &parent_agent).unwrap();

        let mut child_agent = test_agent("subagent", "Sub-agent", Some(parent_agent.id));
        child_agent.adapter_type = Some("task".into());
        AgentRepository::upsert_agent(&mut store, &child_agent).unwrap();

        let parent_run = Run {
            id: RunId::new_v4(),
            agent_id: parent_agent.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &parent_run).unwrap();

        let started = AuditEvent {
            id: EventId::new_v4(),
            run_id: parent_run.id,
            seq: 1,
            agent_id: parent_agent.id,
            recorded_at: Utc::now(),
            kind: EventKind::RunStarted,
            payload_ref: None,
        };
        AuditEventRepository::append_audit_event(&mut store, &started).unwrap();

        let child_run = Run {
            id: RunId::new_v4(),
            agent_id: child_agent.id,
            parent_run_id: Some(parent_run.id),
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &child_run).unwrap();

        let spawn_ev = AuditEvent {
            id: EventId::new_v4(),
            run_id: parent_run.id,
            seq: 2,
            agent_id: parent_agent.id,
            recorded_at: Utc::now(),
            kind: EventKind::SubAgentSpawned {
                child_agent_id: child_agent.id,
                child_run_id: child_run.id,
            },
            payload_ref: None,
        };
        AuditEventRepository::append_audit_event(&mut store, &spawn_ev).unwrap();

        let child_started = AuditEvent {
            id: EventId::new_v4(),
            run_id: child_run.id,
            seq: 1,
            agent_id: child_agent.id,
            recorded_at: Utc::now(),
            kind: EventKind::RunStarted,
            payload_ref: None,
        };
        AuditEventRepository::append_audit_event(&mut store, &child_started).unwrap();

        let got_child = AgentRepository::get_agent(&mut store, child_agent.id)
            .unwrap()
            .unwrap();
        assert_eq!(got_child.parent_agent_id, Some(parent_agent.id));

        let got_child_run = RunRepository::get_run(&mut store, child_run.id)
            .unwrap()
            .unwrap();
        assert_eq!(got_child_run.parent_run_id, Some(parent_run.id));

        let parent_events =
            AuditEventRepository::list_audit_events_for_run(&mut store, parent_run.id).unwrap();
        assert_eq!(parent_events.len(), 2);
        assert_eq!(parent_events[0].kind, EventKind::RunStarted);
        assert_eq!(
            parent_events[1].kind,
            EventKind::SubAgentSpawned {
                child_agent_id: child_agent.id,
                child_run_id: child_run.id,
            }
        );

        let child_events =
            AuditEventRepository::list_audit_events_for_run(&mut store, child_run.id).unwrap();
        assert_eq!(child_events.len(), 1);
        assert_eq!(child_events[0].kind, EventKind::RunStarted);
    }

    #[test]
    fn duplicate_audit_seq_rejected_by_sqlite() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let agent = test_agent("a", "A", None);
        AgentRepository::upsert_agent(&mut store, &agent).unwrap();
        let run = Run {
            id: RunId::new_v4(),
            agent_id: agent.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &run).unwrap();

        let base = Utc::now();
        let ev1 = AuditEvent {
            id: EventId::new_v4(),
            run_id: run.id,
            seq: 1,
            agent_id: agent.id,
            recorded_at: base,
            kind: EventKind::RunStarted,
            payload_ref: None,
        };
        AuditEventRepository::append_audit_event(&mut store, &ev1).unwrap();

        let ev_dup = AuditEvent {
            id: EventId::new_v4(),
            run_id: run.id,
            seq: 1,
            agent_id: agent.id,
            recorded_at: base + chrono::Duration::milliseconds(1),
            kind: EventKind::HeartbeatStarted,
            payload_ref: None,
        };
        let err = AuditEventRepository::append_audit_event(&mut store, &ev_dup).unwrap_err();
        assert!(matches!(err, PersistenceError::Sqlite(_)));
    }

    #[test]
    fn orchestration_record_sub_agent_spawn_atomic_e2e() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let parent_agent = test_agent("orchestrator", "Orchestrator", None);
        AgentRepository::upsert_agent(&mut store, &parent_agent).unwrap();

        let parent_run = Run {
            id: RunId::new_v4(),
            agent_id: parent_agent.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &parent_run).unwrap();

        AuditEventRepository::append_audit_event(
            &mut store,
            &AuditEvent {
                id: EventId::new_v4(),
                run_id: parent_run.id,
                seq: 1,
                agent_id: parent_agent.id,
                recorded_at: Utc::now(),
                kind: EventKind::RunStarted,
                payload_ref: None,
            },
        )
        .unwrap();

        let child_agent = test_agent("spawned", "Spawned worker", Some(parent_agent.id));
        let child_run = Run {
            id: RunId::new_v4(),
            agent_id: child_agent.id,
            parent_run_id: Some(parent_run.id),
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };

        store
            .record_sub_agent_spawn(&child_agent, &child_run)
            .unwrap();

        let edges = RelationshipRepository::list_outgoing(&mut store, parent_agent.id).unwrap();
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].kind, RelationshipKind::SpawnedSubAgent);
        assert_eq!(edges[0].to_agent_id, child_agent.id);
        assert_eq!(edges[0].created_in_run_id, Some(parent_run.id));

        let parent_events =
            AuditEventRepository::list_audit_events_for_run(&mut store, parent_run.id).unwrap();
        assert_eq!(parent_events.len(), 2);
        assert_eq!(
            parent_events[1].kind,
            EventKind::SubAgentSpawned {
                child_agent_id: child_agent.id,
                child_run_id: child_run.id,
            }
        );

        let child_events =
            AuditEventRepository::list_audit_events_for_run(&mut store, child_run.id).unwrap();
        assert_eq!(child_events.len(), 1);
        assert_eq!(child_events[0].kind, EventKind::RunStarted);
    }

    #[test]
    fn orchestration_spawn_rejects_parent_agent_mismatch() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let parent_agent = test_agent("p", "P", None);
        let other = test_agent("o", "O", None);
        AgentRepository::upsert_agent(&mut store, &parent_agent).unwrap();
        AgentRepository::upsert_agent(&mut store, &other).unwrap();

        let parent_run = Run {
            id: RunId::new_v4(),
            agent_id: parent_agent.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &parent_run).unwrap();

        let child = test_agent("c", "C", Some(other.id));
        let child_run = Run {
            id: RunId::new_v4(),
            agent_id: child.id,
            parent_run_id: Some(parent_run.id),
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };

        assert!(store.record_sub_agent_spawn(&child, &child_run).is_err());
    }

    #[test]
    fn orchestration_record_delegated_run_e2e() {
        let mut store = SqliteStore::open_in_memory().unwrap();
        let delegator = test_agent("lead", "Lead", None);
        let specialist = test_agent("spec", "Specialist", None);
        AgentRepository::upsert_agent(&mut store, &delegator).unwrap();
        AgentRepository::upsert_agent(&mut store, &specialist).unwrap();

        let parent_run = Run {
            id: RunId::new_v4(),
            agent_id: delegator.id,
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };
        RunRepository::upsert_run(&mut store, &parent_run).unwrap();

        let delegated = Run {
            id: RunId::new_v4(),
            agent_id: specialist.id,
            parent_run_id: Some(parent_run.id),
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        };

        store.record_delegated_run(&specialist, &delegated).unwrap();

        let got = RunRepository::get_run(&mut store, delegated.id)
            .unwrap()
            .unwrap();
        assert_eq!(got.parent_run_id, Some(parent_run.id));

        let edges = RelationshipRepository::list_outgoing(&mut store, delegator.id).unwrap();
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].kind, RelationshipKind::DelegatesTo);
        assert_eq!(edges[0].to_agent_id, specialist.id);
    }
}
