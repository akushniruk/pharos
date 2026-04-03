use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tokio::sync::broadcast;
use tokio::time::interval;

use crate::api::OutboundWsMessage;
use crate::envelope::{codex_event_to_envelope, transcript_event_to_envelope};
use crate::live_state::{should_broadcast_registry, LiveState};
use crate::model::{
    AcquisitionMode, CapabilitySet, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::{
    claude::ClaudeProfile,
    codex::CodexProfile,
    discover_all_sessions,
    DiscoveryOptions,
};
use crate::store::Store;
use crate::tailer::parse_jsonl_line;

struct TrackedSubagent {
    agent_id: String,
    jsonl_path: PathBuf,
    file_offset: u64,
    tool_name_map: HashMap<String, String>,
}

struct TrackedSession {
    session: crate::profiles::DetectedSession,
    file_offset: u64,
    codex_item_offset: usize,
    codex_log_offset: i64,
    codex_next_poll_at_ms: i64,
    known_subagents: Vec<TrackedSubagent>,
    /// Maps tool_use_id → tool_name so ToolResult events can inherit the tool name.
    tool_name_map: HashMap<String, String>,
}

pub async fn run_scanner(
    store: Store,
    live_state: LiveState,
    sender: broadcast::Sender<OutboundWsMessage>,
    discovery_options: DiscoveryOptions,
) {
    let claude_home = discovery_options.claude_home.clone();
    let claude_profile = claude_home.clone().map(ClaudeProfile::new);
    let codex_profile = discovery_options.codex_home.clone().map(CodexProfile::new);
    let mut tracked: HashMap<String, TrackedSession> = HashMap::new();
    let mut tick = interval(Duration::from_secs(1));
    let mut ticks_since_discovery = usize::MAX;

    loop {
        tick.tick().await;

        ticks_since_discovery = ticks_since_discovery.saturating_add(1);
        if ticks_since_discovery >= 5 {
            ticks_since_discovery = 0;

            let current_sessions = discover_all_sessions(&discovery_options);
            let current_ids: Vec<String> = current_sessions
                .iter()
                .map(|s| s.session_id.clone())
                .collect();

            // Detect new sessions
            for session in current_sessions {
                if let Some(existing) = tracked.get_mut(&session.session_id) {
                    if session.display_title != existing.session.display_title {
                        if let Some(title) = session.display_title.clone() {
                            let envelope = EventEnvelope {
                                runtime_source: session.runtime_source.clone(),
                                acquisition_mode: AcquisitionMode::Observed,
                                event_kind: EventKind::SessionTitleChanged,
                                session: SessionRef {
                                    host_id: "local".to_string(),
                                    workspace_id: workspace_id_from_cwd(&session.cwd),
                                    session_id: session.session_id.clone(),
                                },
                                agent_id: None,
                                occurred_at_ms: now_millis(),
                                capabilities: observed_capabilities(),
                                title: "session title changed".to_string(),
                                payload: json!({ "title": title }),
                            };

                        let _ = store.insert_event(&envelope);
                        broadcast_envelope(&live_state, &sender, &envelope);
                    }
                }
                existing.session = session;
                    continue;
                }
                let session_id = session.session_id.clone();
                let workspace_id = workspace_id_from_cwd(&session.cwd);
                let now_ms = now_millis();

                let envelope = EventEnvelope {
                    runtime_source: session.runtime_source.clone(),
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
                        "runtime_source": format!("{:?}", session.runtime_source),
                        "pid": session.pid,
                        "cwd": session.cwd,
                        "entrypoint": session.entrypoint,
                        "title": session.display_title,
                    }),
                };

            let _ = store.insert_event(&envelope);
            broadcast_envelope(&live_state, &sender, &envelope);

                tracked.insert(
                    session_id,
                    TrackedSession {
                    session,
                    file_offset: 0,
                    codex_item_offset: 0,
                    codex_log_offset: 0,
                    codex_next_poll_at_ms: 0,
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
                        runtime_source: ts.session.runtime_source.clone(),
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
                broadcast_envelope(&live_state, &sender, &envelope);
            }
        }

            // Re-resolve paths for tracked sessions that are missing transcript/subagent paths.
            // This handles the case where the session file appears before the JSONL transcript.
            for (_, ts) in &mut tracked {
                if ts.session.transcript_path.is_none() {
                    let new_path = claude_profile.as_ref().and_then(|profile| {
                        profile.resolve_transcript_path(
                            &ts.session.cwd,
                            &ts.session.session_id,
                        )
                    });
                    if new_path.is_some() {
                        ts.session.subagents_dir = new_path.as_ref().and_then(|tp| {
                            tp.parent()
                                .map(|p| p.join(&ts.session.session_id).join("subagents"))
                        });
                        ts.session.transcript_path = new_path;
                    }
                }
            }
        }

        // Tail transcripts and scan subagents for existing sessions
        let session_ids: Vec<String> = tracked.keys().cloned().collect();
        for session_id in session_ids {
            if let Some(ts) = tracked.get_mut(&session_id) {
                match ts.session.runtime_source {
                    RuntimeSource::ClaudeCode => {
                        tail_transcript(ts, &store, &live_state, &sender);
                        scan_subagents(ts, &store, &live_state, &sender);
                    }
                    RuntimeSource::CodexCli => {
                        if let Some(profile) = codex_profile.as_ref() {
                            tail_codex_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

fn tail_codex_activity(
    ts: &mut TrackedSession,
    profile: &CodexProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let now_ms = now_millis();
    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);
    if let Some(history_path) = &ts.session.history_path {
        let events = profile.read_session_events(history_path);
        if ts.codex_item_offset < events.len() {
            for event in &events[ts.codex_item_offset..] {
                let envelope = codex_event_to_envelope(
                    event,
                    &workspace_id,
                    &ts.session.session_id,
                    now_ms,
                );
                let _ = store.insert_event(&envelope);
                broadcast_envelope(live_state, sender, &envelope);
            }

            ts.codex_item_offset = events.len();
        }
    }

    if ts.session.history_path.is_none() {
        if now_ms < ts.codex_next_poll_at_ms {
            return;
        }

        let Some(thread_id) = ts.session.native_session_id.as_deref() else {
            return;
        };

        let events = profile.read_live_events(thread_id, ts.codex_log_offset);
        for live_event in &events {
            let envelope = codex_event_to_envelope(
                &live_event.event,
                &workspace_id,
                &ts.session.session_id,
                live_event.occurred_at_ms,
            );
            let _ = store.insert_event(&envelope);
            broadcast_envelope(live_state, sender, &envelope);
        }
        if let Some(last) = events.last() {
            ts.codex_log_offset = last.row_id;
        }
        ts.codex_next_poll_at_ms = if events.is_empty() {
            now_ms.saturating_add(2_000)
        } else {
            now_ms.saturating_add(750)
        };
    }
}

fn tail_transcript(
    ts: &mut TrackedSession,
    store: &Store,
    live_state: &LiveState,
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
                        ts.session.runtime_source.clone(),
                        &workspace_id,
                        &ts.session.session_id,
                        None,
                        event_time,
                    );
                    let _ = store.insert_event(&envelope);
                    broadcast_envelope(live_state, sender, &envelope);
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
    live_state: &LiveState,
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
            runtime_source: ts.session.runtime_source.clone(),
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
        broadcast_envelope(live_state, sender, &envelope);

        // Track subagent for JSONL tailing
        let jsonl_path = subagents_dir.join(format!("{subagent_id}.jsonl"));
        ts.known_subagents.push(TrackedSubagent {
            agent_id: subagent_id,
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
                            ts.session.runtime_source.clone(),
                            &workspace_id,
                            &ts.session.session_id,
                            Some(&subagent.agent_id),
                            event_time,
                        );
                        let _ = store.insert_event(&envelope);
                        broadcast_envelope(live_state, sender, &envelope);
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
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
    envelope: &EventEnvelope,
) {
    let Ok(compat_event) = live_state.record_envelope(envelope) else {
        return;
    };

    let Ok(event_payload) = serde_json::to_value(compat_event) else {
        return;
    };

    let _ = sender.send(OutboundWsMessage {
        message_type: "event",
        payload: event_payload,
    });

    if !should_broadcast_registry(&envelope.event_kind) {
        return;
    }

    let Ok(registry) = live_state.list_agent_registry() else {
        return;
    };
    let Ok(registry_payload) = serde_json::to_value(registry) else {
        return;
    };
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
