use serde_json::Value;

/// A parsed event from a Claude `JSONL` transcript line.
#[derive(Debug, Clone)]
pub enum TranscriptEvent {
    UserPrompt {
        text: String,
    },
    AssistantText {
        text: String,
        model: Option<String>,
    },
    ToolUse {
        tool_name: String,
        tool_use_id: String,
        input: Value,
        model: Option<String>,
    },
    ToolResult {
        tool_use_id: String,
        tool_name: Option<String>,
        is_error: bool,
        content: String,
    },
    AiTitle {
        title: String,
    },
}

/// A transcript event with its timestamp from the JSONL line.
#[derive(Debug, Clone)]
pub struct TimestampedEvent {
    pub event: TranscriptEvent,
    pub timestamp_ms: Option<i64>,
}

/// Parse a single JSONL line into zero or more `TimestampedEvent`s.
/// A single Claude JSONL line can contain multiple content blocks
/// (e.g. multiple tool_use or tool_result blocks in one message).
#[must_use]
pub fn parse_jsonl_line(line: &str) -> Vec<TimestampedEvent> {
    let Some(obj) = serde_json::from_str::<Value>(line).ok() else {
        return Vec::new();
    };
    let Some(line_type) = obj.get("type").and_then(Value::as_str) else {
        return Vec::new();
    };

    let timestamp_ms = parse_timestamp(&obj);

    let events = match line_type {
        "ai-title" => {
            if let Some(title) = obj.get("aiTitle").and_then(Value::as_str) {
                vec![TranscriptEvent::AiTitle {
                    title: title.to_string(),
                }]
            } else {
                Vec::new()
            }
        }
        "user" => parse_user_line(&obj),
        "assistant" => parse_assistant_line(&obj),
        _ => Vec::new(),
    };

    events
        .into_iter()
        .map(|event| TimestampedEvent {
            event,
            timestamp_ms,
        })
        .collect()
}

/// Parse ISO 8601 timestamp string to epoch milliseconds.
fn parse_timestamp(obj: &Value) -> Option<i64> {
    let ts_str = obj.get("timestamp").and_then(Value::as_str)?;
    // Parse "2026-04-02T15:44:23.756Z" format
    // Simple manual parse to avoid adding chrono dependency
    parse_iso8601_ms(ts_str)
}

fn parse_iso8601_ms(s: &str) -> Option<i64> {
    // Expected format: YYYY-MM-DDTHH:MM:SS.mmmZ
    let s = s.trim_end_matches('Z');
    let (date_part, time_part) = s.split_once('T')?;
    let date_parts: Vec<&str> = date_part.split('-').collect();
    let (time_main, frac) = if let Some((main, f)) = time_part.split_once('.') {
        (main, f)
    } else {
        (time_part, "0")
    };
    let time_parts: Vec<&str> = time_main.split(':').collect();

    if date_parts.len() != 3 || time_parts.len() != 3 {
        return None;
    }

    let year: i64 = date_parts[0].parse().ok()?;
    let month: i64 = date_parts[1].parse().ok()?;
    let day: i64 = date_parts[2].parse().ok()?;
    let hour: i64 = time_parts[0].parse().ok()?;
    let min: i64 = time_parts[1].parse().ok()?;
    let sec: i64 = time_parts[2].parse().ok()?;

    // Fractional seconds to milliseconds
    let millis: i64 = if frac.len() >= 3 {
        frac[..3].parse().unwrap_or(0)
    } else {
        let padded = format!("{frac:0<3}");
        padded.parse().unwrap_or(0)
    };

    // Days from epoch (simplified, doesn't handle leap seconds but good enough)
    let mut days: i64 = 0;
    for y in 1970..year {
        days += if is_leap(y) { 366 } else { 365 };
    }
    let month_days = [31, if is_leap(year) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for m in 0..(month - 1) as usize {
        days += month_days.get(m).copied().unwrap_or(30) as i64;
    }
    days += day - 1;

    Some(days * 86_400_000 + hour * 3_600_000 + min * 60_000 + sec * 1_000 + millis)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn parse_user_line(obj: &Value) -> Vec<TranscriptEvent> {
    let Some(content) = obj.get("message").and_then(|m| m.get("content")) else {
        return Vec::new();
    };

    // String content = user prompt
    if let Some(text) = content.as_str() {
        return vec![TranscriptEvent::UserPrompt {
            text: text.to_string(),
        }];
    }

    // Array content = tool results (may contain multiple)
    let Some(blocks) = content.as_array() else {
        return Vec::new();
    };

    let mut events = Vec::new();
    for block in blocks {
        if block.get("type").and_then(Value::as_str) == Some("tool_result") {
            let tool_use_id = block
                .get("tool_use_id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let is_error = block
                .get("is_error")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let content = block
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            events.push(TranscriptEvent::ToolResult {
                tool_use_id,
                tool_name: None,
                is_error,
                content,
            });
        }
    }
    events
}

fn parse_assistant_line(obj: &Value) -> Vec<TranscriptEvent> {
    let Some(message) = obj.get("message") else {
        return Vec::new();
    };
    let model = message
        .get("model")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let Some(blocks) = message.get("content").and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut events = Vec::new();
    for block in blocks {
        let Some(block_type) = block.get("type").and_then(Value::as_str) else {
            continue;
        };
        match block_type {
            "tool_use" => {
                if let (Some(tool_name), Some(tool_use_id)) = (
                    block.get("name").and_then(Value::as_str),
                    block.get("id").and_then(Value::as_str),
                ) {
                    let input = block.get("input").cloned().unwrap_or(Value::Null);
                    events.push(TranscriptEvent::ToolUse {
                        tool_name: tool_name.to_string(),
                        tool_use_id: tool_use_id.to_string(),
                        input,
                        model: model.clone(),
                    });
                }
            }
            "text" => {
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    events.push(TranscriptEvent::AssistantText {
                        text: text.to_string(),
                        model: model.clone(),
                    });
                }
            }
            _ => continue,
        }
    }
    events
}
