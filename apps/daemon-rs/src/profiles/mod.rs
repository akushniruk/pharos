pub mod claude;

use std::path::PathBuf;

use crate::model::RuntimeSource;

/// A live session detected by the scanner.
#[derive(Debug, Clone)]
pub struct DetectedSession {
    pub runtime_source: RuntimeSource,
    pub session_id: String,
    pub pid: Option<u32>,
    pub cwd: String,
    pub started_at_ms: i64,
    pub entrypoint: String,
    pub transcript_path: Option<PathBuf>,
    pub subagents_dir: Option<PathBuf>,
}
