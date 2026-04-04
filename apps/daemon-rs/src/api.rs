use axum::{
    Json, Router,
    extract::State,
    extract::Query,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::StatusCode,
    routing::{get, post},
};
use serde::Serialize;
use serde_json::json;
use std::path::PathBuf;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

use crate::{
    connector::resolve_connector,
    discovery::{
        discover_claude_sessions, discovered_session_events, discovered_session_summaries,
    },
    live_state::{LiveState, should_broadcast_registry},
    model::{
        AgentRegistryEntry, DiscoveredSession, EventEnvelope, FilterOptions, LegacyHookEvent,
        ProjectSnapshot, SessionSummary,
    },
    store::Store,
};

#[derive(Debug, Clone, Default)]
pub struct AppOptions {
    pub claude_sessions_dir: Option<PathBuf>,
}

pub fn build_router(store: Store) -> Router {
    let (router, _) = build_router_with_options(store, AppOptions::default());
    router
}

pub fn build_router_with_options(store: Store, options: AppOptions) -> (Router, AppState) {
    let (sender, _) = broadcast::channel(32);
    let state = AppState {
        live_state: LiveState::bootstrap(&store).unwrap_or_default(),
        store,
        sender,
        claude_sessions_dir: options.claude_sessions_dir,
    };

    let router = Router::new()
        .route("/health", get(health))
        .route("/events", post(create_legacy_hook_event))
        .route(
            "/api/discovery/claude/sessions",
            get(list_discovered_claude_sessions),
        )
        .route(
            "/api/connectors/{connector}/events",
            post(create_connector_event),
        )
        .route("/api/events", post(create_event).get(list_events))
        .route("/api/events/search", get(search_events))
        .route("/api/agents", get(list_agent_registry))
        .route("/api/projects", get(list_projects))
        .route("/api/projects/{name}", get(get_project))
        .route("/api/sessions/{id}/snapshot", get(get_session_snapshot))
        .route(
            "/api/events/legacy/claude",
            post(create_legacy_claude_event),
        )
        .route("/events/filter-options", get(get_filter_options))
        .route("/sessions", get(list_sessions))
        .route("/sessions/{id}", get(get_session_events))
        .route("/stream", get(stream_events))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state.clone());

    (router, state)
}

#[derive(Clone)]
pub struct AppState {
    pub live_state: LiveState,
    pub store: Store,
    pub sender: broadcast::Sender<OutboundWsMessage>,
    pub claude_sessions_dir: Option<PathBuf>,
}

#[derive(Clone)]
pub struct OutboundWsMessage {
    pub message_type: &'static str,
    pub payload: serde_json::Value,
}

#[derive(Serialize)]
struct WsEnvelope<T> {
    #[serde(rename = "type")]
    message_type: &'static str,
    data: T,
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn create_event(
    State(state): State<AppState>,
    Json(event): Json<EventEnvelope>,
) -> Result<(StatusCode, Json<EventEnvelope>), StatusCode> {
    let inserted = state
        .store
        .insert_event(&event)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if inserted {
        broadcast_compat_updates(&state, &event).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok((StatusCode::CREATED, Json(event)))
}

async fn list_events(
    State(state): State<AppState>,
) -> Result<Json<Vec<EventEnvelope>>, StatusCode> {
    let events = state
        .store
        .list_events()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(events))
}

#[derive(serde::Deserialize)]
struct SearchEventsParams {
    query: String,
    source_app: Option<String>,
    session_id: Option<String>,
    limit: Option<usize>,
}

async fn search_events(
    State(state): State<AppState>,
    Query(params): Query<SearchEventsParams>,
) -> Result<Json<Vec<LegacyHookEvent>>, StatusCode> {
    let limit = params.limit.unwrap_or(500).clamp(1, 2000);
    let events = state
        .live_state
        .search_legacy_events(
            &params.query,
            params.source_app.as_deref(),
            params.session_id.as_deref(),
            limit,
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(events))
}

async fn list_agent_registry(
    State(state): State<AppState>,
) -> Result<Json<Vec<AgentRegistryEntry>>, StatusCode> {
    let entries = state
        .live_state
        .list_agent_registry()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(entries))
}

async fn list_projects(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectSnapshot>>, StatusCode> {
    let projects = state
        .live_state
        .list_projects()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(projects))
}

async fn get_project(
    axum::extract::Path(project_name): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ProjectSnapshot>, StatusCode> {
    let project = state
        .live_state
        .project(&project_name)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(project))
}

async fn get_session_snapshot(
    axum::extract::Path(session_id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<crate::model::SessionSnapshot>, StatusCode> {
    let snapshot = state
        .live_state
        .session_snapshot(&session_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(snapshot))
}

async fn get_filter_options(
    State(state): State<AppState>,
) -> Result<Json<FilterOptions>, StatusCode> {
    let options = state
        .live_state
        .filter_options()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(options))
}

async fn list_sessions(
    State(state): State<AppState>,
) -> Result<Json<Vec<SessionSummary>>, StatusCode> {
    let mut sessions = state
        .live_state
        .list_sessions()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(dir) = &state.claude_sessions_dir {
        let discovered =
            discovered_session_summaries(dir).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        merge_discovered_sessions(&mut sessions, discovered);
    }
    Ok(Json(sessions))
}

async fn get_session_events(
    axum::extract::Path(session_id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<LegacyHookEvent>>, StatusCode> {
    let events = state
        .live_state
        .session_events(&session_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !events.is_empty() {
        return Ok(Json(events));
    }
    if let Some(dir) = &state.claude_sessions_dir {
        let discovered_events = discovered_session_events(dir, &session_id)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(Json(discovered_events));
    }
    Ok(Json(events))
}

async fn list_discovered_claude_sessions(
    State(state): State<AppState>,
) -> Result<Json<Vec<DiscoveredSession>>, StatusCode> {
    let Some(dir) = &state.claude_sessions_dir else {
        return Ok(Json(Vec::new()));
    };

    let sessions = discover_claude_sessions(dir).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(sessions))
}

async fn create_legacy_claude_event(
    State(state): State<AppState>,
    body: String,
) -> Result<(StatusCode, Json<EventEnvelope>), StatusCode> {
    let connector = resolve_connector("claude").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let event = connector
        .normalize_raw_event(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let inserted = state
        .store
        .insert_event(&event)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if inserted {
        broadcast_compat_updates(&state, &event).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok((StatusCode::CREATED, Json(event)))
}

async fn create_legacy_hook_event(
    State(state): State<AppState>,
    Json(event): Json<LegacyHookEvent>,
) -> Result<(StatusCode, Json<LegacyHookEvent>), StatusCode> {
    let connector = resolve_connector("claude").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let envelope = connector
        .normalize_legacy_hook_event(&event)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let inserted = state
        .store
        .insert_event(&envelope)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if inserted {
        broadcast_compat_updates(&state, &envelope)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok((StatusCode::OK, Json(event)))
}

async fn create_connector_event(
    axum::extract::Path(connector_name): axum::extract::Path<String>,
    State(state): State<AppState>,
    body: String,
) -> Result<(StatusCode, Json<EventEnvelope>), StatusCode> {
    let connector = resolve_connector(&connector_name).map_err(|_| StatusCode::NOT_FOUND)?;
    let event = connector
        .normalize_raw_event(&body)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let inserted = state
        .store
        .insert_event(&event)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if inserted {
        broadcast_compat_updates(&state, &event).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok((StatusCode::CREATED, Json(event)))
}

async fn stream_events(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Result<impl axum::response::IntoResponse, StatusCode> {
    let initial_events = state
        .live_state
        .list_legacy_events()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let initial_registry = state
        .live_state
        .list_agent_registry()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let initial_projects = state
        .live_state
        .list_projects()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let receiver = state.sender.subscribe();

    Ok(ws.on_upgrade(move |socket| {
        stream_socket(
            socket,
            initial_events,
            initial_registry,
            initial_projects,
            receiver,
        )
    }))
}

async fn stream_socket(
    mut socket: WebSocket,
    initial_events: Vec<LegacyHookEvent>,
    initial_registry: Vec<AgentRegistryEntry>,
    initial_projects: Vec<ProjectSnapshot>,
    mut receiver: broadcast::Receiver<OutboundWsMessage>,
) {
    if send_ws_message(&mut socket, "initial", &initial_events)
        .await
        .is_err()
    {
        return;
    }
    if send_ws_message(&mut socket, "agent_registry", &initial_registry)
        .await
        .is_err()
    {
        return;
    }
    if send_ws_message(&mut socket, "projects", &initial_projects)
        .await
        .is_err()
    {
        return;
    }

    loop {
        match receiver.recv().await {
            Ok(message) => {
                if send_ws_raw(&mut socket, message.message_type, message.payload)
                    .await
                    .is_err()
                {
                    return;
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => return,
        }
    }
}

async fn send_ws_message<T: Serialize>(
    socket: &mut WebSocket,
    message_type: &'static str,
    data: &T,
) -> Result<(), ()> {
    let payload = serde_json::to_string(&WsEnvelope { message_type, data }).map_err(|_| ())?;
    socket
        .send(Message::Text(payload.into()))
        .await
        .map_err(|_| ())
}

async fn send_ws_raw(
    socket: &mut WebSocket,
    message_type: &'static str,
    payload: serde_json::Value,
) -> Result<(), ()> {
    let envelope = serde_json::to_string(&WsEnvelope {
        message_type,
        data: payload,
    })
    .map_err(|_| ())?;
    socket
        .send(Message::Text(envelope.into()))
        .await
        .map_err(|_| ())
}

fn broadcast_compat_updates(
    state: &AppState,
    event: &EventEnvelope,
) -> Result<(), serde_json::Error> {
    let compat_event = state
        .live_state
        .record_envelope(event)
        .map_err(|error| serde_json::Error::io(std::io::Error::other(error.to_string())))?;

    let event_payload = serde_json::to_value(compat_event)?;
    let _ = state.sender.send(OutboundWsMessage {
        message_type: "event",
        payload: event_payload,
    });

    let projects = state
        .live_state
        .list_projects()
        .map_err(|error| serde_json::Error::io(std::io::Error::other(error.to_string())))?;
    let projects_payload = serde_json::to_value(projects)?;
    let _ = state.sender.send(OutboundWsMessage {
        message_type: "projects",
        payload: projects_payload,
    });

    if !should_broadcast_registry(&event.event_kind) {
        return Ok(());
    }

    let registry = state
        .live_state
        .list_agent_registry()
        .map_err(|error| serde_json::Error::io(std::io::Error::other(error.to_string())))?;
    let registry_payload = serde_json::to_value(registry)?;
    let _ = state.sender.send(OutboundWsMessage {
        message_type: "agent_registry",
        payload: registry_payload,
    });

    Ok(())
}

fn merge_discovered_sessions(existing: &mut Vec<SessionSummary>, discovered: Vec<SessionSummary>) {
    for session in discovered {
        if existing
            .iter()
            .any(|item| item.session_id == session.session_id)
        {
            continue;
        }
        existing.push(session);
    }
    existing.sort_by(|left, right| right.last_event_at.cmp(&left.last_event_at));
}
