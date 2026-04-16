import type { HookEvent } from '../types';
import type { EventDescription } from './types';
import {
  mapAgentTypeLabel,
  resolveHybridAgentName,
  responsibilityFromPayload,
} from '../agentNaming';
import { formatRuntimeLabel } from './labels';
import {
  basename,
  composeRuntimeDetail,
  describeMemoryOperation,
  extractCommand,
  extractContentPreview,
  extractFileTarget,
  extractMcpToolCall,
  extractPatchedFile,
  friendlyToolName,
  truncate,
} from './text';

/** Plain-language description plus secondary detail for the event */
export function describeEventDescription(event: HookEvent): EventDescription {
  const type = event.hook_event_type;
  const p = (event.payload || {}) as Record<string, unknown>;
  const runtime = formatRuntimeLabel(p.runtime_label as string | undefined);
  const toolName = (typeof p.tool_name === 'string' ? p.tool_name : undefined) || 'unknown';
  const toolInput = (p.tool_input && typeof p.tool_input === 'object' && !Array.isArray(p.tool_input)
    ? (p.tool_input as Record<string, unknown>)
    : {}) as Record<string, unknown>;

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
        const verb =
          toolName === 'Read' ? 'Reading a file' : toolName === 'Edit' ? 'Editing a file' : 'Writing a file';
        return {
          primary: verb,
          secondary: composeRuntimeDetail(runtime, fileTarget),
        };
      }
      if (toolName === 'apply_patch') {
        const patch =
          typeof toolInput?.patch === 'string'
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
          secondary: composeRuntimeDetail(runtime, String(toolInput.pattern)),
        };
      }
      if (toolName === 'Agent') {
        const description = toolInput?.description;
        return {
          primary: 'Handing off work to another agent',
          secondary: composeRuntimeDetail(
            runtime,
            typeof description === 'string' ? truncate(description, 80) : undefined,
          ),
        };
      }
      if (toolName === 'send_input' && toolInput?.message) {
        return {
          primary: 'Sending a message',
          secondary: composeRuntimeDetail(runtime, truncate(String(toolInput.message), 80)),
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
      if (toolName === 'CallMcpTool') {
        const { server, toolName: mcpToolName } = extractMcpToolCall(toolInput);
        const serverLc = (server || '').toLowerCase();
        const isMemoryServer =
          serverLc === 'ai-memory-brain' ||
          serverLc === 'user-ai-memory-brain' ||
          serverLc.endsWith('ai-memory-brain');
        const isLibrarian = serverLc.includes('librarian');
        if (isLibrarian) {
          const memoryOperation =
            describeMemoryOperation(mcpToolName) ||
            (mcpToolName ? mcpToolName.replace(/_/g, ' ') : null) ||
            'Memory operation';
          return {
            primary: `Librarian: ${memoryOperation}`,
            secondary: composeRuntimeDetail(runtime, mcpToolName || server),
          };
        }
        if (isMemoryServer || (mcpToolName || '').startsWith('memory_')) {
          const memoryOperation = describeMemoryOperation(mcpToolName) || 'Memory operation';
          return {
            primary: `Memory brain: ${memoryOperation}`,
            secondary: composeRuntimeDetail(runtime, mcpToolName || server),
          };
        }
        if (server || mcpToolName) {
          return {
            primary: 'Calling MCP tool',
            secondary: composeRuntimeDetail(runtime, [server, mcpToolName].filter(Boolean).join('/')),
          };
        }
      }
      if (toolName === 'FetchMcpResource') {
        const server = typeof toolInput.server === 'string' ? toolInput.server : undefined;
        const uri = typeof toolInput.uri === 'string' ? toolInput.uri : undefined;
        return {
          primary: 'Fetching MCP resource',
          secondary: composeRuntimeDetail(runtime, [server, uri].filter(Boolean).join(' · ')),
        };
      }
      if (toolName === 'ListMcpResources') {
        const server = typeof toolInput.server === 'string' ? toolInput.server : undefined;
        return {
          primary: 'Listing MCP resources',
          secondary: composeRuntimeDetail(runtime, server),
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
        if (toolName === 'CallMcpTool') {
          return {
            primary: 'MCP call finished',
            secondary: composeRuntimeDetail(runtime, truncate(contentPreview, 80)),
          };
        }
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
        primary: p.title ? `Watching ${truncate(String(p.title), 80)}` : 'Watching the session',
        secondary: composeRuntimeDetail(runtime),
      };
    case 'SessionEnd':
      return {
        primary: 'Session ended',
        secondary: composeRuntimeDetail(runtime),
      };
    case 'SubagentStart': {
      const rawAgentLabel = resolveHybridAgentName({
        responsibility: responsibilityFromPayload(p),
        agentType:
          (typeof p.agent_type === 'string' ? p.agent_type : undefined) || event.agent_type,
        displayName:
          (typeof p.display_name === 'string' ? p.display_name : undefined) || event.display_name,
        agentName:
          (typeof p.agent_name === 'string' ? p.agent_name : undefined) || event.agent_name,
        fallback: mapAgentTypeLabel(event.agent_type) || 'Agent',
      });
      const agentLabel = rawAgentLabel === 'Agent' ? 'a helper agent' : rawAgentLabel;
      if (p.description) {
        return {
          primary: `Started ${agentLabel}`,
          secondary: composeRuntimeDetail(runtime, truncate(String(p.description), 80)),
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
      const prompt = String(p.prompt || p.message || '');
      return {
        primary: prompt ? `You asked: ${truncate(prompt, 72)}` : 'You asked for help',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'AssistantResponse': {
      const text = String(p.text || '');
      return {
        primary: text ? truncate(text, 90) : 'Shared an update',
        secondary: composeRuntimeDetail(runtime),
      };
    }
    case 'SessionTitleChanged':
      return {
        primary: p.title ? `Renamed the session to ${truncate(String(p.title), 80)}` : 'Renamed the session',
        secondary: composeRuntimeDetail(runtime, p.title ? String(p.title) : undefined),
      };
    default:
      return {
        primary: 'Observed an event',
        secondary: composeRuntimeDetail(runtime, type || undefined),
      };
  }
}

/** One-line description of an event, optimized for operator scanning */
export function describeEvent(event: HookEvent): string {
  return describeEventDescription(event).primary;
}

/** Secondary technical detail for an event, when available */
export function describeEventDetail(event: HookEvent): string | undefined {
  return describeEventDescription(event).secondary;
}
