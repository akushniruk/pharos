use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tokio::sync::broadcast;
use tokio::time::interval;

use crate::api::OutboundWsMessage;
use crate::envelope::transcript_event_to_envelope;
use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::claude::ClaudeProfile;
use crate::store::{legacy_event_from_envelope, Store};
use crate::tailer::parse_jsonl_line;

struct TrackedSubagent {
    agent_id: String,
    agent_type: String,
    jsonl_path: PathBuf,
    file_offset: u64,
    tool_name_map: HashMap<String, String>,
}

struct TrackedSession {
    session: crate::profiles::DetectedSession,
    file_offset: u64,
    known_subagents: Vec<TrackedSubagent>,
    /// Maps tool_use_id → tool_name so ToolResult events can inherit the tool name.
    tool_name_map: HashMap<String, String>,
}

pub async fn run_scanner(
    store: Store,
    sender: broadcast::Sender<OutboundWsMessage>,
    claude_home: PathBuf,
) {
    let profile = ClaudeProfile::new(claude_home);
    let mut tracked: HashMap<String, TrackedSession> = HashMap::new();
    let mut tick = interval(Duration::from_secs(2));

    loop {
        tick.tick().await;

        let current_sessions = profile.discover_sessions();
        let current_ids: Vec<String> = current_sessions
            .iter()
            .map(|s| s.session_id.clone())
            .collect();

        // Detect new sessions
        for session in current_sessions {
            if tracked.contains_key(&session.session_id) {
                continue;
            }
            let session_id = session.session_id.clone();
            let workspace_id = workspace_id_from_cwd(&session.cwd);
            let now_ms = now_millis();

            let envelope = EventEnvelope {
                runtime_source: RuntimeSource::ClaudeCode,
                acquisition_mode: AcquisitionMode::Observed,
                event_kind: EventKind::SessionStarted,
                session: SessionRef {
                    host_id: "local".to_string(),
                    workspace_id: workspace_id.clone(),
                    session_id: session_id.clone(),
                },
                agent_id: None,
                occurred_at_ms: now_ms,
                capabilities: observed_capabilities(),
                title: "session started".to_string(),
                payload: json!({
                    "pid": session.pid,
                    "cwd": session.cwd,
                    "entrypoint": session.entrypoint,
                }),
            };

            let _ = store.insert_event(&envelope);
            broadcast_envelope(&store, &sender, &envelope);

            tracked.insert(
                session_id,
                TrackedSession {
                    session,
                    file_offset: 0,
                    known_subagents: Vec::new(),
                    tool_name_map: HashMap::new(),
                },
            );

        }

        // Detect removed sessions
        let removed_ids: Vec<String> = tracked
            .keys()
            .filter(|id| !current_ids.contains(id))
            .cloned()
            .collect();

        for session_id in removed_ids {
            if let Some(ts) = tracked.remove(&session_id) {
                let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
                let now_ms = now_millis();

                let envelope = EventEnvelope {
                    runtime_source: RuntimeSource::ClaudeCode,
                    acquisition_mode: AcquisitionMode::Observed,
                    event_kind: EventKind::SessionEnded,
                    session: SessionRef {
                        host_id: "local".to_string(),
                        workspace_id,
                        session_id,
                    },
                    agent_id: None,
                    occurred_at_ms: now_ms,
                    capabilities: observed_capabilities(),
                    title: "session ended".to_string(),
                    payload: json!({}),
                };

                let _ = store.insert_event(&envelope);
                broadcast_envelope(&store, &sender, &envelope);
            }
        }

        // Re-resolve paths for tracked sessions that are missing transcript/subagent paths.
        // This handles the case where the session file appears before the JSONL transcript.
        for (_, ts) in &mut tracked {
            if ts.session.transcript_path.is_none() {
                let new_path = profile.resolve_transcript_path(
                    &ts.session.cwd,
                    &ts.session.session_id,
                );
                if new_path.is_some() {
                    ts.session.subagents_dir = new_path.as_ref().and_then(|tp| {
                        tp.parent()
                            .map(|p| p.join(&ts.session.session_id).join("subagents"))
                    });
                    ts.session.transcript_path = new_path;
                }
            }
        }

        // Tail transcripts and scan subagents for existing sessions
        let session_ids: Vec<String> = tracked.keys().cloned().collect();
        for session_id in session_ids {
            if let Some(ts) = tracked.get_mut(&session_id) {
                tail_transcript(ts, &store, &sender);
                scan_subagents(ts, &store, &sender);
            }
        }
    }
}

fn tail_transcript(
    ts: &mut TrackedSession,
    store: &Store,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(transcript_path) = &ts.session.transcript_path else {
        return;
    };
    let transcript_path = transcript_path.clone();

    let Ok(file) = std::fs::File::open(&transcript_path) else {
        return;
    };

    let mut reader = BufReader::new(file);
    if reader.seek(SeekFrom::Start(ts.file_offset)).is_err() {
        return;
    }

    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    let now_ms = now_millis();

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                for mut te in parse_jsonl_line(trimmed) {
                    // Track tool_use_id → tool_name from ToolUse events
                    if let crate::tailer::TranscriptEvent::ToolUse { ref tool_name, ref tool_use_id, .. } = te.event {
                        ts.tool_name_map.insert(tool_use_id.clone(), tool_name.clone());
                    }
                    // Enrich ToolResult with tool_name from the map
                    if let crate::tailer::TranscriptEvent::ToolResult { ref tool_use_id, ref mut tool_name, .. } = te.event {
                        if tool_name.is_none() {
                            *tool_name = ts.tool_name_map.get(tool_use_id).cloned();
                        }
                    }

                    // Use actual JSONL timestamp, fall back to scan time
                    let event_time = te.timestamp_ms.unwrap_or(now_ms);

                    let envelope = transcript_event_to_envelope(
                        &te.event,
                        RuntimeSource::ClaudeCode,
                        &workspace_id,
                        &ts.session.session_id,
                        None,
                        event_time,
                    );
                    let _ = store.insert_event(&envelope);
                    broadcast_envelope(store, sender, &envelope);
                }
            }
        }
    }

    if let Ok(pos) = reader.stream_position() {
        ts.file_offset = pos;
    }
}

fn scan_subagents(
    ts: &mut TrackedSession,
    store: &Store,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(subagents_dir) = &ts.session.subagents_dir else {
        return;
    };
    let subagents_dir = subagents_dir.clone();

    let Ok(entries) = std::fs::read_dir(&subagents_dir) else {
        return;
    };

    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    let now_ms = now_millis();

    // Discover new subagents from .meta.json files
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let file_name = file_name.to_string();

        if !file_name.ends_with(".meta.json") {
            continue;
        }

        let subagent_id = file_name.trim_end_matches(".meta.json").to_string();
        if ts.known_subagents.iter().any(|s| s.agent_id == subagent_id) {
            continue;
        }

        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };

        let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        let agent_type = meta
            .get("agentType")
            .and_then(|v| v.as_str())
            .unwrap_or("Agent")
            .to_string();
        let description = meta
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let envelope = EventEnvelope {
            runtime_source: RuntimeSource::ClaudeCode,
            acquisition_mode: AcquisitionMode::Observed,
            event_kind: EventKind::SubagentStarted,
            session: SessionRef {
                host_id: "local".to_string(),
                workspace_id: workspace_id.clone(),
                session_id: ts.session.session_id.clone(),
            },
            agent_id: Some(subagent_id.clone()),
            occurred_at_ms: now_ms,
            capabilities: observed_capabilities(),
            title: format!("subagent started: {agent_type}"),
            payload: json!({
                "agent_type": agent_type,
                "description": description,
                "agent_name": agent_type,
            }),
        };

        let _ = store.insert_event(&envelope);
        broadcast_envelope(store, sender, &envelope);

        // Track subagent for JSONL tailing
        let jsonl_path = subagents_dir.join(format!("{subagent_id}.jsonl"));
        ts.known_subagents.push(TrackedSubagent {
            agent_id: subagent_id,
            agent_type,
            jsonl_path,
            file_offset: 0,
            tool_name_map: HashMap::new(),
        });
    }

    // Tail each subagent's JSONL
    for subagent in &mut ts.known_subagents {
        if !subagent.jsonl_path.exists() {
            continue;
        }
        let Ok(file) = std::fs::File::open(&subagent.jsonl_path) else {
            continue;
        };
        let mut reader = BufReader::new(file);
        if reader.seek(SeekFrom::Start(subagent.file_offset)).is_err() {
            continue;
        }

        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    for mut te in parse_jsonl_line(trimmed) {
                        // Track tool names for this subagent
                        if let crate::tailer::TranscriptEvent::ToolUse { ref tool_name, ref tool_use_id, .. } = te.event {
                            subagent.tool_name_map.insert(tool_use_id.clone(), tool_name.clone());
                        }
                        if let crate::tailer::TranscriptEvent::ToolResult { ref tool_use_id, ref mut tool_name, .. } = te.event {
                            if tool_name.is_none() {
                                *tool_name = subagent.tool_name_map.get(tool_use_id).cloned();
                            }
                        }

                        let event_time = te.timestamp_ms.unwrap_or(now_ms);
                        let envelope = transcript_event_to_envelope(
                            &te.event,
                            RuntimeSource::ClaudeCode,
                            &workspace_id,
                            &ts.session.session_id,
                            Some(&subagent.agent_id),
                            event_time,
                        );
                        let _ = store.insert_event(&envelope);
                        broadcast_envelope(store, sender, &envelope);
                    }
                }
            }
        }

        if let Ok(pos) = reader.stream_position() {
            subagent.file_offset = pos;
        }
    }
}

fn broadcast_envelope(
    store: &Store,
    sender: &broadcast::Sender<OutboundWsMessage>,
    envelope: &EventEnvelope,
) {
    let Ok(compat_event) = legacy_event_from_envelope(envelope) else {
        return;
    };
    let Ok(registry) = store.list_agent_registry() else {
        return;
    };

    let Ok(event_payload) = serde_json::to_value(compat_event) else {
        return;
    };
    let Ok(registry_payload) = serde_json::to_value(registry) else {
        return;
    };

    let _ = sender.send(OutboundWsMessage {
        message_type: "event",
        payload: event_payload,
    });
    let _ = sender.send(OutboundWsMessage {
        message_type: "agent_registry",
        payload: registry_payload,
    });
}

fn workspace_id_from_cwd(cwd: &str) -> String {
    std::path::Path::new(cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn observed_capabilities() -> CapabilitySet {
    CapabilitySet {
        can_observe: true,
        can_start: false,
        can_stop: false,
        can_retry: false,
        can_respond: false,
    }
}

fn now_millis() -> i64 {
    i64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_millis(),
    )
    .unwrap_or(0)
}
