use serde::Deserialize;
use serde_json::Value;
use thiserror::Error;

use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};

#[derive(Debug, Error)]
pub enum ClaudeNormalizeError {
    #[error("invalid json: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("missing required field: {0}")]
    MissingField(&'static str),
    #[error("unsupported hook event type: {0}")]
    UnsupportedType(String),
}

#[derive(Debug, Deserialize)]
struct ClaudeHookEvent {
    source_app: String,
    session_id: String,
    hook_event_type: String,
    payload: Value,
    timestamp: Option<i64>,
    agent_id: Option<String>,
}

pub fn normalize_claude_event(raw: &str) -> Result<EventEnvelope, ClaudeNormalizeError> {
    let event: ClaudeHookEvent = serde_json::from_str(raw)?;
    if event.source_app.is_empty() {
        return Err(ClaudeNormalizeError::MissingField("source_app"));
    }
    if event.session_id.is_empty() {
        return Err(ClaudeNormalizeError::MissingField("session_id"));
    }

    let event_kind = match event.hook_event_type.as_str() {
        "SessionStart" => EventKind::SessionStarted,
        "SessionEnd" => EventKind::SessionEnded,
        "PreToolUse" => EventKind::ToolCallStarted,
        "PostToolUse" => EventKind::ToolCallCompleted,
        "PostToolUseFailure" => EventKind::ToolCallFailed,
        "SubagentStart" => EventKind::SubagentStarted,
        "SubagentStop" => EventKind::SubagentStopped,
        "SessionTitleChanged" => EventKind::SessionTitleChanged,
        "UserPromptSubmit" => EventKind::UserPromptSubmitted,
        "AssistantResponse" => EventKind::AssistantResponse,
        other => return Err(ClaudeNormalizeError::UnsupportedType(other.to_string())),
    };

    let title = match event_kind {
        EventKind::SessionStarted => "session started".to_string(),
        EventKind::SessionEnded => "session ended".to_string(),
        EventKind::UserPromptSubmitted => "user prompt submitted".to_string(),
        EventKind::ToolCallStarted => {
            let tool_name = event
                .payload
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            format!("tool call started: {tool_name}")
        }
        EventKind::ToolCallCompleted => {
            let tool_name = event
                .payload
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            format!("tool call completed: {tool_name}")
        }
        EventKind::ToolCallFailed => {
            let tool_name = event
                .payload
                .get("tool_name")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            format!("tool call failed: {tool_name}")
        }
        EventKind::SubagentStarted => "subagent started".to_string(),
        EventKind::SubagentStopped => "subagent stopped".to_string(),
        EventKind::SessionTitleChanged => "session title changed".to_string(),
        EventKind::AssistantResponse => "assistant response".to_string(),
    };

    Ok(EventEnvelope {
        runtime_source: RuntimeSource::ClaudeCode,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: event.source_app,
            session_id: event.session_id,
        },
        agent_id: event.agent_id,
        occurred_at_ms: event.timestamp.unwrap_or(0),
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title,
        payload: event.payload,
    })
}
