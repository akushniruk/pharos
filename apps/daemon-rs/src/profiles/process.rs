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
        native_session_id: None,
        pid: Some(snapshot.pid),
        cwd,
        started_at_ms: snapshot.started_at_ms,
        entrypoint: classification.entrypoint,
        display_title: classification.display_title,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    })
}

struct ProcessClassification {
    runtime_source: RuntimeSource,
    entrypoint: String,
    display_title: Option<String>,
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
    match exe_name.as_str() {
        "codex" | "codex-cli" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::CodexCli,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        "gemini" | "gemini-cli" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::GeminiCli,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        "opencode" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::OpenCode,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        "pi" | "pi-cli" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::PiCli,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        "aider" | "aider-chat" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::Aider,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        "cursor-agent" | "goose" | "copilot-agent" => {
            return Some(ProcessClassification {
                runtime_source: RuntimeSource::GenericAgentCli,
                entrypoint: snapshot.name.clone(),
                display_title: None,
                fallback_cwd: fallback_cwd(snapshot),
            });
        }
        _ => {}
    }

    match_custom_runtime(snapshot, runtime_matchers)
}

fn fallback_cwd(snapshot: &ProcessSnapshot) -> String {
    snapshot
        .exe
        .as_deref()
        .and_then(|p| std::path::Path::new(p).parent())
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| snapshot.name.clone())
}

fn match_custom_runtime(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<ProcessClassification> {
    let exe_name = snapshot
        .exe
        .as_deref()
        .and_then(|p| std::path::Path::new(p).file_name())
        .and_then(|n| n.to_str())
        .unwrap_or(&snapshot.name)
        .to_ascii_lowercase();
    let fallback_cwd = fallback_cwd(snapshot);

    if let Some(matcher) = runtime_matchers.iter().find(|matcher| {
        matcher
            .match_any
            .iter()
            .any(|pattern| pattern.to_ascii_lowercase() == exe_name)
    }) {
        return Some(custom_classification(matcher, snapshot, fallback_cwd));
    }

    if let Some(matcher) = runtime_matchers.iter().find(|matcher| {
        matcher.match_exe_any.iter().any(|pattern| {
            snapshot
                .exe
                .as_deref()
                .is_some_and(|exe| path_eq(exe, pattern))
        }) || matcher.match_exe_contains.iter().any(|pattern| {
            snapshot
                .exe
                .as_deref()
                .is_some_and(|exe| contains_ignore_case(exe, pattern))
        })
    }) {
        return Some(custom_classification(matcher, snapshot, fallback_cwd));
    }

    if let Some(matcher) = runtime_matchers.iter().find(|matcher| {
        matcher.match_argv_any.iter().any(|pattern| {
            snapshot
                .cmd
                .iter()
                .any(|arg| arg.eq_ignore_ascii_case(pattern))
        }) || matcher.match_argv_contains.iter().any(|pattern| {
            snapshot
                .cmd
                .iter()
                .any(|arg| contains_ignore_case(arg, pattern))
        })
    }) {
        return Some(custom_classification(matcher, snapshot, fallback_cwd));
    }

    if let Some(matcher) = runtime_matchers.iter().find(|matcher| {
        matcher.match_cwd_any.iter().any(|pattern| {
            snapshot
                .cwd
                .as_deref()
                .is_some_and(|cwd| path_eq(cwd, pattern))
        }) || matcher.match_cwd_contains.iter().any(|pattern| {
            snapshot
                .cwd
                .as_deref()
                .is_some_and(|cwd| contains_ignore_case(cwd, pattern))
        })
    }) {
        return Some(custom_classification(matcher, snapshot, fallback_cwd));
    }

    None
}

fn custom_classification(
    matcher: &RuntimeMatcherConfig,
    snapshot: &ProcessSnapshot,
    fallback_cwd: String,
) -> ProcessClassification {
    ProcessClassification {
        runtime_source: matcher.runtime_source.clone(),
        entrypoint: matcher
            .entrypoint
            .clone()
            .unwrap_or_else(|| snapshot.name.clone()),
        display_title: matcher
            .display_title
            .clone()
            .or_else(|| matcher.entrypoint.clone()),
        fallback_cwd,
    }
}

fn path_eq(left: &str, right: &str) -> bool {
    left.eq_ignore_ascii_case(right)
}

fn contains_ignore_case(haystack: &str, needle: &str) -> bool {
    haystack
        .to_ascii_lowercase()
        .contains(&needle.to_ascii_lowercase())
}
