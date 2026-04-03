use pharos_daemon::config::RuntimeMatcherConfig;
use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::process::{
    classify_process, load_runtime_matchers, ProcessSnapshot,
};
use tempfile::NamedTempFile;

fn snapshot(name: &str, cmd: &[&str]) -> ProcessSnapshot {
    ProcessSnapshot {
        pid: 999,
        name: name.to_string(),
        exe: Some(format!("/usr/local/bin/{name}")),
        cwd: Some("/Users/tester/workspace/sample-app".to_string()),
        cmd: cmd.iter().map(|part| (*part).to_string()).collect(),
        started_at_ms: 1_711_234_567_000,
    }
}

#[test]
fn loads_runtime_matchers_from_json() {
    let file = NamedTempFile::new().expect("temp matcher file");
    std::fs::write(
        file.path(),
        r#"[
          {
            "id": "custom-bot",
            "runtime_source": "custom_cli",
            "match_any": ["custombot", "custom-bot"],
            "entrypoint": "CustomBot"
          }
        ]"#,
    )
    .expect("write matcher config");

    let matchers = load_runtime_matchers(Some(file.path()));

    assert_eq!(
        matchers,
        vec![RuntimeMatcherConfig {
            id: "custom-bot".to_string(),
            runtime_source: RuntimeSource::CustomCli,
            match_any: vec!["custombot".to_string(), "custom-bot".to_string()],
            entrypoint: Some("CustomBot".to_string()),
        }]
    );
}

#[test]
fn classifies_custom_runtime_from_loaded_matcher() {
    let snapshot = snapshot("custombot", &["custombot", "serve"]);
    let matchers = vec![RuntimeMatcherConfig {
        id: "custom-bot".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec!["custombot".to_string()],
        entrypoint: Some("CustomBot".to_string()),
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CustomCli)
    );
}
