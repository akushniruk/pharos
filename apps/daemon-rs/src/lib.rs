pub mod api;
pub mod connector;
pub mod config;
pub mod discovery;
pub mod envelope;
pub mod legacy;
pub mod model;
pub mod profiles;
#[cfg(feature = "cli")]
pub mod replay;
pub mod scanner;
pub mod store;
pub mod tailer;

use std::path::PathBuf;

/// Start the Pharos daemon as an embeddable server.
/// Used by Tauri desktop app and can be called from any Rust host.
pub async fn start_server(
    host: &str,
    port: u16,
    db_path: &str,
    claude_home: Option<PathBuf>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let store = store::Store::open(db_path)?;
    let (app, state) = api::build_router_with_options(
        store,
        api::AppOptions {
            claude_sessions_dir: None,
        },
    );

    if let Some(claude_home) = claude_home {
        let scanner_store = state.store.clone();
        let scanner_sender = state.sender.clone();
        tokio::spawn(async move {
            scanner::run_scanner(
                scanner_store,
                scanner_sender,
                profiles::DiscoveryOptions {
                    claude_home: Some(claude_home),
                    codex_home: None,
                    gemini_home: None,
                    runtime_matchers: Vec::new(),
                },
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
