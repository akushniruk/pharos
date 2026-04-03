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

pub struct ProcessProfile;

impl ProcessProfile {
    #[must_use]
    pub fn new() -> Self {
        Self
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

                detected_session_from_snapshot(&snapshot)
            })
            .collect()
    }
}

#[must_use]
pub fn detected_session_from_snapshot(snapshot: &ProcessSnapshot) -> Option<DetectedSession> {
    let classification = classify_process_details(snapshot)?;
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
pub fn classify_process(snapshot: &ProcessSnapshot) -> Option<RuntimeSource> {
    classify_process_details(snapshot).map(|details| details.runtime_source)
}

fn classify_process_details(snapshot: &ProcessSnapshot) -> Option<ProcessClassification> {
    let name = normalize(&snapshot.name);
    let exe = snapshot.exe.as_deref().map(normalize).unwrap_or_default();
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
    } else if contains_any(&[&name, &exe, &cmdline], &["pi-cli", " pi ", "/pi", "\\pi", " pi-", " pi_", "pi"]) {
        RuntimeSource::PiCli
    } else if contains_any(&[&name, &exe, &cmdline], &["aider"]) {
        RuntimeSource::Aider
    } else if is_generic_agent_like(&name, &exe, &cmdline) {
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

fn is_generic_agent_like(name: &str, exe: &str, cmdline: &str) -> bool {
    contains_any(
        &[name, exe, cmdline],
        &[
            "copilot",
            "cursor-agent",
            "cursor agent",
            "assistant",
            "agent",
            "goose",
            "qwen",
            "llm",
        ],
    )
}

fn contains_any(haystacks: &[&str], needles: &[&str]) -> bool {
    haystacks
        .iter()
        .any(|haystack| needles.iter().any(|needle| haystack.contains(needle)))
}

fn normalize(value: &str) -> String {
    format!(" {} ", value.to_ascii_lowercase())
}
