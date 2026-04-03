import type { HookEvent } from '../types';

/**
 * Convert a HookEvent into a plain-English one-line description.
 * Shared between SimpleEventRow and AgentEventGroup.
 */
export function describeEvent(event: HookEvent): string {
  const type = event.hook_event_type;
  const toolName = event.payload?.tool_name || 'unknown';
  const command = event.payload?.tool_input?.command;

  switch (type) {
    case 'PreToolUse': {
      const toolInput = event.payload?.tool_input || {};
      if (toolName === 'Bash' && toolInput.command) {
        const cmd = String(toolInput.command).slice(0, 80);
        return cmd + (String(toolInput.command).length > 80 ? '...' : '');
      }
      if (['Read', 'Edit', 'Write'].includes(toolName) && toolInput.file_path) {
        const verb = toolName === 'Read' ? 'reading' : toolName === 'Edit' ? 'editing' : 'writing';
        const path = String(toolInput.file_path).split('/').slice(-3).join('/');
        return `${verb} ${path}`;
      }
      if (['Grep', 'Glob'].includes(toolName) && toolInput.pattern) {
        return `searching: ${toolInput.pattern}`;
      }
      if (toolName === 'Agent') {
        const desc = toolInput.description || toolInput.prompt?.slice(0, 60) || '';
        return desc ? `spawning agent: ${desc}` : 'spawning agent';
      }
      // Fallback for Bash without command in tool_input
      if (toolName === 'Bash' && command) {
        const snippet = String(command).slice(0, 80);
        return snippet + (String(command).length > 80 ? '...' : '');
      }
      return `using ${toolName}`;
    }
    case 'PostToolUse':
      return `completed ${toolName}`;
    case 'PostToolUseFailure':
      return `${toolName} failed`;
    case 'SessionStart':
      return 'session started';
    case 'SessionEnd':
      return 'session ended';
    case 'SubagentStart': {
      const agentType = event.payload?.agent_type || event.agent_type || '';
      return agentType ? `spawned sub-agent ${agentType}` : 'spawned sub-agent';
    }
    case 'SubagentStop':
      return 'finished';
    case 'Notification': {
      const notifType = event.payload?.type || '';
      return notifType ? `notification: ${notifType}` : 'notification';
    }
    case 'PermissionRequest':
      return `requesting permission for ${toolName}`;
    case 'PreCompact':
      return 'compacting context';
    case 'Stop':
      return 'finished';
    case 'UserPromptSubmit': {
      const prompt = event.payload?.prompt || event.payload?.message || '';
      if (prompt) {
        const snippet = String(prompt).slice(0, 80);
        return `user prompt: ${snippet}${String(prompt).length > 80 ? '...' : ''}`;
      }
      return 'user prompt submitted';
    }
    case 'AssistantResponse': {
      const text = event.payload?.text || '';
      if (text) {
        const snippet = String(text).slice(0, 80);
        return snippet + (String(text).length > 80 ? '...' : '');
      }
      return 'assistant response';
    }
    case 'SessionTitleChanged': {
      const title = event.payload?.title || '';
      return title ? `session title: ${title}` : 'session title changed';
    }
    default:
      return type || 'event';
  }
}
