use crate::model::RuntimeSource;
use crate::config::RuntimeMatcherConfig;

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

#[must_use]
pub fn classify_process(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<RuntimeSource> {
    classify_process_details(snapshot, runtime_matchers).map(|details| details.runtime_source)
}

fn classify_process_details(
    snapshot: &ProcessSnapshot,
    runtime_matchers: &[RuntimeMatcherConfig],
) -> Option<ProcessClassification> {
    let name = normalize(&snapshot.name);
    let name_basename = basename(&snapshot.name);
    let exe = snapshot.exe.as_deref().map(normalize).unwrap_or_default();
    let exe_basename = snapshot
        .exe
        .as_deref()
        .and_then(|path| std::path::Path::new(path).file_name())
        .and_then(|value| value.to_str())
        .map(normalize)
        .unwrap_or_default();
    let cmdline = normalize(&snapshot.cmd.join(" "));

    if contains_any(&[&name, &exe, &cmdline], &["claude"]) {
        return None;
    }

    let runtime_source = if contains_any(&[&name, &exe, &cmdline], &["codex-cli", "codex"]) {
        RuntimeSource::CodexCli
    } else if contains_any(&[&name, &exe, &cmdline], &["gemini-cli", "gemini"]) {
        RuntimeSource::GeminiCli
    } else if contains_any(&[&name, &exe, &cmdline], &["opencode"]) {
        RuntimeSource::OpenCode
    } else if is_exact_process_name(&name_basename, &exe_basename, &["pi", "pi-cli"]) {
        RuntimeSource::PiCli
    } else if contains_any(&[&name, &exe, &cmdline], &["aider"]) {
        RuntimeSource::Aider
    } else if let Some(matcher) = runtime_matchers.iter().find(|matcher| {
        matcher
            .match_any
            .iter()
            .map(|pattern| normalize(pattern))
            .any(|pattern| contains_any(&[&name, &exe, &cmdline], &[pattern.as_str()]))
    }) {
        return Some(ProcessClassification {
            runtime_source: matcher.runtime_source.clone(),
            entrypoint: matcher
                .entrypoint
                .clone()
                .unwrap_or_else(|| snapshot.name.clone()),
            fallback_cwd: snapshot
                .exe
                .as_deref()
                .and_then(|path| std::path::Path::new(path).parent())
                .map(|path| path.display().to_string())
                .unwrap_or_else(|| snapshot.name.clone()),
        });
    } else if is_generic_agent_like(
        &name_basename,
        &exe_basename,
        snapshot.exe.as_deref(),
    ) {
        RuntimeSource::GenericAgentCli
    } else {
        return None;
    };

    Some(ProcessClassification {
        runtime_source,
        entrypoint: snapshot.name.clone(),
        fallback_cwd: snapshot
            .exe
            .as_deref()
            .and_then(|path| std::path::Path::new(path).parent())
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| snapshot.name.clone()),
    })
}

fn is_generic_agent_like(name_basename: &str, exe_basename: &str, exe_path: Option<&str>) -> bool {
    if let Some(exe_path) = exe_path {
        if is_system_or_app_bundle_path(exe_path) {
            return false;
        }
    }

    let blocked = [
        "ssh-agent",
        "assistantd",
        "knowledge-agent",
        "talagentd",
        "imagent",
        "usereventagent",
        "corelocationagent",
        "airplayuiagent",
        "wif iagent",
        "contextstoreagent",
        "textinputmenuagent",
        "diagnostics_agent",
        "assessmentagent",
        "findmylocateagent",
        "managedappdistributionagent",
        "usagetrackingagent",
        "figma_agent",
    ];
    if contains_any(&[name_basename, exe_basename], &blocked) {
        return false;
    }

    contains_any(
        &[name_basename, exe_basename],
        &[
            "copilot",
            "cursor-agent",
            "goose",
            "qwen",
            "llm",
            "agent",
            "assistant",
        ],
    )
}

fn contains_any(haystacks: &[&str], needles: &[&str]) -> bool {
    haystacks
        .iter()
        .any(|haystack| needles.iter().any(|needle| haystack.contains(needle)))
}

fn is_exact_process_name(name_basename: &str, exe_basename: &str, names: &[&str]) -> bool {
    names.iter().map(|name| normalize(name)).any(|normalized| {
        name_basename == normalized || exe_basename == normalized
    })
}

fn normalize(value: &str) -> String {
    format!(" {} ", value.to_ascii_lowercase())
}

fn basename(value: &str) -> String {
    std::path::Path::new(value)
        .file_name()
        .and_then(|part| part.to_str())
        .map(normalize)
        .unwrap_or_else(|| normalize(value))
}

fn is_system_or_app_bundle_path(path: &str) -> bool {
    path.starts_with("/System/")
        || path.starts_with("/usr/libexec/")
        || path.starts_with("/Applications/")
        || path.starts_with("/Library/")
}
