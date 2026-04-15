use serde_json::json;

use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::codex::CodexSessionEvent;
use crate::profiles::cursor::CursorSessionEvent;
use crate::profiles::gemini::GeminiSessionEvent;
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
            json!({ "text": text, "model": model }),
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

pub fn codex_event_to_envelope(
    event: &CodexSessionEvent,
    workspace_id: &str,
    session_id: &str,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let (event_kind, title, payload) = match event {
        CodexSessionEvent::UserPrompt { text } => (
            EventKind::UserPromptSubmitted,
            "user prompt".to_string(),
            json!({ "prompt": truncate(text, 500) }),
        ),
        CodexSessionEvent::AssistantText { text, model } => (
            EventKind::AssistantResponse,
            "assistant response".to_string(),
            json!({
                "text": text,
                "model": model.as_deref().unwrap_or("codex"),
            }),
        ),
        CodexSessionEvent::SessionTitleChanged { title } => (
            EventKind::SessionTitleChanged,
            format!("session title: {title}"),
            json!({ "title": title }),
        ),
        CodexSessionEvent::SubagentStart {
            agent_type,
            display_name,
            description,
            model,
            reasoning_effort,
            agent_id: _,
        } => (
            EventKind::SubagentStarted,
            format!("subagent started: {display_name}"),
            json!({
                "agent_type": agent_type,
                "agent_name": display_name,
                "display_name": resolve_subagent_display_name(display_name, agent_type, description.as_deref()),
                "description": description,
                "responsibility": description,
                "model": model,
                "reasoning_effort": reasoning_effort,
                "parent_agent_id": "main",
            }),
        ),
        CodexSessionEvent::ToolUse {
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
                "model": model.as_deref().unwrap_or("codex"),
            }),
        ),
        CodexSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
            model,
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
                    "model": model.as_deref().unwrap_or("codex"),
                }),
            )
        }
    };

    EventEnvelope {
        runtime_source: RuntimeSource::CodexCli,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
        },
        agent_id: match event {
            CodexSessionEvent::SubagentStart { agent_id, .. } => Some(agent_id.clone()),
            _ => None,
        },
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

pub fn gemini_event_to_envelope(
    event: &GeminiSessionEvent,
    workspace_id: &str,
    session_id: &str,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let (event_kind, title, payload) = match event {
        GeminiSessionEvent::UserPrompt { text } => (
            EventKind::UserPromptSubmitted,
            "user prompt".to_string(),
            json!({ "prompt": truncate(text, 500) }),
        ),
        GeminiSessionEvent::AssistantText { text } => (
            EventKind::AssistantResponse,
            "assistant response".to_string(),
            json!({ "text": text, "model": "gemini" }),
        ),
        GeminiSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => (
            EventKind::ToolCallStarted,
            format!("tool call started: {tool_name}"),
            json!({
                "tool_name": tool_name,
                "tool_use_id": tool_use_id,
                "tool_input": input,
                "model": "gemini",
            }),
        ),
        GeminiSessionEvent::ToolResult {
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
    };

    EventEnvelope {
        runtime_source: RuntimeSource::GeminiCli,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
        },
        agent_id: None,
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

pub fn cursor_event_to_envelope(
    event: &CursorSessionEvent,
    workspace_id: &str,
    session_id: &str,
    occurred_at_ms: i64,
) -> EventEnvelope {
    let (event_kind, title, payload) = match event {
        CursorSessionEvent::UserPrompt { text } => (
            EventKind::UserPromptSubmitted,
            "user prompt".to_string(),
            json!({ "prompt": truncate(text, 500) }),
        ),
        CursorSessionEvent::AssistantText { text } => (
            EventKind::AssistantResponse,
            "assistant response".to_string(),
            json!({ "text": text, "model": "cursor-agent" }),
        ),
        CursorSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => (
            EventKind::ToolCallStarted,
            format!("tool call started: {tool_name}"),
            json!({
                "tool_name": tool_name,
                "tool_use_id": tool_use_id,
                "tool_input": input,
                "model": "cursor-agent",
            }),
        ),
        CursorSessionEvent::ToolResult {
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
        CursorSessionEvent::SubagentStart {
            agent_id: _,
            display_name,
            description,
            parent_agent_id,
            subagent_type,
        } => {
            let effective_type = subagent_type.as_deref().unwrap_or("cursor_subagent");
            (
                EventKind::SubagentStarted,
                format!("subagent started: {display_name}"),
                json!({
                    "agent_type": effective_type,
                    "agent_name": display_name,
                    "display_name": resolve_subagent_display_name(display_name, effective_type, description.as_deref()),
                    "description": description,
                    "responsibility": description,
                    "parent_agent_id": parent_agent_id.clone().unwrap_or_else(|| "main".to_string()),
                }),
            )
        },
    };

    EventEnvelope {
        runtime_source: RuntimeSource::CursorAgent,
        acquisition_mode: AcquisitionMode::Observed,
        event_kind,
        session: SessionRef {
            host_id: "local".to_string(),
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
        },
        agent_id: match event {
            CursorSessionEvent::SubagentStart { agent_id, .. } => Some(agent_id.clone()),
            _ => None,
        },
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
        return s.to_string();
    }
    // Find a char boundary at or before max
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}...", &s[..end])
}

fn resolve_subagent_display_name(
    display_name: &str,
    agent_type: &str,
    description: Option<&str>,
) -> String {
    if let Some(description) = description.map(str::trim).filter(|value| !value.is_empty()) {
        return description.to_string();
    }
    mapped_agent_type_label(agent_type).unwrap_or_else(|| display_name.trim().to_string())
}

fn mapped_agent_type_label(agent_type: &str) -> Option<String> {
    let normalized = agent_type.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    let mapped = match normalized.as_str() {
        "team-reviewer" | "code-reviewer" => Some("Code Reviewer"),
        "reviewer" => Some("Reviewer"),
        "architect" => Some("Architect"),
        "coder" => Some("Coder"),
        "security-architect" => Some("Security Architect"),
        "researcher" => Some("Researcher"),
        "optimizer" => Some("Optimizer"),
        "documenter" => Some("Documenter"),
        "queen-coordinator" => Some("Queen Coordinator"),
        "memory-specialist" => Some("Memory Specialist"),
        "perf-engineer" => Some("Perf Engineer"),
        "pr-review-toolkit" => Some("PR Review Toolkit"),
        "full-stack-orchestrator" => Some("Full Stack Orchestrator"),
        "general-purpose" => Some("General Purpose"),
        "orchestrator" => Some("Orchestrator"),
        "explorer" | "explore" => Some("Explorer"),
        "cursor_subagent" => Some("Cursor Helper"),
        "main" => Some("Session"),
        _ => None,
    };
    if let Some(value) = mapped {
        return Some(value.to_string());
    }
    let words = normalized
        .replace('_', "-")
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            if let Some(first) = chars.next() {
                format!("{}{}", first.to_uppercase(), chars.as_str())
            } else {
                String::new()
            }
        })
        .collect::<Vec<_>>();
    if words.is_empty() {
        None
    } else {
        Some(words.join(" "))
    }
}
