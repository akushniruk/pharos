use crate::model::LegacyHookEvent;

use super::util::{
    encode_data_uri_component, escape_svg_text, initials_from_name, payload_string,
};

pub(crate) fn resolve_project_icon_url(project_name: &str) -> Option<String> {
    Some(default_project_icon_data_uri(project_name))
}

pub(crate) fn default_project_icon_data_uri(project_name: &str) -> String {
    let initials = escape_svg_text(&project_initials(project_name));
    let svg = format!(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>\
<rect x='1' y='1' width='22' height='22' rx='6' fill='#111827' stroke='#374151'/>\
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='8' font-weight='700' fill='white'>{initials}</text>\
</svg>"
    );
    format!("data:image/svg+xml,{}", encode_data_uri_component(&svg))
}

fn project_initials(name: &str) -> String {
    initials_from_name(name, "P")
}

pub(crate) fn resolve_agent_avatar_url(events: &[&LegacyHookEvent], display_name: &str) -> Option<String> {
    for event in events.iter().rev() {
        if let Some(url) = payload_string(&event.payload, "agent_avatar_url")
            .or_else(|| payload_string(&event.payload, "avatar_url"))
            .or_else(|| payload_string(&event.payload, "avatar"))
        {
            let trimmed = url.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    let runtime = events
        .iter()
        .rev()
        .find_map(|event| {
            payload_string(&event.payload, "runtime_label")
                .or_else(|| payload_string(&event.payload, "runtime_source"))
        })
        .unwrap_or_else(|| "Agent".to_string());

    Some(default_agent_avatar_data_uri(&runtime, display_name))
}

pub(crate) fn default_agent_avatar_data_uri(runtime: &str, display_name: &str) -> String {
    let initials = escape_svg_text(&avatar_initials(display_name));
    let fill = runtime_color(runtime);
    let svg = format!(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>\
<rect x='0' y='0' width='24' height='24' rx='12' fill='{fill}'/>\
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='9' font-weight='700' fill='white'>{initials}</text>\
</svg>"
    );
    format!("data:image/svg+xml,{}", encode_data_uri_component(&svg))
}

fn avatar_initials(name: &str) -> String {
    initials_from_name(name, "A")
}

fn runtime_color(runtime: &str) -> &'static str {
    match runtime.to_ascii_lowercase().as_str() {
        "claude" | "claude_code" => "#8B5CF6",
        "codex" | "codex_cli" => "#2563EB",
        "gemini" | "gemini_cli" => "#0EA5A8",
        "cursor" | "cursor_agent" => "#16A34A",
        "pi" | "pi_cli" => "#EA580C",
        "aider" => "#DB2777",
        "opencode" => "#0891B2",
        _ => "#6B7280",
    }
}
