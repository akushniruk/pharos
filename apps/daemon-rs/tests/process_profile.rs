use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::process::{
    classify_process, detected_session_from_snapshot, ProcessSnapshot,
};

fn snapshot(name: &str, cmd: &[&str]) -> ProcessSnapshot {
    ProcessSnapshot {
        pid: 4242,
        name: name.to_string(),
        exe: Some(format!("/usr/local/bin/{name}")),
        cwd: Some("/Users/tester/workspace/sample-app".to_string()),
        cmd: cmd.iter().map(|part| (*part).to_string()).collect(),
        started_at_ms: 1_711_234_567_000,
    }
}

#[test]
fn classifies_known_codex_process() {
    let snapshot = snapshot("codex", &["codex", "chat"]);

    assert_eq!(classify_process(&snapshot, &[]), Some(RuntimeSource::CodexCli));
}

#[test]
fn classifies_known_gemini_process() {
    let snapshot = snapshot("gemini", &["gemini", "--prompt", "hello"]);

    assert_eq!(classify_process(&snapshot, &[]), Some(RuntimeSource::GeminiCli));
}

#[test]
fn classifies_agent_like_unknown_process_as_generic() {
    let snapshot = snapshot("cursor-agent", &["cursor-agent", "--project", "."]);

    assert_eq!(
        classify_process(&snapshot, &[]),
        Some(RuntimeSource::GenericAgentCli)
    );
}

#[test]
fn ignores_system_agent_processes_from_generic_heuristics() {
    let snapshot = ProcessSnapshot {
        pid: 7331,
        name: "assistantd".to_string(),
        exe: Some("/System/Library/PrivateFrameworks/AssistantServices.framework/Versions/A/Support/assistantd".to_string()),
        cwd: None,
        cmd: vec!["/System/Library/PrivateFrameworks/AssistantServices.framework/Versions/A/Support/assistantd".to_string()],
        started_at_ms: 1_711_234_567_000,
    };

    assert_eq!(classify_process(&snapshot, &[]), None);
}

#[test]
fn ignores_claude_processes_because_native_profile_handles_them() {
    let snapshot = snapshot("claude", &["claude", "chat"]);

    assert_eq!(classify_process(&snapshot, &[]), None);
}

#[test]
fn builds_detected_session_for_supported_process() {
    let snapshot = snapshot("opencode", &["opencode", "run"]);

    let session = detected_session_from_snapshot(&snapshot, &[]).expect("detected session");
    assert_eq!(session.runtime_source, RuntimeSource::OpenCode);
    assert_eq!(session.session_id, "proc-4242");
    assert_eq!(session.pid, Some(4242));
    assert_eq!(session.cwd, "/Users/tester/workspace/sample-app");
    assert_eq!(session.entrypoint, "opencode");
    assert_eq!(session.display_title, None);
    assert!(session.transcript_path.is_none());
}
