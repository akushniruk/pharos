//! Wire / projection models. Core domain types live in `pharos_domain`.

pub use pharos_domain::{
    AcquisitionMode, AgentHierarchyEdge, AgentId, AgentRegistryEntry, CapabilitySet, DomainError,
    EventEnvelope, EventKind, HostId, LegacyHookEvent, RunId, RuntimeSource, SessionId,
    SessionRef, WorkspaceId,
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FilterOptions {
    pub source_apps: Vec<String>,
    pub session_ids: Vec<String>,
    pub hook_event_types: Vec<String>,
    pub agent_ids: Vec<String>,
    pub agent_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionSummary {
    pub session_id: String,
    pub source_app: String,
    pub started_at: i64,
    pub last_event_at: i64,
    pub event_count: usize,
    pub agent_count: usize,
    pub agents: Vec<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredSession {
    pub session_id: String,
    pub prompt_count: usize,
    pub latest_prompt_preview: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectSnapshot {
    pub name: String,
    pub icon_url: Option<String>,
    pub runtime_labels: Vec<String>,
    pub sessions: Vec<SessionSnapshot>,
    pub summary: Option<String>,
    pub event_count: usize,
    pub agent_count: usize,
    pub active_session_count: usize,
    pub last_event_at: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionSnapshot {
    pub session_id: String,
    pub label: String,
    pub runtime_label: Option<String>,
    pub summary: Option<String>,
    pub current_action: Option<String>,
    pub event_count: usize,
    pub agents: Vec<AgentSnapshot>,
    pub active_agent_count: usize,
    pub last_event_at: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentSnapshot {
    pub agent_id: Option<String>,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub runtime_label: Option<String>,
    pub assignment: Option<String>,
    pub current_action: Option<String>,
    pub agent_type: Option<String>,
    pub model_name: Option<String>,
    pub event_count: usize,
    pub last_event_at: i64,
    pub is_active: bool,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IntegrationState {
    Disabled,
    NotConfigured,
    Healthy,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectivityState {
    Online,
    Offline,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SinkHealth {
    Ok,
    Warn,
    Fail,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoryBrainHelperStatus {
    pub enabled: bool,
    pub model: Option<String>,
    pub last_ok_at: Option<i64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoryBrainSinkStatus {
    pub jsonl: SinkHealth,
    pub vault: SinkHealth,
    pub postgres: SinkHealth,
    pub neo4j: SinkHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoryBrainActivityStatus {
    pub recent_writes_count: usize,
    pub last_write_at: Option<i64>,
    pub last_graph_write_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoryBrainIntegrationStatus {
    pub state: IntegrationState,
    pub connectivity: ConnectivityState,
    pub status_source: String,
    pub helper: MemoryBrainHelperStatus,
    pub sinks: MemoryBrainSinkStatus,
    pub activity: MemoryBrainActivityStatus,
    pub observed_mcp_activity: bool,
    pub updated_at: i64,
}

impl MemoryBrainIntegrationStatus {
    #[must_use]
    pub fn disabled(updated_at: i64) -> Self {
        Self {
            state: IntegrationState::Disabled,
            connectivity: ConnectivityState::Offline,
            status_source: "config".to_string(),
            helper: MemoryBrainHelperStatus {
                enabled: false,
                model: None,
                last_ok_at: None,
                last_error: None,
            },
            sinks: MemoryBrainSinkStatus {
                jsonl: SinkHealth::Unknown,
                vault: SinkHealth::Unknown,
                postgres: SinkHealth::Unknown,
                neo4j: SinkHealth::Unknown,
            },
            activity: MemoryBrainActivityStatus {
                recent_writes_count: 0,
                last_write_at: None,
                last_graph_write_at: None,
            },
            observed_mcp_activity: false,
            updated_at,
        }
    }

    #[must_use]
    pub fn not_configured(updated_at: i64) -> Self {
        let mut value = Self::disabled(updated_at);
        value.state = IntegrationState::NotConfigured;
        value
    }
}
