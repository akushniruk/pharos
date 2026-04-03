#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

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

            // Resolve Claude home directory
            let claude_home = resolve_claude_home();

            // Spawn the daemon in a background thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
                rt.block_on(async move {
                    if let Err(e) =
                        pharos_daemon::start_server("127.0.0.1", 4000, &db_path, claude_home).await
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

fn resolve_claude_home() -> Option<PathBuf> {
    // macOS / Linux
    if let Ok(home) = std::env::var("HOME") {
        let path = PathBuf::from(home).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Windows
    if let Ok(appdata) = std::env::var("APPDATA") {
        let path = PathBuf::from(appdata).join("claude");
        if path.exists() {
            return Some(path);
        }
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let path = PathBuf::from(profile).join(".claude");
        if path.exists() {
            return Some(path);
        }
    }
    // Fallback
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".claude"))
}
