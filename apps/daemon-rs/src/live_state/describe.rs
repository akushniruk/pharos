use crate::model::LegacyHookEvent;

use super::util::{
    basename_from_path, clean_summary_text, content_preview, payload_string, short_path, truncate,
};

fn as_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToString::to_string)
}

fn mcp_tool_summary(tool_name: &str, tool_input: &serde_json::Value) -> Option<String> {
    let uri = as_non_empty(tool_input.get("uri").and_then(serde_json::Value::as_str));
    let server = as_non_empty(tool_input.get("server").and_then(serde_json::Value::as_str));

    match tool_name {
        "CallMcpTool" => {
            let (server_l, mcp_l) = crate::cursor_callmcp::extract_server_tool(tool_input);
            let server_label = if server_l.is_empty() {
                as_non_empty(tool_input.get("server").and_then(serde_json::Value::as_str))
                    .unwrap_or_else(|| "unknown-server".to_string())
            } else {
                server_l
            };
            let mcp_tool = if !mcp_l.is_empty() {
                Some(mcp_l)
            } else {
                as_non_empty(
                    tool_input
                        .get("toolName")
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| tool_input.get("tool_name").and_then(serde_json::Value::as_str)),
                )
            };
            if let Some(mcp_tool_name) = mcp_tool {
                let server_lc = server_label.to_ascii_lowercase();
                if server_lc.contains("librarian") {
                    let action = if mcp_tool_name.starts_with("memory_") {
                        mcp_tool_name
                            .strip_prefix("memory_")
                            .unwrap_or(mcp_tool_name.as_str())
                            .replace('_', " ")
                    } else {
                        mcp_tool_name.replace('_', " ")
                    };
                    return Some(format!("Librarian: {action}"));
                }
                if server_lc == "ai-memory-brain"
                    || server_lc == "user-ai-memory-brain"
                    || server_lc.ends_with("ai-memory-brain")
                    || mcp_tool_name.starts_with("memory_")
                {
                    let memory_action = mcp_tool_name
                        .strip_prefix("memory_")
                        .unwrap_or(mcp_tool_name.as_str())
                        .replace('_', " ");
                    return Some(format!("Memory brain: {memory_action}"));
                }
                return Some(format!("Calling MCP {server_label}/{mcp_tool_name}"));
            }
            Some(format!("Calling MCP {server_label}"))
        }
        "FetchMcpResource" => {
            let server_label = server.unwrap_or_else(|| "unknown-server".to_string());
            if let Some(resource_uri) = uri {
                let short_uri = truncate(&resource_uri, 48);
                return Some(format!("Fetching MCP resource {server_label}: {short_uri}"));
            }
            Some(format!("Fetching MCP resource from {server_label}"))
        }
        "ListMcpResources" => {
            let server_label = server.unwrap_or_else(|| "all servers".to_string());
            Some(format!("Listing MCP resources for {server_label}"))
        }
        _ => None,
    }
}

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
                if let Some(summary) = mcp_tool_summary(&tool_name, tool_input) {
                    return summary;
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::model::LegacyHookEvent;

    use super::describe_legacy_event;

    fn build_event(payload: serde_json::Value) -> LegacyHookEvent {
        LegacyHookEvent {
            source_app: "pharos".to_string(),
            session_id: "session-1".to_string(),
            hook_event_type: "PreToolUse".to_string(),
            payload,
            timestamp: 1,
            agent_id: None,
            agent_type: None,
            model_name: None,
            display_name: None,
            agent_name: None,
        }
    }

    #[test]
    fn describes_memory_brain_mcp_calls() {
        let event = build_event(json!({
            "tool_name": "CallMcpTool",
            "tool_input": {
                "server": "ai-memory-brain",
                "toolName": "memory_store_summary"
            }
        }));
        assert_eq!(describe_legacy_event(&event), "Memory brain: store summary");
    }

    #[test]
    fn describes_fetch_mcp_resource_calls() {
        let event = build_event(json!({
            "tool_name": "FetchMcpResource",
            "tool_input": {
                "server": "ai-memory-brain",
                "uri": "memory://brain/health"
            }
        }));
        assert_eq!(
            describe_legacy_event(&event),
            "Fetching MCP resource ai-memory-brain: memory://brain/health"
        );
    }
}
