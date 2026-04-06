use super::session::TrackedSession;

const MAX_CODEX_SIGNATURES: usize = 256;

pub(crate) fn remember_codex_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::codex::CodexSessionEvent,
) -> bool {
    let signature = codex_signature(event);
    if session.recent_codex_signatures.contains(&signature) {
        return false;
    }
    session.recent_codex_signatures.push(signature);
    if session.recent_codex_signatures.len() > MAX_CODEX_SIGNATURES {
        session.recent_codex_signatures.remove(0);
    }
    true
}

const MAX_GEMINI_SIGNATURES: usize = 256;

pub(crate) fn remember_gemini_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::gemini::GeminiSessionEvent,
) -> bool {
    let signature = gemini_signature(event);
    if session.recent_gemini_signatures.contains(&signature) {
        return false;
    }
    session.recent_gemini_signatures.push(signature);
    if session.recent_gemini_signatures.len() > MAX_GEMINI_SIGNATURES {
        session.recent_gemini_signatures.remove(0);
    }
    true
}

const MAX_CURSOR_SIGNATURES: usize = 256;

pub(crate) fn remember_cursor_signature(
    session: &mut TrackedSession,
    event: &crate::profiles::cursor::CursorSessionEvent,
) -> bool {
    let signature = cursor_signature(event);
    if session.recent_cursor_signatures.contains(&signature) {
        return false;
    }
    session.recent_cursor_signatures.push(signature);
    if session.recent_cursor_signatures.len() > MAX_CURSOR_SIGNATURES {
        session.recent_cursor_signatures.remove(0);
    }
    true
}

pub(crate) fn gemini_signature(event: &crate::profiles::gemini::GeminiSessionEvent) -> String {
    match event {
        crate::profiles::gemini::GeminiSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::gemini::GeminiSessionEvent::AssistantText { text } => {
            format!("assistant:{text}")
        }
        crate::profiles::gemini::GeminiSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::gemini::GeminiSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
    }
}

pub(crate) fn cursor_signature(event: &crate::profiles::cursor::CursorSessionEvent) -> String {
    match event {
        crate::profiles::cursor::CursorSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::cursor::CursorSessionEvent::AssistantText { text } => {
            format!("assistant:{text}")
        }
        crate::profiles::cursor::CursorSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::cursor::CursorSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
        crate::profiles::cursor::CursorSessionEvent::SubagentStart {
            agent_id,
            display_name,
            description,
            parent_agent_id,
        } => format!(
            "subagent:{agent_id}:{display_name}:{}:{}",
            description.clone().unwrap_or_default(),
            parent_agent_id.clone().unwrap_or_default()
        ),
    }
}

pub(crate) fn codex_signature(event: &crate::profiles::codex::CodexSessionEvent) -> String {
    match event {
        crate::profiles::codex::CodexSessionEvent::UserPrompt { text } => {
            format!("prompt:{text}")
        }
        crate::profiles::codex::CodexSessionEvent::AssistantText { text, .. } => {
            format!("assistant:{text}")
        }
        crate::profiles::codex::CodexSessionEvent::SessionTitleChanged { title } => {
            format!("title:{title}")
        }
        crate::profiles::codex::CodexSessionEvent::SubagentStart {
            agent_type,
            display_name,
            description,
            model,
            reasoning_effort,
            agent_id,
        } => format!(
            "subagent:{agent_id}:{agent_type}:{display_name}:{}:{}:{}",
            description.clone().unwrap_or_default(),
            model.clone().unwrap_or_default(),
            reasoning_effort.clone().unwrap_or_default()
        ),
        crate::profiles::codex::CodexSessionEvent::ToolUse {
            tool_name,
            tool_use_id,
            input,
            ..
        } => format!("tool_use:{tool_use_id}:{tool_name}:{input}"),
        crate::profiles::codex::CodexSessionEvent::ToolResult {
            tool_use_id,
            tool_name,
            is_error,
            content,
            ..
        } => format!(
            "tool_result:{tool_use_id}:{}:{is_error}:{content}",
            tool_name.clone().unwrap_or_default()
        ),
    }
}
