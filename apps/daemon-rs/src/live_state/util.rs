use std::time::{SystemTime, UNIX_EPOCH};

use crate::model::LegacyHookEvent;

pub(crate) fn payload_string(payload: &serde_json::Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(ToString::to_string)
}

pub(crate) fn payload_responsibility(payload: &serde_json::Value) -> Option<String> {
    payload_string(payload, "responsibility")
        .or_else(|| payload_string(payload, "description"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(crate) fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    if max == 0 {
        return String::new();
    }

    let mut end = max.saturating_sub(1);
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }

    format!("{}…", &text[..end])
}

pub(crate) fn clean_summary_text(value: &str) -> Option<String> {
    let without_tags = strip_markup_tags(value);
    let collapsed = without_tags
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub(crate) fn strip_markup_tags(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => {
                in_tag = true;
            }
            '>' => {
                if in_tag {
                    in_tag = false;
                    out.push(' ');
                } else {
                    out.push(ch);
                }
            }
            _ => {
                if !in_tag {
                    out.push(ch);
                }
            }
        }
    }
    out
}

pub(crate) fn content_preview(content: &str) -> Option<String> {
    for line in content.lines() {
        if let Some(clean) = clean_summary_text(line) {
            return Some(clean);
        }
    }
    clean_summary_text(content)
}

pub(crate) fn short_path(path: &str) -> Option<String> {
    let parts = path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty() {
        None
    } else {
        Some(
            parts
                .into_iter()
                .rev()
                .take(3)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("/"),
        )
    }
}

pub(crate) fn basename_from_path(path: &str) -> Option<String> {
    path.split('/')
        .filter(|part| !part.is_empty())
        .next_back()
        .map(ToString::to_string)
}

pub(crate) fn workspace_name_from_cwd(cwd: &str) -> Option<String> {
    cwd.split('/')
        .filter(|part| !part.is_empty())
        .next_back()
        .map(ToString::to_string)
}

pub(crate) fn current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
        .unwrap_or(0)
}

pub(crate) fn build_registry_id(source_app: &str, session_id: &str, agent_id: Option<&str>) -> String {
    let session_prefix: String = session_id.chars().take(8).collect();
    match agent_id {
        Some(agent_id) if !agent_id.is_empty() => {
            format!("{source_app}:{session_prefix}:{agent_id}")
        }
        _ => format!("{source_app}:{session_prefix}"),
    }
}

pub(crate) fn resolve_lifecycle_status(hook_event_type: &str) -> &'static str {
    match hook_event_type {
        "SessionEnd"
        | "SubagentStop"
        | "SubagentStopped"
        | "SubagentComplete"
        | "SubagentCompleted"
        | "AgentStop"
        | "AgentStopped" => "stopped",
        "PostToolUseFailure" => "error",
        "AssistantResponse" | "PostToolUse" | "SessionTitleChanged" => "idle",
        "PreToolUse"
        | "ToolCallStarted"
        | "UserPromptSubmit"
        | "SubagentStart"
        | "SessionStart" => "active",
        _ => "active",
    }
}

pub(crate) fn encode_data_uri_component(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric()
            || matches!(byte, b'-' | b'_' | b'.' | b'~')
        {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

pub(crate) fn escape_svg_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub(crate) fn initials_from_name(name: &str, fallback: &str) -> String {
    let initials = name
        .chars()
        .filter(|c| c.is_alphanumeric())
        .take(2)
        .collect::<String>();
    if initials.is_empty() {
        return fallback.to_string();
    }
    initials.to_uppercase()
}

pub(crate) fn legacy_event_search_text(event: &LegacyHookEvent) -> String {
    let mut parts = Vec::new();
    parts.push(event.hook_event_type.clone());
    parts.push(event.source_app.clone());
    parts.push(event.session_id.clone());
    if let Some(value) = &event.display_name {
        parts.push(value.clone());
    }
    if let Some(value) = &event.agent_name {
        parts.push(value.clone());
    }
    if let Some(value) = event.payload.get("runtime_label").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event.payload.get("tool_name").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event.payload.get("prompt").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event.payload.get("message").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event.payload.get("text").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event.payload.get("content").and_then(serde_json::Value::as_str) {
        parts.push(value.to_string());
    }
    if let Some(value) = event
        .payload
        .get("description")
        .and_then(serde_json::Value::as_str)
    {
        parts.push(value.to_string());
    }
    parts.join(" ").to_ascii_lowercase()
}
