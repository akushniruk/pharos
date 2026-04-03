use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::gemini::{enrich_detected_sessions, GeminiProfile};
use pharos_daemon::profiles::DetectedSession;
use tempfile::tempdir;

#[test]
fn gemini_profile_discovers_native_sessions_from_logs() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::create_dir_all(temp_dir.path().join("tmp").join("pharos")).expect("logs dir");
    std::fs::write(
        temp_dir.path().join("tmp").join("pharos").join("logs.json"),
        r#"[
          {
            "sessionId": "gem-a",
            "messageId": 0,
            "type": "user",
            "message": "/model manage",
            "timestamp": "2026-04-03T11:35:03.467Z"
          },
          {
            "sessionId": "gem-a",
            "messageId": 1,
            "type": "user",
            "message": "review the pharos solid app",
            "timestamp": "2026-04-03T11:36:19.705Z"
          }
        ]"#,
    )
    .expect("write logs");

    let profile = GeminiProfile::new(temp_dir.path().to_path_buf());
    let sessions = profile.discover_native_sessions();

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].native_session_id, "gem-a");
    assert_eq!(sessions[0].workspace_hint.as_deref(), Some("pharos"));
    assert_eq!(sessions[0].title.as_deref(), Some("review the pharos solid app"));
    assert!(sessions[0].updated_at_ms > 0);
}

#[test]
fn gemini_native_session_enrichment_uses_workspace_hint() {
    let mut sessions = vec![DetectedSession {
        runtime_source: RuntimeSource::GeminiCli,
        session_id: "proc-99".to_string(),
        native_session_id: None,
        pid: Some(99),
        cwd: "/Users/tester/workspace/pharos".to_string(),
        started_at_ms: 1_711_234_567_000,
        entrypoint: "gemini".to_string(),
        display_title: None,
        history_path: None,
        transcript_path: None,
        subagents_dir: None,
    }];

    let native_sessions = vec![pharos_daemon::profiles::gemini::NativeGeminiSession {
        native_session_id: "gem-a".to_string(),
        title: Some("review the pharos solid app".to_string()),
        updated_at_ms: 1_711_234_579_000,
        workspace_hint: Some("pharos".to_string()),
    }];

    enrich_detected_sessions(&mut sessions, &native_sessions);

    assert_eq!(
        sessions[0].display_title.as_deref(),
        Some("review the pharos solid app")
    );
}
