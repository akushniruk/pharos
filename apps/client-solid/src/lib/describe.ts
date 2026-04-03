import type { HookEvent } from './types';

export interface EventDescription {
  primary: string;
  secondary?: string;
}

/** One-line description of an event, optimized for operator scanning */
export function describeEvent(event: HookEvent): string {
  return describeEventDescription(event).primary;
}

/** Secondary technical detail for an event, when available */
export function describeEventDetail(event: HookEvent): string | undefined {
  return describeEventDescription(event).secondary;
}

/** Plain-language description plus secondary detail for the event */
export function describeEventDescription(event: HookEvent): EventDescription {
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
          return {
            primary: `Running a command in ${workdir}`,
            secondary: command,
          };
        }
        return {
          primary: 'Running a command',
          secondary: command,
        };
      }
      const fileTarget = extractFileTarget(toolInput);
      if (['Read', 'Edit', 'Write'].includes(toolName) && fileTarget) {
        const verb = toolName === 'Read' ? 'Reading a file' : toolName === 'Edit' ? 'Editing a file' : 'Writing a file';
        return {
          primary: verb,
          secondary: fileTarget,
        };
      }
      if (toolName === 'apply_patch') {
        const patch = typeof toolInput?.patch === 'string'
          ? toolInput.patch
          : typeof toolInput?.input === 'string'
            ? toolInput.input
            : '';
        const target = extractPatchedFile(patch);
        return {
          primary: 'Updating files',
          secondary: target ?? undefined,
        };
      }
      if (['Grep', 'Glob'].includes(toolName) && toolInput?.pattern) {
        return {
          primary: 'Searching for matches',
          secondary: toolInput.pattern,
        };
      }
      if (toolName === 'Agent') {
        const description = toolInput?.description;
        return {
          primary: 'Handing off work to another agent',
          secondary: description ? truncate(description, 80) : undefined,
        };
      }
      if (toolName === 'send_input' && toolInput?.message) {
        return {
          primary: 'Sending a message',
          secondary: truncate(toolInput.message, 80),
        };
      }
      if (toolName === 'wait_agent') {
        return {
          primary: 'Waiting for a helper agent to finish',
        };
      }
      return {
        primary: 'Using a tool',
        secondary: toolName !== 'unknown' ? toolName : undefined,
      };
    }
    case 'PostToolUse': {
      const contentPreview = extractContentPreview(p.content);
      if (toolName === 'exec_command' && contentPreview) {
        return {
          primary: 'Finished the command',
          secondary: truncate(contentPreview, 80),
        };
      }
      if (contentPreview) {
        return {
          primary: 'Finished using a tool',
          secondary: truncate(contentPreview, 80),
        };
      }
      return {
        primary: 'Finished using a tool',
        secondary: toolName !== 'unknown' ? toolName : undefined,
      };
    }
    case 'PostToolUseFailure': {
      const contentPreview = extractContentPreview(p.content);
      if (contentPreview) {
        return {
          primary: toolName === 'exec_command' ? 'Command failed' : 'A tool call failed',
          secondary: truncate(contentPreview, 80),
        };
      }
      return {
        primary: toolName === 'exec_command' ? 'Command failed' : 'A tool call failed',
        secondary: toolName !== 'unknown' ? toolName : undefined,
      };
    }
    case 'SessionStart':
      return {
        primary: p.title ? `Watching ${truncate(p.title, 80)}` : 'Watching the session',
        secondary: typeof p.runtime_label === 'string' && p.runtime_label.trim()
          ? `${p.runtime_label.trim()} runtime`
          : undefined,
      };
    case 'SessionEnd':
      return {
        primary: 'Session ended',
        secondary: typeof p.runtime_label === 'string' && p.runtime_label.trim()
          ? `${p.runtime_label.trim()} runtime`
          : undefined,
      };
    case 'SubagentStart': {
      const rawAgentLabel =
        p.display_name || p.agent_name || p.agent_type || event.agent_name || event.agent_type || 'Agent';
      const agentLabel = rawAgentLabel === 'Agent' ? 'a helper agent' : rawAgentLabel;
      if (p.description) {
        return {
          primary: `Started ${agentLabel}`,
          secondary: truncate(p.description, 80),
        };
      }
      return {
        primary: `Started ${agentLabel}`,
      };
    }
    case 'SubagentStop':
      return {
        primary: 'Helper agent finished',
      };
    case 'UserPromptSubmit': {
      const prompt = p.prompt || p.message || '';
      return {
        primary: 'Captured a request',
        secondary: prompt ? truncate(prompt, 80) : undefined,
      };
    }
    case 'AssistantResponse': {
      const text = p.text || '';
      return {
        primary: 'Shared an update',
        secondary: text ? truncate(text, 80) : undefined,
      };
    }
    case 'SessionTitleChanged':
      return {
        primary: p.title ? `Renamed the session to ${truncate(p.title, 80)}` : 'Renamed the session',
        secondary: p.title ? p.title : undefined,
      };
    default:
      return {
        primary: 'Observed an event',
        secondary: type || undefined,
      };
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
