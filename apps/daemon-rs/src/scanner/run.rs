use std::collections::HashMap;
use std::time::Duration;

use serde_json::json;
use tokio::sync::broadcast;
use tokio::time::interval;

use crate::api::OutboundWsMessage;
use crate::live_state::LiveState;
use crate::model::{
    AcquisitionMode, EventEnvelope, EventKind, RuntimeSource, SessionRef,
};
use crate::profiles::{
    DiscoveryOptions, claude::ClaudeProfile, codex::CodexProfile, cursor::CursorProfile,
    discover_all_sessions, gemini::GeminiProfile,
};
use crate::store::Store;

use super::helpers::{
    active_session_ids, broadcast_envelope, codex_history_offset_key, codex_log_offset_key,
    gemini_log_offset_key, load_i64_offset, load_u64_offset, load_usize_offset, now_millis,
    observed_capabilities, transcript_offset_key, workspace_id_from_cwd,
};
use super::session::{TrackedSession, should_remove_after_missed_discovery};
use super::tailing::{scan_subagents, tail_codex_activity, tail_cursor_activity, tail_gemini_activity, tail_transcript};

pub async fn run_scanner(
    store: Store,
    live_state: LiveState,
    sender: broadcast::Sender<OutboundWsMessage>,
    discovery_options: DiscoveryOptions,
) {
    let claude_home = discovery_options.claude_home.clone();
    let claude_profile = claude_home.clone().map(ClaudeProfile::new);
    let codex_profile = discovery_options.codex_home.clone().map(CodexProfile::new);
    let gemini_profile = discovery_options
        .gemini_home
        .clone()
        .map(GeminiProfile::new);
    let cursor_profile = discovery_options
        .cursor_home
        .clone()
        .map(CursorProfile::new);
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
            let active_sessions = active_session_ids(&live_state);

            // Detect new sessions
            for session in current_sessions {
                if let Some(existing) = tracked.get_mut(&session.session_id) {
                    existing.missed_discovery_cycles = 0;
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

                            if let Ok(true) = store.insert_event(&envelope) {
                                broadcast_envelope(&live_state, &sender, &envelope);
                            }
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

                if !active_sessions.contains(&session_id)
                    && matches!(store.insert_event(&envelope), Ok(true))
                {
                    broadcast_envelope(&live_state, &sender, &envelope);
                }

                tracked.insert(
                    session_id.clone(),
                    TrackedSession {
                        session,
                        missed_discovery_cycles: 0,
                        file_offset: load_u64_offset(
                            &store,
                            &transcript_offset_key(&workspace_id, &session_id),
                        ),
                        codex_item_offset: load_usize_offset(
                            &store,
                            &codex_history_offset_key(&workspace_id, &session_id),
                        ),
                        codex_log_offset: load_i64_offset(
                            &store,
                            &codex_log_offset_key(&workspace_id, &session_id),
                        ),
                        codex_next_poll_at_ms: 0,
                        recent_codex_signatures: Vec::new(),
                        gemini_log_offset: load_usize_offset(
                            &store,
                            &gemini_log_offset_key(&workspace_id, &session_id),
                        ),
                        recent_gemini_signatures: Vec::new(),
                        recent_cursor_signatures: Vec::new(),
                        known_subagents: Vec::new(),
                        tool_name_map: HashMap::new(),
                    },
                );
            }

            // Detect removed sessions with a short grace window so
            // process-backed runtimes do not flap on transient discovery misses.
            for (session_id, tracked_session) in &mut tracked {
                if !current_ids.contains(session_id) {
                    tracked_session.missed_discovery_cycles =
                        tracked_session.missed_discovery_cycles.saturating_add(1);
                }
            }
            let removed_ids: Vec<String> = tracked
                .iter()
                .filter_map(|(id, session)| {
                    should_remove_after_missed_discovery(session.missed_discovery_cycles)
                        .then(|| id.clone())
                })
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

                    if let Ok(true) = store.insert_event(&envelope) {
                        broadcast_envelope(&live_state, &sender, &envelope);
                    }
                }
            }

            // Re-resolve paths for tracked sessions that are missing transcript/subagent paths.
            // This handles the case where the session file appears before the JSONL transcript.
            for (_, ts) in &mut tracked {
                if ts.session.transcript_path.is_none() {
                    let new_path = claude_profile.as_ref().and_then(|profile| {
                        profile.resolve_transcript_path(&ts.session.cwd, &ts.session.session_id)
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
                    RuntimeSource::GeminiCli => {
                        if let Some(profile) = gemini_profile.as_ref() {
                            tail_gemini_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    RuntimeSource::CursorAgent => {
                        if let Some(profile) = cursor_profile.as_ref() {
                            tail_cursor_activity(ts, profile, &store, &live_state, &sender);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}
