use tempfile::tempdir;

#[test]
fn parses_claude_session_file_into_detected_session() {
    let temp = tempdir().expect("tempdir");
    let sessions_dir = temp.path().join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("create sessions dir");
    std::fs::copy(
        "fixtures/native/claude_session.json",
        sessions_dir.join("12345.json"),
    )
    .expect("copy fixture");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();

    assert_eq!(sessions.len(), 1);
    let session = &sessions[0];
    assert_eq!(session.session_id, "abc12345-def6-7890-abcd-ef1234567890");
    assert_eq!(session.pid, Some(12345));
    assert_eq!(session.cwd, "/Users/testuser/my-project");
    assert_eq!(session.started_at_ms, 1775143799221_i64);
    assert_eq!(session.entrypoint, "claude-vscode");
}

#[test]
fn returns_empty_when_sessions_dir_missing() {
    let temp = tempdir().expect("tempdir");
    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();
    assert!(sessions.is_empty());
}

#[test]
fn skips_malformed_session_files() {
    let temp = tempdir().expect("tempdir");
    let sessions_dir = temp.path().join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("create sessions dir");
    std::fs::write(sessions_dir.join("99999.json"), "not valid json").expect("write bad file");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let sessions = profile.discover_sessions();
    assert!(sessions.is_empty());
}

#[test]
fn computes_project_slug_from_cwd() {
    assert_eq!(
        pharos_daemon::profiles::claude::cwd_to_project_slug("/Users/testuser/my-project"),
        "-Users-testuser-my-project"
    );
}

#[test]
fn resolves_transcript_path() {
    let temp = tempdir().expect("tempdir");
    let slug = "-Users-testuser-my-project";
    let session_id = "abc12345-def6-7890-abcd-ef1234567890";

    let projects_dir = temp.path().join("projects").join(slug);
    std::fs::create_dir_all(&projects_dir).expect("create projects dir");
    let jsonl_path = projects_dir.join(format!("{session_id}.jsonl"));
    std::fs::write(&jsonl_path, "").expect("create empty jsonl");

    let profile = pharos_daemon::profiles::claude::ClaudeProfile::new(temp.path().to_path_buf());
    let resolved = profile.resolve_transcript_path("/Users/testuser/my-project", session_id);
    assert!(resolved.is_some());
    assert_eq!(resolved.unwrap(), jsonl_path);
}
