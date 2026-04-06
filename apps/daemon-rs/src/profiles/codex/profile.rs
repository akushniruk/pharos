
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use rusqlite::Connection;

use super::parse::*;
use super::types::*;

pub struct CodexProfile {
    codex_home: PathBuf,
}

static DISCOVERY_CACHE: LazyLock<Mutex<HashMap<PathBuf, CachedCodexDiscovery>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static HISTORY_CACHE: LazyLock<Mutex<HashMap<PathBuf, CachedCodexHistory>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

impl CodexProfile {
    #[must_use]
    pub fn new(codex_home: PathBuf) -> Self {
        Self { codex_home }
    }

    #[must_use]
    pub fn discover_native_sessions(&self) -> Vec<NativeCodexSession> {
        let fingerprint = self.discovery_fingerprint();
        if let Ok(cache) = DISCOVERY_CACHE.lock() {
            if let Some(cached) = cache.get(&self.codex_home) {
                if cached.fingerprint == fingerprint {
                    return cached.sessions.clone();
                }
            }
        }

        let mut sessions_by_id = HashMap::<String, NativeCodexSession>::new();

        for state_session in self.discover_state_sessions() {
            merge_native_session(&mut sessions_by_id, state_session);
        }

        let index_path = self.codex_home.join("session_index.jsonl");
        if let Ok(content) = std::fs::read_to_string(index_path) {
            for line in content.lines() {
                let Ok(entry) = serde_json::from_str::<CodexIndexEntry>(line) else {
                    continue;
                };

                merge_native_session(
                    &mut sessions_by_id,
                    NativeCodexSession {
                        native_session_id: entry.id.clone(),
                        title: non_empty_string(entry.thread_name),
                        updated_at_ms: parse_rfc3339_ms(&entry.updated_at).unwrap_or(0),
                        project_root: None,
                        history_path: None,
                    },
                );
            }
        }

        for live_session in self.discover_log_sessions() {
            merge_native_session(&mut sessions_by_id, live_session);
        }

        let sessions_dir = self.codex_home.join("sessions");
        let Ok(entries) = std::fs::read_dir(sessions_dir) else {
            return sessions_by_id.into_values().collect();
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }

            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Ok(parsed) = serde_json::from_str::<CodexSessionFile>(&content) else {
                continue;
            };

            let title = extract_session_metadata(&parsed.items)
                .title
                .or_else(|| latest_user_prompt(&parsed.items))
                .or_else(|| {
                    sessions_by_id
                        .get(&parsed.session.id)
                        .and_then(|entry| entry.title.clone())
                });
            let updated_at_ms = sessions_by_id
                .get(&parsed.session.id)
                .map(|entry| entry.updated_at_ms)
                .filter(|timestamp| *timestamp > 0)
                .or_else(|| parse_rfc3339_ms(&parsed.session.timestamp))
                .unwrap_or(0);
            let project_root = extract_session_metadata(&parsed.items)
                .project_root
                .or_else(|| extract_project_root(&parsed.items));

            merge_native_session(
                &mut sessions_by_id,
                NativeCodexSession {
                    native_session_id: parsed.session.id.clone(),
                    title,
                    updated_at_ms,
                    project_root,
                    history_path: Some(path),
                },
            );
        }

        let mut sessions: Vec<_> = sessions_by_id.into_values().collect();
        sessions.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));

        if let Ok(mut cache) = DISCOVERY_CACHE.lock() {
            cache.insert(
                self.codex_home.clone(),
                CachedCodexDiscovery {
                    fingerprint,
                    sessions: sessions.clone(),
                },
            );
        }

        sessions
    }

    pub fn read_session_events(&self, history_path: &std::path::Path) -> Vec<CodexSessionEvent> {
        let fingerprint = history_fingerprint(history_path);
        if let Ok(cache) = HISTORY_CACHE.lock() {
            if let Some(cached) = cache.get(history_path) {
                if cached.fingerprint == fingerprint {
                    return cached.events.clone();
                }
            }
        }

        let Ok(content) = std::fs::read_to_string(history_path) else {
            return Vec::new();
        };
        let events = if history_path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            parse_codex_jsonl(&content)
        } else if let Ok(parsed) = serde_json::from_str::<CodexSessionFile>(&content) {
            parse_codex_items(&parsed.items)
        } else {
            parse_codex_jsonl(&content)
        };

        if let Ok(mut cache) = HISTORY_CACHE.lock() {
            cache.insert(
                history_path.to_path_buf(),
                CachedCodexHistory {
                    fingerprint,
                    events: events.clone(),
                },
            );
        }

        events
    }

    fn discover_state_sessions(&self) -> Vec<NativeCodexSession> {
        let Ok(entries) = std::fs::read_dir(&self.codex_home) else {
            return Vec::new();
        };

        let mut sessions = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !file_name.starts_with("state_")
                || path.extension().and_then(|value| value.to_str()) != Some("sqlite")
            {
                continue;
            }

            let Ok(connection) = Connection::open(&path) else {
                continue;
            };
            let Ok(mut statement) = connection.prepare(
                "SELECT id, title, updated_at, rollout_path, cwd
                 FROM threads
                 ORDER BY updated_at DESC",
            ) else {
                continue;
            };
            let Ok(rows) = statement.query_map([], |row| {
                let native_session_id: String = row.get(0)?;
                let title: Option<String> = row.get::<_, Option<String>>(1)?;
                let updated_at_ms = parse_sqlite_timestamp(row.get_ref(2)?).unwrap_or(0);
                let rollout_path: Option<String> = row.get::<_, Option<String>>(3)?;
                let cwd: Option<String> = row.get::<_, Option<String>>(4)?;

                Ok(NativeCodexSession {
                    native_session_id,
                    title: title.and_then(non_empty_string),
                    updated_at_ms,
                    project_root: cwd.and_then(non_empty_string),
                    history_path: rollout_path.and_then(non_empty_string).map(PathBuf::from),
                })
            }) else {
                continue;
            };

            sessions.extend(rows.flatten());
        }

        sessions
    }

    pub fn read_live_events(&self, thread_id: &str, after_row_id: i64) -> Vec<CodexLiveEvent> {
        let db_path = self.codex_home.join("logs_1.sqlite");
        let Ok(connection) = Connection::open(db_path) else {
            return Vec::new();
        };
        let Ok(mut statement) = connection.prepare(
            "SELECT id, ts, feedback_log_body
             FROM logs
             WHERE thread_id = ?1 AND id > ?2
             ORDER BY id ASC",
        ) else {
            return Vec::new();
        };
        let Ok(rows) = statement.query_map([thread_id, &after_row_id.to_string()], |row| {
            let row_id: i64 = row.get(0)?;
            let ts_seconds: i64 = row.get(1)?;
            let body: String = row.get(2)?;
            Ok((row_id, ts_seconds, body))
        }) else {
            return Vec::new();
        };

        rows.filter_map(|row| {
            let Ok((row_id, ts_seconds, body)) = row else {
                return None;
            };
            parse_live_log_event(&body).map(|event| CodexLiveEvent {
                row_id,
                occurred_at_ms: ts_seconds.saturating_mul(1000),
                event,
            })
        })
        .collect()
    }

    fn discovery_fingerprint(&self) -> CodexDiscoveryFingerprint {
        let index_modified_ms = modified_ms(self.codex_home.join("session_index.jsonl"));
        let sessions_dir = self.codex_home.join("sessions");
        let mut sessions_modified_ms = modified_ms(&sessions_dir);
        let mut state_modified_ms = 0_u128;
        let mut session_file_count = 0_usize;

        if let Ok(entries) = std::fs::read_dir(&self.codex_home) {
            for entry in entries.flatten() {
                let path = entry.path();
                let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                    continue;
                };
                if file_name.starts_with("state_")
                    && path.extension().and_then(|value| value.to_str()) == Some("sqlite")
                {
                    state_modified_ms = state_modified_ms.max(modified_ms(path));
                    continue;
                }
                if path.parent() == Some(sessions_dir.as_path())
                    && path.extension().and_then(|value| value.to_str()) == Some("json")
                {
                    session_file_count += 1;
                    sessions_modified_ms = sessions_modified_ms.max(modified_ms(path));
                }
            }
        }

        let logs_modified_ms = modified_ms(self.codex_home.join("logs_1.sqlite"));

        CodexDiscoveryFingerprint {
            index_modified_ms,
            sessions_modified_ms,
            state_modified_ms,
            session_file_count,
            logs_modified_ms,
        }
    }

    fn discover_log_sessions(&self) -> Vec<NativeCodexSession> {
        let db_path = self.codex_home.join("logs_1.sqlite");
        let Ok(connection) = Connection::open(db_path) else {
            return Vec::new();
        };

        let recent_cutoff_ms = now_millis().saturating_sub(12 * 60 * 60 * 1000);
        let recent_cutoff_secs = recent_cutoff_ms / 1000;

        let Ok(mut statement) = connection.prepare(
            "SELECT thread_id, MAX(ts) AS last_ts
             FROM logs
             WHERE thread_id IS NOT NULL AND ts >= ?1
             GROUP BY thread_id
             ORDER BY last_ts DESC",
        ) else {
            return Vec::new();
        };

        let Ok(rows) = statement.query_map([recent_cutoff_secs], |row| {
            let thread_id: String = row.get(0)?;
            let last_ts: i64 = row.get(1)?;
            Ok((thread_id, last_ts))
        }) else {
            return Vec::new();
        };

        rows.filter_map(|row| {
            let Ok((thread_id, last_ts)) = row else {
                return None;
            };
            let body = latest_body_for_thread(&connection, &thread_id)?;
            let project_root = extract_workdir_from_log_body(&body);
            let title = extract_title_from_log_body(&body);
            Some(NativeCodexSession {
                native_session_id: thread_id,
                title,
                updated_at_ms: last_ts.saturating_mul(1000),
                project_root,
                history_path: None,
            })
        })
        .collect()
    }
}
