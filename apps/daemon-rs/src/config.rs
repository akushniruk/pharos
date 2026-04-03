use std::collections::BTreeMap;
use std::env;
use std::path::PathBuf;

use serde::Deserialize;
use thiserror::Error;

use crate::model::RuntimeSource;

const HOST_ENV: &str = "PHAROS_DAEMON_HOST";
const PORT_ENV: &str = "PHAROS_DAEMON_PORT";
const DB_PATH_ENV: &str = "PHAROS_DAEMON_DB_PATH";
const CLAUDE_SESSIONS_DIR_ENV: &str = "PHAROS_CLAUDE_SESSIONS_DIR";
const CLAUDE_HOME_ENV: &str = "PHAROS_CLAUDE_HOME";
const CODEX_HOME_ENV: &str = "PHAROS_CODEX_HOME";
const GEMINI_HOME_ENV: &str = "PHAROS_GEMINI_HOME";
const RUNTIME_MATCHERS_PATH_ENV: &str = "PHAROS_RUNTIME_MATCHERS_PATH";
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
    pub runtime_matchers_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct RuntimeMatcherConfig {
    pub id: String,
    pub runtime_source: RuntimeSource,
    pub match_any: Vec<String>,
    pub entrypoint: Option<String>,
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
            .or_else(default_claude_sessions_dir);
        let claude_home = env_map
            .get(CLAUDE_HOME_ENV)
            .map(PathBuf::from)
            .or_else(default_claude_home);
        let codex_home = env_map
            .get(CODEX_HOME_ENV)
            .map(PathBuf::from)
            .or_else(default_codex_home);
        let gemini_home = env_map
            .get(GEMINI_HOME_ENV)
            .map(PathBuf::from)
            .or_else(default_gemini_home);
        let runtime_matchers_path = env_map
            .get(RUNTIME_MATCHERS_PATH_ENV)
            .map(PathBuf::from)
            .or_else(default_runtime_matchers_path);

        Ok(Self {
            host,
            port,
            db_path,
            claude_sessions_dir,
            claude_home,
            codex_home,
            gemini_home,
            runtime_matchers_path,
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
        if let Ok(runtime_matchers_path) = env::var(RUNTIME_MATCHERS_PATH_ENV) {
            env_map.insert(
                RUNTIME_MATCHERS_PATH_ENV.to_string(),
                runtime_matchers_path,
            );
        }

        Self::from_env_map(env_map)
    }
}

fn default_claude_sessions_dir() -> Option<PathBuf> {
    default_claude_home().map(|home| home.join("data").join("sessions"))
}

/// Resolve Claude's home directory cross-platform.
/// - macOS/Linux: `$HOME/.claude`
/// - Windows: `%APPDATA%\claude` or `%USERPROFILE%\.claude`
fn default_claude_home() -> Option<PathBuf> {
    // Try HOME first (macOS, Linux)
    if let Ok(home) = env::var("HOME") {
        let path = PathBuf::from(home).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Try APPDATA (Windows)
    if let Ok(appdata) = env::var("APPDATA") {
        let path = PathBuf::from(appdata).join("claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Try USERPROFILE (Windows fallback)
    if let Ok(profile) = env::var("USERPROFILE") {
        let path = PathBuf::from(profile).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Fallback: try HOME even if dir doesn't exist yet
    env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".claude"))
}

fn default_codex_home() -> Option<PathBuf> {
    env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".codex"))
}

fn default_gemini_home() -> Option<PathBuf> {
    env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".gemini"))
}

fn default_runtime_matchers_path() -> Option<PathBuf> {
    env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".config").join("pharos").join("runtime-matchers.json"))
}
