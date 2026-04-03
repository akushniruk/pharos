use clap::Parser;
use pharos_daemon::api::{build_router_with_options, AppOptions};
use pharos_daemon::config::Config;
use pharos_daemon::profiles::DiscoveryOptions;
use pharos_daemon::replay::{replay_file, Cli, Command};
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
            let discovery_options = DiscoveryOptions {
                claude_home: config.claude_home.clone(),
                codex_home: config.codex_home.clone(),
                gemini_home: config.gemini_home.clone(),
                runtime_matchers: pharos_daemon::profiles::process::load_runtime_matchers(
                    config.runtime_matchers_path.as_deref(),
                ),
            };
            let (app, state) = build_router_with_options(
                store,
                AppOptions {
                    claude_sessions_dir: config.claude_sessions_dir,
                },
            );

            // Spawn scanner when any runtime observation source is configured.
            if discovery_options.claude_home.is_some()
                || discovery_options.codex_home.is_some()
                || discovery_options.gemini_home.is_some()
                || !discovery_options.runtime_matchers.is_empty()
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
