//! Legacy hook wire shape (derived from envelopes for UI / projections).

use serde::{Deserialize, Serialize};
use serde_json::Value;

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
