use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

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

#[derive(Debug, Clone, PartialEq, Eq)]
struct CodexDiscoveryFingerprint {
    index_modified_ms: u128,
    sessions_modified_ms: u128,
    session_file_count: usize,
}

static DISCOVERY_CACHE: LazyLock<Mutex<HashMap<PathBuf, CachedCodexDiscovery>>> =
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

        let index_path = self.codex_home.join("session_index.jsonl");
        if let Ok(content) = std::fs::read_to_string(index_path) {
            for line in content.lines() {
                let Ok(entry) = serde_json::from_str::<CodexIndexEntry>(line) else {
                    continue;
                };

                sessions_by_id.insert(
                    entry.id.clone(),
                    NativeCodexSession {
                        native_session_id: entry.id,
                        title: non_empty_string(entry.thread_name),
                        updated_at_ms: parse_rfc3339_ms(&entry.updated_at).unwrap_or(0),
                        project_root: None,
                        history_path: None,
                    },
                );
            }
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

            let title = latest_user_prompt(&parsed.items)
                .or_else(|| sessions_by_id.get(&parsed.session.id).and_then(|entry| entry.title.clone()));
            let updated_at_ms = sessions_by_id
                .get(&parsed.session.id)
                .map(|entry| entry.updated_at_ms)
                .filter(|timestamp| *timestamp > 0)
                .or_else(|| parse_rfc3339_ms(&parsed.session.timestamp))
                .unwrap_or(0);
            let project_root = extract_project_root(&parsed.items);

            sessions_by_id.insert(
                parsed.session.id.clone(),
                NativeCodexSession {
                    native_session_id: parsed.session.id,
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

    pub fn read_session_events(
        &self,
        history_path: &std::path::Path,
    ) -> Vec<CodexSessionEvent> {
        let Ok(content) = std::fs::read_to_string(history_path) else {
            return Vec::new();
        };
        let Ok(parsed) = serde_json::from_str::<CodexSessionFile>(&content) else {
            return Vec::new();
        };
        parse_codex_items(&parsed.items)
    }

    fn discovery_fingerprint(&self) -> CodexDiscoveryFingerprint {
        let index_modified_ms = modified_ms(self.codex_home.join("session_index.jsonl"));
        let sessions_dir = self.codex_home.join("sessions");
        let mut sessions_modified_ms = modified_ms(&sessions_dir);
        let mut session_file_count = 0_usize;

        if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) != Some("json") {
                    continue;
                }
                session_file_count += 1;
                sessions_modified_ms = sessions_modified_ms.max(modified_ms(path));
            }
        }

        CodexDiscoveryFingerprint {
            index_modified_ms,
            sessions_modified_ms,
            session_file_count,
        }
    }
}

pub fn parse_codex_items(items: &[Value]) -> Vec<CodexSessionEvent> {
    let mut events = Vec::new();
    let mut tool_names = HashMap::<String, String>::new();

    for item in items {
        let Some(item_type) = item.get("type").and_then(Value::as_str) else {
            continue;
        };
        match item_type {
            "message" => {
                let role = item.get("role").and_then(Value::as_str).unwrap_or("");
                let Some(content) = item.get("content").and_then(Value::as_array) else {
                    continue;
                };

                for block in content {
                    match (
                        role,
                        block.get("type").and_then(Value::as_str),
                    ) {
                        ("user", Some("input_text")) => {
                            if let Some(text) = block.get("text").and_then(Value::as_str) {
                                events.push(CodexSessionEvent::UserPrompt {
                                    text: text.to_string(),
                                });
                            }
                        }
                        ("assistant", Some("output_text")) => {
                            if let Some(text) = block.get("text").and_then(Value::as_str) {
                                events.push(CodexSessionEvent::AssistantText {
                                    text: text.to_string(),
                                });
                            }
                        }
                        _ => {}
                    }
                }
            }
            "function_call" => {
                let Some(tool_name) = item.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let Some(tool_use_id) = item.get("call_id").and_then(Value::as_str) else {
                    continue;
                };
                let input = item
                    .get("arguments")
                    .and_then(Value::as_str)
                    .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
                    .unwrap_or(Value::Null);
                tool_names.insert(tool_use_id.to_string(), tool_name.to_string());
                events.push(CodexSessionEvent::ToolUse {
                    tool_name: tool_name.to_string(),
                    tool_use_id: tool_use_id.to_string(),
                    input,
                });
            }
            "function_call_output" => {
                let Some(tool_use_id) = item.get("call_id").and_then(Value::as_str) else {
                    continue;
                };
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
                    .and_then(|output| output.get("output"))
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                    .or_else(|| {
                        item.get("output")
                            .and_then(Value::as_str)
                            .map(ToString::to_string)
                    })
                    .unwrap_or_default();
                events.push(CodexSessionEvent::ToolResult {
                    tool_use_id: tool_use_id.to_string(),
                    tool_name: tool_names.get(tool_use_id).cloned(),
                    is_error,
                    content,
                });
            }
            _ => {}
        }
    }

    events
}

pub fn enrich_detected_sessions(
    sessions: &mut [DetectedSession],
    native_sessions: &[NativeCodexSession],
) {
    let live_codex_count = sessions
        .iter()
        .filter(|session| session.runtime_source == RuntimeSource::CodexCli)
        .count();

    for session in sessions {
        if session.runtime_source != RuntimeSource::CodexCli {
            continue;
        }

        if let Some(native_session) = best_native_match(session, native_sessions, live_codex_count) {
            if session.display_title.is_none() {
                session.display_title = native_session.title.clone();
            }
            if session.native_session_id.is_none() {
                session.native_session_id = Some(native_session.native_session_id.clone());
            }
            if session.history_path.is_none() {
                session.history_path = native_session.history_path.clone();
            }
        }
    }
}

fn best_native_match<'a>(
    session: &DetectedSession,
    native_sessions: &'a [NativeCodexSession],
    live_codex_count: usize,
) -> Option<&'a NativeCodexSession> {
    let session_workspace_name = workspace_name(&session.cwd);
    native_sessions
        .iter()
        .max_by_key(|native_session| {
            let mut score = 0_i64;

            if let Some(project_root) = &native_session.project_root {
                if project_root == &session.cwd {
                    score += 10_000;
                } else if session_workspace_name == workspace_name(project_root) {
                    score += 5_000;
                }
            }

            if live_codex_count == 1 {
                score += 1_000;
            }

            score + native_session.updated_at_ms
        })
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
                    block.get("text")
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
                    block.get("text").and_then(Value::as_str).map(ToString::to_string)
                })
            })?;

        text.lines()
            .find_map(|line| line.strip_prefix("Project root: ").map(ToString::to_string))
    })
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
    let timestamp = time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339).ok()?;
    i64::try_from(timestamp.unix_timestamp_nanos() / 1_000_000).ok()
}

fn modified_ms(path: impl AsRef<std::path::Path>) -> u128 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis())
}
