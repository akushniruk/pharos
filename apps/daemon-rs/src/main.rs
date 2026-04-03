use clap::Parser;
use pharos_daemon::api::{build_router_with_options, AppOptions};
use pharos_daemon::config::Config;
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
            let (app, state) = build_router_with_options(
                store,
                AppOptions {
                    claude_sessions_dir: config.claude_sessions_dir,
                },
            );

            // Spawn scanner if claude_home is available
            if let Some(claude_home) = config.claude_home {
                let scanner_store = state.store.clone();
                let scanner_sender = state.sender.clone();
                tokio::spawn(async move {
                    scanner::run_scanner(scanner_store, scanner_sender, claude_home).await;
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
