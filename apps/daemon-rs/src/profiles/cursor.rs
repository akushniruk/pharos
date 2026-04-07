use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde_json::Value;

use super::DetectedSession;
use crate::model::RuntimeSource;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeCursorSession {
    pub native_session_id: String,
    pub title: Option<String>,
    pub updated_at_ms: i64,
    pub project_root: Option<String>,
    pub project_hint: Option<String>,
    pub transcript_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CursorSessionEvent {
    UserPrompt { text: String },
    AssistantText { text: String },
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
    SubagentStart {
        agent_id: String,
        display_name: String,
        description: Option<String>,
        parent_agent_id: Option<String>,
        subagent_type: Option<String>,
    },
}

pub struct CursorProfile {
    cursor_home: PathBuf,
}

impl CursorProfile {
    #[must_use]
    pub fn new(cursor_home: PathBuf) -> Self {
        Self { cursor_home }
    }

    #[must_use]
    pub fn discover_native_sessions(&self) -> Vec<NativeCursorSession> {
        let projects_dir = self.cursor_home.join("projects");
        let Ok(project_entries) = std::fs::read_dir(projects_dir) else {
            return Vec::new();
        };

        let mut sessions = Vec::new();
        for project_entry in project_entries.flatten() {
            let project_path = project_entry.path();
            let project_hint = project_path
                .file_name()
                .and_then(|value| value.to_str())
                .map(ToString::to_string);
            let transcripts_dir = project_path.join("agent-transcripts");
            let Ok(session_dirs) = std::fs::read_dir(transcripts_dir) else {
                continue;
            };

            for session_dir in session_dirs.flatten() {
                let session_path = session_dir.path();
                let native_session_id = session_path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_string();
                if native_session_id.is_empty() {
                    continue;
                }
                let transcript_path = session_path.join(format!("{native_session_id}.jsonl"));
                if !transcript_path.exists() {
                    continue;
                }

                let (title, project_root) =
                    parse_cursor_transcript_metadata(&transcript_path, project_hint.as_deref());
                let updated_at_ms = modified_ms(&transcript_path);
                sessions.push(NativeCursorSession {
                    native_session_id,
                    title,
                    updated_at_ms,
                    project_root,
                    project_hint: project_hint.clone(),
                    transcript_path,
                });
            }
        }

        sessions.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        sessions
    }

    #[must_use]
    pub fn discover_sessions(&self) -> Vec<DetectedSession> {
        self.discover_native_sessions()
            .into_iter()
            .map(|native| {
                let cwd = native
                    .project_root
                    .clone()
                    .unwrap_or_else(|| normalized_project_hint(native.project_hint.as_deref().unwrap_or("cursor")));
                DetectedSession {
                    runtime_source: RuntimeSource::CursorAgent,
                    session_id: format!("cursor-{}", native.native_session_id),
                    native_session_id: Some(native.native_session_id),
                    pid: None,
                    cwd,
                    started_at_ms: native.updated_at_ms,
                    entrypoint: "cursor-native".to_string(),
                    display_title: native.title,
                    history_path: None,
                    transcript_path: Some(native.transcript_path),
                    subagents_dir: None,
                }
            })
            .collect()
    }
}

pub fn enrich_detected_sessions(
    sessions: &mut [DetectedSession],
    native_sessions: &[NativeCursorSession],
) {
    let live_cursor_count = sessions
        .iter()
        .filter(|session| session.runtime_source == RuntimeSource::CursorAgent)
        .count();

    for session in sessions {
        if session.runtime_source != RuntimeSource::CursorAgent {
            continue;
        }
        if let Some(native_session) = best_native_match(session, native_sessions, live_cursor_count) {
            let native_project_context = native_session
                .project_root
                .clone()
                .unwrap_or_else(|| {
                    normalized_project_hint(native_session.project_hint.as_deref().unwrap_or("cursor"))
                });
            if session.display_title.is_none() {
                session.display_title = native_session.title.clone();
            }
            if session.native_session_id.is_none() {
                session.native_session_id = Some(native_session.native_session_id.clone());
            }
            if session.transcript_path.is_none() {
                session.transcript_path = Some(native_session.transcript_path.clone());
            }
            if should_replace_session_cwd(&session.cwd, &session.entrypoint) {
                session.cwd = native_project_context;
            }
        }
    }
}

fn best_native_match<'a>(
    session: &DetectedSession,
    native_sessions: &'a [NativeCursorSession],
    live_cursor_count: usize,
) -> Option<&'a NativeCursorSession> {
    let workspace = workspace_name(&session.cwd);
    let workspace_is_project_like = is_project_like_name(&workspace);
    let mut best: Option<(&NativeCursorSession, i64, i64)> = None;

    for native_session in native_sessions {
        let mut score = 0_i64;
        let mut correlation = 0_i64;
        if let Some(project_root) = &native_session.project_root {
            if project_root == &session.cwd {
                score += 100_000;
                correlation += 100_000;
            } else if workspace == workspace_name(project_root) {
                score += 40_000;
                correlation += 40_000;
            }
        }
        if let Some(project_hint) = &native_session.project_hint {
            if workspace == normalized_project_hint(project_hint) {
                score += 10_000;
                correlation += 10_000;
            }
        }
        if live_cursor_count == 1 {
            score += 1_000;
            if !workspace_is_project_like && native_sessions.len() == 1 {
                correlation += 1;
            }
        }

        if best
            .as_ref()
            .is_none_or(|(_, best_score, best_correlation)| {
                score > *best_score || (score == *best_score && correlation > *best_correlation)
            })
        {
            best = Some((native_session, score, correlation));
        }
    }

    let (native_session, score, correlation) = best?;
    // Avoid mis-associating unrelated transcripts when there are multiple
    // live Cursor sessions and we have no workspace/project correlation.
    if score <= 0 || correlation <= 0 {
        return None;
    }

    Some(native_session)
}

pub fn parse_cursor_jsonl_line(line: &str) -> Vec<CursorSessionEvent> {
    let Ok(root) = serde_json::from_str::<Value>(line) else {
        return Vec::new();
    };
    let role = root.get("role").and_then(Value::as_str).unwrap_or("");
    let message = root.get("message").unwrap_or(&root);
    let content = message
        .get("content")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);

    let mut events = Vec::new();
    for (index, block) in content.iter().enumerate() {
        match block.get("type").and_then(Value::as_str) {
            Some("text") => {
                let text = block
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|text| !text.is_empty())
                    .map(ToString::to_string);
                if let Some(text) = text {
                    if role == "user" {
                        events.push(CursorSessionEvent::UserPrompt { text });
                    } else if role == "assistant" {
                        events.push(CursorSessionEvent::AssistantText { text });
                    }
                }
            }
            Some("tool_use") => {
                let tool_name = block
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_string();
                let tool_use_id = block
                    .get("id")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                    .unwrap_or_else(|| format!("cursor-tool-{}", stable_hash(&format!("{line}:{index}"))));
                let input = block.get("input").cloned().unwrap_or(Value::Null);
                if is_subagent_tool_name(&tool_name) {
                    let description = input
                        .get("description")
                        .and_then(Value::as_str)
                        .or_else(|| input.get("message").and_then(Value::as_str))
                        .map(ToString::to_string);
                    let subagent_type = input
                        .get("subagent_type")
                        .and_then(Value::as_str)
                        .or_else(|| input.get("agent_type").and_then(Value::as_str))
                        .map(ToString::to_string);
                    let display_name = input
                        .get("display_name")
                        .and_then(Value::as_str)
                        .or_else(|| input.get("agent_name").and_then(Value::as_str))
                        .or_else(|| subagent_type.as_deref())
                        .map(title_case)
                        .unwrap_or_else(|| "Cursor Helper".to_string());
                    let parent_agent_id = input
                        .get("parent_agent_id")
                        .and_then(Value::as_str)
                        .or_else(|| input.get("parent_id").and_then(Value::as_str))
                        .or_else(|| input.get("parentId").and_then(Value::as_str))
                        .map(ToString::to_string);
                    events.push(CursorSessionEvent::SubagentStart {
                        agent_id: tool_use_id.clone(),
                        display_name,
                        description,
                        parent_agent_id,
                        subagent_type,
                    });
                }
                events.push(CursorSessionEvent::ToolUse {
                    tool_name,
                    tool_use_id,
                    input,
                });
            }
            Some("tool_result") => {
                let tool_use_id = block
                    .get("tool_use_id")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                    .unwrap_or_else(|| format!("cursor-result-{}", stable_hash(&format!("{line}:{index}"))));
                let tool_name = block
                    .get("tool_name")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
                let is_error = block.get("is_error").and_then(Value::as_bool).unwrap_or(false);
                let content = block
                    .get("content")
                    .and_then(text_from_value)
                    .unwrap_or_default();
                events.push(CursorSessionEvent::ToolResult {
                    tool_use_id,
                    tool_name,
                    is_error,
                    content,
                });
            }
            _ => {}
        }
    }
    events
}

fn parse_cursor_transcript_metadata(
    path: &Path,
    project_hint: Option<&str>,
) -> (Option<String>, Option<String>) {
    let Ok(file) = std::fs::File::open(path) else {
        return (None, None);
    };
    let reader = std::io::BufReader::new(file);
    let mut title: Option<String> = None;
    let mut project_root: Option<String> = None;
    let expected_workspace = project_hint
        .map(normalized_project_hint)
        .filter(|workspace| is_project_like_name(workspace));
    for line in reader.lines().map_while(Result::ok).take(200) {
        for event in parse_cursor_jsonl_line(&line) {
            if title.is_none() {
                if let CursorSessionEvent::UserPrompt { text } = &event {
                    title = Some(text.chars().take(96).collect());
                    if project_root.is_none() {
                        project_root = extract_project_root(text, expected_workspace.as_deref());
                    }
                }
            }
        }
        if title.is_some() && project_root.is_some() {
            break;
        }
    }
    (title, project_root)
}

fn extract_project_root(text: &str, expected_workspace: Option<&str>) -> Option<String> {
    for token in text.split_whitespace() {
        let clean = token.trim_matches(|ch: char| ch == '"' || ch == '\'' || ch == ',' || ch == '.');
        if clean.starts_with('/') && clean.contains('/') {
            if let Some(expected) = expected_workspace {
                let candidate_workspace = workspace_name(clean);
                if candidate_workspace != expected {
                    continue;
                }
            }
            return Some(clean.to_string());
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
            let parts = values.iter().filter_map(text_from_value).collect::<Vec<_>>();
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

fn modified_ms(path: &Path) -> i64 {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
        .unwrap_or(0)
}

fn workspace_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string()
}

fn normalized_project_hint(project_hint: &str) -> String {
    let parts = project_hint.split('-').collect::<Vec<_>>();
    if let Some(index) = parts.iter().position(|part| *part == "home_projects") {
        if let Some(candidate) = parts.get(index + 1).copied() {
            return candidate.to_string();
        }
    }
    parts
        .last()
        .copied()
        .unwrap_or(project_hint)
        .to_string()
}

fn should_replace_session_cwd(cwd: &str, entrypoint: &str) -> bool {
    let workspace = workspace_name(cwd);
    if cwd == entrypoint {
        return true;
    }
    if cwd.starts_with("/Applications/Cursor.app/")
        || cwd.starts_with("/System/")
        || cwd.starts_with("/usr/libexec/")
    {
        return true;
    }
    !is_project_like_name(&workspace)
}

fn is_project_like_name(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    !normalized.is_empty()
        && !matches!(
            normalized.as_str(),
            "unknown"
                | "macos"
                | "resources"
                | "data"
                | "libexec"
                | "sbin"
                | "bin"
                | "system"
                | "contents"
                | "workbench"
                | "app"
                | "out"
        )
}

fn stable_hash(body: &str) -> u64 {
    use std::hash::{DefaultHasher, Hasher};
    let mut hasher = DefaultHasher::new();
    hasher.write(body.as_bytes());
    hasher.finish()
}

fn title_case(value: &str) -> String {
    let cleaned = value.trim().replace('_', " ");
    let mut words = Vec::new();
    for word in cleaned.split_whitespace() {
        let mut chars = word.chars();
        if let Some(first) = chars.next() {
            words.push(format!(
                "{}{}",
                first.to_uppercase(),
                chars.as_str().to_lowercase()
            ));
        }
    }
    if words.is_empty() {
        "Cursor Helper".to_string()
    } else {
        words.join(" ")
    }
}

fn is_subagent_tool_name(name: &str) -> bool {
    let normalized = name.trim().to_ascii_lowercase();
    matches!(normalized.as_str(), "agent" | "spawn_agent" | "subagent" | "task")
}
