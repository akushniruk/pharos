use std::fs;
use std::path::Path;

use serde::Deserialize;
use thiserror::Error;

use crate::model::{DiscoveredSession, LegacyHookEvent, SessionSummary};

/// Errors returned while scanning persisted Claude session files.
#[derive(Debug, Error)]
pub enum DiscoveryError {
    #[error("failed to read sessions directory {path}: {source}")]
    ReadDir {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to read session file {path}: {source}")]
    ReadFile {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse session file {path}: {source}")]
    ParseFile {
        path: String,
        #[source]
        source: serde_json::Error,
    },
}

#[derive(Debug, Deserialize)]
struct ClaudeSessionArchive {
    session_id: String,
    prompts: Vec<String>,
}

/// Discover Claude sessions from a directory of archived session JSON files.
pub fn discover_claude_sessions(dir: &Path) -> Result<Vec<DiscoveredSession>, DiscoveryError> {
    let entries = fs::read_dir(dir).map_err(|source| DiscoveryError::ReadDir {
        path: dir.display().to_string(),
        source,
    })?;
    let mut sessions = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|source| DiscoveryError::ReadDir {
            path: dir.display().to_string(),
            source,
        })?;
        let path = entry.path();
        if !is_json_file(&path) {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|source| DiscoveryError::ReadFile {
            path: path.display().to_string(),
            source,
        })?;
        let archive: ClaudeSessionArchive =
            serde_json::from_str(&raw).map_err(|source| DiscoveryError::ParseFile {
                path: path.display().to_string(),
                source,
            })?;

        let latest_prompt_preview = archive
            .prompts
            .last()
            .map(|prompt| summarize_prompt(prompt, 120))
            .unwrap_or_default();

        sessions.push(DiscoveredSession {
            session_id: archive.session_id,
            prompt_count: archive.prompts.len(),
            latest_prompt_preview,
            path: path.display().to_string(),
        });
    }

    sessions.sort_by(|left, right| left.session_id.cmp(&right.session_id));
    Ok(sessions)
}

fn is_json_file(path: &Path) -> bool {
    path.extension()
        .and_then(std::ffi::OsStr::to_str)
        .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
}

fn summarize_prompt(prompt: &str, max_len: usize) -> String {
    let single_line = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.chars().count() <= max_len {
        return single_line;
    }

    single_line.chars().take(max_len).collect()
}

pub fn discovered_session_summaries(dir: &Path) -> Result<Vec<SessionSummary>, DiscoveryError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let archives = load_claude_session_archives(dir)?;
    let mut sessions = Vec::new();

    for archive in archives {
        let timestamp = archive.modified_at_ms;
        sessions.push(SessionSummary {
            session_id: archive.session_id,
            source_app: "claude_observed".to_string(),
            started_at: timestamp,
            last_event_at: timestamp,
            event_count: archive.prompts.len(),
            agent_count: 1,
            agents: vec!["claude_observed".to_string()],
        });
    }

    sessions.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
    Ok(sessions)
}

pub fn discovered_session_events(
    dir: &Path,
    session_id: &str,
) -> Result<Vec<LegacyHookEvent>, DiscoveryError> {
    let archives = load_claude_session_archives(dir)?;
    let Some(archive) = archives.into_iter().find(|archive| archive.session_id == session_id) else {
        return Ok(Vec::new());
    };

    let event_count = archive.prompts.len();
    let base_timestamp = archive.modified_at_ms;
    let mut events = Vec::with_capacity(event_count);
    for (index, prompt) in archive.prompts.into_iter().enumerate() {
        let offset = i64::try_from(index).unwrap_or(0);
        events.push(LegacyHookEvent {
            source_app: "claude_observed".to_string(),
            session_id: archive.session_id.clone(),
            hook_event_type: "UserPromptSubmit".to_string(),
            payload: serde_json::json!({
                "prompt": prompt,
                "observed": true,
            }),
            timestamp: base_timestamp + offset,
            agent_id: None,
            agent_type: None,
            model_name: None,
            display_name: Some("Observed session".to_string()),
            agent_name: None,
        });
    }

    Ok(events)
}

struct LoadedClaudeSessionArchive {
    session_id: String,
    prompts: Vec<String>,
    modified_at_ms: i64,
}

fn load_claude_session_archives(dir: &Path) -> Result<Vec<LoadedClaudeSessionArchive>, DiscoveryError> {
    let entries = fs::read_dir(dir).map_err(|source| DiscoveryError::ReadDir {
        path: dir.display().to_string(),
        source,
    })?;
    let mut sessions = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|source| DiscoveryError::ReadDir {
            path: dir.display().to_string(),
            source,
        })?;
        let path = entry.path();
        if !is_json_file(&path) {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|source| DiscoveryError::ReadFile {
            path: path.display().to_string(),
            source,
        })?;
        let archive: ClaudeSessionArchive =
            serde_json::from_str(&raw).map_err(|source| DiscoveryError::ParseFile {
                path: path.display().to_string(),
                source,
            })?;
        let metadata = fs::metadata(&path).map_err(|source| DiscoveryError::ReadFile {
            path: path.display().to_string(),
            source,
        })?;
        let modified_at_ms = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .and_then(|duration| i64::try_from(duration.as_millis()).ok())
            .unwrap_or(0);

        sessions.push(LoadedClaudeSessionArchive {
            session_id: archive.session_id,
            prompts: archive.prompts,
            modified_at_ms,
        });
    }

    Ok(sessions)
}
