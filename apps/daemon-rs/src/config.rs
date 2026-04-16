use std::collections::BTreeMap;
use std::env;
use std::path::PathBuf;

use serde::Deserialize;
use thiserror::Error;

use crate::api::AppOptions;
use crate::memory_brain::MemoryBrainConfig;
use crate::model::RuntimeSource;
use crate::profiles::DiscoveryOptions;
use crate::profiles::process::load_runtime_matchers;

const HOST_ENV: &str = "PHAROS_DAEMON_HOST";
const PORT_ENV: &str = "PHAROS_DAEMON_PORT";
const DB_PATH_ENV: &str = "PHAROS_DAEMON_DB_PATH";
const CLAUDE_SESSIONS_DIR_ENV: &str = "PHAROS_CLAUDE_SESSIONS_DIR";
const CLAUDE_HOME_ENV: &str = "PHAROS_CLAUDE_HOME";
const CODEX_HOME_ENV: &str = "PHAROS_CODEX_HOME";
const GEMINI_HOME_ENV: &str = "PHAROS_GEMINI_HOME";
const CURSOR_HOME_ENV: &str = "PHAROS_CURSOR_HOME";
const RUNTIME_MATCHERS_PATH_ENV: &str = "PHAROS_RUNTIME_MATCHERS_PATH";
const MEMORY_BRAIN_ENABLED_ENV: &str = "PHAROS_MEMORY_BRAIN_INTEGRATION";
const MEMORY_BRAIN_URL_ENV: &str = "PHAROS_MEMORY_BRAIN_URL";
const MEMORY_BRAIN_TIMEOUT_MS_ENV: &str = "PHAROS_MEMORY_BRAIN_TIMEOUT_MS";
const MEMORY_BRAIN_POLL_MS_ENV: &str = "PHAROS_MEMORY_BRAIN_POLL_MS";
const MEMORY_BRAIN_REPAIR_PATH_ENV: &str = "PHAROS_MEMORY_BRAIN_REPAIR_PATH";
const MEMORY_BRAIN_OLLAMA_URL_ENV: &str = "PHAROS_MEMORY_BRAIN_OLLAMA_URL";
const MEMORY_BRAIN_HELPER_MODEL_ENV: &str = "PHAROS_MEMORY_BRAIN_HELPER_MODEL";
const OLLAMA_EVENT_WORKSPACE_ENV: &str = "PHAROS_OLLAMA_EVENT_WORKSPACE";
const HOME_ENV: &str = "HOME";
const APPDATA_ENV: &str = "APPDATA";
const USERPROFILE_ENV: &str = "USERPROFILE";
const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 4000;
const DEFAULT_DB_PATH: &str = "pharos-daemon.db";

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("invalid value for PHAROS_DAEMON_PORT: {0}")]
    InvalidPort(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub db_path: String,
    pub claude_sessions_dir: Option<PathBuf>,
    pub claude_home: Option<PathBuf>,
    pub codex_home: Option<PathBuf>,
    pub gemini_home: Option<PathBuf>,
    pub cursor_home: Option<PathBuf>,
    pub runtime_matchers_path: Option<PathBuf>,
    pub memory_brain: MemoryBrainConfig,
    /// Workspace id (`source_app`) for scanner-emitted Ollama `/api/ps` rows.
    pub ollama_events_workspace: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct RuntimeMatcherConfig {
    pub id: String,
    pub runtime_source: RuntimeSource,
    #[serde(default)]
    pub match_any: Vec<String>,
    #[serde(default)]
    pub match_exe_any: Vec<String>,
    #[serde(default)]
    pub match_exe_contains: Vec<String>,
    #[serde(default)]
    pub match_argv_any: Vec<String>,
    #[serde(default)]
    pub match_argv_contains: Vec<String>,
    #[serde(default)]
    pub match_cwd_any: Vec<String>,
    #[serde(default)]
    pub match_cwd_contains: Vec<String>,
    pub entrypoint: Option<String>,
    #[serde(default)]
    pub display_title: Option<String>,
}

impl Config {
    pub fn from_env_map(env_map: BTreeMap<String, String>) -> Result<Self, ConfigError> {
        let host = env_map
            .get(HOST_ENV)
            .cloned()
            .unwrap_or_else(|| DEFAULT_HOST.to_string());
        let port = match env_map.get(PORT_ENV) {
            Some(raw) => raw
                .parse::<u16>()
                .map_err(|_| ConfigError::InvalidPort(raw.clone()))?,
            None => DEFAULT_PORT,
        };
        let db_path = env_map
            .get(DB_PATH_ENV)
            .cloned()
            .unwrap_or_else(|| DEFAULT_DB_PATH.to_string());
        let claude_sessions_dir = env_map
            .get(CLAUDE_SESSIONS_DIR_ENV)
            .map(PathBuf::from)
            .or_else(|| default_claude_sessions_dir(&env_map));
        let claude_home = env_map
            .get(CLAUDE_HOME_ENV)
            .map(PathBuf::from)
            .or_else(|| default_claude_home(&env_map));
        let codex_home = env_map
            .get(CODEX_HOME_ENV)
            .map(PathBuf::from)
            .or_else(|| default_codex_home(&env_map));
        let gemini_home = env_map
            .get(GEMINI_HOME_ENV)
            .map(PathBuf::from)
            .or_else(|| default_gemini_home(&env_map));
        let cursor_home = env_map
            .get(CURSOR_HOME_ENV)
            .map(PathBuf::from)
            .or_else(|| default_cursor_home(&env_map));
        let runtime_matchers_path = env_map
            .get(RUNTIME_MATCHERS_PATH_ENV)
            .map(PathBuf::from)
            .or_else(|| default_runtime_matchers_path(&env_map));
        let memory_brain = MemoryBrainConfig {
            enabled: env_truthy(env_map.get(MEMORY_BRAIN_ENABLED_ENV)),
            base_url: env_map.get(MEMORY_BRAIN_URL_ENV).cloned(),
            ollama_base_url: env_map.get(MEMORY_BRAIN_OLLAMA_URL_ENV).cloned(),
            helper_model_hint: env_map.get(MEMORY_BRAIN_HELPER_MODEL_ENV).cloned(),
            timeout_ms: env_u64(env_map.get(MEMORY_BRAIN_TIMEOUT_MS_ENV), 3_000),
            poll_interval_ms: env_u64(env_map.get(MEMORY_BRAIN_POLL_MS_ENV), 15_000),
            repair_path: env_map
                .get(MEMORY_BRAIN_REPAIR_PATH_ENV)
                .cloned()
                .unwrap_or_else(|| "/ops/repair-graph".to_string()),
        };
        let ollama_events_workspace = env_map
            .get(OLLAMA_EVENT_WORKSPACE_ENV)
            .map(|raw| raw.trim().to_string())
            .filter(|value| !value.is_empty());

        Ok(Self {
            host,
            port,
            db_path,
            claude_sessions_dir,
            claude_home,
            codex_home,
            gemini_home,
            cursor_home,
            runtime_matchers_path,
            memory_brain,
            ollama_events_workspace,
        })
    }

    pub fn from_env() -> Result<Self, ConfigError> {
        let mut env_map = BTreeMap::new();

        if let Ok(host) = env::var(HOST_ENV) {
            env_map.insert(HOST_ENV.to_string(), host);
        }
        if let Ok(port) = env::var(PORT_ENV) {
            env_map.insert(PORT_ENV.to_string(), port);
        }
        if let Ok(db_path) = env::var(DB_PATH_ENV) {
            env_map.insert(DB_PATH_ENV.to_string(), db_path);
        }
        if let Ok(claude_sessions_dir) = env::var(CLAUDE_SESSIONS_DIR_ENV) {
            env_map.insert(CLAUDE_SESSIONS_DIR_ENV.to_string(), claude_sessions_dir);
        }
        if let Ok(claude_home) = env::var(CLAUDE_HOME_ENV) {
            env_map.insert(CLAUDE_HOME_ENV.to_string(), claude_home);
        }
        if let Ok(codex_home) = env::var(CODEX_HOME_ENV) {
            env_map.insert(CODEX_HOME_ENV.to_string(), codex_home);
        }
        if let Ok(gemini_home) = env::var(GEMINI_HOME_ENV) {
            env_map.insert(GEMINI_HOME_ENV.to_string(), gemini_home);
        }
        if let Ok(cursor_home) = env::var(CURSOR_HOME_ENV) {
            env_map.insert(CURSOR_HOME_ENV.to_string(), cursor_home);
        }
        if let Ok(runtime_matchers_path) = env::var(RUNTIME_MATCHERS_PATH_ENV) {
            env_map.insert(RUNTIME_MATCHERS_PATH_ENV.to_string(), runtime_matchers_path);
        }
        if let Ok(memory_brain_enabled) = env::var(MEMORY_BRAIN_ENABLED_ENV) {
            env_map.insert(MEMORY_BRAIN_ENABLED_ENV.to_string(), memory_brain_enabled);
        }
        if let Ok(memory_brain_url) = env::var(MEMORY_BRAIN_URL_ENV) {
            env_map.insert(MEMORY_BRAIN_URL_ENV.to_string(), memory_brain_url);
        }
        if let Ok(memory_brain_timeout) = env::var(MEMORY_BRAIN_TIMEOUT_MS_ENV) {
            env_map.insert(MEMORY_BRAIN_TIMEOUT_MS_ENV.to_string(), memory_brain_timeout);
        }
        if let Ok(memory_brain_poll) = env::var(MEMORY_BRAIN_POLL_MS_ENV) {
            env_map.insert(MEMORY_BRAIN_POLL_MS_ENV.to_string(), memory_brain_poll);
        }
        if let Ok(memory_brain_repair) = env::var(MEMORY_BRAIN_REPAIR_PATH_ENV) {
            env_map.insert(
                MEMORY_BRAIN_REPAIR_PATH_ENV.to_string(),
                memory_brain_repair,
            );
        }
        if let Ok(memory_brain_ollama_url) = env::var(MEMORY_BRAIN_OLLAMA_URL_ENV) {
            env_map.insert(
                MEMORY_BRAIN_OLLAMA_URL_ENV.to_string(),
                memory_brain_ollama_url,
            );
        }
        if let Ok(memory_brain_helper_model) = env::var(MEMORY_BRAIN_HELPER_MODEL_ENV) {
            env_map.insert(
                MEMORY_BRAIN_HELPER_MODEL_ENV.to_string(),
                memory_brain_helper_model,
            );
        }
        if let Ok(ollama_event_ws) = env::var(OLLAMA_EVENT_WORKSPACE_ENV) {
            env_map.insert(OLLAMA_EVENT_WORKSPACE_ENV.to_string(), ollama_event_ws);
        }
        if let Ok(home) = env::var(HOME_ENV) {
            env_map.insert(HOME_ENV.to_string(), home);
        }
        if let Ok(appdata) = env::var(APPDATA_ENV) {
            env_map.insert(APPDATA_ENV.to_string(), appdata);
        }
        if let Ok(profile) = env::var(USERPROFILE_ENV) {
            env_map.insert(USERPROFILE_ENV.to_string(), profile);
        }

        Self::from_env_map(env_map)
    }

    #[must_use]
    pub fn app_options(&self) -> AppOptions {
        AppOptions {
            claude_sessions_dir: self.claude_sessions_dir.clone(),
            memory_brain: Some(crate::memory_brain::MemoryBrainService::new(
                self.memory_brain.clone(),
            )),
        }
    }

    #[must_use]
    pub fn discovery_options(&self) -> DiscoveryOptions {
        DiscoveryOptions {
            claude_home: self.claude_home.clone(),
            codex_home: self.codex_home.clone(),
            gemini_home: self.gemini_home.clone(),
            cursor_home: self.cursor_home.clone(),
            runtime_matchers: load_runtime_matchers(self.runtime_matchers_path.as_deref()),
            ollama_base_url: self.memory_brain.ollama_base_url.clone(),
            ollama_events_workspace: self.ollama_events_workspace.clone(),
        }
    }
}

fn env_truthy(value: Option<&String>) -> bool {
    value.is_some_and(|raw| {
        matches!(
            raw.trim().to_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

fn env_u64(value: Option<&String>, default_value: u64) -> u64 {
    value
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .unwrap_or(default_value)
}

fn default_claude_sessions_dir(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    default_claude_home(env_map).map(|home| home.join("data").join("sessions"))
}

/// Resolve Claude's home directory cross-platform.
/// - macOS/Linux: `$HOME/.claude`
/// - Windows: `%APPDATA%\claude` or `%USERPROFILE%\.claude`
fn default_claude_home(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    // Try HOME first (macOS, Linux)
    if let Some(home) = env_map.get(HOME_ENV) {
        let path = PathBuf::from(home).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Try APPDATA (Windows)
    if let Some(appdata) = env_map.get(APPDATA_ENV) {
        let path = PathBuf::from(appdata).join("claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Try USERPROFILE (Windows fallback)
    if let Some(profile) = env_map.get(USERPROFILE_ENV) {
        let path = PathBuf::from(profile).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Fallback: try HOME even if dir doesn't exist yet
    env_map
        .get(HOME_ENV)
        .map(|home| PathBuf::from(home).join(".claude"))
}

fn default_codex_home(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    env_map
        .get(HOME_ENV)
        .map(|home| PathBuf::from(home).join(".codex"))
}

fn default_gemini_home(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    env_map
        .get(HOME_ENV)
        .map(|home| PathBuf::from(home).join(".gemini"))
}

fn default_cursor_home(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    env_map
        .get(HOME_ENV)
        .map(|home| PathBuf::from(home).join(".cursor"))
}

fn default_runtime_matchers_path(env_map: &BTreeMap<String, String>) -> Option<PathBuf> {
    env_map.get(HOME_ENV).map(|home| {
        PathBuf::from(home)
            .join(".config")
            .join("pharos")
            .join("runtime-matchers.json")
    })
}
