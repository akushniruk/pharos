use crate::error::DomainError;
use crate::ids::{AgentId, EventId, RunId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Kind of structured audit / telemetry row.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EventKind {
    HeartbeatStarted,
    /// First structured signal that a run row is live for this execution window.
    RunStarted,
    IssueCheckedOut {
        issue_identifier: String,
    },
    IssueUpdated {
        issue_identifier: String,
    },
    CommentPosted {
        issue_identifier: String,
    },
    /// Recorded on the **parent** run when a sub-agent run is created (`child_run_id.parent_run_id` should match).
    SubAgentSpawned {
        child_agent_id: AgentId,
        child_run_id: RunId,
    },
    /// Extension point for product-specific events (keep payloads small at domain layer).
    Custom {
        name: String,
    },
}

/// Immutable audit event attached to a [`Run`](crate::Run).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: EventId,
    pub run_id: RunId,
    /// Monotonic sequence per `run_id` (append-only stream; plan §4).
    pub seq: u64,
    pub agent_id: AgentId,
    pub recorded_at: DateTime<Utc>,
    pub kind: EventKind,
    /// Optional pointer to a larger payload (object store key, file path) — not validated here.
    pub payload_ref: Option<String>,
}

impl AuditEvent {
    /// Invariants: issue identifiers non-empty for issue-scoped kinds; custom name non-empty; payload_ref length cap.
    pub fn validate(&self) -> Result<(), DomainError> {
        const MAX_PAYLOAD_REF: usize = 2048;

        if self.seq < 1 {
            return Err(DomainError::validation(
                "seq",
                "must be >= 1 for durable append ordering",
            ));
        }

        match &self.kind {
            EventKind::IssueCheckedOut { issue_identifier }
            | EventKind::IssueUpdated { issue_identifier }
            | EventKind::CommentPosted { issue_identifier } => {
                if issue_identifier.trim().is_empty() {
                    return Err(DomainError::validation(
                        "kind.issue_identifier",
                        "must not be empty",
                    ));
                }
                if issue_identifier.len() > 128 {
                    return Err(DomainError::validation(
                        "kind.issue_identifier",
                        "must be at most 128 characters",
                    ));
                }
            }
            EventKind::Custom { name } => {
                if name.trim().is_empty() {
                    return Err(DomainError::validation(
                        "kind.name",
                        "custom event name must not be empty",
                    ));
                }
            }
            EventKind::HeartbeatStarted | EventKind::RunStarted => {}
            EventKind::SubAgentSpawned { child_run_id, .. } => {
                if *child_run_id == self.run_id {
                    return Err(DomainError::validation(
                        "kind.child_run_id",
                        "must not equal parent audit event run_id",
                    ));
                }
            }
        }

        if let Some(ref p) = self.payload_ref {
            if p.len() > MAX_PAYLOAD_REF {
                return Err(DomainError::validation(
                    "payload_ref",
                    format!("must be at most {MAX_PAYLOAD_REF} characters"),
                ));
            }
        }

        Ok(())
    }
}

/// Ensures all events share `run_id`, and `seq` values are strictly increasing when sorted by `seq` (no duplicates).
pub fn validate_event_seq_monotonic_for_run(events: &[AuditEvent]) -> Result<(), DomainError> {
    if events.is_empty() {
        return Ok(());
    }
    let run_id = events[0].run_id;
    for e in events {
        e.validate()?;
        if e.run_id != run_id {
            return Err(DomainError::invariant(
                "all events in batch must share the same run_id",
            ));
        }
    }
    let mut seqs: Vec<u64> = events.iter().map(|e| e.seq).collect();
    seqs.sort_unstable();
    for w in seqs.windows(2) {
        if w[0] >= w[1] {
            return Err(DomainError::invariant(
                "event seq values must be strictly increasing per run",
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn sample_event() -> AuditEvent {
        AuditEvent {
            id: EventId::new_v4(),
            run_id: RunId::new_v4(),
            seq: 1,
            agent_id: AgentId::from_uuid(Uuid::nil()),
            recorded_at: Utc::now(),
            kind: EventKind::HeartbeatStarted,
            payload_ref: None,
        }
    }

    #[test]
    fn heartbeat_ok() {
        sample_event().validate().unwrap();
    }

    #[test]
    fn issue_kind_requires_id() {
        let mut e = sample_event();
        e.kind = EventKind::IssueCheckedOut {
            issue_identifier: "  ".into(),
        };
        assert!(e.validate().is_err());
    }

    #[test]
    fn run_started_ok() {
        let mut e = sample_event();
        e.kind = EventKind::RunStarted;
        e.validate().unwrap();
    }

    #[test]
    fn sub_agent_spawned_rejects_same_run_id() {
        let rid = RunId::new_v4();
        let mut e = sample_event();
        e.run_id = rid;
        e.kind = EventKind::SubAgentSpawned {
            child_agent_id: AgentId::new_v4(),
            child_run_id: rid,
        };
        assert!(e.validate().is_err());
    }

    #[test]
    fn monotonic_seq_ok() {
        let run = RunId::new_v4();
        let a = AuditEvent {
            seq: 1,
            ..sample_event_with_run(run)
        };
        let b = AuditEvent {
            seq: 2,
            ..sample_event_with_run(run)
        };
        validate_event_seq_monotonic_for_run(&[a, b]).unwrap();
    }

    #[test]
    fn monotonic_seq_rejects_duplicate() {
        let run = RunId::new_v4();
        let a = AuditEvent {
            seq: 1,
            ..sample_event_with_run(run)
        };
        let b = AuditEvent {
            seq: 1,
            ..sample_event_with_run(run)
        };
        assert!(validate_event_seq_monotonic_for_run(&[a, b]).is_err());
    }

    fn sample_event_with_run(run_id: RunId) -> AuditEvent {
        AuditEvent {
            id: EventId::new_v4(),
            run_id,
            seq: 1,
            agent_id: AgentId::from_uuid(Uuid::nil()),
            recorded_at: Utc::now(),
            kind: EventKind::HeartbeatStarted,
            payload_ref: None,
        }
    }
}
