pub use pharos_domain;

pub mod agent_identity;
pub mod api;
pub mod config;
pub mod connector;
pub mod cursor_callmcp;
pub mod discovery;
pub mod envelope;
pub mod legacy;
pub mod live_state;
pub mod memory_brain;
pub mod model;
pub mod profiles;
#[cfg(feature = "cli")]
pub mod replay;
pub mod scanner;
pub mod store;
pub mod tailer;

/// Start the Pharos daemon as an embeddable server.
/// Used by Tauri desktop app and can be called from any Rust host.
pub async fn start_server(
    host: &str,
    port: u16,
    db_path: &str,
    app_options: api::AppOptions,
    discovery_options: profiles::DiscoveryOptions,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let store = store::Store::open(db_path)?;
    let memory_brain_service = app_options.memory_brain.clone();
    let (app, state) = api::build_router_with_options(store, app_options);
    if let Some(service) = memory_brain_service {
        let poll_state = state.clone();
        service.spawn_poller(state.sender.clone(), move |events| {
            crate::api::persist_poller_envelopes(&poll_state, events);
        });
    }

    if discovery_options.claude_home.is_some()
        || discovery_options.codex_home.is_some()
        || discovery_options.gemini_home.is_some()
        || discovery_options.cursor_home.is_some()
        || !discovery_options.runtime_matchers.is_empty()
        || discovery_options
            .ollama_base_url
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty())
    {
        let scanner_store = state.store.clone();
        let scanner_sender = state.sender.clone();
        let scanner_live_state = state.live_state.clone();
        tokio::spawn(async move {
            scanner::run_scanner(
                scanner_store,
                scanner_live_state,
                scanner_sender,
                discovery_options,
            )
            .await;
        });
    }

    let address = format!("{host}:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await?;
    println!("pharos-daemon listening on {address}");
    axum::serve(listener, app).await?;
    Ok(())
}
