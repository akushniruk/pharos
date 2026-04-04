use pharos_daemon::envelope::{
    codex_event_to_envelope, cursor_event_to_envelope, transcript_event_to_envelope,
};
use pharos_daemon::model::{AcquisitionMode, EventKind, RuntimeSource};
use pharos_daemon::profiles::codex::CodexSessionEvent;
use pharos_daemon::profiles::cursor::CursorSessionEvent;
use pharos_daemon::profiles::gemini::GeminiSessionEvent;
use pharos_daemon::tailer::TranscriptEvent;
use serde_json::json;

#[test]
fn converts_user_prompt_to_envelope() {
    let event = TranscriptEvent::UserPrompt {
        text: "hello world".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::UserPromptSubmitted);
    assert_eq!(envelope.acquisition_mode, AcquisitionMode::Observed);
    assert_eq!(envelope.session.workspace_id, "my-project");
    assert_eq!(envelope.session.session_id, "sess-1234");
    assert_eq!(envelope.title, "user prompt");
    assert_eq!(envelope.payload["prompt"], "hello world");
}

#[test]
fn converts_tool_use_to_envelope() {
    let event = TranscriptEvent::ToolUse {
        tool_name: "Bash".to_string(),
        tool_use_id: "toolu_01abc".to_string(),
        input: json!({"command": "ls"}),
        model: Some("claude-opus-4-5".to_string()),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallStarted);
    assert_eq!(envelope.title, "tool call started: Bash");
    assert_eq!(envelope.payload["tool_name"], "Bash");
    assert_eq!(envelope.payload["tool_use_id"], "toolu_01abc");
    assert_eq!(envelope.payload["model"], "claude-opus-4-5");
}

#[test]
fn converts_tool_result_success_to_envelope() {
    let event = TranscriptEvent::ToolResult {
        tool_use_id: "toolu_01abc".to_string(),
        tool_name: Some("Bash".to_string()),
        is_error: false,
        content: "output".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallCompleted);
    assert_eq!(envelope.title, "tool call completed: Bash");
    assert_eq!(envelope.payload["tool_name"], "Bash");
}

#[test]
fn converts_tool_result_failure_to_envelope() {
    let event = TranscriptEvent::ToolResult {
        tool_use_id: "toolu_01abc".to_string(),
        tool_name: None,
        is_error: true,
        content: "error".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::ToolCallFailed);
    assert_eq!(envelope.title, "tool call failed: unknown");
    assert_eq!(envelope.payload["tool_name"], "unknown");
}

#[test]
fn converts_ai_title_to_envelope() {
    let event = TranscriptEvent::AiTitle {
        title: "Test session".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        None,
        1711234567000,
    );

    assert_eq!(envelope.event_kind, EventKind::SessionTitleChanged);
    assert_eq!(envelope.title, "session title: Test session");
}

#[test]
fn includes_agent_id_when_provided() {
    let event = TranscriptEvent::UserPrompt {
        text: "do something".to_string(),
    };

    let envelope = transcript_event_to_envelope(
        &event,
        RuntimeSource::ClaudeCode,
        "my-project",
        "sess-1234",
        Some("agent-abc"),
        1711234567000,
    );

    assert_eq!(envelope.agent_id, Some("agent-abc".to_string()));
}

#[test]
fn converts_codex_tool_use_to_envelope() {
    let event = CodexSessionEvent::ToolUse {
        tool_name: "exec_command".to_string(),
        tool_use_id: "call_123".to_string(),
        input: json!({"command": ["ls"]}),
        model: None,
    };

    let envelope = codex_event_to_envelope(&event, "pharos", "proc-42", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CodexCli);
    assert_eq!(envelope.acquisition_mode, AcquisitionMode::Observed);
    assert_eq!(envelope.event_kind, EventKind::ToolCallStarted);
    assert_eq!(envelope.title, "tool call started: exec_command");
    assert_eq!(envelope.session.workspace_id, "pharos");
    assert_eq!(envelope.session.session_id, "proc-42");
    assert_eq!(envelope.payload["tool_name"], "exec_command");
    assert_eq!(envelope.payload["tool_use_id"], "call_123");
}

#[test]
fn converts_codex_tool_result_failure_to_envelope() {
    let event = CodexSessionEvent::ToolResult {
        tool_use_id: "call_123".to_string(),
        tool_name: Some("exec_command".to_string()),
        is_error: true,
        content: "permission denied".to_string(),
        model: None,
    };

    let envelope = codex_event_to_envelope(&event, "pharos", "proc-42", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CodexCli);
    assert_eq!(envelope.event_kind, EventKind::ToolCallFailed);
    assert_eq!(envelope.title, "tool call failed: exec_command");
    assert_eq!(envelope.payload["tool_name"], "exec_command");
    assert_eq!(envelope.payload["is_error"], true);
    assert_eq!(envelope.payload["content"], "permission denied");
}

#[test]
fn converts_codex_session_title_changed_to_envelope() {
    let event = CodexSessionEvent::SessionTitleChanged {
        title: "Review native Codex metadata".to_string(),
    };

    let envelope = codex_event_to_envelope(&event, "pharos", "proc-42", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CodexCli);
    assert_eq!(envelope.event_kind, EventKind::SessionTitleChanged);
    assert_eq!(
        envelope.title,
        "session title: Review native Codex metadata"
    );
    assert_eq!(envelope.payload["title"], "Review native Codex metadata");
}

#[test]
fn converts_codex_spawn_agent_to_subagent_start_envelope() {
    let event = CodexSessionEvent::SubagentStart {
        agent_type: "explorer".to_string(),
        display_name: "Explorer".to_string(),
        description: Some("inspect the daemon".to_string()),
        model: Some("gpt-5.4-mini".to_string()),
        reasoning_effort: Some("medium".to_string()),
        agent_id: "turn-3".to_string(),
    };

    let envelope = codex_event_to_envelope(&event, "pharos", "proc-42", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CodexCli);
    assert_eq!(envelope.event_kind, EventKind::SubagentStarted);
    assert_eq!(envelope.agent_id.as_deref(), Some("turn-3"));
    assert_eq!(envelope.payload["agent_type"], "explorer");
    assert_eq!(envelope.payload["agent_name"], "Explorer");
    assert_eq!(envelope.payload["description"], "inspect the daemon");
    assert_eq!(envelope.payload["parent_agent_id"], "main");
}

#[test]
fn converts_gemini_user_prompt_to_envelope() {
    let event = GeminiSessionEvent::UserPrompt {
        text: "build the feature".to_string(),
    };

    let envelope = pharos_daemon::envelope::gemini_event_to_envelope(
        &event,
        "pharos",
        "gem-live",
        1_711_234_567_000,
    );

    assert_eq!(envelope.runtime_source, RuntimeSource::GeminiCli);
    assert_eq!(envelope.event_kind, EventKind::UserPromptSubmitted);
    assert_eq!(envelope.title, "user prompt");
    assert_eq!(envelope.payload["prompt"], "build the feature");
}

#[test]
fn converts_gemini_assistant_text_to_envelope() {
    let event = GeminiSessionEvent::AssistantText {
        text: "Working on it".to_string(),
    };

    let envelope = pharos_daemon::envelope::gemini_event_to_envelope(
        &event,
        "pharos",
        "gem-live",
        1_711_234_567_000,
    );

    assert_eq!(envelope.runtime_source, RuntimeSource::GeminiCli);
    assert_eq!(envelope.event_kind, EventKind::AssistantResponse);
    assert_eq!(envelope.title, "assistant response");
    assert_eq!(envelope.payload["text"], "Working on it");
}

#[test]
fn preserves_full_assistant_text_without_truncating() {
    let long_text = "A".repeat(260);

    let transcript_event = TranscriptEvent::AssistantText {
        text: long_text.clone(),
        model: Some("claude-sonnet".to_string()),
    };
    let transcript_envelope = transcript_event_to_envelope(
        &transcript_event,
        RuntimeSource::ClaudeCode,
        "pharos",
        "sess-1",
        None,
        1_711_234_567_000,
    );
    assert_eq!(transcript_envelope.payload["text"], long_text);

    let codex_event = CodexSessionEvent::AssistantText {
        text: long_text.clone(),
        model: None,
    };
    let codex_envelope = codex_event_to_envelope(&codex_event, "pharos", "codex-1", 1_711_234_567_000);
    assert_eq!(codex_envelope.payload["text"], long_text);

    let gemini_event = GeminiSessionEvent::AssistantText {
        text: long_text.clone(),
    };
    let gemini_envelope =
        pharos_daemon::envelope::gemini_event_to_envelope(
            &gemini_event,
            "pharos",
            "gemini-1",
            1_711_234_567_000,
        );
    assert_eq!(gemini_envelope.payload["text"], long_text);

    let cursor_event = CursorSessionEvent::AssistantText { text: long_text.clone() };
    let cursor_envelope =
        cursor_event_to_envelope(&cursor_event, "pharos", "cursor-1", 1_711_234_567_000);
    assert_eq!(cursor_envelope.payload["text"], long_text);
}

#[test]
fn converts_gemini_tool_use_to_envelope() {
    let event = GeminiSessionEvent::ToolUse {
        tool_name: "shell".to_string(),
        tool_use_id: "tool-1".to_string(),
        input: json!({"command": "cargo test"}),
    };

    let envelope = pharos_daemon::envelope::gemini_event_to_envelope(
        &event,
        "pharos",
        "gem-live",
        1_711_234_567_000,
    );

    assert_eq!(envelope.runtime_source, RuntimeSource::GeminiCli);
    assert_eq!(envelope.event_kind, EventKind::ToolCallStarted);
    assert_eq!(envelope.title, "tool call started: shell");
    assert_eq!(envelope.payload["tool_name"], "shell");
    assert_eq!(envelope.payload["tool_use_id"], "tool-1");
}

#[test]
fn converts_gemini_tool_result_to_envelope() {
    let event = GeminiSessionEvent::ToolResult {
        tool_use_id: "tool-1".to_string(),
        tool_name: Some("shell".to_string()),
        is_error: false,
        content: "ok".to_string(),
    };

    let envelope = pharos_daemon::envelope::gemini_event_to_envelope(
        &event,
        "pharos",
        "gem-live",
        1_711_234_567_000,
    );

    assert_eq!(envelope.runtime_source, RuntimeSource::GeminiCli);
    assert_eq!(envelope.event_kind, EventKind::ToolCallCompleted);
    assert_eq!(envelope.title, "tool call completed: shell");
    assert_eq!(envelope.payload["tool_name"], "shell");
    assert_eq!(envelope.payload["tool_use_id"], "tool-1");
}

#[test]
fn converts_cursor_tool_use_to_envelope() {
    let event = CursorSessionEvent::ToolUse {
        tool_name: "ReadFile".to_string(),
        tool_use_id: "tool-2".to_string(),
        input: json!({"path":"apps/daemon-rs/src/scanner.rs"}),
    };

    let envelope = cursor_event_to_envelope(&event, "pharos", "cursor-sess", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CursorAgent);
    assert_eq!(envelope.event_kind, EventKind::ToolCallStarted);
    assert_eq!(envelope.payload["tool_name"], "ReadFile");
    assert_eq!(envelope.payload["tool_use_id"], "tool-2");
}

#[test]
fn converts_cursor_subagent_start_to_envelope() {
    let event = CursorSessionEvent::SubagentStart {
        agent_id: "tool-1".to_string(),
        display_name: "Cursor Helper".to_string(),
        description: Some("inspect scanner dedupe behavior".to_string()),
        parent_agent_id: Some("main".to_string()),
    };

    let envelope = cursor_event_to_envelope(&event, "pharos", "cursor-sess", 1_711_234_567_000);

    assert_eq!(envelope.runtime_source, RuntimeSource::CursorAgent);
    assert_eq!(envelope.event_kind, EventKind::SubagentStarted);
    assert_eq!(envelope.agent_id.as_deref(), Some("tool-1"));
    assert_eq!(envelope.payload["agent_name"], "Cursor Helper");
}
