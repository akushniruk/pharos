use std::collections::BTreeMap;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use pharos_daemon::api::{build_router, build_router_with_options, AppOptions};
use pharos_daemon::config::{Config, ConfigError};
use pharos_daemon::model::EventEnvelope;
use pharos_daemon::store::Store;
use futures_util::StreamExt;
use serde_json::json;
use tempfile::tempdir;
use tokio_tungstenite::connect_async;
use tower::util::ServiceExt;

#[test]
fn config_defaults_to_local_sqlite_and_loopback_http() {
    let config = Config::from_env_map(BTreeMap::new()).expect("default config should parse");

    assert_eq!(config.host, "127.0.0.1");
    assert_eq!(config.port, 4000);
    assert_eq!(config.db_path, "pharos-daemon.db");
}

#[test]
fn config_rejects_invalid_port_values() {
    let mut env_map = BTreeMap::new();
    env_map.insert("PHAROS_DAEMON_PORT".to_string(), "410O".to_string());

    let error = Config::from_env_map(env_map).expect_err("invalid port should fail");

    assert_eq!(error, ConfigError::InvalidPort("410O".to_string()));
}

#[tokio::test]
async fn posts_and_reads_back_normalized_events() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);

    let event = json!({
        "runtime_source": "claude_code",
        "acquisition_mode": "observed",
        "event_kind": "session_started",
        "session": {
            "host_id": "local",
            "workspace_id": "demo-project",
            "session_id": "sess-1234"
        },
        "agent_id": null,
        "occurred_at_ms": 1711234567000_i64,
        "capabilities": {
            "can_observe": true,
            "can_start": false,
            "can_stop": false,
            "can_retry": false,
            "can_respond": false
        },
        "title": "session started",
        "payload": { "raw": true }
    });

    let response = app
        .clone()
        .oneshot(
            Request::post("/api/events")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(event.to_string()))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::get("/api/events")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn posts_generic_connector_event_and_reads_it_back() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);

    let event = json!({
        "runtime_source": "claude_code",
        "acquisition_mode": "observed",
        "event_kind": "session_started",
        "session": {
            "host_id": "local",
            "workspace_id": "generic-project",
            "session_id": "sess-generic"
        },
        "agent_id": null,
        "occurred_at_ms": 1711234567999_i64,
        "capabilities": {
            "can_observe": true,
            "can_start": false,
            "can_stop": false,
            "can_retry": false,
            "can_respond": false
        },
        "title": "generic connector event",
        "payload": { "producer": "manual-test" }
    });

    let response = app
        .clone()
        .oneshot(
            Request::post("/api/connectors/generic/events")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(event.to_string()))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::get("/api/events")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn lists_discovered_claude_sessions_from_configured_directory() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::write(
        temp_dir.path().join("session-a.json"),
        r#"{
          "session_id": "session-a",
          "prompts": ["first prompt", "second prompt"]
        }"#,
    )
    .expect("write session fixture");

    let store = Store::open_in_memory().expect("in-memory sqlite");
    let (app, _) = build_router_with_options(
        store,
        AppOptions {
            claude_sessions_dir: Some(temp_dir.path().to_path_buf()),
        },
    );

    let response = app
        .oneshot(
            Request::get("/api/discovery/claude/sessions")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let sessions: serde_json::Value =
        serde_json::from_slice(&body).expect("discovered sessions json");
    let array = sessions.as_array().expect("discovered sessions array");
    assert_eq!(array.len(), 1);
    assert_eq!(array[0]["session_id"], "session-a");
    assert_eq!(array[0]["prompt_count"], 2);
}

#[tokio::test]
async fn merges_discovered_sessions_into_session_history_and_replay() {
    let temp_dir = tempdir().expect("tempdir");
    std::fs::write(
        temp_dir.path().join("session-observed.json"),
        r#"{
          "session_id": "session-observed",
          "prompts": ["first prompt", "second prompt"]
        }"#,
    )
    .expect("write session fixture");

    let store = Store::open_in_memory().expect("in-memory sqlite");
    let (app, _) = build_router_with_options(
        store,
        AppOptions {
            claude_sessions_dir: Some(temp_dir.path().to_path_buf()),
        },
    );

    let response = app
        .clone()
        .oneshot(
            Request::get("/sessions")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let sessions: serde_json::Value =
        serde_json::from_slice(&body).expect("session summary json");
    let array = sessions.as_array().expect("session summary array");
    assert_eq!(array.len(), 1);
    assert_eq!(array[0]["session_id"], "session-observed");
    assert_eq!(array[0]["source_app"], "claude_observed");
    assert_eq!(array[0]["event_count"], 2);

    let response = app
        .oneshot(
            Request::get("/sessions/session-observed")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let events: serde_json::Value = serde_json::from_slice(&body).expect("session events json");
    let array = events.as_array().expect("session events array");
    assert_eq!(array.len(), 2);
    assert_eq!(array[0]["hook_event_type"], "UserPromptSubmit");
    assert_eq!(array[0]["payload"]["prompt"], "first prompt");
}

#[tokio::test]
async fn posts_legacy_claude_event_and_returns_normalized_envelope() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);
    let legacy_event = include_str!("../fixtures/claude/pre_tool_use.json");

    let response = app
        .clone()
        .oneshot(
            Request::post("/api/events/legacy/claude")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(legacy_event))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let envelope: EventEnvelope = serde_json::from_slice(&body).expect("normalized event");

    assert_eq!(envelope.session.workspace_id, "demo-project");
    assert_eq!(envelope.title, "tool call started: Bash");

    let response = app
        .oneshot(
            Request::get("/api/events")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn posts_legacy_hook_event_to_compat_events_route() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);
    let legacy_event = json!({
        "source_app": "demo-project",
        "session_id": "sess-1234",
        "hook_event_type": "PreToolUse",
        "payload": {
            "tool_name": "Bash",
            "tool_input": {
                "command": "pwd"
            }
        },
        "timestamp": 1711234567000_i64,
        "agent_id": null,
        "agent_type": null,
        "model_name": "claude-opus-4-5"
    });

    let response = app
        .clone()
        .oneshot(
            Request::post("/events")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(legacy_event.to_string()))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .oneshot(
            Request::get("/api/events")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let events: Vec<EventEnvelope> = serde_json::from_slice(&body).expect("normalized event list");

    assert_eq!(events.len(), 1);
    assert_eq!(events[0].session.workspace_id, "demo-project");
    assert_eq!(events[0].title, "tool call started: Bash");
}

#[tokio::test]
async fn lists_agent_registry_entries_from_stored_events() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);
    let legacy_event = include_str!("../fixtures/claude/session_start.json");

    let response = app
        .clone()
        .oneshot(
            Request::post("/api/events/legacy/claude")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(legacy_event))
                .expect("request"),
        )
        .await
        .expect("post response");

    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::get("/api/agents")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let entries: serde_json::Value = serde_json::from_slice(&body).expect("agent registry json");
    let array = entries.as_array().expect("registry array");
    assert_eq!(array.len(), 1);

    let first = &array[0];
    assert_eq!(first["source_app"], "demo-project");
    assert_eq!(first["session_id"], "sess-1234");
    assert_eq!(first["display_name"], "demo-project");
    assert_eq!(first["lifecycle_status"], "active");
}

#[tokio::test]
async fn websocket_stream_sends_initial_event_list() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store.clone());

    let legacy_event = include_str!("../fixtures/claude/pre_tool_use.json");
    let response = app
        .clone()
        .oneshot(
            Request::post("/api/events/legacy/claude")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(legacy_event))
                .expect("request"),
        )
        .await
        .expect("post response");
    assert_eq!(response.status(), StatusCode::CREATED);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind tcp listener");
    let address = listener.local_addr().expect("listener address");
    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve app");
    });

    let stream_url = format!("ws://{address}/stream");
    let (mut socket, _) = connect_async(stream_url).await.expect("connect websocket");
    let message = socket
        .next()
        .await
        .expect("initial websocket frame")
        .expect("websocket message");

    let payload: serde_json::Value =
        serde_json::from_str(message.to_text().expect("text frame")).expect("json payload");

    assert_eq!(payload["type"], "initial");
    let data = payload["data"].as_array().expect("initial event array");
    assert_eq!(data.len(), 1);
    assert_eq!(data[0]["source_app"], "demo-project");
    assert_eq!(data[0]["hook_event_type"], "PreToolUse");

    server.abort();
}

#[tokio::test]
async fn returns_filter_options_from_stored_events() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);
    let legacy_event = include_str!("../fixtures/claude/pre_tool_use.json");

    let response = app
        .clone()
        .oneshot(
            Request::post("/api/events/legacy/claude")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(legacy_event))
                .expect("request"),
        )
        .await
        .expect("post response");
    assert_eq!(response.status(), StatusCode::CREATED);

    let response = app
        .oneshot(
            Request::get("/events/filter-options")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn returns_session_summaries_and_session_events() {
    let store = Store::open_in_memory().expect("in-memory sqlite");
    let app = build_router(store);
    let session_start = include_str!("../fixtures/claude/session_start.json");
    let pre_tool_use = include_str!("../fixtures/claude/pre_tool_use.json");

    for fixture in [session_start, pre_tool_use] {
        let response = app
            .clone()
            .oneshot(
                Request::post("/api/events/legacy/claude")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(fixture))
                    .expect("request"),
            )
            .await
            .expect("post response");
        assert_eq!(response.status(), StatusCode::CREATED);
    }

    let response = app
        .clone()
        .oneshot(
            Request::get("/sessions")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let sessions: serde_json::Value = serde_json::from_slice(&body).expect("session summary json");
    let array = sessions.as_array().expect("session summary array");
    assert_eq!(array.len(), 1);
    assert_eq!(array[0]["session_id"], "sess-1234");
    assert_eq!(array[0]["source_app"], "demo-project");

    let response = app
        .oneshot(
            Request::get("/sessions/sess-1234")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("get response");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let events: serde_json::Value = serde_json::from_slice(&body).expect("session events json");
    let array = events.as_array().expect("session events array");
    assert_eq!(array.len(), 2);
}
