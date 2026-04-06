use crate::error::DomainError;
use crate::ids::{AgentId, OrgId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Lifecycle for an agent registry row (architecture plan §6).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentLifecycle {
    Active,
    Idle,
    Retired,
}

/// Human-facing agent registration (no secrets).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Agent {
    pub id: AgentId,
    /// Tenant scope; join key with org metadata in persistence.
    pub org_id: OrgId,
    /// Stable key for URLs and APIs (`engineer`, `claudecoder`, …); plan §7 `canonical_key`.
    pub url_key: String,
    pub display_name: String,
    /// Optional adapter label (`cursor`, `codex_local`, …).
    pub adapter_type: Option<String>,
    /// When set, this agent was spawned or scoped under another agent (hierarchy).
    pub parent_agent_id: Option<AgentId>,
    pub lifecycle: AgentLifecycle,
    pub created_at: DateTime<Utc>,
    /// Set when [`AgentLifecycle::Retired`]; must be `>= created_at`.
    pub retired_at: Option<DateTime<Utc>>,
}

impl Agent {
    /// `url_key`: non-empty, ≤64 chars, lowercase `[a-z0-9-]+`, no leading/trailing `-`, no `--`.
    pub fn validate(&self) -> Result<(), DomainError> {
        const MAX_URL_KEY: usize = 64;
        const MAX_NAME: usize = 256;

        if self.url_key.is_empty() {
            return Err(DomainError::validation("url_key", "must not be empty"));
        }
        if self.url_key.len() > MAX_URL_KEY {
            return Err(DomainError::validation(
                "url_key",
                format!("must be at most {MAX_URL_KEY} characters"),
            ));
        }
        if !self
            .url_key
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(DomainError::validation(
                "url_key",
                "must contain only lowercase letters, digits, and hyphen",
            ));
        }
        if self.url_key.starts_with('-') || self.url_key.ends_with('-') {
            return Err(DomainError::validation(
                "url_key",
                "must not start or end with hyphen",
            ));
        }
        if self.url_key.contains("--") {
            return Err(DomainError::validation(
                "url_key",
                "must not contain consecutive hyphens",
            ));
        }

        if self.display_name.is_empty() {
            return Err(DomainError::validation("display_name", "must not be empty"));
        }
        if self.display_name.len() > MAX_NAME {
            return Err(DomainError::validation(
                "display_name",
                format!("must be at most {MAX_NAME} characters"),
            ));
        }

        if let Some(ref a) = self.adapter_type {
            if a.is_empty() {
                return Err(DomainError::validation(
                    "adapter_type",
                    "if set, must not be empty",
                ));
            }
            if a.len() > 64 {
                return Err(DomainError::validation(
                    "adapter_type",
                    "must be at most 64 characters",
                ));
            }
        }

        if let Some(p) = self.parent_agent_id {
            if p == self.id {
                return Err(DomainError::validation(
                    "parent_agent_id",
                    "must not equal agent id",
                ));
            }
        }

        match self.lifecycle {
            AgentLifecycle::Active | AgentLifecycle::Idle => {
                if self.retired_at.is_some() {
                    return Err(DomainError::invariant(
                        "active or idle agent must not have retired_at",
                    ));
                }
            }
            AgentLifecycle::Retired => {
                let Some(ret) = self.retired_at else {
                    return Err(DomainError::invariant("retired agent requires retired_at"));
                };
                if ret < self.created_at {
                    return Err(DomainError::invariant(
                        "retired_at must be greater than or equal to created_at",
                    ));
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::AgentId;
    use uuid::Uuid;

    fn sample_agent() -> Agent {
        Agent {
            id: AgentId::from_uuid(Uuid::nil()),
            org_id: OrgId::from_uuid(Uuid::nil()),
            url_key: "engineer".into(),
            display_name: "Engineer".into(),
            adapter_type: Some("cursor".into()),
            parent_agent_id: None,
            lifecycle: AgentLifecycle::Active,
            created_at: Utc::now(),
            retired_at: None,
        }
    }

    #[test]
    fn valid_agent() {
        sample_agent().validate().unwrap();
    }

    #[test]
    fn rejects_bad_url_key() {
        let mut a = sample_agent();
        a.url_key = "Bad".into();
        assert!(a.validate().is_err());
        a.url_key = "-x".into();
        assert!(a.validate().is_err());
        a.url_key = "a--b".into();
        assert!(a.validate().is_err());
    }

    #[test]
    fn rejects_self_parent() {
        let mut a = sample_agent();
        a.parent_agent_id = Some(a.id);
        assert!(a.validate().is_err());
    }

    #[test]
    fn retired_requires_timestamp() {
        let mut a = sample_agent();
        a.lifecycle = AgentLifecycle::Retired;
        assert!(a.validate().is_err());
        a.retired_at = Some(a.created_at);
        a.validate().unwrap();
    }
}
