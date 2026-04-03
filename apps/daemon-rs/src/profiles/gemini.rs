use std::collections::HashMap;
use std::path::PathBuf;

use serde::Deserialize;

use super::DetectedSession;
use crate::model::RuntimeSource;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeGeminiSession {
    pub native_session_id: String,
    pub title: Option<String>,
    pub updated_at_ms: i64,
    pub workspace_hint: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiLogEntry {
    session_id: String,
    #[serde(rename = "type")]
    entry_type: String,
    message: String,
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

            let Ok(content) = std::fs::read_to_string(logs_path) else {
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

        if let Some(native_session) = best_native_match(session, native_sessions, live_gemini_count) {
            if session.display_title.is_none() {
                session.display_title = native_session.title.clone();
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
    native_sessions
        .iter()
        .max_by_key(|native_session| {
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

    let trimmed = entry.message.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.chars().take(96).collect())
}

fn should_replace_title(current: Option<&str>, candidate: Option<&str>) -> bool {
    match (current, candidate) {
        (_, None) => false,
        (None, Some(_)) => true,
        (Some(current), Some(candidate)) if current.starts_with('/') && !candidate.starts_with('/') => {
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
    let timestamp = time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339).ok()?;
    i64::try_from(timestamp.unix_timestamp_nanos() / 1_000_000).ok()
}
