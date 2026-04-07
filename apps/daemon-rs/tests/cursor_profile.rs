use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::DetectedSession;
use pharos_daemon::profiles::cursor::{
    CursorProfile, CursorSessionEvent, enrich_detected_sessions, parse_cursor_jsonl_line,
};
use tempfile::tempdir;

#[test]
fn cursor_profile_discovers_native_sessions_from_agent_transcripts() {
    let temp_dir = tempdir().expect("tempdir");
    let transcript_dir = temp_dir
        .path()
        .join("projects")
        .join("Users-tester-home_projects-pharos")
        .join("agent-transcripts")
        .join("sess-a");
    std::fs::create_dir_all(&transcript_dir).expect("transcript dir");
    std::fs::write(
        transcript_dir.join("sess-a.jsonl"),
        r#"{"role":"user","message":{"content":[{"type":"text","text":"review /Users/tester/home_projects/pharos and summarize key risks"}]}}
{"role":"assistant","message":{"content":[{"type":"text","text":"I will inspect the daemon scanner first."}]}}
"#,
    )
    .expect("write transcript");

    let profile = CursorProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_native_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].native_session_id, "sess-a");
    assert_eq!(
        sessions[0].title.as_deref(),
        Some("review /Users/tester/home_projects/pharos and summarize key risks")
    );
    assert_eq!(
        sessions[0].project_root.as_deref(),
        Some("/Users/tester/home_projects/pharos")
    );
}

#[test]
fn cursor_profile_discovers_detected_sessions_from_native_transcripts() {
    let temp_dir = tempdir().expect("tempdir");
    let transcript_dir = temp_dir
        .path()
        .join("projects")
        .join("Users-tester-home_projects-pharos")
        .join("agent-transcripts")
        .join("sess-b");
    std::fs::create_dir_all(&transcript_dir).expect("transcript dir");
    std::fs::write(
        transcript_dir.join("sess-b.jsonl"),
        r#"{"role":"user","message":{"content":[{"type":"text","text":"audit /Users/tester/home_projects/pharos scanner behavior"}]}}"#,
    )
    .expect("write transcript");

    let profile = CursorProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].runtime_source, RuntimeSource::CursorAgent);
    assert_eq!(sessions[0].session_id, "cursor-sess-b");
    assert_eq!(sessions[0].native_session_id.as_deref(), Some("sess-b"));
    assert_eq!(sessions[0].entrypoint, "cursor-native");
    assert_eq!(sessions[0].display_title.as_deref(), Some("audit /Users/tester/home_projects/pharos scanner behavior"));
    assert!(sessions[0].transcript_path.is_some());
}

#[test]
fn cursor_profile_prefers_project_hint_when_prompt_mentions_other_paths() {
    let temp_dir = tempdir().expect("tempdir");
    let transcript_dir = temp_dir
        .path()
        .join("projects")
        .join("Users-tester-home_projects-pharos")
        .join("agent-transcripts")
        .join("sess-mixed");
    std::fs::create_dir_all(&transcript_dir).expect("transcript dir");
    std::fs::write(
        transcript_dir.join("sess-mixed.jsonl"),
        r#"{"role":"user","message":{"content":[{"type":"text","text":"check /Users/tester/home_projects/dalaran docs and then continue in /Users/tester/home_projects/pharos"}]}}"#,
    )
    .expect("write transcript");

    let profile = CursorProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].cwd, "/Users/tester/home_projects/pharos");
}

#[test]
fn cursor_profile_enriches_detected_sessions_with_title_and_transcript_path() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::CursorAgent,
        session_id: "proc-77".to_string(),
        native_session_id: None,
        pid: Some(77),
        cwd: "/Users/tester/home_projects/pharos".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "cursor-agent".to_string(),
        display_title: None,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let native_sessions = vec![pharos_daemon::profiles::cursor::NativeCursorSession {
        native_session_id: "sess-a".to_string(),
        title: Some("Review runtime labels".to_string()),
        updated_at_ms: 1_711_234_568_000,
        project_root: Some("/Users/tester/home_projects/pharos".to_string()),
        project_hint: Some("Users-tester-home_projects-pharos".to_string()),
        transcript_path: std::path::PathBuf::from("/tmp/sess-a.jsonl"),
    }];

    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert_eq!(sessions[0].native_session_id.as_deref(), Some("sess-a"));
    assert_eq!(sessions[0].display_title.as_deref(), Some("Review runtime labels"));
    assert_eq!(
        sessions[0].transcript_path.as_deref(),
        Some(std::path::Path::new("/tmp/sess-a.jsonl"))
    );
}

#[test]
fn cursor_enrichment_replaces_non_project_cwd_with_native_project_context() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::CursorAgent,
        session_id: "proc-77".to_string(),
        native_session_id: None,
        pid: Some(77),
        cwd: "/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "cursor-agent".to_string(),
        display_title: None,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let native_sessions = vec![pharos_daemon::profiles::cursor::NativeCursorSession {
        native_session_id: "sess-a".to_string(),
        title: Some("Review runtime labels".to_string()),
        updated_at_ms: 1_711_234_568_000,
        project_root: Some("/Users/tester/home_projects/pharos".to_string()),
        project_hint: Some("Users-tester-home_projects-pharos".to_string()),
        transcript_path: std::path::PathBuf::from("/tmp/sess-a.jsonl"),
    }];

    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert_eq!(sessions[0].cwd, "/Users/tester/home_projects/pharos");
}

#[test]
fn cursor_jsonl_parser_maps_prompt_tool_and_subagent_events() {
    let line = r#"{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Agent","id":"tool_1","input":{"description":"inspect scanner dedupe behavior"}},{"type":"tool_use","name":"ReadFile","id":"tool_2","input":{"path":"apps/daemon-rs/src/scanner.rs"}},{"type":"text","text":"Done reading scanner."}]}}"#;
    let events = parse_cursor_jsonl_line(line);

    assert_eq!(
        events,
        vec![
            CursorSessionEvent::SubagentStart {
                agent_id: "tool_1".to_string(),
                display_name: "Cursor Helper".to_string(),
                description: Some("inspect scanner dedupe behavior".to_string()),
                parent_agent_id: None,
                subagent_type: None,
            },
            CursorSessionEvent::ToolUse {
                tool_name: "Agent".to_string(),
                tool_use_id: "tool_1".to_string(),
                input: serde_json::json!({"description":"inspect scanner dedupe behavior"}),
            },
            CursorSessionEvent::ToolUse {
                tool_name: "ReadFile".to_string(),
                tool_use_id: "tool_2".to_string(),
                input: serde_json::json!({"path":"apps/daemon-rs/src/scanner.rs"}),
            },
            CursorSessionEvent::AssistantText {
                text: "Done reading scanner.".to_string(),
            },
        ]
    );
}

#[test]
fn cursor_jsonl_parser_fallback_tool_ids_are_deterministic() {
    let line = r#"{"role":"assistant","message":{"content":[{"type":"tool_use","name":"ReadFile","input":{"path":"apps/daemon-rs/src/scanner.rs"}}]}}"#;
    let first = parse_cursor_jsonl_line(line);
    let second = parse_cursor_jsonl_line(line);

    assert_eq!(first, second);
}

#[test]
fn cursor_jsonl_parser_detects_subagent_aliases_and_parent_id() {
    let line = r#"{"role":"assistant","message":{"content":[{"type":"tool_use","name":"Subagent","id":"tool_sub","input":{"description":"analyze ui graph","agent_type":"code-reviewer","parent_agent_id":"main"}}]}}"#;
    let events = parse_cursor_jsonl_line(line);

    assert_eq!(
        events[0],
        CursorSessionEvent::SubagentStart {
            agent_id: "tool_sub".to_string(),
            display_name: "Code-reviewer".to_string(),
            description: Some("analyze ui graph".to_string()),
            parent_agent_id: Some("main".to_string()),
            subagent_type: Some("code-reviewer".to_string()),
        }
    );
}

#[test]
fn cursor_profile_does_not_link_unrelated_native_sessions() {
    let mut sessions = vec![
        DetectedSession {
            runtime_source: RuntimeSource::CursorAgent,
            session_id: "proc-1".to_string(),
            native_session_id: None,
            pid: Some(1),
            cwd: "/Users/tester/workspaces/project-alpha".to_string(),
            started_at_ms: 1_711_234_567_000,
            entrypoint: "cursor-agent".to_string(),
            display_title: None,
            history_path: None,
            transcript_path: None,
            subagents_dir: None,
        },
        DetectedSession {
            runtime_source: RuntimeSource::CursorAgent,
            session_id: "proc-2".to_string(),
            native_session_id: None,
            pid: Some(2),
            cwd: "/Users/tester/workspaces/project-beta".to_string(),
            started_at_ms: 1_711_234_567_100,
            entrypoint: "cursor-agent".to_string(),
            display_title: None,
            history_path: None,
            transcript_path: None,
            subagents_dir: None,
        },
    ];

    let native_sessions = vec![pharos_daemon::profiles::cursor::NativeCursorSession {
        native_session_id: "sess-z".to_string(),
        title: Some("Unrelated session".to_string()),
        updated_at_ms: 1_711_234_568_000,
        project_root: None,
        project_hint: Some("Users-tester-home_projects-other-repo".to_string()),
        transcript_path: std::path::PathBuf::from("/tmp/sess-z.jsonl"),
    }];

    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert!(sessions.iter().all(|session| session.native_session_id.is_none()));
    assert!(sessions.iter().all(|session| session.transcript_path.is_none()));
}

#[test]
fn cursor_profile_does_not_link_unrelated_native_session_when_only_one_cursor_process_exists() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::CursorAgent,
        session_id: "proc-1".to_string(),
        native_session_id: None,
        pid: Some(1),
        cwd: "/Users/tester/workspaces/project-alpha".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "cursor-agent".to_string(),
        display_title: None,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let native_sessions = vec![pharos_daemon::profiles::cursor::NativeCursorSession {
        native_session_id: "sess-z".to_string(),
        title: Some("Unrelated session".to_string()),
        updated_at_ms: 1_711_234_568_000,
        project_root: None,
        project_hint: Some("Users-tester-home_projects-other-repo".to_string()),
        transcript_path: std::path::PathBuf::from("/tmp/sess-z.jsonl"),
    }];

    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert!(sessions.iter().all(|session| session.native_session_id.is_none()));
    assert!(sessions.iter().all(|session| session.transcript_path.is_none()));
}
