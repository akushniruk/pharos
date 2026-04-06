use crate::model::LegacyHookEvent;

use super::util::{
    basename_from_path, clean_summary_text, content_preview, payload_string, short_path, truncate,
};

pub(crate) fn describe_legacy_event(event: &LegacyHookEvent) -> String {
    let tool_name =
        payload_string(&event.payload, "tool_name").unwrap_or_else(|| "unknown".to_string());
    match event.hook_event_type.as_str() {
        "PreToolUse" => {
            if let Some(tool_input) = event.payload.get("tool_input") {
                if (tool_name == "Bash" || tool_name == "exec_command")
                    && extract_command(tool_input).is_some()
                {
                    let command = extract_command(tool_input).unwrap_or_default();
                    if let Some(workdir) = tool_input
                        .get("workdir")
                        .and_then(serde_json::Value::as_str)
                        .and_then(basename_from_path)
                    {
                        return format!("Running {} in {workdir}", truncate(&command, 64));
                    }
                    return format!("Running {}", truncate(&command, 72));
                }
                if ["Read", "Edit", "Write"].contains(&tool_name.as_str())
                    && extract_file_target(tool_input).is_some()
                {
                    let target = extract_file_target(tool_input).unwrap_or_default();
                    let verb = match tool_name.as_str() {
                        "Read" => "Reading",
                        "Edit" => "Editing",
                        _ => "Writing",
                    };
                    return format!("{verb} {target}");
                }
                if tool_name == "apply_patch" {
                    let patch = tool_input
                        .get("patch")
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| tool_input.get("input").and_then(serde_json::Value::as_str))
                        .unwrap_or_default();
                    if let Some(target) = extract_patched_file(patch) {
                        return format!("Patching {target}");
                    }
                    return "Applying patch".to_string();
                }
            }
            format!("Using {tool_name}")
        }
        "PostToolUse" => {
            if let Some(content) = event
                .payload
                .get("content")
                .and_then(serde_json::Value::as_str)
                .and_then(content_preview)
            {
                if tool_name == "exec_command" {
                    return format!("Command completed: {}", truncate(&content, 72));
                }
                return format!("{tool_name} completed: {}", truncate(&content, 72));
            }
            format!("{tool_name} completed")
        }
        "PostToolUseFailure" => {
            if let Some(content) = event
                .payload
                .get("content")
                .and_then(serde_json::Value::as_str)
                .and_then(content_preview)
            {
                return format!("{tool_name} failed: {}", truncate(&content, 72));
            }
            format!("{tool_name} failed")
        }
        "SessionStart" => payload_string(&event.payload, "title")
            .map(|title| format!("Watching {}", truncate(&title, 80)))
            .unwrap_or_else(|| "Session observed".to_string()),
        "SessionEnd" => "Session ended".to_string(),
        "SubagentStart" => {
            let label = payload_string(&event.payload, "display_name")
                .or_else(|| payload_string(&event.payload, "agent_name"))
                .or_else(|| payload_string(&event.payload, "agent_type"))
                .or_else(|| event.agent_name.clone())
                .unwrap_or_else(|| "Agent".to_string());
            if let Some(description) = payload_string(&event.payload, "description") {
                return format!("Spawned {} to {}", label, truncate(&description, 72));
            }
            format!("Spawned {label}")
        }
        "SubagentStop" => "Subagent finished".to_string(),
        "UserPromptSubmit" => payload_string(&event.payload, "prompt")
            .or_else(|| payload_string(&event.payload, "message"))
            .and_then(|prompt| clean_summary_text(&prompt))
            .map(|prompt| format!("Prompted: {}", truncate(&prompt, 72)))
            .unwrap_or_else(|| "User prompt".to_string()),
        "AssistantResponse" => payload_string(&event.payload, "text")
            .and_then(|text| clean_summary_text(&text))
            .map(|text| format!("Responded: {}", truncate(&text, 72)))
            .unwrap_or_else(|| "Response".to_string()),
        "SessionTitleChanged" => {
            payload_string(&event.payload, "title").unwrap_or_else(|| "Title changed".to_string())
        }
        _ => event.hook_event_type.clone(),
    }
}

pub(crate) fn extract_command(tool_input: &serde_json::Value) -> Option<String> {
    if let Some(command) = tool_input.get("cmd").and_then(serde_json::Value::as_str) {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(command) = tool_input
        .get("command")
        .and_then(serde_json::Value::as_str)
    {
        let trimmed = command.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(parts) = tool_input
        .get("command")
        .and_then(serde_json::Value::as_array)
    {
        let joined = parts
            .iter()
            .filter_map(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        if !joined.is_empty() {
            return Some(joined);
        }
    }
    None
}

pub(crate) fn extract_file_target(tool_input: &serde_json::Value) -> Option<String> {
    ["file_path", "path", "file"]
        .iter()
        .find_map(|key| tool_input.get(*key).and_then(serde_json::Value::as_str))
        .and_then(short_path)
}

pub(crate) fn extract_patched_file(patch: &str) -> Option<String> {
    let marker = ["*** Add File: ", "*** Update File: ", "*** Delete File: "];
    for prefix in marker {
        if let Some(rest) = patch.lines().find_map(|line| line.strip_prefix(prefix)) {
            return short_path(rest);
        }
    }
    None
}
