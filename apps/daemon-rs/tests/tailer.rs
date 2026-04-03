use pharos_daemon::tailer::{parse_jsonl_line, TranscriptEvent};

#[test]
fn parses_user_prompt_from_string_content() {
    let line = r#"{"type":"user","message":{"role":"user","content":"hello world"},"uuid":"u1","timestamp":"2026-04-02T15:00:00.000Z"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0].event, TranscriptEvent::UserPrompt { .. }));
    if let TranscriptEvent::UserPrompt { ref text } = events[0].event {
        assert_eq!(text, "hello world");
    }
    // Verify timestamp was parsed
    assert!(events[0].timestamp_ms.is_some());
}

#[test]
fn parses_tool_use_from_assistant_content() {
    let line = r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"toolu_01abc","name":"Bash","input":{"command":"ls"}}]},"uuid":"u3","timestamp":"2026-04-02T15:00:01.000Z"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    if let TranscriptEvent::ToolUse { ref tool_name, ref tool_use_id, ref input, ref model } = events[0].event {
        assert_eq!(tool_name, "Bash");
        assert_eq!(tool_use_id, "toolu_01abc");
        assert_eq!(model, &Some("claude-opus-4-5".to_string()));
        assert_eq!(input["command"], "ls");
    } else {
        panic!("expected ToolUse");
    }
}

#[test]
fn parses_tool_result_success() {
    let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01abc","content":"file1.txt","is_error":false}]},"uuid":"u4"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    if let TranscriptEvent::ToolResult { ref tool_use_id, ref tool_name, is_error, .. } = events[0].event {
        assert_eq!(tool_use_id, "toolu_01abc");
        assert!(tool_name.is_none());
        assert!(!is_error);
    } else {
        panic!("expected ToolResult");
    }
}

#[test]
fn parses_tool_result_failure() {
    let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_02def","content":"error: not found","is_error":true}]},"uuid":"u5"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0].event, TranscriptEvent::ToolResult { is_error: true, .. }));
}

#[test]
fn parses_ai_title() {
    let line = r#"{"type":"ai-title","sessionId":"sess-test","aiTitle":"Test session title"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    if let TranscriptEvent::AiTitle { ref title } = events[0].event {
        assert_eq!(title, "Test session title");
    } else {
        panic!("expected AiTitle");
    }
}

#[test]
fn parses_assistant_text_response() {
    let line = r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"text","text":"Hi there!"}]},"uuid":"u2"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0].event, TranscriptEvent::AssistantText { .. }));
}

#[test]
fn skips_queue_operations() {
    let events = parse_jsonl_line(r#"{"type":"queue-operation","operation":"enqueue"}"#);
    assert!(events.is_empty());
}

#[test]
fn skips_malformed_json() {
    let events = parse_jsonl_line("not json at all");
    assert!(events.is_empty());
}

#[test]
fn parses_all_events_from_fixture_file() {
    let content = std::fs::read_to_string("fixtures/native/transcript.jsonl").expect("read fixture");
    let events: Vec<_> = content
        .lines()
        .flat_map(parse_jsonl_line)
        .collect();
    // 7 lines: user prompt, assistant text, tool_use, tool_result ok, tool_result err, ai-title, queue-op(skipped)
    assert_eq!(events.len(), 6);
}

#[test]
fn parses_multiple_tool_uses_from_single_assistant_message() {
    let line = r#"{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5","content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file":"a.rs"}},{"type":"tool_use","id":"t2","name":"Bash","input":{"command":"ls"}}]},"uuid":"u9"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 2);
    assert!(matches!(events[0].event, TranscriptEvent::ToolUse { ref tool_name, .. } if tool_name == "Read"));
    assert!(matches!(events[1].event, TranscriptEvent::ToolUse { ref tool_name, .. } if tool_name == "Bash"));
}

#[test]
fn parses_multiple_tool_results_from_single_user_message() {
    let line = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"ok","is_error":false},{"type":"tool_result","tool_use_id":"t2","content":"fail","is_error":true}]},"uuid":"u10"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 2);
    assert!(matches!(events[0].event, TranscriptEvent::ToolResult { is_error: false, .. }));
    assert!(matches!(events[1].event, TranscriptEvent::ToolResult { is_error: true, .. }));
}

#[test]
fn extracts_iso8601_timestamp_as_milliseconds() {
    let line = r#"{"type":"user","message":{"role":"user","content":"test"},"timestamp":"2026-04-02T15:44:23.756Z"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    let ts = events[0].timestamp_ms.expect("should have timestamp");
    // 2026-04-02 15:44:23.756 UTC — verify it's in the right ballpark (2026)
    assert!(ts > 1_774_000_000_000); // after 2026-03-01
    assert!(ts < 1_776_000_000_000); // before 2026-05-01
}

#[test]
fn handles_missing_timestamp_gracefully() {
    let line = r#"{"type":"ai-title","aiTitle":"No timestamp here"}"#;
    let events = parse_jsonl_line(line);
    assert_eq!(events.len(), 1);
    assert!(events[0].timestamp_ms.is_none());
}
