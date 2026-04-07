//! Control-plane / org-style agent labels and parent id aliases for event payloads.

use std::collections::HashMap;
use serde_json::Value;

fn pv(payload: &Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .map(std::string::ToString::to_string)
}

/// Subagent / org edges may use `parent_agent_id`, `parent_id`, or `parentId`.
pub fn payload_parent_agent_id(payload: &Value) -> Option<String> {
    pv(payload, "parent_agent_id")
        .or_else(|| pv(payload, "parent_id"))
        .or_else(|| pv(payload, "parentId"))
}

fn is_prompt_like_agent_name(value: &str) -> bool {
    let t = value.trim();
    if t.len() > 120 {
        return true;
    }
    let lower = t.to_ascii_lowercase();
    lower.contains("```")
        || lower.starts_with("you are ")
        || lower.contains("follow all")
        || lower.contains("user rules")
}

fn capitalize_word(word: &str) -> String {
    let mut chars = word.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn format_url_key_label(key: &str) -> String {
    let parts: Vec<&str> = key.split('_').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return key.trim().to_string();
    }
    parts
        .iter()
        .map(|p| {
            let pl = p.to_ascii_lowercase();
            match pl.as_str() {
                "ux" => "UX".to_string(),
                "ui" => "UI".to_string(),
                "qa" => "QA".to_string(),
                _ if pl.len() <= 4 && pl.chars().all(|c| c.is_ascii_alphanumeric()) => {
                    pl.to_ascii_uppercase()
                }
                _ => capitalize_word(&pl),
            }
        })
        .collect()
}

/// Prefer short operator-facing names from control-plane shaped payloads (e.g. Paperclip `agents/me`).
pub fn control_plane_agent_label(payload: &Value) -> Option<String> {
    if let Some(name) = pv(payload, "name") {
        let t = name.trim();
        if !t.is_empty() && !is_prompt_like_agent_name(t) {
            return Some(t.to_string());
        }
    }
    if let Some(title) = pv(payload, "title").or_else(|| pv(payload, "agent_title")) {
        let t = title.trim();
        if !t.is_empty() && t.len() <= 80 && !is_prompt_like_agent_name(t) {
            return Some(t.to_string());
        }
    }
    if let Some(key) = pv(payload, "url_key").or_else(|| pv(payload, "urlKey")) {
        let t = key.trim();
        if !t.is_empty() {
            return Some(format_url_key_label(t));
        }
    }
    if let Some(role) = pv(payload, "role") {
        let t = role.trim();
        if !t.is_empty() && t.len() <= 48 {
            let underscored: String = t.split_whitespace().collect::<Vec<_>>().join("_");
            return Some(format_url_key_label(&underscored));
        }
    }
    None
}

/// Infer an agent role from the tools it has called.
/// Returns `None` until at least 3 tool calls have been observed.
pub fn infer_agent_role(tool_counts: &HashMap<String, usize>) -> Option<String> {
    let total: usize = tool_counts.values().sum();
    if total < 3 {
        return None;
    }

    let count = |names: &[&str]| -> usize {
        names.iter().filter_map(|n| tool_counts.get(*n)).sum()
    };

    let read = count(&[
        "Read", "ReadFile", "Grep", "Glob", "SemanticSearch", "WebSearch", "WebFetch",
        "FetchMcpResource", "ListMcpResources",
    ]);
    let write = count(&[
        "Write", "StrReplace", "EditNotebook", "Delete",
    ]);
    let shell = count(&["Shell", "Bash"]);
    let browser = count(&[
        "browser_navigate", "browser_snapshot", "browser_click", "browser_type",
        "browser_fill", "browser_hover", "browser_scroll", "browser_tabs",
        "browser_take_screenshot", "browser_handle_dialog", "browser_lock",
        "browser_console_messages", "browser_network_requests",
        "browser_navigate_back", "browser_search", "browser_select",
        "browser_mouse_click_xy", "browser_fill_form", "browser_press_key",
        "browser_drag", "browser_wait",
    ]);
    let plan = count(&["CreatePlan", "TodoWrite", "AskQuestion", "SwitchMode"]);
    let spawn = count(&["Task"]);
    let mcp = count(&["CallMcpTool", "FetchMcpResource", "ListMcpResources"]);
    let image = count(&["GenerateImage"]);
    let git = count(&["git_status", "git_diff", "git_log", "git_commit"]);
    let review = count(&["GetPRComments", "CreatePullRequest"]);
    let notebook = count(&["EditNotebook"]);

    // Dominant-signal roles: one category clearly dominates
    if browser * 3 > total {
        return Some("browser".into());
    }
    if spawn * 3 > total {
        return Some("orchestrator".into());
    }
    if image * 3 > total {
        return Some("designer".into());
    }
    if notebook * 3 > total {
        return Some("analyst".into());
    }
    if mcp * 3 > total {
        return Some("integrator".into());
    }
    if review > 0 && read > write * 2 {
        return Some("reviewer".into());
    }
    if plan * 3 > total {
        return Some("planner".into());
    }
    if git * 2 > total {
        return Some("deployer".into());
    }
    if shell * 2 > total {
        return Some("runner".into());
    }

    // Mixed-signal roles
    if write > 0 && read > 0 {
        return Some("developer".into());
    }
    if read * 3 > total * 2 {
        return Some("explorer".into());
    }
    if write * 2 > total {
        return Some("writer".into());
    }
    Some("developer".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parent_id_aliases() {
        let a = json!({"parent_id": "p1"});
        assert_eq!(payload_parent_agent_id(&a).as_deref(), Some("p1"));
        let b = json!({"parentId": "p2"});
        assert_eq!(payload_parent_agent_id(&b).as_deref(), Some("p2"));
        let c = json!({"parent_agent_id": "p0"});
        assert_eq!(payload_parent_agent_id(&c).as_deref(), Some("p0"));
    }

    #[test]
    fn control_plane_labels() {
        let j = json!({"name": "CTO"});
        assert_eq!(control_plane_agent_label(&j).as_deref(), Some("CTO"));
        let t = json!({"title": "Software Engineer"});
        assert_eq!(control_plane_agent_label(&t).as_deref(), Some("Software Engineer"));
        let k = json!({"url_key": "ux_designer"});
        assert_eq!(control_plane_agent_label(&k).as_deref(), Some("UXDesigner"));
        let r = json!({"role": "engineer"});
        assert_eq!(control_plane_agent_label(&r).as_deref(), Some("Engineer"));
    }

    #[test]
    fn infer_role_returns_none_below_threshold() {
        let counts = HashMap::from([("Read".into(), 2)]);
        assert_eq!(infer_agent_role(&counts), None);
        assert_eq!(infer_agent_role(&HashMap::new()), None);
    }

    #[test]
    fn infer_role_developer_when_read_and_write() {
        let counts = HashMap::from([("Read".into(), 5), ("StrReplace".into(), 3)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("developer"));
    }

    #[test]
    fn infer_role_explorer_when_mostly_reads() {
        let counts = HashMap::from([("Read".into(), 8), ("Grep".into(), 4), ("Shell".into(), 1)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("explorer"));
    }

    #[test]
    fn infer_role_runner_when_mostly_shell() {
        let counts = HashMap::from([("Shell".into(), 6), ("Read".into(), 2)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("runner"));
    }

    #[test]
    fn infer_role_browser_when_dominated_by_browser_tools() {
        let counts = HashMap::from([
            ("browser_navigate".into(), 3),
            ("browser_snapshot".into(), 4),
            ("Read".into(), 1),
        ]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("browser"));
    }

    #[test]
    fn infer_role_orchestrator_when_mostly_spawning() {
        let counts = HashMap::from([("Task".into(), 5), ("Read".into(), 2)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("orchestrator"));
    }

    #[test]
    fn infer_role_planner_when_mostly_planning() {
        let counts = HashMap::from([("TodoWrite".into(), 4), ("AskQuestion".into(), 2), ("Read".into(), 1)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("planner"));
    }

    #[test]
    fn infer_role_designer_when_mostly_image_gen() {
        let counts = HashMap::from([("GenerateImage".into(), 4), ("Read".into(), 1)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("designer"));
    }

    #[test]
    fn infer_role_integrator_when_mostly_mcp() {
        let counts = HashMap::from([("CallMcpTool".into(), 5), ("Read".into(), 1)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("integrator"));
    }

    #[test]
    fn infer_role_reviewer_when_pr_and_reads() {
        let counts = HashMap::from([
            ("GetPRComments".into(), 1),
            ("Read".into(), 8),
            ("Grep".into(), 4),
            ("StrReplace".into(), 1),
        ]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("reviewer"));
    }

    #[test]
    fn infer_role_deployer_when_mostly_git() {
        let counts = HashMap::from([
            ("git_status".into(), 3),
            ("git_diff".into(), 2),
            ("git_commit".into(), 2),
        ]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("deployer"));
    }

    #[test]
    fn infer_role_analyst_when_mostly_notebooks() {
        let counts = HashMap::from([("EditNotebook".into(), 5), ("Read".into(), 1)]);
        assert_eq!(infer_agent_role(&counts).as_deref(), Some("analyst"));
    }
}
