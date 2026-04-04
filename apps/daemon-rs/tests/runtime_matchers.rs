use pharos_daemon::config::RuntimeMatcherConfig;
use pharos_daemon::model::RuntimeSource;
use pharos_daemon::profiles::process::{ProcessSnapshot, classify_process, load_runtime_matchers};
use tempfile::NamedTempFile;

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
            "match_exe_any": ["/opt/custom/bin/custombot"],
            "match_exe_contains": [],
            "match_argv_any": ["custombot", "--serve"],
            "match_argv_contains": [],
            "match_cwd_any": ["/Users/tester/workspace/sample-app"],
            "match_cwd_contains": [],
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
            match_exe_any: vec!["/opt/custom/bin/custombot".to_string()],
            match_exe_contains: vec![],
            match_argv_any: vec!["custombot".to_string(), "--serve".to_string()],
            match_argv_contains: vec![],
            match_cwd_any: vec!["/Users/tester/workspace/sample-app".to_string()],
            match_cwd_contains: vec![],
            entrypoint: Some("CustomBot".to_string()),
            display_title: None,
        }]
    );
}

#[test]
fn classifies_custom_runtime_from_loaded_matcher() {
    let snapshot = ProcessSnapshot {
        pid: 999,
        name: "node".to_string(),
        exe: Some("/opt/custom/bin/custombot".to_string()),
        cwd: Some("/Users/tester/workspace/sample-app".to_string()),
        cmd: vec![
            "node".to_string(),
            "/opt/custom/bin/custombot".to_string(),
            "--serve".to_string(),
        ],
        started_at_ms: 1_711_234_567_000,
    };
    let matchers = vec![RuntimeMatcherConfig {
        id: "custom-bot".to_string(),
        runtime_source: RuntimeSource::CustomCli,
        match_any: vec!["custombot".to_string()],
        match_exe_any: vec!["/opt/custom/bin/custombot".to_string()],
        match_exe_contains: vec![],
        match_argv_any: vec!["--serve".to_string()],
        match_argv_contains: vec![],
        match_cwd_any: vec!["/Users/tester/workspace/sample-app".to_string()],
        match_cwd_contains: vec![],
        entrypoint: Some("CustomBot".to_string()),
        display_title: Some("Custom Bot".to_string()),
    }];

    assert_eq!(
        classify_process(&snapshot, &matchers),
        Some(RuntimeSource::CustomCli)
    );
}
