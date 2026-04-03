use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

use rusqlite::{Connection, types::ValueRef};
use serde::Deserialize;
use serde_json::Value;

use super::DetectedSession;
use crate::model::RuntimeSource;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeCodexSession {
    pub native_session_id: String,
    pub title: Option<String>,
    pub updated_at_ms: i64,
    pub project_root: Option<String>,
    pub history_path: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
struct CodexIndexEntry {
    id: String,
    #[serde(default)]
    thread_name: String,
    #[serde(default)]
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CodexSessionFile {
    session: CodexSessionHeader,
    #[serde(default)]
    items: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CodexSessionEvent {
    UserPrompt {
        text: String,
    },
    AssistantText {
        text: String,
        model: Option<String>,
    },
    SessionTitleChanged {
        title: String,
    },
    SubagentStart {
        agent_type: String,
        display_name: String,
        description: Option<String>,
        model: Option<String>,
        reasoning_effort: Option<String>,
        agent_id: String,
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
        model: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct CodexLiveEvent {
    pub row_id: i64,
    pub occurred_at_ms: i64,
    pub event: CodexSessionEvent,
}

#[derive(Debug, Deserialize)]
struct CodexSessionHeader {
    id: String,
    #[serde(default)]
    timestamp: String,
}

pub struct CodexProfile {
    codex_home: PathBuf,
}

#[derive(Debug, Clone)]
struct CachedCodexDiscovery {
    fingerprint: CodexDiscoveryFingerprint,
    sessions: Vec<NativeCodexSession>,
}

#[derive(Debug, Clone)]
struct CachedCodexHistory {
    fingerprint: CodexHistoryFingerprint,
    events: Vec<CodexSessionEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CodexDiscoveryFingerprint {
    index_modified_ms: u128,
    sessions_modified_ms: u128,
    state_modified_ms: u128,
    session_file_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CodexHistoryFingerprint {
    modified_ms: u128,
    file_len: u64,
}

static DISCOVERY_CACHE: LazyLock<Mutex<HashMap<PathBuf, CachedCodexDiscovery>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static HISTORY_CACHE: LazyLock<Mutex<HashMap<PathBuf, CachedCodexHistory>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

impl CodexProfile {
    #[must_use]
    pub fn new(codex_home: PathBuf) -> Self {
        Self { codex_home }
    }

    #[must_use]
    pub fn discover_native_sessions(&self) -> Vec<NativeCodexSession> {
        let fingerprint = self.discovery_fingerprint();
        if let Ok(cache) = DISCOVERY_CACHE.lock() {
            if let Some(cached) = cache.get(&self.codex_home) {
                if cached.fingerprint == fingerprint {
                    return cached.sessions.clone();
                }
            }
        }

        let mut sessions_by_id = HashMap::<String, NativeCodexSession>::new();

        for state_session in self.discover_state_sessions() {
            merge_native_session(&mut sessions_by_id, state_session);
        }

        let index_path = self.codex_home.join("session_index.jsonl");
        if let Ok(content) = std::fs::read_to_string(index_path) {
            for line in content.lines() {
                let Ok(entry) = serde_json::from_str::<CodexIndexEntry>(line) else {
                    continue;
                };

                merge_native_session(
                    &mut sessions_by_id,
                    NativeCodexSession {
                        native_session_id: entry.id.clone(),
                        title: non_empty_string(entry.thread_name),
                        updated_at_ms: parse_rfc3339_ms(&entry.updated_at).unwrap_or(0),
                        project_root: None,
                        history_path: None,
                    },
                );
            }
        }

        for live_session in self.discover_log_sessions() {
            merge_native_session(&mut sessions_by_id, live_session);
        }

        let sessions_dir = self.codex_home.join("sessions");
        let Ok(entries) = std::fs::read_dir(sessions_dir) else {
            return sessions_by_id.into_values().collect();
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }

            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Ok(parsed) = serde_json::from_str::<CodexSessionFile>(&content) else {
                continue;
            };

            let title = extract_session_metadata(&parsed.items)
                .title
                .or_else(|| latest_user_prompt(&parsed.items))
                .or_else(|| {
                    sessions_by_id
                        .get(&parsed.session.id)
                        .and_then(|entry| entry.title.clone())
                });
            let updated_at_ms = sessions_by_id
                .get(&parsed.session.id)
                .map(|entry| entry.updated_at_ms)
                .filter(|timestamp| *timestamp > 0)
                .or_else(|| parse_rfc3339_ms(&parsed.session.timestamp))
                .unwrap_or(0);
            let project_root = extract_session_metadata(&parsed.items)
                .project_root
                .or_else(|| extract_project_root(&parsed.items));

            merge_native_session(
                &mut sessions_by_id,
                NativeCodexSession {
                    native_session_id: parsed.session.id.clone(),
                    title,
                    updated_at_ms,
                    project_root,
                    history_path: Some(path),
                },
            );
        }

        let mut sessions: Vec<_> = sessions_by_id.into_values().collect();
        sessions.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));

        if let Ok(mut cache) = DISCOVERY_CACHE.lock() {
            cache.insert(
                self.codex_home.clone(),
                CachedCodexDiscovery {
                    fingerprint,
                    sessions: sessions.clone(),
                },
            );
        }

        sessions
    }

    pub fn read_session_events(&self, history_path: &std::path::Path) -> Vec<CodexSessionEvent> {
        let fingerprint = history_fingerprint(history_path);
        if let Ok(cache) = HISTORY_CACHE.lock() {
            if let Some(cached) = cache.get(history_path) {
                if cached.fingerprint == fingerprint {
                    return cached.events.clone();
                }
            }
        }

        let Ok(content) = std::fs::read_to_string(history_path) else {
            return Vec::new();
        };
        let events = if history_path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            parse_codex_jsonl(&content)
        } else if let Ok(parsed) = serde_json::from_str::<CodexSessionFile>(&content) {
            parse_codex_items(&parsed.items)
        } else {
            parse_codex_jsonl(&content)
        };

        if let Ok(mut cache) = HISTORY_CACHE.lock() {
            cache.insert(
                history_path.to_path_buf(),
                CachedCodexHistory {
                    fingerprint,
                    events: events.clone(),
                },
            );
        }

        events
    }

    fn discover_state_sessions(&self) -> Vec<NativeCodexSession> {
        let Ok(entries) = std::fs::read_dir(&self.codex_home) else {
            return Vec::new();
        };

        let mut sessions = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !file_name.starts_with("state_")
                || path.extension().and_then(|value| value.to_str()) != Some("sqlite")
            {
                continue;
            }

            let Ok(connection) = Connection::open(&path) else {
                continue;
            };
            let Ok(mut statement) = connection.prepare(
                "SELECT id, title, updated_at, rollout_path, cwd
                 FROM threads
                 ORDER BY updated_at DESC",
            ) else {
                continue;
            };
            let Ok(rows) = statement.query_map([], |row| {
                let native_session_id: String = row.get(0)?;
                let title: Option<String> = row.get::<_, Option<String>>(1)?;
                let updated_at_ms = parse_sqlite_timestamp(row.get_ref(2)?).unwrap_or(0);
                let rollout_path: Option<String> = row.get::<_, Option<String>>(3)?;
                let cwd: Option<String> = row.get::<_, Option<String>>(4)?;

                Ok(NativeCodexSession {
                    native_session_id,
                    title: title.and_then(non_empty_string),
                    updated_at_ms,
                    project_root: cwd.and_then(non_empty_string),
                    history_path: rollout_path.and_then(non_empty_string).map(PathBuf::from),
                })
            }) else {
                continue;
            };

            sessions.extend(rows.flatten());
        }

        sessions
    }

    pub fn read_live_events(&self, thread_id: &str, after_row_id: i64) -> Vec<CodexLiveEvent> {
        let db_path = self.codex_home.join("logs_1.sqlite");
        let Ok(connection) = Connection::open(db_path) else {
            return Vec::new();
        };
        let Ok(mut statement) = connection.prepare(
            "SELECT id, ts, feedback_log_body
             FROM logs
             WHERE thread_id = ?1 AND id > ?2
             ORDER BY id ASC",
        ) else {
            return Vec::new();
        };
        let Ok(rows) = statement.query_map([thread_id, &after_row_id.to_string()], |row| {
            let row_id: i64 = row.get(0)?;
            let ts_seconds: i64 = row.get(1)?;
            let body: String = row.get(2)?;
            Ok((row_id, ts_seconds, body))
        }) else {
            return Vec::new();
        };

        rows.filter_map(|row| {
            let Ok((row_id, ts_seconds, body)) = row else {
                return None;
            };
            parse_live_log_event(&body).map(|event| CodexLiveEvent {
                row_id,
                occurred_at_ms: ts_seconds.saturating_mul(1000),
                event,
            })
        })
        .collect()
    }

    fn discovery_fingerprint(&self) -> CodexDiscoveryFingerprint {
        let index_modified_ms = modified_ms(self.codex_home.join("session_index.jsonl"));
        let sessions_dir = self.codex_home.join("sessions");
        let mut sessions_modified_ms = modified_ms(&sessions_dir);
        let mut state_modified_ms = 0_u128;
        let mut session_file_count = 0_usize;

        if let Ok(entries) = std::fs::read_dir(&self.codex_home) {
            for entry in entries.flatten() {
                let path = entry.path();
                let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                    continue;
                };
                if file_name.starts_with("state_")
                    && path.extension().and_then(|value| value.to_str()) == Some("sqlite")
                {
                    state_modified_ms = state_modified_ms.max(modified_ms(path));
                    continue;
                }
                if path.parent() == Some(sessions_dir.as_path())
                    && path.extension().and_then(|value| value.to_str()) == Some("json")
                {
                    session_file_count += 1;
                    sessions_modified_ms = sessions_modified_ms.max(modified_ms(path));
                }
            }
        }

        CodexDiscoveryFingerprint {
            index_modified_ms,
            sessions_modified_ms,
            state_modified_ms,
            session_file_count,
        }
    }

    fn discover_log_sessions(&self) -> Vec<NativeCodexSession> {
        let db_path = self.codex_home.join("logs_1.sqlite");
        let Ok(connection) = Connection::open(db_path) else {
            return Vec::new();
        };

        let recent_cutoff_ms = now_millis().saturating_sub(12 * 60 * 60 * 1000);
        let recent_cutoff_secs = recent_cutoff_ms / 1000;

        let Ok(mut statement) = connection.prepare(
            "SELECT thread_id, MAX(ts) AS last_ts
             FROM logs
             WHERE thread_id IS NOT NULL AND ts >= ?1
             GROUP BY thread_id
             ORDER BY last_ts DESC",
        ) else {
            return Vec::new();
        };

        let Ok(rows) = statement.query_map([recent_cutoff_secs], |row| {
            let thread_id: String = row.get(0)?;
            let last_ts: i64 = row.get(1)?;
            Ok((thread_id, last_ts))
        }) else {
            return Vec::new();
        };

        rows.filter_map(|row| {
            let Ok((thread_id, last_ts)) = row else {
                return None;
            };
            let body = latest_body_for_thread(&connection, &thread_id)?;
            let project_root = extract_workdir_from_log_body(&body);
            let title = extract_title_from_log_body(&body);
            Some(NativeCodexSession {
                native_session_id: thread_id,
                title,
                updated_at_ms: last_ts.saturating_mul(1000),
                project_root,
                history_path: None,
            })
        })
        .collect()
    }
}

pub fn parse_codex_items(items: &[Value]) -> Vec<CodexSessionEvent> {
    let mut events = Vec::new();
    let mut tool_names = HashMap::<String, String>::new();

    for item in items {
        parse_codex_item(item, &mut tool_names, &mut events);
    }

    events
}

fn parse_codex_jsonl(content: &str) -> Vec<CodexSessionEvent> {
    let mut events = Vec::new();
    let mut tool_names = HashMap::<String, String>::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(item) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        parse_codex_item(&item, &mut tool_names, &mut events);
    }

    events
}

fn parse_codex_item(
    item: &Value,
    tool_names: &mut HashMap<String, String>,
    events: &mut Vec<CodexSessionEvent>,
) {
    if let Some(title) = extract_session_title(item) {
        events.push(CodexSessionEvent::SessionTitleChanged { title });
        return;
    }

    let item_type = item.get("type").and_then(Value::as_str).unwrap_or("");
    let message = item.get("message").unwrap_or(item);
    let role = message
        .get("role")
        .and_then(Value::as_str)
        .or_else(|| item.get("role").and_then(Value::as_str))
        .unwrap_or("");
    let model = message
        .get("model")
        .and_then(Value::as_str)
        .or_else(|| item.get("model").and_then(Value::as_str))
        .map(ToString::to_string);

    match item_type {
        "message" | "user" | "assistant" | "response_item" | "session_meta" | "turn_context" => {
            if let Some(content) = message.get("content").and_then(Value::as_array) {
                for block in content {
                    match (role, block.get("type").and_then(Value::as_str)) {
                        ("user", Some("input_text")) => {
                            if let Some(text) = block.get("text").and_then(Value::as_str) {
                                events.push(CodexSessionEvent::UserPrompt {
                                    text: text.to_string(),
                                });
                            }
                        }
                        ("assistant", Some("output_text")) | ("assistant", Some("text")) => {
                            if let Some(text) = block.get("text").and_then(Value::as_str) {
                                events.push(CodexSessionEvent::AssistantText {
                                    text: text.to_string(),
                                    model: model.clone(),
                                });
                            }
                        }
                        ("assistant", Some("tool_use")) => {
                            if let Some(event) = parse_tool_use_block(block, model.clone()) {
                                if let CodexSessionEvent::ToolUse {
                                    tool_use_id,
                                    tool_name,
                                    ..
                                } = &event
                                {
                                    tool_names.insert(tool_use_id.clone(), tool_name.clone());
                                }
                                events.push(event);
                            }
                        }
                        ("user", Some("tool_result")) | ("assistant", Some("tool_result")) => {
                            if let Some(event) = parse_tool_result_block(block, model.clone()) {
                                events.push(event);
                            }
                        }
                        _ => {}
                    }
                }
            } else if role == "user" {
                if let Some(text) = text_from_value(message) {
                    events.push(CodexSessionEvent::UserPrompt { text });
                }
            } else if role == "assistant" {
                if let Some(text) = text_from_value(message) {
                    events.push(CodexSessionEvent::AssistantText {
                        text,
                        model: model.clone(),
                    });
                }
            }
        }
        "function_call" | "tool_use" => {
            if let Some(event) = parse_tool_use_item(item, model.clone()) {
                if let CodexSessionEvent::ToolUse {
                    tool_use_id,
                    tool_name,
                    ..
                } = &event
                {
                    tool_names.insert(tool_use_id.clone(), tool_name.clone());
                }
                events.push(event);
            }
        }
        "function_call_output" | "tool_result" => {
            if let Some(event) = parse_tool_result_item(item, tool_names, model.clone()) {
                events.push(event);
            }
        }
        _ => {}
    }
}

pub fn enrich_detected_sessions(
    sessions: &mut [DetectedSession],
    native_sessions: &[NativeCodexSession],
) {
    let codex_indices: Vec<usize> = sessions
        .iter()
        .enumerate()
        .filter(|(_, session)| session.runtime_source == RuntimeSource::CodexCli)
        .map(|(index, _)| index)
        .collect();

    let live_codex_count = codex_indices.len();
    let mut candidates = Vec::<(i64, usize, usize)>::new();
    for &session_index in &codex_indices {
        for (native_index, native_session) in native_sessions.iter().enumerate() {
            let score = match_score(&sessions[session_index], native_session, live_codex_count);
            if score > 0 {
                candidates.push((score, session_index, native_index));
            }
        }
    }

    candidates.sort_by(|left, right| right.cmp(left));

    let mut assigned_sessions = std::collections::HashSet::<usize>::new();
    let mut assigned_natives = std::collections::HashSet::<usize>::new();

    for (_, session_index, native_index) in candidates {
        if assigned_sessions.contains(&session_index) || assigned_natives.contains(&native_index) {
            continue;
        }

        let session = &mut sessions[session_index];
        let native_session = &native_sessions[native_index];
        if session.display_title.is_none() {
            session.display_title = native_session.title.clone();
        }
        if session.native_session_id.is_none() {
            session.native_session_id = Some(native_session.native_session_id.clone());
        }
        if session.history_path.is_none() {
            session.history_path = native_session.history_path.clone();
        }
        assigned_sessions.insert(session_index);
        assigned_natives.insert(native_index);
    }
}

fn match_score(
    session: &DetectedSession,
    native_session: &NativeCodexSession,
    live_codex_count: usize,
) -> i64 {
    let session_workspace_name = workspace_name(&session.cwd);
    let mut score = 0_i64;

    if let Some(project_root) = &native_session.project_root {
        if project_root == &session.cwd {
            score += 100_000;
        } else if session_workspace_name == workspace_name(project_root) {
            score += 50_000;
        }
    }

    if live_codex_count == 1 {
        score += 1_000;
    }

    score + native_session.updated_at_ms
}

fn latest_user_prompt(items: &[Value]) -> Option<String> {
    items.iter().rev().find_map(|item| {
        if item.get("type").and_then(Value::as_str) != Some("message") {
            return None;
        }
        if item.get("role").and_then(Value::as_str) != Some("user") {
            return None;
        }

        item.get("content")
            .and_then(Value::as_array)
            .and_then(|blocks| {
                blocks.iter().find_map(|block| {
                    if block.get("type").and_then(Value::as_str) != Some("input_text") {
                        return None;
                    }
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .map(trimmed_preview)
                })
            })
    })
}

fn extract_project_root(items: &[Value]) -> Option<String> {
    items.iter().find_map(|item| {
        let text = item
            .get("content")
            .and_then(Value::as_array)
            .and_then(|blocks| {
                blocks.iter().find_map(|block| {
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                })
            })?;

        text.lines()
            .find_map(|line| line.strip_prefix("Project root: ").map(ToString::to_string))
    })
}

fn extract_session_title(item: &Value) -> Option<String> {
    match item.get("type").and_then(Value::as_str) {
        Some("ai-title") => item
            .get("aiTitle")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        Some("session_meta") => item
            .get("title")
            .and_then(Value::as_str)
            .or_else(|| {
                item.get("session")
                    .and_then(|session| session.get("title"))
                    .and_then(Value::as_str)
            })
            .map(ToString::to_string),
        _ => None,
    }
}

fn extract_session_metadata(items: &[Value]) -> SessionMetadata {
    for item in items {
        let title = extract_session_title(item);
        let project_root = extract_project_root(std::slice::from_ref(item));
        if title.is_some() || project_root.is_some() {
            return SessionMetadata {
                title,
                project_root,
            };
        }
    }

    SessionMetadata::default()
}

#[derive(Default)]
struct SessionMetadata {
    title: Option<String>,
    project_root: Option<String>,
}

fn merge_native_session(
    sessions_by_id: &mut HashMap<String, NativeCodexSession>,
    session: NativeCodexSession,
) {
    match sessions_by_id.get_mut(&session.native_session_id) {
        Some(existing) => {
            if existing.title.is_none() {
                existing.title = session.title.clone();
            }
            if existing.project_root.is_none() {
                existing.project_root = session.project_root.clone();
            }
            if existing.history_path.is_none() {
                existing.history_path = session.history_path.clone();
            }
            if session.updated_at_ms > existing.updated_at_ms {
                existing.updated_at_ms = session.updated_at_ms;
            }
        }
        None => {
            sessions_by_id.insert(session.native_session_id.clone(), session);
        }
    }
}

fn parse_sqlite_timestamp(value: ValueRef<'_>) -> Option<i64> {
    match value {
        ValueRef::Integer(raw) => {
            if raw >= 1_000_000_000_000 {
                Some(raw)
            } else {
                Some(raw.saturating_mul(1000))
            }
        }
        ValueRef::Real(raw) if raw.is_sign_negative() => None,
        ValueRef::Real(raw) => Some(raw as i64),
        ValueRef::Text(raw) => std::str::from_utf8(raw).ok().and_then(|text| {
            text.parse::<i64>()
                .ok()
                .map(|value| {
                    if value >= 1_000_000_000_000 {
                        value
                    } else {
                        value.saturating_mul(1000)
                    }
                })
                .or_else(|| parse_rfc3339_ms(text))
        }),
        _ => None,
    }
}

fn parse_tool_use_block(block: &Value, model: Option<String>) -> Option<CodexSessionEvent> {
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

    Some(CodexSessionEvent::ToolUse {
        tool_name,
        tool_use_id,
        input,
        model,
    })
}

fn parse_tool_use_item(item: &Value, model: Option<String>) -> Option<CodexSessionEvent> {
    let tool_name = item
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| item.get("tool_name").and_then(Value::as_str))?
        .to_string();
    let tool_use_id = item
        .get("call_id")
        .and_then(Value::as_str)
        .or_else(|| item.get("id").and_then(Value::as_str))
        .or_else(|| item.get("tool_use_id").and_then(Value::as_str))?
        .to_string();
    let input = item
        .get("arguments")
        .and_then(Value::as_str)
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .or_else(|| item.get("input").cloned())
        .unwrap_or(Value::Null);

    Some(CodexSessionEvent::ToolUse {
        tool_name,
        tool_use_id,
        input,
        model,
    })
}

fn parse_tool_result_block(block: &Value, model: Option<String>) -> Option<CodexSessionEvent> {
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

    Some(CodexSessionEvent::ToolResult {
        tool_use_id,
        tool_name,
        is_error,
        content,
        model,
    })
}

fn parse_tool_result_item(
    item: &Value,
    tool_names: &HashMap<String, String>,
    model: Option<String>,
) -> Option<CodexSessionEvent> {
    let tool_use_id = item
        .get("call_id")
        .and_then(Value::as_str)
        .or_else(|| item.get("tool_use_id").and_then(Value::as_str))
        .or_else(|| item.get("id").and_then(Value::as_str))?
        .to_string();
    let parsed_output = item
        .get("output")
        .and_then(Value::as_str)
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok());
    let is_error = parsed_output
        .as_ref()
        .and_then(|output| output.get("metadata"))
        .and_then(|metadata| metadata.get("exit_code"))
        .and_then(Value::as_i64)
        .is_some_and(|exit_code| exit_code != 0);
    let content = parsed_output
        .as_ref()
        .and_then(extract_codex_tool_result_content)
        .or_else(|| {
            item.get("output")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default();

    Some(CodexSessionEvent::ToolResult {
        tool_use_id: tool_use_id.clone(),
        tool_name: tool_names.get(&tool_use_id).cloned().or_else(|| {
            item.get("tool_name")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        }),
        is_error,
        content,
        model,
    })
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

fn latest_body_for_thread(connection: &Connection, thread_id: &str) -> Option<String> {
    let mut statement = connection
        .prepare(
            "SELECT feedback_log_body
             FROM logs
             WHERE thread_id = ?1
             ORDER BY id DESC
             LIMIT 1",
        )
        .ok()?;
    statement.query_row([thread_id], |row| row.get(0)).ok()
}

fn extract_workdir_from_log_body(body: &str) -> Option<String> {
    extract_quoted_value(body, "\"workdir\":\"")
}

fn extract_title_from_log_body(body: &str) -> Option<String> {
    if let Some(cmd) = extract_quoted_value(body, "\"cmd\":\"") {
        return Some(trimmed_preview(&cmd));
    }

    parse_submission_user_prompt(body)
        .or_else(|| extract_quoted_value(body, "Prompt: "))
        .or_else(|| extract_quoted_value(body, "UserPrompt: "))
        .map(|text| trimmed_preview(&text))
}

fn extract_quoted_value(body: &str, marker: &str) -> Option<String> {
    let start = body.find(marker)? + marker.len();
    let rest = body.get(start..)?;
    let mut escaped = false;
    let mut value = String::new();

    for ch in rest.chars() {
        if escaped {
            value.push(match ch {
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                '"' => '"',
                '\\' => '\\',
                other => other,
            });
            escaped = false;
            continue;
        }

        match ch {
            '\\' => escaped = true,
            '"' => break,
            other => value.push(other),
        }
    }

    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_live_log_event(body: &str) -> Option<CodexSessionEvent> {
    if let Some(event) = parse_exec_command_failure(body) {
        return Some(event);
    }

    if let Some(prompt) = parse_submission_user_prompt(body) {
        return Some(CodexSessionEvent::UserPrompt { text: prompt });
    }

    let tool_marker = ": ToolCall: ";
    let start = body.find(tool_marker)? + tool_marker.len();
    let rest = body.get(start..)?.trim();
    let mut parts = rest.splitn(2, ' ');
    let tool_name = parts.next()?.trim();
    if tool_name.is_empty() {
        return None;
    }
    let input = parts
        .next()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .unwrap_or(Value::Null);
    let tool_use_id = extract_turn_id(body).unwrap_or_else(|| format!("log-{}", stable_hash(body)));

    if tool_name == "spawn_agent" {
        return Some(parse_spawn_agent_event(&input, &tool_use_id));
    }

    Some(CodexSessionEvent::ToolUse {
        tool_name: tool_name.to_string(),
        tool_use_id,
        input,
        model: None,
    })
}

fn parse_exec_command_failure(body: &str) -> Option<CodexSessionEvent> {
    let marker = "error=exec_command failed for `";
    let start = body.find(marker)? + marker.len();
    let rest = body.get(start..)?;
    let command_end = rest.find('`')?;
    let command = rest.get(..command_end)?.trim();
    if command.is_empty() {
        return None;
    }

    let stderr = extract_stream_output_text(body, "stderr")
        .or_else(|| extract_stream_output_text(body, "aggregated_output"));
    let content = stderr.unwrap_or_else(|| format!("exec_command failed: {command}"));

    Some(CodexSessionEvent::ToolResult {
        tool_use_id: extract_turn_id(body).unwrap_or_else(|| format!("log-{}", stable_hash(body))),
        tool_name: Some("exec_command".to_string()),
        is_error: true,
        content,
        model: None,
    })
}

fn extract_stream_output_text(body: &str, stream_name: &str) -> Option<String> {
    let direct_marker = format!("{stream_name}: StreamOutput {{ text: \"");
    if let Some(value) = extract_quoted_value(body, &direct_marker) {
        return Some(normalize_stream_output_text(&value));
    }

    let escaped_marker = format!(r#"{stream_name}: StreamOutput {{ text: \"#);
    extract_escaped_quoted_value(body, &escaped_marker)
        .map(|value| normalize_stream_output_text(&value))
}

fn extract_escaped_quoted_value(body: &str, marker: &str) -> Option<String> {
    let start = body.find(marker)? + marker.len();
    let rest = body.get(start..)?;
    let mut value = String::new();
    let mut chars = rest.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.peek().copied() {
                Some('"') => {
                    chars.next();
                    break;
                }
                Some('n') => {
                    chars.next();
                    value.push('\n');
                    continue;
                }
                Some('r') => {
                    chars.next();
                    value.push('\r');
                    continue;
                }
                Some('t') => {
                    chars.next();
                    value.push('\t');
                    continue;
                }
                Some('\\') => {
                    chars.next();
                    value.push('\\');
                    continue;
                }
                Some(other) => {
                    chars.next();
                    value.push(other);
                    continue;
                }
                None => break,
            }
        }

        value.push(ch);
    }

    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_stream_output_text(value: &str) -> String {
    value
        .trim_matches('"')
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
}

fn extract_codex_tool_result_content(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            if text.trim().is_empty() {
                None
            } else {
                Some(text.to_string())
            }
        }
        Value::Array(values) => {
            let parts = values
                .iter()
                .filter_map(extract_codex_tool_result_content)
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        Value::Object(map) => {
            if let Some(content) = map
                .get("output")
                .and_then(extract_codex_tool_result_content)
            {
                return Some(content);
            }
            if let Some(content) = map
                .get("content")
                .and_then(extract_codex_tool_result_content)
            {
                return Some(content);
            }
            map.get("text").and_then(Value::as_str).and_then(|text| {
                if text.trim().is_empty() {
                    None
                } else {
                    Some(text.to_string())
                }
            })
        }
        _ => None,
    }
}

fn parse_spawn_agent_event(input: &Value, tool_use_id: &str) -> CodexSessionEvent {
    let agent_type = input
        .get("agent_type")
        .and_then(Value::as_str)
        .unwrap_or("worker")
        .to_string();
    let display_name = title_case(&agent_type);
    let description = input
        .get("message")
        .and_then(Value::as_str)
        .and_then(extract_task_description)
        .or_else(|| {
            input
                .get("description")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        });

    CodexSessionEvent::SubagentStart {
        agent_type,
        display_name,
        description,
        model: input
            .get("model")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        reasoning_effort: input
            .get("reasoning_effort")
            .and_then(Value::as_str)
            .map(ToString::to_string),
        agent_id: tool_use_id.to_string(),
    }
}

fn extract_task_description(message: &str) -> Option<String> {
    if let Some(start) = message.find("Task:") {
        let task = message.get(start + "Task:".len()..)?.trim();
        if !task.is_empty() {
            return Some(trimmed_preview(task));
        }
    }

    for line in message.lines() {
        let trimmed = line.trim();
        if let Some(task) = trimmed.strip_prefix("Task:") {
            let task = task.trim();
            if !task.is_empty() {
                return Some(trimmed_preview(task));
            }
        }
    }

    let trimmed = message.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed_preview(trimmed))
    }
}

fn parse_submission_user_prompt(body: &str) -> Option<String> {
    if !body.contains("op: UserInput") {
        return None;
    }

    extract_quoted_value(body, "Text { text: \"")
}

fn extract_turn_id(body: &str) -> Option<String> {
    extract_unquoted_value(body, "turn.id=")
}

fn extract_unquoted_value(body: &str, marker: &str) -> Option<String> {
    let start = body.find(marker)? + marker.len();
    let rest = body.get(start..)?;
    let end = rest
        .find(|ch: char| ch.is_whitespace() || ch == '}' || ch == '"')
        .unwrap_or(rest.len());
    let value = rest.get(..end)?.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn stable_hash(body: &str) -> u64 {
    use std::hash::{BuildHasher, Hasher};
    let builder = std::collections::hash_map::RandomState::new();
    let mut hasher = builder.build_hasher();
    hasher.write(body.as_bytes());
    hasher.finish()
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => {
            let mut label = first.to_uppercase().collect::<String>();
            label.push_str(chars.as_str());
            label
        }
        None => "Worker".to_string(),
    }
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_or(0, |duration| {
            i64::try_from(duration.as_millis()).unwrap_or(i64::MAX)
        })
}

fn history_fingerprint(path: &std::path::Path) -> CodexHistoryFingerprint {
    let metadata = std::fs::metadata(path);
    let modified_ms = metadata
        .as_ref()
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(system_time_to_ms)
        .unwrap_or(0);
    let file_len = metadata.as_ref().map_or(0, std::fs::Metadata::len);

    CodexHistoryFingerprint {
        modified_ms,
        file_len,
    }
}

fn system_time_to_ms(time: SystemTime) -> Option<u128> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
}

fn workspace_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string()
}

fn non_empty_string(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed_preview(trimmed))
    }
}

fn trimmed_preview(value: &str) -> String {
    value.trim().chars().take(96).collect()
}

fn parse_rfc3339_ms(value: &str) -> Option<i64> {
    let timestamp =
        time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339).ok()?;
    i64::try_from(timestamp.unix_timestamp_nanos() / 1_000_000).ok()
}

fn modified_ms(path: impl AsRef<std::path::Path>) -> u128 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis())
}
