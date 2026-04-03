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

fn custom_snapshot(name: &str, exe: &str, cwd: &str, cmd: &[&str]) -> ProcessSnapshot {
    ProcessSnapshot {
        pid: 4243,
        name: name.to_string(),
        exe: Some(exe.to_string()),
        cwd: Some(cwd.to_string()),
        cmd: cmd.iter().map(|part| (*part).to_string()).collect(),
        started_at_ms: 1_711_234_567_000,
    }
}

#[test]
fn classifies_known_codex_process() {
    let snapshot = snapshot("codex", &["codex", "chat"]);

    assert_eq!(
        classify_process(&snapshot, &[]),
        Some(RuntimeSource::CodexCli)
    );
}

#[test]
fn classifies_known_gemini_process() {
    let snapshot = snapshot("gemini", &["gemini", "--prompt", "hello"]);

    assert_eq!(
        classify_process(&snapshot, &[]),
        Some(RuntimeSource::GeminiCli)
    );
}

#[test]
fn classifies_known_pi_process_only_on_exact_name() {
    let snapshot = snapshot("pi", &["pi", "chat"]);

    assert_eq!(classify_process(&snapshot, &[]), Some(RuntimeSource::PiCli));
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
fn classifies_custom_runtime_from_exe_path_match() {
    let snapshot = custom_snapshot(
        "node",
        "/opt/custom/bin/custombot",
        "/Users/tester/workspace/sample-app",
        &["node", "/opt/custom/bin/custombot", "--serve"],
    );
    let matchers = vec![pharos_daemon::config::RuntimeMatcherConfig {
        id: "custom-bot".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec![],
        match_exe_any: vec!["/opt/custom/bin/custombot".to_string()],
        match_exe_contains: vec![],
        match_argv_any: vec![],
        match_argv_contains: vec![],
        match_cwd_any: vec![],
        match_cwd_contains: vec![],
        entrypoint: Some("CustomBot".to_string()),
        display_title: Some("Custom Bot".to_string()),
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CustomCli)
    );
}

#[test]
fn classifies_custom_runtime_from_argv_match() {
    let snapshot = custom_snapshot(
        "node",
        "/usr/local/bin/node",
        "/Users/tester/workspace/sample-app",
        &["node", "custombot", "--serve"],
    );
    let matchers = vec![pharos_daemon::config::RuntimeMatcherConfig {
        id: "custom-bot".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec![],
        match_exe_any: vec![],
        match_exe_contains: vec![],
        match_argv_any: vec!["custombot".to_string(), "--serve".to_string()],
        match_argv_contains: vec![],
        match_cwd_any: vec![],
        match_cwd_contains: vec![],
        entrypoint: Some("CustomBot".to_string()),
        display_title: None,
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CustomCli)
    );
}

#[test]
fn classifies_custom_runtime_from_cwd_match() {
    let snapshot = custom_snapshot(
        "node",
        "/usr/local/bin/node",
        "/Users/tester/workspace/sample-app",
        &["node", "--serve"],
    );
    let matchers = vec![pharos_daemon::config::RuntimeMatcherConfig {
        id: "custom-bot".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec![],
        match_exe_any: vec![],
        match_exe_contains: vec![],
        match_argv_any: vec![],
        match_argv_contains: vec![],
        match_cwd_any: vec!["/Users/tester/workspace/sample-app".to_string()],
        match_cwd_contains: vec![],
        entrypoint: Some("CustomBot".to_string()),
        display_title: None,
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CustomCli)
    );
}

#[test]
fn prefers_builtin_exact_name_matches_over_custom_path_matchers() {
    let snapshot = snapshot("codex", &["codex", "chat"]);
    let matchers = vec![pharos_daemon::config::RuntimeMatcherConfig {
        id: "codex-path".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec![],
        match_exe_any: vec!["/usr/local/bin/codex".to_string()],
        match_exe_contains: vec![],
        match_argv_any: vec![],
        match_argv_contains: vec![],
        match_cwd_any: vec![],
        match_cwd_contains: vec![],
        entrypoint: Some("Custom Codex".to_string()),
        display_title: None,
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CodexCli)
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
fn ignores_pidinfo_for_pi_detection() {
    let snapshot = ProcessSnapshot {
        pid: 9123,
        name: "pidinfo".to_string(),
        exe: Some(
            "/Applications/iTerm.app/Contents/XPCServices/pidinfo.xpc/Contents/MacOS/pidinfo"
                .to_string(),
        ),
        cwd: None,
        cmd: vec![
            "/Applications/iTerm.app/Contents/XPCServices/pidinfo.xpc/Contents/MacOS/pidinfo"
                .to_string(),
        ],
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
