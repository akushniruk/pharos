#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Resolve DB path in Tauri's app data directory
            let db_path = tauri::Manager::path(&app_handle)
                .app_local_data_dir()
                .map(|p| {
                    std::fs::create_dir_all(&p).ok();
                    p.join("pharos-daemon.db")
                        .to_string_lossy()
                        .to_string()
                })
                .unwrap_or_else(|_| "pharos-daemon.db".to_string());

            let config = pharos_daemon::config::Config::from_env()
                .expect("failed to resolve Pharos runtime configuration");
            let app_options = config.app_options();
            let discovery_options = config.discovery_options();

            // Spawn the daemon in a background thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
                rt.block_on(async move {
                    if let Err(e) = pharos_daemon::start_server(
                        "127.0.0.1",
                        4000,
                        &db_path,
                        app_options,
                        discovery_options,
                    )
                    .await
                    {
                        eprintln!("Pharos daemon error: {e}");
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pharos");
}
