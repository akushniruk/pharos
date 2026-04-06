use crate::error::DomainError;
use crate::ids::{AgentId, CorrelationId, RunId, SessionId, WorkspaceId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// High-level lifecycle for a run record.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunLifecycle {
    Active,
    Completed,
    Failed,
    Cancelled,
}

/// One agent execution window (heartbeat / task work), correlatable to an upstream run id.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Run {
    pub id: RunId,
    pub agent_id: AgentId,
    /// When set, this run was spawned from activity in the parent run (sub-agent / delegation).
    pub parent_run_id: Option<RunId>,
    pub workspace_id: Option<WorkspaceId>,
    /// Optional content hash or opaque fingerprint for the workspace snapshot (plan §4).
    pub workspace_fingerprint: Option<String>,
    pub session_id: Option<SessionId>,
    /// When present, ties this row to control-plane audit (`checkoutRunId` / `executionRunId`).
    pub correlation_id: Option<CorrelationId>,
    pub lifecycle: RunLifecycle,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

impl Run {
    /// Invariants:
    /// - `ended_at` must be `>= started_at` when set.
    /// - `Completed` / `Failed` / `Cancelled` require `ended_at`.
    /// - `Active` must not have `ended_at`.
    pub fn validate(&self) -> Result<(), DomainError> {
        if let Some(parent) = self.parent_run_id {
            if parent == self.id {
                return Err(DomainError::validation(
                    "parent_run_id",
                    "must not equal run id",
                ));
            }
        }

        if let Some(end) = self.ended_at {
            if end < self.started_at {
                return Err(DomainError::invariant(
                    "ended_at must be greater than or equal to started_at",
                ));
            }
        }

        match self.lifecycle {
            RunLifecycle::Active => {
                if self.ended_at.is_some() {
                    return Err(DomainError::invariant("active run must not have ended_at"));
                }
            }
            RunLifecycle::Completed | RunLifecycle::Failed | RunLifecycle::Cancelled => {
                if self.ended_at.is_none() {
                    return Err(DomainError::invariant(
                        "terminal lifecycle requires ended_at",
                    ));
                }
            }
        }

        const MAX_FINGERPRINT: usize = 512;
        if let Some(ref fp) = self.workspace_fingerprint {
            if fp.len() > MAX_FINGERPRINT {
                return Err(DomainError::validation(
                    "workspace_fingerprint",
                    format!("must be at most {MAX_FINGERPRINT} characters"),
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn base_run() -> Run {
        Run {
            id: RunId::new_v4(),
            agent_id: AgentId::from_uuid(Uuid::nil()),
            parent_run_id: None,
            workspace_id: None,
            workspace_fingerprint: None,
            session_id: None,
            correlation_id: None,
            lifecycle: RunLifecycle::Active,
            started_at: Utc::now(),
            ended_at: None,
        }
    }

    #[test]
    fn active_ok() {
        base_run().validate().unwrap();
    }

    #[test]
    fn completed_requires_end() {
        let mut r = base_run();
        r.lifecycle = RunLifecycle::Completed;
        assert!(r.validate().is_err());
        r.ended_at = Some(r.started_at);
        r.validate().unwrap();
    }

    #[test]
    fn rejects_end_before_start() {
        let mut r = base_run();
        r.lifecycle = RunLifecycle::Completed;
        r.ended_at = Some(r.started_at - chrono::Duration::seconds(1));
        assert!(r.validate().is_err());
    }

    #[test]
    fn rejects_self_parent_run() {
        let mut r = base_run();
        r.parent_run_id = Some(r.id);
        assert!(r.validate().is_err());
    }
}
