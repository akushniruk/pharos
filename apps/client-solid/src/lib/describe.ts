import type { HookEvent } from './types';

/** One-line description of an event */
export function describeEvent(event: HookEvent): string {
  const type = event.hook_event_type;
  const p = event.payload || {};
  const toolName = p.tool_name || 'unknown';

  switch (type) {
    case 'PreToolUse': {
      if (toolName === 'Bash' && p.tool_input?.command) {
        return `Running ${truncate(p.tool_input.command, 72)}`;
      }
      if (['Read', 'Edit', 'Write'].includes(toolName) && p.tool_input?.file_path) {
        const verb = toolName === 'Read' ? 'Reading' : toolName === 'Edit' ? 'Editing' : 'Writing';
        const path = String(p.tool_input.file_path).split('/').slice(-3).join('/');
        return `${verb} ${path}`;
      }
      if (['Grep', 'Glob'].includes(toolName) && p.tool_input?.pattern) {
        return `Searching: ${p.tool_input.pattern}`;
      }
      if (toolName === 'Agent') {
        const description = p.tool_input?.description;
        return description ? `Delegating: ${truncate(description, 72)}` : 'Delegating work';
      }
      return `Using ${toolName}`;
    }
    case 'PostToolUse':
      return `${toolName} completed`;
    case 'PostToolUseFailure':
      return `${toolName} failed`;
    case 'SessionStart':
      return p.title ? `Watching ${truncate(p.title, 80)}` : 'Session observed';
    case 'SessionEnd':
      return 'Session ended';
    case 'SubagentStart': {
      const agentLabel =
        p.display_name || p.agent_name || p.agent_type || event.agent_name || event.agent_type || 'Agent';
      if (p.description) {
        return `Spawned ${agentLabel} to ${truncate(p.description, 72)}`;
      }
      return `Spawned ${agentLabel}`;
    }
    case 'SubagentStop':
      return 'Subagent finished';
    case 'UserPromptSubmit': {
      const prompt = p.prompt || p.message || '';
      return prompt ? `Prompted: ${truncate(prompt, 72)}` : 'User prompt';
    }
    case 'AssistantResponse': {
      const text = p.text || '';
      return text ? `Responded: ${truncate(text, 72)}` : 'Response';
    }
    case 'SessionTitleChanged':
      return p.title || 'Title changed';
    default:
      return type || 'event';
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
