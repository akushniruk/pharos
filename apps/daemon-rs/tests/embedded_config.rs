use std::collections::BTreeMap;
use std::path::PathBuf;

use pharos_daemon::config::Config;
use pharos_daemon::model::RuntimeSource;

#[test]
fn embedded_discovery_options_include_supported_runtime_homes() {
    let mut env_map = BTreeMap::new();
    env_map.insert("HOME".to_string(), "/Users/tester".to_string());
    env_map.insert(
        "PHAROS_RUNTIME_MATCHERS_PATH".to_string(),
        "/Users/tester/.config/pharos/runtime-matchers.json".to_string(),
    );

    let config = Config::from_env_map(env_map).expect("config should parse");
    let options = config.discovery_options();

    assert_eq!(
        options.claude_home,
        Some(PathBuf::from("/Users/tester/.claude")),
    );
    assert_eq!(
        options.codex_home,
        Some(PathBuf::from("/Users/tester/.codex")),
    );
    assert_eq!(
        options.gemini_home,
        Some(PathBuf::from("/Users/tester/.gemini")),
    );
    assert_eq!(
        options.cursor_home,
        Some(PathBuf::from("/Users/tester/.cursor")),
    );
    assert_eq!(options.ollama_base_url, None);
    assert_eq!(options.ollama_events_workspace, None);
}

#[test]
fn discovery_options_propagate_ollama_url_and_workspace_from_env() {
    let mut env_map = BTreeMap::new();
    env_map.insert("HOME".to_string(), "/Users/tester".to_string());
    env_map.insert(
        "PHAROS_MEMORY_BRAIN_OLLAMA_URL".to_string(),
        "http://127.0.0.1:11434".to_string(),
    );
    env_map.insert("PHAROS_OLLAMA_EVENT_WORKSPACE".to_string(), "projects".to_string());

    let config = Config::from_env_map(env_map).expect("config should parse");
    let options = config.discovery_options();

    assert_eq!(
        options.ollama_base_url.as_deref(),
        Some("http://127.0.0.1:11434")
    );
    assert_eq!(options.ollama_events_workspace.as_deref(), Some("projects"));
}

#[test]
fn embedded_discovery_options_load_runtime_matchers_from_configured_path() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let matcher_path = temp_dir.path().join("runtime-matchers.json");
    std::fs::write(
        &matcher_path,
        r#"[
          {
            "id": "custom-agent",
            "runtime_source": "generic_agent_cli",
            "match_any": ["custom-agent"],
            "entrypoint": "CustomAgent"
          }
        ]"#,
    )
    .expect("write matcher config");

    let mut env_map = BTreeMap::new();
    env_map.insert("HOME".to_string(), "/Users/tester".to_string());
    env_map.insert(
        "PHAROS_RUNTIME_MATCHERS_PATH".to_string(),
        matcher_path.display().to_string(),
    );

    let config = Config::from_env_map(env_map).expect("config should parse");
    let options = config.discovery_options();

    assert_eq!(options.runtime_matchers.len(), 1);
    assert_eq!(options.runtime_matchers[0].id, "custom-agent");
    assert_eq!(
        options.runtime_matchers[0].runtime_source,
        RuntimeSource::GenericAgentCli,
    );
}
