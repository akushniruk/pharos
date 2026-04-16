use clap::Parser;
use pharos_daemon::api::{AppOptions, build_router_with_options};
use pharos_daemon::config::Config;
use pharos_daemon::memory_brain::MemoryBrainService;
use pharos_daemon::replay::{Cli, Command, replay_file};
use pharos_daemon::scanner;
use pharos_daemon::store::Store;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    match Cli::parse().command {
        Command::Replay { connector, input } => {
            replay_file(input, &connector)?;
        }
        Command::Serve => {
            let config = Config::from_env()?;
            let store = Store::open(&config.db_path)?;
            let discovery_options = config.discovery_options();
            let memory_brain_service = MemoryBrainService::new(config.memory_brain.clone());
            let (app, state) = build_router_with_options(
                store,
                AppOptions {
                    claude_sessions_dir: config.claude_sessions_dir,
                    memory_brain: Some(memory_brain_service.clone()),
                },
            );
            let poll_state = state.clone();
            memory_brain_service.spawn_poller(state.sender.clone(), move |events| {
                pharos_daemon::api::persist_poller_envelopes(&poll_state, events);
            });

            // Spawn scanner when any runtime observation source is configured.
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

            let address = format!("{}:{}", config.host, config.port);
            let listener = tokio::net::TcpListener::bind(&address).await?;

            println!("pharos-daemon listening on {address}");
            axum::serve(listener, app).await?;
        }
    }

    Ok(())
}
