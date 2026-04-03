use thiserror::Error;

use crate::{
    legacy::claude::{normalize_claude_event, ClaudeNormalizeError},
    model::{EventEnvelope, LegacyHookEvent},
};

pub trait Connector: Send + Sync {
    fn key(&self) -> &'static str;
    fn normalize_raw_event(&self, raw: &str) -> Result<EventEnvelope, ConnectorError>;
    fn normalize_legacy_hook_event(
        &self,
        event: &LegacyHookEvent,
    ) -> Result<EventEnvelope, ConnectorError>;
}

#[derive(Debug, Error)]
pub enum ConnectorError {
    #[error("unsupported connector: {0}")]
    UnsupportedConnector(String),
    #[error("unsupported legacy hook event type for connector {connector}: {event_type}")]
    UnsupportedLegacyHookEvent {
        connector: &'static str,
        event_type: String,
    },
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    ClaudeNormalize(#[from] ClaudeNormalizeError),
}

pub struct ClaudeConnector;
pub struct GenericConnector;

impl Connector for ClaudeConnector {
    fn key(&self) -> &'static str {
        "claude"
    }

    fn normalize_raw_event(&self, raw: &str) -> Result<EventEnvelope, ConnectorError> {
        Ok(normalize_claude_event(raw)?)
    }

    fn normalize_legacy_hook_event(
        &self,
        event: &LegacyHookEvent,
    ) -> Result<EventEnvelope, ConnectorError> {
        let event_kind = match event.hook_event_type.as_str() {
            "SessionStart" => crate::model::EventKind::SessionStarted,
            "PreToolUse" => crate::model::EventKind::ToolCallStarted,
            "PostToolUseFailure" => crate::model::EventKind::ToolCallFailed,
            _ => {
                return Err(ConnectorError::UnsupportedLegacyHookEvent {
                    connector: self.key(),
                    event_type: event.hook_event_type.clone(),
                })
            }
        };

        Ok(EventEnvelope {
            runtime_source: crate::model::RuntimeSource::ClaudeCode,
            acquisition_mode: crate::model::AcquisitionMode::Observed,
            event_kind,
            session: crate::model::SessionRef {
                host_id: "local".to_string(),
                workspace_id: event.source_app.clone(),
                session_id: event.session_id.clone(),
            },
            agent_id: event.agent_id.clone(),
            occurred_at_ms: event.timestamp,
            capabilities: crate::model::CapabilitySet {
                can_observe: true,
                can_start: false,
                can_stop: false,
                can_retry: false,
                can_respond: false,
            },
            title: event_title(event),
            payload: event.payload.clone(),
        })
    }
}

impl Connector for GenericConnector {
    fn key(&self) -> &'static str {
        "generic"
    }

    fn normalize_raw_event(&self, raw: &str) -> Result<EventEnvelope, ConnectorError> {
        Ok(serde_json::from_str(raw)?)
    }

    fn normalize_legacy_hook_event(
        &self,
        event: &LegacyHookEvent,
    ) -> Result<EventEnvelope, ConnectorError> {
        Err(ConnectorError::UnsupportedLegacyHookEvent {
            connector: self.key(),
            event_type: event.hook_event_type.clone(),
        })
    }
}

pub fn resolve_connector(name: &str) -> Result<&'static dyn Connector, ConnectorError> {
    match name {
        "claude" => Ok(&ClaudeConnector),
        "generic" => Ok(&GenericConnector),
        _ => Err(ConnectorError::UnsupportedConnector(name.to_string())),
    }
}

fn event_title(event: &LegacyHookEvent) -> String {
    match event.hook_event_type.as_str() {
        "SessionStart" => "session started".to_string(),
        "PreToolUse" => {
            let tool_name = event
                .payload
                .get("tool_name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            format!("tool call started: {tool_name}")
        }
        "PostToolUseFailure" => {
            let tool_name = event
                .payload
                .get("tool_name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            format!("tool call failed: {tool_name}")
        }
        _ => event.hook_event_type.clone(),
    }
}
