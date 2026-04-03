import type { HookEvent } from './types';

/** One-line description of an event */
export function describeEvent(event: HookEvent): string {
  const type = event.hook_event_type;
  const p = event.payload || {};
  const toolName = p.tool_name || 'unknown';
  const toolInput = p.tool_input || {};

  switch (type) {
    case 'PreToolUse': {
      const command = extractCommand(toolInput);
      if ((toolName === 'Bash' || toolName === 'exec_command') && command) {
        const workdir = typeof toolInput?.workdir === 'string' ? basename(toolInput.workdir) : null;
        if (workdir) {
          return `Running ${truncate(command, 64)} in ${workdir}`;
        }
        return `Running ${truncate(command, 72)}`;
      }
      const fileTarget = extractFileTarget(toolInput);
      if (['Read', 'Edit', 'Write'].includes(toolName) && fileTarget) {
        const verb = toolName === 'Read' ? 'Reading' : toolName === 'Edit' ? 'Editing' : 'Writing';
        return `${verb} ${fileTarget}`;
      }
      if (toolName === 'apply_patch') {
        const patch = typeof toolInput?.patch === 'string'
          ? toolInput.patch
          : typeof toolInput?.input === 'string'
            ? toolInput.input
            : '';
        const target = extractPatchedFile(patch);
        return target ? `Patching ${target}` : 'Applying patch';
      }
      if (['Grep', 'Glob'].includes(toolName) && toolInput?.pattern) {
        return `Searching: ${toolInput.pattern}`;
      }
      if (toolName === 'Agent') {
        const description = toolInput?.description;
        return description ? `Delegating: ${truncate(description, 72)}` : 'Delegating work';
      }
      if (toolName === 'send_input' && toolInput?.message) {
        return `Sending: ${truncate(toolInput.message, 72)}`;
      }
      if (toolName === 'wait_agent') {
        return 'Waiting for subagent';
      }
      return `Using ${toolName}`;
    }
    case 'PostToolUse': {
      const contentPreview = extractContentPreview(p.content);
      if (toolName === 'exec_command' && contentPreview) {
        return `Command completed: ${truncate(contentPreview, 72)}`;
      }
      if (contentPreview) {
        return `${toolName} completed: ${truncate(contentPreview, 72)}`;
      }
      return `${toolName} completed`;
    }
    case 'PostToolUseFailure': {
      const contentPreview = extractContentPreview(p.content);
      if (contentPreview) {
        return `${toolName} failed: ${truncate(contentPreview, 72)}`;
      }
      return `${toolName} failed`;
    }
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

function extractCommand(toolInput: Record<string, any>): string | null {
  const candidate = toolInput?.cmd ?? toolInput?.command;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  if (Array.isArray(candidate)) {
    const parts = candidate
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  return null;
}

function extractFileTarget(toolInput: Record<string, any>): string | null {
  const candidate = toolInput?.file_path ?? toolInput?.path ?? toolInput?.file;
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  return candidate.split('/').slice(-3).join('/');
}

function extractPatchedFile(patch: string): string | null {
  const match = patch.match(/\*\*\* (?:Add|Update|Delete) File: (.+)/);
  if (!match) {
    return null;
  }
  return match[1].split('/').slice(-3).join('/');
}

function extractContentPreview(content: unknown): string | null {
  if (typeof content !== 'string') {
    return null;
  }
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || null;
}

function basename(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
