use std::path::PathBuf;

use serde::Deserialize;

use super::DetectedSession;
use crate::model::RuntimeSource;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeSessionFile {
    pid: u32,
    session_id: String,
    cwd: String,
    started_at: i64,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    entrypoint: String,
}

pub struct ClaudeProfile {
    claude_home: PathBuf,
}

impl ClaudeProfile {
    #[must_use]
    pub fn new(claude_home: PathBuf) -> Self {
        Self { claude_home }
    }

    #[must_use]
    pub fn discover_sessions(&self) -> Vec<DetectedSession> {
        let sessions_dir = self.claude_home.join("sessions");
        let Ok(entries) = std::fs::read_dir(&sessions_dir) else {
            return Vec::new();
        };

        let mut sessions = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Ok(parsed) = serde_json::from_str::<ClaudeSessionFile>(&content) else {
                continue;
            };

            let transcript_path = self.resolve_transcript_path(&parsed.cwd, &parsed.session_id);
            let subagents_dir = transcript_path.as_ref().and_then(|tp| {
                tp.parent()
                    .map(|p| p.join(&parsed.session_id).join("subagents"))
            });

            sessions.push(DetectedSession {
                runtime_source: RuntimeSource::ClaudeCode,
                session_id: parsed.session_id,
                pid: Some(parsed.pid),
                cwd: parsed.cwd,
                started_at_ms: parsed.started_at,
                entrypoint: if parsed.entrypoint.is_empty() {
                    parsed.kind
                } else {
                    parsed.entrypoint
                },
                display_title: None,
                transcript_path,
                subagents_dir,
            });
        }
        sessions
    }

    #[must_use]
    pub fn resolve_transcript_path(&self, cwd: &str, session_id: &str) -> Option<PathBuf> {
        let slug = cwd_to_project_slug(cwd);
        let jsonl = self
            .claude_home
            .join("projects")
            .join(&slug)
            .join(format!("{session_id}.jsonl"));
        if jsonl.exists() {
            Some(jsonl)
        } else {
            None
        }
    }
}

#[must_use]
pub fn cwd_to_project_slug(cwd: &str) -> String {
    cwd.replace('/', "-")
}
