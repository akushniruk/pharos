use std::collections::HashMap;
use std::path::PathBuf;

pub(crate) struct TrackedSubagent {
    pub(crate) agent_id: String,
    pub(crate) jsonl_path: PathBuf,
    pub(crate) file_offset: u64,
    pub(crate) tool_name_map: HashMap<String, String>,
}

pub(crate) struct TrackedSession {
    pub(crate) session: crate::profiles::DetectedSession,
    pub(crate) missed_discovery_cycles: u8,
    pub(crate) file_offset: u64,
    pub(crate) codex_item_offset: usize,
    pub(crate) codex_log_offset: i64,
    pub(crate) codex_next_poll_at_ms: i64,
    pub(crate) recent_codex_signatures: Vec<String>,
    pub(crate) gemini_log_offset: usize,
    pub(crate) recent_gemini_signatures: Vec<String>,
    pub(crate) recent_cursor_signatures: Vec<String>,
    pub(crate) known_subagents: Vec<TrackedSubagent>,
    /// Maps tool_use_id → tool_name so ToolResult events can inherit the tool name.
    pub(crate) tool_name_map: HashMap<String, String>,
}

pub(crate) const SESSION_REMOVAL_GRACE_CYCLES: u8 = 3;

pub(crate) fn should_remove_after_missed_discovery(missed_cycles: u8) -> bool {
    missed_cycles >= SESSION_REMOVAL_GRACE_CYCLES
}
