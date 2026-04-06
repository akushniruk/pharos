//! Control-plane / org-style agent labels and parent id aliases for event payloads.

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
        let k = json!({"url_key": "ux_designer"});
        assert_eq!(control_plane_agent_label(&k).as_deref(), Some("UXDesigner"));
        let r = json!({"role": "engineer"});
        assert_eq!(control_plane_agent_label(&r).as_deref(), Some("Engineer"));
    }
}
