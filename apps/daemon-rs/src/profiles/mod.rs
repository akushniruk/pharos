pub mod claude;
pub mod codex;
pub mod gemini;
pub mod process;

use std::path::PathBuf;

use crate::config::RuntimeMatcherConfig;
use crate::model::RuntimeSource;

/// A live session detected by the scanner.
#[derive(Debug, Clone)]
pub struct DetectedSession {
    pub runtime_source: RuntimeSource,
    pub session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub started_at_ms: i64,
    pub entrypoint: String,
    pub display_title: Option<String>,
    pub transcript_path: Option<PathBuf>,
    pub subagents_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, Default)]
pub struct DiscoveryOptions {
    pub claude_home: Option<PathBuf>,
    pub codex_home: Option<PathBuf>,
    pub gemini_home: Option<PathBuf>,
    pub runtime_matchers: Vec<RuntimeMatcherConfig>,
}

pub fn discover_all_sessions(options: &DiscoveryOptions) -> Vec<DetectedSession> {
    let mut sessions = Vec::new();

    // Claude: native file observation (reliable, rich data)
    if let Some(claude_home) = options.claude_home.clone() {
        sessions.extend(claude::ClaudeProfile::new(claude_home).discover_sessions());
    }

    // Process-based detection for non-Claude runtimes (exact name matching only)
    let mut process_sessions = process::ProcessProfile::new(options.runtime_matchers.clone())
        .discover_sessions();

    // Enrich process-detected sessions with native metadata
    if let Some(codex_home) = options.codex_home.clone() {
        let native_sessions = codex::CodexProfile::new(codex_home).discover_native_sessions();
        codex::enrich_detected_sessions(&mut process_sessions, &native_sessions);
    }

    if let Some(gemini_home) = options.gemini_home.clone() {
        let native_sessions = gemini::GeminiProfile::new(gemini_home).discover_native_sessions();
        gemini::enrich_detected_sessions(&mut process_sessions, &native_sessions);
    }

    sessions.extend(process_sessions);
    sessions
}
