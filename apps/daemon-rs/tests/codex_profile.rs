use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::codex::{enrich_detected_sessions, CodexProfile};
use pharos_daemon::profiles::DetectedSession;
use tempfile::tempdir;

#[test]
fn codex_profile_discovers_native_session_titles_and_project_roots() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::create_dir_all(temp_dir.path().join("sessions")).expect("sessions dir");
    std::fs::write(
        temp_dir.path().join("session_index.jsonl"),
        r#"{"id":"sess-a","thread_name":"Review pharos runtime design","updated_at":"2026-04-03T11:40:03.467Z"}"#,
    )
    .expect("write index");
    std::fs::write(
        temp_dir.path().join("sessions").join("rollout-sess-a.json"),
        r#"{
          "session": {
            "timestamp": "2026-04-03T11:35:03.467Z",
            "id": "sess-a",
            "instructions": ""
          },
          "items": [
            {
              "type": "message",
              "role": "assistant",
              "content": [
                {
                  "type": "output_text",
                  "text": "Codex CLI initialized.\nProject root: /Users/tester/workspace/pharos\nType `help` for a list of available commands."
                }
              ]
            },
            {
              "type": "message",
              "role": "user",
              "content": [
                {
                  "type": "input_text",
                  "text": "review codebase fully"
                }
              ]
            }
          ]
        }"#,
    )
    .expect("write session");

    let profile = CodexProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_native_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].native_session_id, "sess-a");
    assert_eq!(sessions[0].project_root.as_deref(), Some("/Users/tester/workspace/pharos"));
    assert_eq!(sessions[0].title.as_deref(), Some("review codebase fully"));
    assert!(sessions[0].updated_at_ms > 0);
}

#[test]
fn codex_native_session_enrichment_upgrades_detected_process_name() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::CodexCli,
        session_id: "proc-42".to_string(),
        pid: Some(42),
        cwd: "/Users/tester/workspace/pharos".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "codex".to_string(),
        display_title: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let profile = CodexProfile::new(tempdir().expect("tempdir").path().to_path_buf());
    let native_sessions = vec![pharos_daemon::profiles::codex::NativeCodexSession {
        native_session_id: "sess-a".to_string(),
        title: Some("Review pharos runtime design".to_string()),
        updated_at_ms: 1_711_234_569_000,
        project_root: Some("/Users/tester/workspace/pharos".to_string()),
    }];

    let _ = profile;
    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert_eq!(
        sessions[0].display_title.as_deref(),
        Some("Review pharos runtime design")
    );
}
