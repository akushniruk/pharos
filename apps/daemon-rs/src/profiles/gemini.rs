use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;

use super::DetectedSession;
use crate::model::RuntimeSource;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeGeminiSession {
    pub native_session_id: String,
    pub title: Option<String>,
    pub updated_at_ms: i64,
    pub workspace_hint: Option<String>,
    pub logs_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq)]
pub enum GeminiSessionEvent {
    UserPrompt {
        text: String,
    },
    AssistantText {
        text: String,
    },
    ToolUse {
        tool_name: String,
        tool_use_id: String,
        input: Value,
    },
    ToolResult {
        tool_use_id: String,
        tool_name: Option<String>,
        is_error: bool,
        content: String,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct GeminiLiveEvent {
    pub row_id: usize,
    pub occurred_at_ms: i64,
    pub event: GeminiSessionEvent,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiLogEntry {
    session_id: String,
    #[serde(rename = "type")]
    entry_type: String,
    message: Value,
    timestamp: String,
}

pub struct GeminiProfile {
    gemini_home: PathBuf,
}

impl GeminiProfile {
    #[must_use]
    pub fn new(gemini_home: PathBuf) -> Self {
        Self { gemini_home }
    }

    #[must_use]
    pub fn discover_native_sessions(&self) -> Vec<NativeGeminiSession> {
        let tmp_dir = self.gemini_home.join("tmp");
        let Ok(entries) = std::fs::read_dir(tmp_dir) else {
            return Vec::new();
        };

        let mut sessions = HashMap::<String, NativeGeminiSession>::new();
        for entry in entries.flatten() {
            let logs_path = entry.path().join("logs.json");
            if !logs_path.exists() {
                continue;
            }

            let workspace_hint = logs_path
                .parent()
                .and_then(|path| path.file_name())
                .and_then(|value| value.to_str())
                .filter(|value| !looks_like_hash(value))
                .map(ToString::to_string);

            let Ok(content) = std::fs::read_to_string(&logs_path) else {
                continue;
            };
            let Ok(entries) = serde_json::from_str::<Vec<GeminiLogEntry>>(&content) else {
                continue;
            };

            for entry in entries {
                let updated_at_ms = parse_rfc3339_ms(&entry.timestamp).unwrap_or(0);
                let title = title_candidate(&entry);

                let existing = sessions.entry(entry.session_id.clone()).or_insert_with(|| {
                    NativeGeminiSession {
                        native_session_id: entry.session_id.clone(),
                        title: None,
                        updated_at_ms,
                        workspace_hint: workspace_hint.clone(),
                        logs_path: logs_path.clone(),
                    }
                });

                existing.updated_at_ms = existing.updated_at_ms.max(updated_at_ms);
                if existing.workspace_hint.is_none() {
                    existing.workspace_hint = workspace_hint.clone();
                }
                if should_replace_title(existing.title.as_deref(), title.as_deref()) {
                    existing.title = title;
                }
            }
        }

        let mut sessions: Vec<_> = sessions.into_values().collect();
        sessions.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        sessions
    }

    #[must_use]
    pub fn read_live_events(&self, logs_path: &Path, after_index: usize) -> Vec<GeminiLiveEvent> {
        let Ok(content) = std::fs::read_to_string(logs_path) else {
            return Vec::new();
        };
        let Ok(entries) = serde_json::from_str::<Vec<GeminiLogEntry>>(&content) else {
            return Vec::new();
        };

        let start_index = after_index.min(entries.len());
        entries
            .into_iter()
            .enumerate()
            .skip(start_index)
            .flat_map(|(index, entry)| {
                let occurred_at_ms = parse_rfc3339_ms(&entry.timestamp).unwrap_or(0);
                parse_live_events(&entry)
                    .into_iter()
                    .map(move |event| GeminiLiveEvent {
                        row_id: index.saturating_add(1),
                        occurred_at_ms,
                        event,
                    })
            })
            .collect()
    }
}

pub fn enrich_detected_sessions(
    sessions: &mut [DetectedSession],
    native_sessions: &[NativeGeminiSession],
) {
    let live_gemini_count = sessions
        .iter()
        .filter(|session| session.runtime_source == RuntimeSource::GeminiCli)
        .count();

    for session in sessions {
        if session.runtime_source != RuntimeSource::GeminiCli {
            continue;
        }

        if let Some(native_session) = best_native_match(session, native_sessions, live_gemini_count)
        {
            if session.display_title.is_none() {
                session.display_title = native_session.title.clone();
            }
            if session.history_path.is_none() {
                session.history_path = Some(native_session.logs_path.clone());
            }
        }
    }
}

fn best_native_match<'a>(
    session: &DetectedSession,
    native_sessions: &'a [NativeGeminiSession],
    live_gemini_count: usize,
) -> Option<&'a NativeGeminiSession> {
    let workspace_name = workspace_name(&session.cwd);
    native_sessions.iter().max_by_key(|native_session| {
        let mut score = 0_i64;

        if let Some(workspace_hint) = &native_session.workspace_hint {
            if workspace_hint == &workspace_name {
                score += 5_000;
            }
        }
        if live_gemini_count == 1 {
            score += 1_000;
        }

        score + native_session.updated_at_ms
    })
}

fn title_candidate(entry: &GeminiLogEntry) -> Option<String> {
    if entry.entry_type != "user" {
        return None;
    }

    text_from_value(&entry.message).map(|text| text.chars().take(96).collect())
}

fn should_replace_title(current: Option<&str>, candidate: Option<&str>) -> bool {
    match (current, candidate) {
        (_, None) => false,
        (None, Some(_)) => true,
        (Some(current), Some(candidate))
            if current.starts_with('/') && !candidate.starts_with('/') =>
        {
            true
        }
        _ => false,
    }
}

fn workspace_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string()
}

fn looks_like_hash(value: &str) -> bool {
    value.len() >= 24 && value.chars().all(|char| char.is_ascii_hexdigit())
}

fn parse_rfc3339_ms(value: &str) -> Option<i64> {
    let timestamp =
        time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339).ok()?;
    i64::try_from(timestamp.unix_timestamp_nanos() / 1_000_000).ok()
}

fn parse_live_events(entry: &GeminiLogEntry) -> Vec<GeminiSessionEvent> {
    match entry.entry_type.as_str() {
        "user" => parse_user_events(&entry.message),
        "assistant" => parse_assistant_events(&entry.message),
        "tool_use" | "function_call" => parse_tool_use_events(&entry.message),
        "tool_result" | "function_call_output" => parse_tool_result_events(&entry.message),
        _ => Vec::new(),
    }
}

fn parse_user_events(message: &Value) -> Vec<GeminiSessionEvent> {
    if let Some(blocks) = content_blocks(message) {
        let events = blocks
            .iter()
            .filter_map(parse_tool_result_block)
            .collect::<Vec<_>>();
        if !events.is_empty() {
            return events;
        }
    }

    text_from_message(message)
        .map(|text| vec![GeminiSessionEvent::UserPrompt { text }])
        .unwrap_or_default()
}

fn parse_assistant_events(message: &Value) -> Vec<GeminiSessionEvent> {
    let mut events = Vec::new();

    if let Some(blocks) = content_blocks(message) {
        for block in blocks {
            match block.get("type").and_then(Value::as_str) {
                Some("tool_use") => {
                    if let Some(event) = parse_tool_use_block(block) {
                        events.push(event);
                    }
                }
                Some("text") => {
                    if let Some(text) = block.get("text").and_then(text_from_value) {
                        events.push(GeminiSessionEvent::AssistantText { text });
                    }
                }
                _ => {}
            }
        }
    }

    if events.is_empty() {
        if let Some(text) = text_from_message(message) {
            events.push(GeminiSessionEvent::AssistantText { text });
        }
    }

    events
}

fn parse_tool_use_events(message: &Value) -> Vec<GeminiSessionEvent> {
    if let Some(blocks) = content_blocks(message) {
        let events = blocks
            .iter()
            .filter_map(parse_tool_use_block)
            .collect::<Vec<_>>();
        if !events.is_empty() {
            return events;
        }
    }

    parse_tool_use_object(message).into_iter().collect()
}

fn parse_tool_result_events(message: &Value) -> Vec<GeminiSessionEvent> {
    if let Some(blocks) = content_blocks(message) {
        let events = blocks
            .iter()
            .filter_map(parse_tool_result_block)
            .collect::<Vec<_>>();
        if !events.is_empty() {
            return events;
        }
    }

    parse_tool_result_object(message).into_iter().collect()
}

fn parse_tool_use_block(block: &Value) -> Option<GeminiSessionEvent> {
    let tool_name = block
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| block.get("tool_name").and_then(Value::as_str))?
        .to_string();
    let tool_use_id = block
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| block.get("tool_use_id").and_then(Value::as_str))?
        .to_string();
    let input = block.get("input").cloned().unwrap_or(Value::Null);

    Some(GeminiSessionEvent::ToolUse {
        tool_name,
        tool_use_id,
        input,
    })
}

fn parse_tool_result_block(block: &Value) -> Option<GeminiSessionEvent> {
    let tool_use_id = block
        .get("tool_use_id")
        .and_then(Value::as_str)
        .or_else(|| block.get("id").and_then(Value::as_str))?
        .to_string();
    let tool_name = block
        .get("tool_name")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let is_error = block
        .get("is_error")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let content = block
        .get("content")
        .and_then(text_from_value)
        .or_else(|| block.get("output").and_then(text_from_value))
        .unwrap_or_default();

    Some(GeminiSessionEvent::ToolResult {
        tool_use_id,
        tool_name,
        is_error,
        content,
    })
}

fn parse_tool_use_object(message: &Value) -> Option<GeminiSessionEvent> {
    let tool_name = message
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| message.get("toolName").and_then(Value::as_str))?
        .to_string();
    let tool_use_id = message
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| message.get("toolUseId").and_then(Value::as_str))
        .or_else(|| message.get("tool_use_id").and_then(Value::as_str))?
        .to_string();
    let input = message
        .get("input")
        .cloned()
        .or_else(|| message.get("arguments").cloned())
        .unwrap_or(Value::Null);

    Some(GeminiSessionEvent::ToolUse {
        tool_name,
        tool_use_id,
        input,
    })
}

fn parse_tool_result_object(message: &Value) -> Option<GeminiSessionEvent> {
    let tool_use_id = message
        .get("tool_use_id")
        .and_then(Value::as_str)
        .or_else(|| message.get("toolUseId").and_then(Value::as_str))
        .or_else(|| message.get("id").and_then(Value::as_str))?
        .to_string();
    let tool_name = message
        .get("tool_name")
        .and_then(Value::as_str)
        .or_else(|| message.get("toolName").and_then(Value::as_str))
        .map(ToString::to_string);
    let is_error = message
        .get("is_error")
        .and_then(Value::as_bool)
        .or_else(|| message.get("isError").and_then(Value::as_bool))
        .unwrap_or(false);
    let content = message
        .get("content")
        .and_then(text_from_value)
        .or_else(|| message.get("output").and_then(text_from_value))
        .unwrap_or_default();

    Some(GeminiSessionEvent::ToolResult {
        tool_use_id,
        tool_name,
        is_error,
        content,
    })
}

fn content_blocks(message: &Value) -> Option<&[Value]> {
    message
        .get("content")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .or_else(|| {
            message
                .get("parts")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
        })
}

fn text_from_message(message: &Value) -> Option<String> {
    if let Some(text) = message.as_str() {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(text) = message.get("content").and_then(text_from_value) {
        return Some(text);
    }
    if let Some(text) = message.get("text").and_then(text_from_value) {
        return Some(text);
    }
    if let Some(blocks) = content_blocks(message) {
        let mut text = String::new();
        for block in blocks {
            if let Some(block_text) = block.get("text").and_then(text_from_value) {
                text.push_str(&block_text);
            }
        }
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

fn text_from_value(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Array(values) => {
            let parts = values
                .iter()
                .filter_map(text_from_value)
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        Value::Object(map) => map
            .get("text")
            .and_then(text_from_value)
            .or_else(|| map.get("content").and_then(text_from_value))
            .or_else(|| map.get("output").and_then(text_from_value)),
        _ => None,
    }
}
