import type { HookEvent } from '../types';
import { formatRuntimeLabel } from './labels';
import { describeEventDescription } from './eventDescriptions';

export function mergeSimpleRowSummary(events: HookEvent[]): string {
  if (events.length === 0) return '';
  if (events.length === 1) {
    return describeEventDescription(events[0]).primary;
  }

  const types = new Set(events.map((event) => event.hook_event_type));
  if (types.size === 1) {
    const [type] = Array.from(types);
    const first = events[0];
    const payload = (first.payload || {}) as Record<string, unknown>;
    const runtime = formatRuntimeLabel(payload.runtime_label as string | undefined);
    const runtimeSuffix = runtime ? ` · ${runtime}` : '';

    if (type === 'PreToolUse') {
      const toolName = (typeof payload.tool_name === 'string' ? payload.tool_name : undefined) || 'unknown';
      if (toolName === 'Bash' || toolName === 'exec_command' || toolName === 'Shell') {
        return `${events.length} shell steps${runtimeSuffix}`;
      }
      if (['Read', 'Edit', 'Write'].includes(toolName)) {
        return `${events.length} file ${events.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (toolName === 'apply_patch') {
        return `${events.length} patch ${events.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (['Grep', 'Glob'].includes(toolName)) {
        return `${events.length} search ${events.length === 1 ? 'step' : 'steps'}${runtimeSuffix}`;
      }
      if (toolName === 'Agent') {
        return `${events.length} delegations${runtimeSuffix}`;
      }
      if (toolName === 'send_input') {
        return `${events.length} messages sent${runtimeSuffix}`;
      }
      if (toolName === 'wait_agent') {
        return `${events.length} waits for helpers${runtimeSuffix}`;
      }
      if (toolName === 'TodoWrite') {
        return `${events.length} plan updates${runtimeSuffix}`;
      }
    }

    if (type === 'PostToolUse') {
      return `${events.length} tool completions${runtimeSuffix}`;
    }
    if (type === 'PostToolUseFailure') {
      return `${events.length} tool failures${runtimeSuffix}`;
    }
    if (type === 'AssistantResponse') {
      return `${events.length} replies${runtimeSuffix}`;
    }
    if (type === 'UserPromptSubmit') {
      return `${events.length} prompts${runtimeSuffix}`;
    }
    if (type === 'SubagentStart') {
      return `${events.length} helper starts${runtimeSuffix}`;
    }
    if (type === 'SubagentStop') {
      return `${events.length} helper finishes${runtimeSuffix}`;
    }
  }

  return `${events.length} grouped events`;
}
