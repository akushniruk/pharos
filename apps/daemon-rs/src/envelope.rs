use serde_json::json;

use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::tailer::TranscriptEvent;

pub fn transcript_event_to_envelope(
    event: &TranscriptEvent,
    runtime_source: RuntimeSource,
    workspace_id: &str,
    session_id: &str,
    agent_id: Option<&str>,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let (event_kind, title, payload) = match event {
        TranscriptEvent::UserPrompt { text } => (
            EventKind::UserPromptSubmitted,
            "user prompt".to_string(),
            json!({ "prompt": text }),
        ),
        TranscriptEvent::AssistantText { text, model } => (
            EventKind::AssistantResponse,
            "assistant response".to_string(),
            json!({ "text": truncate(text, 200), "model": model }),
        ),
        TranscriptEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
            model,
        } => (
            EventKind::ToolCallStarted,
            format!("tool call started: {tool_name}"),
            json!({
                "tool_name": tool_name,
                "tool_use_id": tool_use_id,
                "tool_input": input,
                "model": model,
            }),
        ),
        TranscriptEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
        } => {
            let resolved_name = tool_name.as_deref().unwrap_or("unknown");
            let kind = if *is_error {
                EventKind::ToolCallFailed
            } else {
                EventKind::ToolCallCompleted
            };
            let title = if *is_error {
                format!("tool call failed: {resolved_name}")
            } else {
                format!("tool call completed: {resolved_name}")
            };
            (
                kind,
                title,
                json!({
                    "tool_name": resolved_name,
                    "tool_use_id": tool_use_id,
                    "is_error": is_error,
                    "content": truncate(content, 500),
                }),
            )
        }
        TranscriptEvent::AiTitle { title } => (
            EventKind::SessionTitleChanged,
            format!("session title: {title}"),
            json!({ "title": title }),
        ),
    };

    EventEnvelope {
        runtime_source,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
        },
        agent_id: agent_id.map(ToString::to_string),
        occurred_at_ms,
        capabilities: CapabilitySet {
            can_observe: true,
            can_start: false,
            can_stop: false,
            can_retry: false,
            can_respond: false,
        },
        title,
        payload,
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max])
    }
}
