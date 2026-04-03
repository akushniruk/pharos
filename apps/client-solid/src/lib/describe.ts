import type { HookEvent } from './types';

/** One-line description of an event */
export function describeEvent(event: HookEvent): string {
  const type = event.hook_event_type;
  const p = event.payload || {};
  const toolName = p.tool_name || 'unknown';

  switch (type) {
    case 'PreToolUse': {
      if (toolName === 'Bash' && p.tool_input?.command) {
        return truncate(p.tool_input.command, 80);
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
        return p.tool_input?.description || 'Spawning agent';
      }
      return `Using ${toolName}`;
    }
    case 'PostToolUse':
      return `${toolName} done`;
    case 'PostToolUseFailure':
      return `${toolName} failed`;
    case 'SessionStart':
      return 'Session started';
    case 'SessionEnd':
      return 'Session ended';
    case 'SubagentStart': {
      const agentType = p.agent_type || event.agent_type || '';
      return agentType ? `Spawned ${agentType}` : 'Spawned agent';
    }
    case 'SubagentStop':
      return 'Agent finished';
    case 'UserPromptSubmit': {
      const prompt = p.prompt || p.message || '';
      return prompt ? `"${truncate(prompt, 80)}"` : 'User prompt';
    }
    case 'AssistantResponse': {
      const text = p.text || '';
      return text ? truncate(text, 80) : 'Response';
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
