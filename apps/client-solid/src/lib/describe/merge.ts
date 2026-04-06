import type { HookEvent } from '../types';
import { formatRuntimeLabel } from './labels';
import { describeEventDescription } from './eventDescriptions';

export function mergeSimpleRowSummary(events: HookEvent | HookEvent[]): string {
  const evts = Array.isArray(events) ? events : [events];
  if (evts.length === 0) return '';
  if (evts.length === 1) {
    return describeEventDescription(evts[0]).primary;
  }

  const types = new Set(evts.map((event) => event.hook_event_type));
  if (types.size === 1) {
    const [type] = Array.from(types);
    const first = evts[0];
    const payload = (first.payload || {}) as Record<string, unknown>;
    const runtime = formatRuntimeLabel(payload.runtime_label as string | undefined);
    const runtimeSuffix = runtime ? ` · ${runtime}` : '';

    if (type === 'PreToolUse') {
      const toolName = (typeof payload.tool_name === 'string' ? payload.tool_name : undefined) || 'unknown';
      if (toolName === 'Bash' || toolName === 'exec_command' || toolName === 'Shell') {
        return `${evts.length} shell steps${runtimeSuffix}`;
      }
      if (['Read', 'Edit', 'Write'].includes(toolName)) {
        return `${evts.length} file ${evts.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (toolName === 'apply_patch') {
        return `${evts.length} patch ${evts.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (['Grep', 'Glob'].includes(toolName)) {
        return `${evts.length} search ${evts.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (toolName === 'Agent') {
        return `${evts.length} delegations${runtimeSuffix}`;
      }
      if (toolName === 'send_input') {
        return `${evts.length} messages sent${runtimeSuffix}`;
      }
      if (toolName === 'wait_agent') {
        return `${evts.length} waits for helpers${runtimeSuffix}`;
      }
      if (toolName === 'TodoWrite') {
        return `${evts.length} plan updates${runtimeSuffix}`;
      }
    }

    if (type === 'PostToolUse') {
      return `${evts.length} tool completions${runtimeSuffix}`;
    }
    if (type === 'PostToolUseFailure') {
      return `${evts.length} tool failures${runtimeSuffix}`;
    }
    if (type === 'AssistantResponse') {
      return `${evts.length} replies${runtimeSuffix}`;
    }
    if (type === 'UserPromptSubmit') {
      return `${evts.length} prompts${runtimeSuffix}`;
    }
    if (type === 'SubagentStart') {
      return `${evts.length} helper starts${runtimeSuffix}`;
    }
    if (type === 'SubagentStop') {
      return `${evts.length} helper finishes${runtimeSuffix}`;
    }
  }

  return `${evts.length} grouped events`;
}
