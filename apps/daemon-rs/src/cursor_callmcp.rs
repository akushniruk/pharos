//! Normalize Cursor `CallMcpTool` payloads: keys vary (`toolName` vs `tool_name`),
//! and Anthropic-style clients often nest `server` + tool name inside `arguments`
//! (JSON object or stringified JSON).

use serde_json::Value;

fn pick_lower(obj: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(s) = obj.get(*key).and_then(Value::as_str) {
            let t = s.trim();
            if !t.is_empty() {
                return t.to_ascii_lowercase();
            }
        }
    }
    String::new()
}

fn merge_arguments_layer(tool_input: &Value) -> Option<Value> {
    let args = tool_input.get("arguments")?;
    match args {
        Value::String(s) => serde_json::from_str::<Value>(s).ok(),
        Value::Object(_) => Some(args.clone()),
        _ => None,
    }
}

/// Returns `(server, mcp_tool)` in lowercase for matching.
pub fn extract_server_tool(tool_input: &Value) -> (String, String) {
    let mut server = pick_lower(
        tool_input,
        &["server", "mcp_server", "mcpServer", "mcp_server_id"],
    );
    let mut mcp_tool = pick_lower(
        tool_input,
        &["toolName", "tool_name", "name", "tool", "toolId", "tool_id"],
    );

    if let Some(nested) = merge_arguments_layer(tool_input) {
        if server.is_empty() {
            server = pick_lower(
                &nested,
                &["server", "mcp_server", "mcpServer", "mcp_server_id"],
            );
        }
        if mcp_tool.is_empty() {
            mcp_tool = pick_lower(
                &nested,
                &["toolName", "tool_name", "name", "tool", "toolId", "tool_id"],
            );
        }
    }

    (server, mcp_tool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_snake_case_tool_name() {
        let tool_input = json!({
            "server": "user-ai-memory-brain",
            "tool_name": "memory_add"
        });
        let (s, t) = extract_server_tool(&tool_input);
        assert_eq!(s, "user-ai-memory-brain");
        assert_eq!(t, "memory_add");
    }

    #[test]
    fn reads_nested_arguments_object() {
        let tool_input = json!({
            "arguments": {
                "server": "user-librarian",
                "toolName": "memory_store_summary"
            }
        });
        let (s, t) = extract_server_tool(&tool_input);
        assert_eq!(s, "user-librarian");
        assert_eq!(t, "memory_store_summary");
    }

    #[test]
    fn reads_nested_arguments_json_string() {
        let tool_input = json!({
            "arguments": r#"{"server":"ai-memory-brain","tool_name":"memory_add"}"#
        });
        let (s, t) = extract_server_tool(&tool_input);
        assert_eq!(s, "ai-memory-brain");
        assert_eq!(t, "memory_add");
    }
}
