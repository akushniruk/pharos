use crate::config::RuntimeMatcherConfig;
use crate::model::RuntimeSource;

use super::DetectedSession;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessSnapshot {
    pub pid: u32,
    pub name: String,
    pub exe: Option<String>,
    pub cwd: Option<String>,
    pub cmd: Vec<String>,
    pub started_at_ms: i64,
}

pub struct ProcessProfile {
    runtime_matchers: Vec<RuntimeMatcherConfig>,
}

impl ProcessProfile {
    #[must_use]
    pub fn new(runtime_matchers: Vec<RuntimeMatcherConfig>) -> Self {
        Self { runtime_matchers }
    }

    #[must_use]
    pub fn discover_sessions(&self) -> Vec<DetectedSession> {
        let mut system = sysinfo::System::new_all();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        system
            .processes()
            .iter()
            .filter_map(|(pid, process)| {
                let snapshot = ProcessSnapshot {
                    pid: pid.as_u32(),
                    name: process.name().to_string_lossy().into_owned(),
                    exe: process.exe().map(|path| path.display().to_string()),
                    cwd: process.cwd().map(|path| path.display().to_string()),
                    cmd: process
                        .cmd()
                        .iter()
                        .map(|part| part.to_string_lossy().into_owned())
                        .collect(),
                    started_at_ms: i64::try_from(process.start_time())
                        .unwrap_or(0)
                        .saturating_mul(1000),
                };

                detected_session_from_snapshot(&snapshot, &self.runtime_matchers)
            })
            .collect()
    }
}

#[must_use]
pub fn load_runtime_matchers(path: Option<&std::path::Path>) -> Vec<RuntimeMatcherConfig> {
    let Some(path) = path else {
        return Vec::new();
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return Vec::new();
    };

    serde_json::from_str::<Vec<RuntimeMatcherConfig>>(&content).unwrap_or_default()
}

#[must_use]
pub fn detected_session_from_snapshot(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<DetectedSession> {
    let classification = classify_process_details(snapshot, runtime_matchers)?;
    let cwd = snapshot
        .cwd
        .clone()
        .unwrap_or_else(|| classification.fallback_cwd.clone());

    Some(DetectedSession {
        runtime_source: classification.runtime_source,
        session_id: format!("proc-{}", snapshot.pid),
        pid: Some(snapshot.pid),
        cwd,
        started_at_ms: snapshot.started_at_ms,
        entrypoint: classification.entrypoint,
        display_title: None,
        transcript_path: None,
        subagents_dir: None,
    })
}

struct ProcessClassification {
    runtime_source: RuntimeSource,
    entrypoint: String,
    fallback_cwd: String,
}

/// Classify a process as a known AI agent runtime.
/// Returns the RuntimeSource if matched, None otherwise.
#[must_use]
pub fn classify_process(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<RuntimeSource> {
    classify_process_details(snapshot, runtime_matchers).map(|c| c.runtime_source)
}

/// Internal: full classification with entrypoint and fallback cwd.
fn classify_process_details(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<ProcessClassification> {
    // Get the exact binary name (lowercase)
    let exe_name = snapshot
        .exe
        .as_deref()
        .and_then(|p| std::path::Path::new(p).file_name())
        .and_then(|n| n.to_str())
        .unwrap_or(&snapshot.name)
        .to_ascii_lowercase();

    // Skip Claude — handled by native file observation
    if exe_name == "claude" || exe_name.starts_with("claude-") {
        return None;
    }

    // Skip system paths
    if let Some(exe) = &snapshot.exe {
        if exe.starts_with("/System/")
            || exe.starts_with("/usr/libexec/")
            || exe.starts_with("/Library/")
        {
            return None;
        }
        // Skip IDE extension helper processes (not interactive agents)
        if (exe.contains(".vscode/extensions/") || exe.contains(".cursor/extensions/"))
            && snapshot.cmd.iter().any(|arg| {
                let a = arg.to_ascii_lowercase();
                a.contains("app-server") || a.contains("language-server")
            })
        {
            return None;
        }
    }

    // Match by EXACT binary name (no substring matching)
    let runtime_source = match exe_name.as_str() {
        "codex" | "codex-cli" => RuntimeSource::CodexCli,
        "gemini" | "gemini-cli" => RuntimeSource::GeminiCli,
        "opencode" => RuntimeSource::OpenCode,
        "pi" | "pi-cli" => RuntimeSource::PiCli,
        "aider" | "aider-chat" => RuntimeSource::Aider,
        "cursor-agent" | "goose" | "copilot-agent" => RuntimeSource::GenericAgentCli,
        _ => {
            // Check custom runtime matchers (exact name match)
            if let Some(matcher) = runtime_matchers.iter().find(|m| {
                m.match_any
                    .iter()
                    .any(|pattern| pattern.to_ascii_lowercase() == exe_name)
            }) {
                return Some(ProcessClassification {
                    runtime_source: matcher.runtime_source.clone(),
                    entrypoint: matcher
                        .entrypoint
                        .clone()
                        .unwrap_or_else(|| snapshot.name.clone()),
                    fallback_cwd: fallback_cwd(snapshot),
                });
            }
            return None;
        }
    };

    Some(ProcessClassification {
        runtime_source,
        entrypoint: snapshot.name.clone(),
        fallback_cwd: fallback_cwd(snapshot),
    })
}

fn fallback_cwd(snapshot: &ProcessSnapshot) -> String {
    snapshot
        .exe
        .as_deref()
        .and_then(|p| std::path::Path::new(p).parent())
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| snapshot.name.clone())
}
