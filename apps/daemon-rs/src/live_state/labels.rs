use std::collections::BTreeSet;

use crate::model::{AgentSnapshot, LegacyHookEvent, SessionSnapshot};

use super::describe::describe_legacy_event;
use crate::agent_identity::control_plane_agent_label;

use super::util::{
    clean_summary_text, content_preview, payload_responsibility, payload_string, truncate,
    workspace_name_from_cwd,
};

pub(crate) fn should_upgrade_project_label(current: &str, candidate: &str) -> bool {
    let current_is_project = is_project_like_name(current);
    let candidate_is_project = is_project_like_name(candidate);

    candidate_is_project && (!current_is_project || current.eq_ignore_ascii_case("unknown"))
}

fn is_project_like_name(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    !normalized.is_empty()
        && !matches!(
            normalized.as_str(),
            "unknown"
                | "macos"
                | "resources"
                | "data"
                | "libexec"
                | "sbin"
                | "bin"
                | "system"
                | "contents"
                | "workbench"
                | "app"
                | "out"
        )
}

pub(crate) fn resolve_runtime_label(events: &[LegacyHookEvent]) -> Option<String> {
    events
        .iter()
        .find_map(|event| payload_string(&event.payload, "runtime_label"))
}

pub(crate) fn resolve_agent_name(events: &[&LegacyHookEvent], is_main: bool) -> String {
    for event in events {
        if let Some(label) = control_plane_agent_label(&event.payload) {
            return label;
        }
        if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
            if let Some(mapped) = mapped_agent_type_label(&agent_type) {
                if mapped != "Session" {
                    return mapped;
                }
            }
        }
        if let Some(display_name) = &event.display_name {
            if let Some(label) = normalized_agent_label(display_name) {
                return label;
            }
        }
        if let Some(agent_name) = &event.agent_name {
            if let Some(label) = normalized_agent_label(agent_name) {
                return label;
            }
        }
        if let Some(display_name) = payload_string(&event.payload, "display_name") {
            if let Some(label) = normalized_agent_label(&display_name) {
                return label;
            }
        }
        if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
            if let Some(label) = normalized_agent_label(&agent_name) {
                return label;
            }
        }
        if let Some(responsibility) = payload_responsibility(&event.payload) {
            if let Some(label) = normalized_agent_label(&responsibility) {
                return label;
            }
        }
        if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
            if agent_type != "main" {
                return agent_type;
            }
        }
        if is_main {
            if let Some(title) = payload_string(&event.payload, "title") {
                return title;
            }
            if let Some(description) = payload_string(&event.payload, "description") {
                return description;
            }
            if let Some(cwd) = payload_string(&event.payload, "cwd") {
                if let Some(workspace) = workspace_name_from_cwd(&cwd) {
                    return workspace;
                }
            }
        }
    }
    if is_main {
        "Session".to_string()
    } else {
        "Agent".to_string()
    }
}

pub(crate) fn resolve_session_label(events: &[LegacyHookEvent], workspace_name: &str) -> String {
    if let Some(title) = events
        .iter()
        .find(|event| event.hook_event_type == "SessionTitleChanged")
        .and_then(|event| payload_string(&event.payload, "title"))
    {
        return title;
    }

    let main_events: Vec<_> = events
        .iter()
        .filter(|event| event.agent_id.is_none())
        .collect();
    let main_name = resolve_agent_name(&main_events, true);
    if main_name != "Session" && main_name != "Agent" {
        return main_name;
    }
    workspace_name.to_string()
}

pub(crate) fn resolve_assignment(events: &[&LegacyHookEvent]) -> Option<String> {
    let subagent = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "SubagentStart")
        .and_then(|event| payload_string(&event.payload, "description"));
    if let Some(description) = subagent.filter(|value| !value.trim().is_empty()) {
        return Some(truncate(&description, 100));
    }

    let delegated = events
        .iter()
        .rev()
        .find(|event| {
            event.hook_event_type == "PreToolUse"
                && payload_string(&event.payload, "tool_name").as_deref() == Some("Agent")
        })
        .and_then(|event| {
            event
                .payload
                .get("tool_input")
                .and_then(|value| value.get("description"))
                .and_then(serde_json::Value::as_str)
                .map(ToString::to_string)
        });
    if let Some(description) = delegated.filter(|value| !value.trim().is_empty()) {
        return Some(truncate(&description, 100));
    }

    let prompt = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "UserPromptSubmit")
        .and_then(|event| {
            payload_string(&event.payload, "prompt")
                .or_else(|| payload_string(&event.payload, "message"))
        });
    prompt
        .and_then(|value| clean_summary_text(&value))
        .map(|value| truncate(&value, 100))
}

pub(crate) fn resolve_current_action_from_refs(events: &[&LegacyHookEvent]) -> Option<String> {
    let latest = events.iter().rev().find(|event| {
        !matches!(
            event.hook_event_type.as_str(),
            "SessionStart" | "SessionEnd" | "SessionTitleChanged"
        )
    })?;
    if latest.hook_event_type == "SubagentStart" {
        return None;
    }
    Some(describe_legacy_event(latest))
}

pub(crate) fn resolve_session_summary(events: &[LegacyHookEvent], agents: &[AgentSnapshot]) -> Option<String> {
    let active_workers: Vec<_> = agents
        .iter()
        .filter(|agent| agent.agent_id.is_some() && agent.is_active)
        .filter_map(summarize_agent)
        .take(2)
        .collect();
    if !active_workers.is_empty() {
        return Some(active_workers.join(" · "));
    }

    let recent_workers: Vec<_> = agents
        .iter()
        .filter(|agent| agent.agent_id.is_some())
        .filter_map(summarize_agent)
        .take(2)
        .collect();
    if !recent_workers.is_empty() {
        return Some(recent_workers.join(" · "));
    }

    if let Some(summary) = latest_useful_event_summary(events) {
        return Some(summary);
    }

    let refs: Vec<_> = events.iter().collect();
    resolve_assignment(&refs)
        .or_else(|| resolve_current_action_from_refs(&refs))
        .or_else(|| active_runtime_summary(events))
}

pub(crate) fn resolve_project_summary(
    sessions: &[SessionSnapshot],
    runtime_labels: &BTreeSet<String>,
    active_session_count: usize,
) -> Option<String> {
    if let Some(summary) = sessions
        .iter()
        .find(|session| session.is_active)
        .and_then(|session| session.summary.clone())
    {
        return Some(summary);
    }
    if let Some(summary) = sessions.iter().find_map(|session| session.summary.clone()) {
        return Some(summary);
    }
    if active_session_count > 0 && !runtime_labels.is_empty() {
        return Some(format!(
            "{} active",
            runtime_labels
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if !runtime_labels.is_empty() {
        return Some(
            runtime_labels
                .iter()
                .cloned()
                .collect::<Vec<_>>()
                .join(", "),
        );
    }
    None
}

fn summarize_agent(agent: &AgentSnapshot) -> Option<String> {
    let action = agent
        .current_action
        .as_ref()
        .filter(|action| Some((*action).clone()) != agent.assignment)
        .cloned()
        .or_else(|| agent.assignment.clone());
    match action {
        Some(action) => Some(format!("{}: {}", agent.display_name, truncate(&action, 72))),
        None => Some(agent.display_name.clone()),
    }
}

fn latest_useful_event_summary(events: &[LegacyHookEvent]) -> Option<String> {
    events
        .iter()
        .rev()
        .find_map(|event| match event.hook_event_type.as_str() {
            "AssistantResponse" => payload_string(&event.payload, "text")
                .and_then(|text| clean_summary_text(&text))
                .map(|text| format!("Responded: {}", truncate(&text, 96))),
            "PostToolUse" | "PostToolUseFailure" => {
                let tool_name = payload_string(&event.payload, "tool_name")
                    .unwrap_or_else(|| "tool".to_string());
                let preview = payload_string(&event.payload, "content")
                    .and_then(|content| content_preview(&content));
                match (event.hook_event_type.as_str(), preview) {
                    ("PostToolUse", Some(content)) => {
                        if tool_name == "exec_command" {
                            Some(format!("Command completed: {}", truncate(&content, 96)))
                        } else {
                            Some(format!("{tool_name} completed: {}", truncate(&content, 96)))
                        }
                    }
                    ("PostToolUseFailure", Some(content)) => {
                        Some(format!("{tool_name} failed: {}", truncate(&content, 96)))
                    }
                    ("PostToolUse", None) => Some(format!("{tool_name} completed")),
                    ("PostToolUseFailure", None) => Some(format!("{tool_name} failed")),
                    _ => None,
                }
            }
            "UserPromptSubmit" => payload_string(&event.payload, "prompt")
                .or_else(|| payload_string(&event.payload, "message"))
                .and_then(|prompt| clean_summary_text(&prompt))
                .map(|prompt| format!("Prompted: {}", truncate(&prompt, 96))),
            _ => None,
        })
}

fn active_runtime_summary(events: &[LegacyHookEvent]) -> Option<String> {
    let latest = events
        .iter()
        .rev()
        .find(|event| event.hook_event_type == "SessionStart")?;
    let runtime = payload_string(&latest.payload, "runtime_label")
        .or_else(|| payload_string(&latest.payload, "runtime_source"))
        .unwrap_or_else(|| "Agent".to_string());
    let cwd =
        payload_string(&latest.payload, "cwd").and_then(|value| workspace_name_from_cwd(&value));
    match cwd {
        Some(workspace) => Some(format!("{runtime} active in {workspace}")),
        None => Some(format!("{runtime} active")),
    }
}

pub(crate) struct DisplayNameCandidate {
    pub(crate) value: String,
    pub(crate) score: u8,
}

pub(crate) fn display_name_candidate_for_legacy_event(event: &LegacyHookEvent) -> DisplayNameCandidate {
    if let Some(label) = control_plane_agent_label(&event.payload) {
        return DisplayNameCandidate {
            value: label,
            score: 15,
        };
    }
    if let Some(agent_type) = payload_string(&event.payload, "agent_type") {
        if let Some(mapped) = mapped_agent_type_label(&agent_type) {
            if mapped != "Session" {
                return DisplayNameCandidate {
                    value: mapped,
                    score: 9,
                };
            }
        }
    }
    if let Some(display_name) = &event.display_name {
        if let Some(label) = normalized_agent_label(display_name) {
            return DisplayNameCandidate {
                value: label,
                score: 8,
            };
        }
    }
    if let Some(display_name) = payload_string(&event.payload, "display_name") {
        if let Some(label) = normalized_agent_label(&display_name) {
            return DisplayNameCandidate {
                value: label,
                score: 7,
            };
        }
    }
    if let Some(agent_name) = &event.agent_name {
        if let Some(label) = normalized_agent_label(agent_name) {
            return DisplayNameCandidate {
                value: label,
                score: 6,
            };
        }
    }
    if let Some(agent_name) = payload_string(&event.payload, "agent_name") {
        if let Some(label) = normalized_agent_label(&agent_name) {
            return DisplayNameCandidate {
                value: label,
                score: 5,
            };
        }
    }
    if let Some(responsibility) = payload_responsibility(&event.payload) {
        if let Some(label) = normalized_agent_label(&responsibility) {
            return DisplayNameCandidate {
                value: label,
                score: 4,
            };
        }
    }
    if let Some(description) = payload_string(&event.payload, "description") {
        let trimmed = description.trim();
        if !trimmed.is_empty() {
            if let Some(label) = normalized_agent_label(trimmed) {
                return DisplayNameCandidate {
                    value: label,
                    score: 3,
                };
            }
        }
    }
    if let Some(title) = payload_string(&event.payload, "title") {
        return DisplayNameCandidate {
            value: title,
            score: 2,
        };
    }
    if event.agent_id.is_none() {
        return DisplayNameCandidate {
            value: event.source_app.clone(),
            score: 1,
        };
    }
    DisplayNameCandidate {
        value: "Agent".to_string(),
        score: 0,
    }
}

fn normalized_agent_label(value: &str) -> Option<String> {
    let normalized = value.replace('\n', " ").replace('\t', " ");
    let compact = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = compact.trim();
    if trimmed.is_empty() || is_noisy_agent_label(trimmed) {
        return None;
    }
    Some(trimmed.to_string())
}

fn is_noisy_agent_label(value: &str) -> bool {
    let compact = value.trim();
    if compact.is_empty() {
        return true;
    }
    if compact.len() > 48 {
        return true;
    }
    if compact.split_whitespace().count() > 6 {
        return true;
    }
    if compact.contains('<') || compact.contains('>') || compact.contains('[') || compact.contains(']') {
        return true;
    }
    let lowered = compact.to_ascii_lowercase();
    lowered.starts_with("respond ")
        || lowered.starts_with("build ")
        || lowered.starts_with("write ")
        || lowered.starts_with("fix ")
        || lowered.starts_with("investigate ")
        || lowered.starts_with("update ")
        || lowered.starts_with("user ")
        || lowered.starts_with("prompt ")
        || lowered.starts_with("message ")
}

fn mapped_agent_type_label(agent_type: &str) -> Option<String> {
    let normalized = agent_type.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    let mapped = match normalized.as_str() {
        "team-reviewer" | "code-reviewer" => Some("Code Reviewer"),
        "reviewer" => Some("Reviewer"),
        "architect" => Some("Architect"),
        "coder" => Some("Coder"),
        "security-architect" => Some("Security Architect"),
        "researcher" => Some("Researcher"),
        "optimizer" => Some("Optimizer"),
        "documenter" => Some("Documenter"),
        "queen-coordinator" => Some("Queen Coordinator"),
        "memory-specialist" => Some("Memory Specialist"),
        "perf-engineer" => Some("Perf Engineer"),
        "pr-review-toolkit" => Some("PR Review Toolkit"),
        "full-stack-orchestrator" => Some("Full Stack Orchestrator"),
        "general-purpose" => Some("General Purpose"),
        "orchestrator" => Some("Orchestrator"),
        "explorer" | "explore" => Some("Explorer"),
        "cursor_subagent" => Some("Cursor Helper"),
        "main" => Some("Session"),
        _ => None,
    };
    if let Some(value) = mapped {
        return Some(value.to_string());
    }
    let words = normalized
        .replace('_', "-")
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            if let Some(first) = chars.next() {
                format!("{}{}", first.to_uppercase(), chars.as_str())
            } else {
                String::new()
            }
        })
        .collect::<Vec<_>>();
    if words.is_empty() {
        None
    } else {
        Some(words.join(" "))
    }
}
