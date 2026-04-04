use pharos_daemon::envelope::transcript_event_to_envelope;
use pharos_daemon::model::{EventKind, RuntimeSource};
use pharos_daemon::profiles::claude::ClaudeProfile;
use pharos_daemon::store::Store;
use pharos_daemon::tailer::parse_jsonl_line;
use tempfile::tempdir;

/// Simulates the full scanner cycle: discover session → tail transcript → produce events.
#[test]
fn full_scan_cycle_discovers_session_and_tails_transcript() {
    let temp = tempdir().expect("tempdir");
    let claude_home = temp.path();

    // 1. Create session file
    let sessions_dir = claude_home.join("sessions");
    std::fs::create_dir_all(&sessions_dir).expect("mkdir sessions");
    std::fs::write(
        sessions_dir.join("55555.json"),
        r#"{"pid":55555,"sessionId":"test-sess-001","cwd":"/Users/testuser/my-project","startedAt":1775143799221,"kind":"interactive","entrypoint":"claude-vscode"}"#,
    ).expect("write session");

    // 2. Create transcript JSONL
    let project_dir = claude_home
        .join("projects")
        .join("-Users-testuser-my-project");
    std::fs::create_dir_all(&project_dir).expect("mkdir projects");
    std::fs::write(
        project_dir.join("test-sess-001.jsonl"),
        concat!(
            r#"{"type":"user","message":{"role":"user","content":"hello from test"},"uuid":"u1"}"#, "\n",
            r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"toolu_01","name":"Read","input":{"file":"foo.rs"}}]},"uuid":"u2"}"#, "\n",
            r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"fn main() {}","is_error":false}]},"uuid":"u3"}"#, "\n",
            r#"{"type":"ai-title","sessionId":"test-sess-001","aiTitle":"Test project work"}"#, "\n",
        ),
    ).expect("write transcript");

    // 3. Create subagent
    let subagent_dir = project_dir.join("test-sess-001").join("subagents");
    std::fs::create_dir_all(&subagent_dir).expect("mkdir subagents");
    std::fs::write(
        subagent_dir.join("agent-abc123.meta.json"),
        r#"{"agentType":"Explore","description":"Explore codebase"}"#,
    )
    .expect("write subagent meta");

    // 4. Discover sessions
    let profile = ClaudeProfile::new(claude_home.to_path_buf());
    let sessions = profile.discover_sessions();
    assert_eq!(sessions.len(), 1);
    let session = &sessions[0];
    assert_eq!(session.session_id, "test-sess-001");
    assert!(session.transcript_path.is_some());

    // 5. Parse transcript
    let transcript = std::fs::read_to_string(session.transcript_path.as_ref().unwrap())
        .expect("read transcript");
    let events: Vec<_> = transcript.lines().flat_map(parse_jsonl_line).collect();
    assert_eq!(events.len(), 4); // prompt, tool_use, tool_result, ai-title

    // 6. Convert to envelopes and insert into store
    let store = Store::open_in_memory().expect("store");
    for te in &events {
        let envelope = transcript_event_to_envelope(
            &te.event,
            RuntimeSource::ClaudeCode,
            "my-project",
            "test-sess-001",
            None,
            te.timestamp_ms.unwrap_or(1775143799221),
        );
        store.insert_event(&envelope).expect("insert");
    }

    // 7. Verify store has all events
    let stored = store.list_events().expect("list events");
    assert_eq!(stored.len(), 4);
    assert_eq!(stored[0].event_kind, EventKind::UserPromptSubmitted);
    assert_eq!(stored[1].event_kind, EventKind::ToolCallStarted);
    assert_eq!(stored[2].event_kind, EventKind::ToolCallCompleted);
    assert_eq!(stored[3].event_kind, EventKind::SessionTitleChanged);

    // 8. Verify sessions API
    let sessions = store.list_sessions().expect("list sessions");
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].session_id, "test-sess-001");
    assert_eq!(sessions[0].event_count, 4);

    // 9. Verify subagent meta exists
    assert!(subagent_dir.join("agent-abc123.meta.json").exists());
}
