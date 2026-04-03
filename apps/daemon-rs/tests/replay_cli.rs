use assert_cmd::Command;

#[test]
fn replay_command_imports_a_fixture_file() {
    let mut command = Command::cargo_bin("pharos-daemon").expect("binary exists");
    command.args([
        "replay",
        "--connector",
        "claude",
        "--input",
        "fixtures/claude/pre_tool_use.json",
    ]);
    command.assert().success();
}
