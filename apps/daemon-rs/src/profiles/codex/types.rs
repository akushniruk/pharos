//! Codex session types shared by discovery and parsing.

use std::path::PathBuf;

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeCodexSession {
    pub native_session_id: String,
    pub title: Option<String>,
    pub updated_at_ms: i64,
    pub project_root: Option<String>,
    pub history_path: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CodexIndexEntry {
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) thread_name: String,
    #[serde(default)]
    pub(crate) updated_at: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CodexSessionFile {
    pub(crate) session: CodexSessionHeader,
    #[serde(default)]
    pub(crate) items: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CodexSessionEvent {
    UserPrompt {
        text: String,
    },
    AssistantText {
        text: String,
        model: Option<String>,
    },
    SessionTitleChanged {
        title: String,
    },
    SubagentStart {
        agent_type: String,
        display_name: String,
        description: Option<String>,
        model: Option<String>,
        reasoning_effort: Option<String>,
        agent_id: String,
    },
    ToolUse {
        tool_name: String,
        tool_use_id: String,
        input: Value,
        model: Option<String>,
    },
    ToolResult {
        tool_use_id: String,
        tool_name: Option<String>,
        is_error: bool,
        content: String,
        model: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct CodexLiveEvent {
    pub row_id: i64,
    pub occurred_at_ms: i64,
    pub event: CodexSessionEvent,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CodexSessionHeader {
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) timestamp: String,
}

#[derive(Debug, Clone)]
pub(crate) struct CachedCodexDiscovery {
    pub(crate) fingerprint: CodexDiscoveryFingerprint,
    pub(crate) sessions: Vec<NativeCodexSession>,
}

#[derive(Debug, Clone)]
pub(crate) struct CachedCodexHistory {
    pub(crate) fingerprint: CodexHistoryFingerprint,
    pub(crate) events: Vec<CodexSessionEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CodexDiscoveryFingerprint {
    pub(crate) index_modified_ms: u128,
    pub(crate) sessions_modified_ms: u128,
    pub(crate) state_modified_ms: u128,
    pub(crate) session_file_count: usize,
    pub(crate) logs_modified_ms: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CodexHistoryFingerprint {
    pub(crate) modified_ms: u128,
    pub(crate) file_len: u64,
}
