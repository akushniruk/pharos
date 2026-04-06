use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};

use serde_json::json;
use tokio::sync::broadcast;

use crate::api::OutboundWsMessage;
use crate::envelope::{codex_event_to_envelope, cursor_event_to_envelope, transcript_event_to_envelope};
use crate::live_state::LiveState;
use crate::model::{
    AcquisitionMode, EventEnvelope, EventKind, SessionRef,
};
use crate::profiles::codex::CodexProfile;
use crate::profiles::cursor::CursorProfile;
use crate::profiles::gemini::GeminiProfile;
use crate::store::Store;
use crate::tailer::parse_jsonl_line;

use super::helpers::{
    active_subagent_ids, broadcast_envelope, codex_history_offset_key, codex_log_offset_key,
    gemini_log_offset_key, load_u64_offset, now_millis, observed_capabilities, subagent_offset_key,
    transcript_offset_key, workspace_id_from_cwd,
};
use super::session::{TrackedSession, TrackedSubagent};
use super::signatures::{
    remember_codex_signature, remember_cursor_signature, remember_gemini_signature,
};

pub(crate) fn tail_codex_activity(
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
                if !remember_codex_signature(ts, event) {
                    continue;
                }
                let envelope =
                    codex_event_to_envelope(event, &workspace_id, &ts.session.session_id, now_ms);
                if let Ok(true) = store.insert_event(&envelope) {
                    broadcast_envelope(live_state, sender, &envelope);
                }
            }

            ts.codex_item_offset = events.len();
            let _ = store.save_scanner_offset(
                &codex_history_offset_key(&workspace_id, &ts.session.session_id),
                i64::try_from(ts.codex_item_offset).unwrap_or(i64::MAX),
            );
        }
    }

    if now_ms < ts.codex_next_poll_at_ms {
        return;
    }

    let Some(thread_id) = ts.session.native_session_id.as_deref() else {
        return;
    };

    let events = profile.read_live_events(thread_id, ts.codex_log_offset);
    for live_event in &events {
        if !remember_codex_signature(ts, &live_event.event) {
            continue;
        }
        let envelope = codex_event_to_envelope(
            &live_event.event,
            &workspace_id,
            &ts.session.session_id,
            live_event.occurred_at_ms,
        );
        if let Ok(true) = store.insert_event(&envelope) {
            broadcast_envelope(live_state, sender, &envelope);
        }
    }
    if let Some(last) = events.last() {
        ts.codex_log_offset = last.row_id;
        let _ = store.save_scanner_offset(
            &codex_log_offset_key(&workspace_id, &ts.session.session_id),
            ts.codex_log_offset,
        );
    }
    ts.codex_next_poll_at_ms = if events.is_empty() {
        now_ms.saturating_add(2_000)
    } else {
        now_ms.saturating_add(750)
    };
}
pub(crate) fn tail_gemini_activity(
    ts: &mut TrackedSession,
    profile: &GeminiProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let now_ms = now_millis();
    let workspace_id = workspace_id_from_cwd(&ts.session.cwd);

    let Some(logs_path) = ts.session.history_path.as_ref() else {
        return;
    };

    let events = profile.read_live_events(logs_path, ts.gemini_log_offset);
    for live_event in &events {
        if !remember_gemini_signature(ts, &live_event.event) {
            continue;
        }

        let envelope = crate::envelope::gemini_event_to_envelope(
            &live_event.event,
            &workspace_id,
            &ts.session.session_id,
            if live_event.occurred_at_ms > 0 {
                live_event.occurred_at_ms
            } else {
                now_ms
            },
        );
        if let Ok(true) = store.insert_event(&envelope) {
            broadcast_envelope(live_state, sender, &envelope);
        }
    }

    if let Some(last) = events.last() {
        ts.gemini_log_offset = last.row_id;
        let _ = store.save_scanner_offset(
            &gemini_log_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(ts.gemini_log_offset).unwrap_or(i64::MAX),
        );
    }
}
pub(crate) fn tail_cursor_activity(
    ts: &mut TrackedSession,
    _profile: &CursorProfile,
    store: &Store,
    live_state: &LiveState,
    sender: &broadcast::Sender<OutboundWsMessage>,
) {
    let Some(transcript_path) = ts.session.transcript_path.as_ref() else {
        return;
    };
    let Ok(file) = std::fs::File::open(transcript_path) else {
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
                for event in crate::profiles::cursor::parse_cursor_jsonl_line(trimmed) {
                    if !remember_cursor_signature(ts, &event) {
                        continue;
                    }

                    let envelope = cursor_event_to_envelope(
                        &event,
                        &workspace_id,
                        &ts.session.session_id,
                        now_ms,
                    );
                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(live_state, sender, &envelope);
                    }
                }
            }
        }
    }

    if let Ok(pos) = reader.stream_position() {
        ts.file_offset = pos;
        let _ = store.save_scanner_offset(
            &transcript_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(pos).unwrap_or(i64::MAX),
        );
    }
}
pub(crate) fn tail_transcript(
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
                    if let crate::tailer::TranscriptEvent::ToolUse {
                        ref tool_name,
                        ref tool_use_id,
                        ..
                    } = te.event
                    {
                        ts.tool_name_map
                            .insert(tool_use_id.clone(), tool_name.clone());
                    }
                    // Enrich ToolResult with tool_name from the map
                    if let crate::tailer::TranscriptEvent::ToolResult {
                        ref tool_use_id,
                        ref mut tool_name,
                        ..
                    } = te.event
                    {
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
                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(live_state, sender, &envelope);
                    }
                }
            }
        }
    }

    if let Ok(pos) = reader.stream_position() {
        ts.file_offset = pos;
        let _ = store.save_scanner_offset(
            &transcript_offset_key(&workspace_id, &ts.session.session_id),
            i64::try_from(pos).unwrap_or(i64::MAX),
        );
    }
}

pub(crate) fn scan_subagents(
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
    let active_subagents = active_subagent_ids(live_state, &ts.session.session_id);

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
        let display_name = if description.trim().is_empty() {
            agent_type.clone()
        } else {
            description.trim().to_string()
        };

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
                "responsibility": description,
                "agent_name": agent_type,
                "display_name": display_name,
                "parent_agent_id": "main",
            }),
        };

        if !active_subagents.contains(&subagent_id)
            && matches!(store.insert_event(&envelope), Ok(true))
        {
            broadcast_envelope(live_state, sender, &envelope);
        }

        // Track subagent for JSONL tailing
        let jsonl_path = subagents_dir.join(format!("{subagent_id}.jsonl"));
        ts.known_subagents.push(TrackedSubagent {
            agent_id: subagent_id.clone(),
            jsonl_path,
            file_offset: load_u64_offset(
                store,
                &subagent_offset_key(
                    &workspace_id,
                    &ts.session.session_id,
                    &format!("{subagent_id}.jsonl"),
                ),
            ),
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
                        if let crate::tailer::TranscriptEvent::ToolUse {
                            ref tool_name,
                            ref tool_use_id,
                            ..
                        } = te.event
                        {
                            subagent
                                .tool_name_map
                                .insert(tool_use_id.clone(), tool_name.clone());
                        }
                        if let crate::tailer::TranscriptEvent::ToolResult {
                            ref tool_use_id,
                            ref mut tool_name,
                            ..
                        } = te.event
                        {
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
                        if let Ok(true) = store.insert_event(&envelope) {
                            broadcast_envelope(live_state, sender, &envelope);
                        }
                    }
                }
            }
        }

        if let Ok(pos) = reader.stream_position() {
            subagent.file_offset = pos;
            let _ = store.save_scanner_offset(
                &subagent_offset_key(
                    &workspace_id,
                    &ts.session.session_id,
                    &format!("{}.jsonl", subagent.agent_id),
                ),
                i64::try_from(pos).unwrap_or(i64::MAX),
            );
        }
    }
}
