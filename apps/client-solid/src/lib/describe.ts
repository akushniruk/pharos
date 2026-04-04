import type { HookEvent } from './types';

export interface EventDescription {
  primary: string;
  secondary?: string;
}

export function sortedPayloadEntries(
  payload: Record<string, unknown> | null | undefined,
): Array<[string, unknown]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload).sort(([left], [right]) => left.localeCompare(right));
}

export function isPayloadContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || (typeof value === 'object' && value !== null);
}

export function formatPayloadScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'undefined') return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function simpleEventKindLabel(type: string): string {
  switch (type) {
    case 'UserPromptSubmit':
      return 'You';
    case 'AssistantResponse':
      return 'Reply';
    case 'PreToolUse':
      return 'Doing';
    case 'PostToolUse':
      return 'Done';
    case 'PostToolUseFailure':
      return 'Failed';
    case 'SubagentStart':
      return 'Delegated';
    case 'SubagentStop':
      return 'Completed';
    default:
      return 'Update';
  }
}

export function mergeSimpleRowSummary(event: HookEvent, maxLen = 120): string {
  const description = describeEventDescription(event);
  const primary = description.primary.trim();
  const secondary = description.secondary?.trim();
  if (!secondary || primary.toLowerCase().includes(secondary.toLowerCase())) {
    return truncate(primary, maxLen);
  }
  const joined = `${primary} - ${secondary}`;
  if (joined.length <= maxLen) return joined;
  return truncate(joined, maxLen);
}

/** Trust signal: observed vs managed acquisition; unknown or absent values yield no label */
export function formatAcquisitionModeLabel(mode?: string | null): string | undefined {
  if (typeof mode !== 'string') return undefined;
  const normalized = mode
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;

  const first = normalized.split(' ')[0];
  if (!first || first === 'unknown') return undefined;

  if (first === 'observed') return 'Observed';
  if (first === 'managed') return 'Managed';

  return undefined;
}

export function formatRuntimeLabel(label?: string | null): string | undefined {
  if (typeof label !== 'string') return undefined;
  const normalized = label.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!normalized) return undefined;

  if (normalized.includes('claude')) return 'Claude';
  if (normalized.includes('codex')) return 'Codex';
  if (normalized.includes('gemini')) return 'Gemini';
  if (normalized.includes('cursor')) return 'Cursor';

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
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
  const runtime = formatRuntimeLabel(p.runtime_label);
  const toolName = p.tool_name || 'unknown';
  const toolInput = p.tool_input || {};

  switch (type) {
    case 'PreToolUse': {
      const command = extractCommand(toolInput);
      if ((toolName === 'Bash' || toolName === 'exec_command' || toolName === 'Shell') && command) {
        const workdir = typeof toolInput?.workdir === 'string' ? basename(toolInput.workdir) : null;
        if (workdir) {
          return {
            primary: `Running a task in ${workdir}`,
            secondary: composeRuntimeDetail(runtime, command),
          };
        }
        return {
          primary: 'Running a task',
          secondary: composeRuntimeDetail(runtime, command),
        };
      }
      const fileTarget = extractFileTarget(toolInput);
      if (['Read', 'Edit', 'Write'].includes(toolName) && fileTarget) {
        const verb = toolName === 'Read' ? 'Reading a file' : toolName === 'Edit' ? 'Editing a file' : 'Writing a file';
        return {
          primary: verb,
          secondary: composeRuntimeDetail(runtime, fileTarget),
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
          secondary: composeRuntimeDetail(runtime, target),
        };
      }
      if (['Grep', 'Glob'].includes(toolName) && toolInput?.pattern) {
        return {
          primary: 'Searching for matches',
          secondary: composeRuntimeDetail(runtime, toolInput.pattern),
        };
      }
      if (toolName === 'Agent') {
        const description = toolInput?.description;
        return {
          primary: 'Handing off work to another agent',
          secondary: composeRuntimeDetail(runtime, description ? truncate(description, 80) : undefined),
        };
      }
      if (toolName === 'send_input' && toolInput?.message) {
        return {
          primary: 'Sending a message',
          secondary: composeRuntimeDetail(runtime, truncate(toolInput.message, 80)),
        };
      }
      if (toolName === 'wait_agent') {
        return {
          primary: 'Waiting for a helper agent to finish',
          secondary: composeRuntimeDetail(runtime),
        };
      }
      if (toolName === 'TodoWrite') {
        return {
          primary: 'Updating the plan',
          secondary: composeRuntimeDetail(runtime),
        };
      }
      return {
        primary: toolName !== 'unknown' ? `Using ${friendlyToolName(toolName)}` : 'Working on your request',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'PostToolUse': {
      const contentPreview = extractContentPreview(p.content);
      if (toolName === 'exec_command' && contentPreview) {
        return {
          primary: 'Finished the command',
          secondary: composeRuntimeDetail(runtime, truncate(contentPreview, 80)),
        };
      }
      if (contentPreview) {
        return {
          primary: 'Finished using a tool',
          secondary: composeRuntimeDetail(runtime, truncate(contentPreview, 80)),
        };
      }
      return {
        primary: 'Step finished',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'PostToolUseFailure': {
      const contentPreview = extractContentPreview(p.content);
      if (contentPreview) {
        return {
          primary: toolName === 'exec_command' ? 'Command failed' : 'A tool call failed',
          secondary: composeRuntimeDetail(runtime, truncate(contentPreview, 80)),
        };
      }
      return {
        primary: toolName === 'exec_command' ? 'Command failed' : 'Step failed',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'SessionStart':
      return {
        primary: p.title ? `Watching ${truncate(p.title, 80)}` : 'Watching the session',
        secondary: composeRuntimeDetail(runtime),
      };
    case 'SessionEnd':
      return {
        primary: 'Session ended',
        secondary: composeRuntimeDetail(runtime),
      };
    case 'SubagentStart': {
      const rawAgentLabel =
        p.display_name || p.agent_name || p.agent_type || event.agent_name || event.agent_type || 'Agent';
      const agentLabel = rawAgentLabel === 'Agent' ? 'a helper agent' : rawAgentLabel;
      if (p.description) {
        return {
          primary: `Started ${agentLabel}`,
          secondary: composeRuntimeDetail(runtime, truncate(p.description, 80)),
        };
      }
      return {
        primary: `Started ${agentLabel}`,
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'SubagentStop':
      return {
        primary: 'Helper agent finished',
        secondary: composeRuntimeDetail(runtime),
      };
    case 'UserPromptSubmit': {
      const prompt = p.prompt || p.message || '';
      return {
        primary: prompt ? `You asked: ${truncate(prompt, 72)}` : 'You asked for help',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'AssistantResponse': {
      const text = p.text || '';
      return {
        primary: text ? truncate(text, 90) : 'Shared an update',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'SessionTitleChanged':
      return {
        primary: p.title ? `Renamed the session to ${truncate(p.title, 80)}` : 'Renamed the session',
        secondary: composeRuntimeDetail(runtime, p.title ? p.title : undefined),
      };
    default:
      return {
        primary: 'Observed an event',
        secondary: composeRuntimeDetail(runtime, type || undefined),
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

function composeRuntimeDetail(runtime: string | undefined, detail?: string | null): string | undefined {
  const trimmedDetail = detail?.trim();
  if (runtime && trimmedDetail) {
    return `${runtime} runtime · ${trimmedDetail}`;
  }
  if (runtime) {
    return `${runtime} runtime`;
  }
  return trimmedDetail || undefined;
}

function friendlyToolName(toolName: string): string {
  const map: Record<string, string> = {
    readfile: 'file read',
    read: 'file read',
    edit: 'file edit',
    write: 'file write',
    shell: 'terminal command',
    exec_command: 'terminal command',
    grep: 'search',
    glob: 'file search',
    todowrite: 'plan update',
    agent: 'helper delegation',
    subagent: 'helper delegation',
  };
  const normalized = toolName.trim().toLowerCase();
  return map[normalized] || toolName;
}
