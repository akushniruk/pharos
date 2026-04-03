use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeSource {
    ClaudeCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AcquisitionMode {
    Managed,
    Observed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    SessionStarted,
    SessionEnded,
    UserPromptSubmitted,
    ToolCallStarted,
    ToolCallCompleted,
    ToolCallFailed,
    SubagentStarted,
    SubagentStopped,
    SessionTitleChanged,
    AssistantResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionRef {
    pub host_id: String,
    pub workspace_id: String,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapabilitySet {
    pub can_observe: bool,
    pub can_start: bool,
    pub can_stop: bool,
    pub can_retry: bool,
    pub can_respond: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EventEnvelope {
    pub runtime_source: RuntimeSource,
    pub acquisition_mode: AcquisitionMode,
    pub event_kind: EventKind,
    pub session: SessionRef,
    pub agent_id: Option<String>,
    pub occurred_at_ms: i64,
    pub capabilities: CapabilitySet,
    pub title: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentRegistryEntry {
    pub id: String,
    pub source_app: String,
    pub session_id: String,
    pub agent_id: Option<String>,
    pub display_name: String,
    pub agent_type: Option<String>,
    pub model_name: Option<String>,
    pub parent_id: Option<String>,
    pub team_name: Option<String>,
    pub lifecycle_status: String,
    pub first_seen_at: i64,
    pub last_seen_at: i64,
    pub event_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LegacyHookEvent {
    pub source_app: String,
    pub session_id: String,
    pub hook_event_type: String,
    pub payload: Value,
    pub timestamp: i64,
    pub agent_id: Option<String>,
    pub agent_type: Option<String>,
    pub model_name: Option<String>,
    pub display_name: Option<String>,
    pub agent_name: Option<String>,
}

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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredSession {
    pub session_id: String,
    pub prompt_count: usize,
    pub latest_prompt_preview: String,
    pub path: String,
}
