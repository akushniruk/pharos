import type { HookEvent } from '../../lib/types';
import {
  describeEvent,
  describeEventDetail,
  mergeSimpleRowSummary,
  simpleEventKindLabel,
} from '../../lib/describe';
import { timeAgo } from '../../lib/time';

export const EVENT_STREAM_EVENT_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'UserPromptSubmit',
  'AssistantResponse',
  'SubagentStart',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
  'SessionTitleChanged',
] as const;

export const EVENT_STREAM_DETAIL_MODE_KEY = 'pharos.event-stream.detail-mode';

export function attentionEventKey(event: HookEvent): string {
  return `${event.session_id}\u001f${event.timestamp}\u001f${event.hook_event_type}\u001f${event.agent_id ?? ''}`;
}

export function searchableEventText(event: HookEvent): string {
  const payload = event.payload || {};
  const textFields: string[] = [];
  if (typeof payload.prompt === 'string') textFields.push(payload.prompt);
  if (typeof payload.message === 'string') textFields.push(payload.message);
  if (typeof payload.text === 'string') textFields.push(payload.text);
  if (typeof payload.content === 'string') textFields.push(payload.content);
  if (typeof payload.description === 'string') textFields.push(payload.description);
  if (typeof payload.title === 'string') textFields.push(payload.title);
  if (typeof payload.project_name === 'string') textFields.push(payload.project_name);
  if (typeof payload.cwd === 'string') textFields.push(payload.cwd);
  return textFields.join(' ');
}

export function searchableDisplayLine(event: HookEvent): string {
  const parts = [
    event.hook_event_type,
    simpleEventKindLabel(event.hook_event_type),
    event.source_app,
    event.session_id,
    event.display_name || '',
    event.agent_name || '',
    event.payload?.runtime_label || '',
    event.payload?.acquisition_mode || '',
    event.payload?.tool_name || '',
    describeEvent(event),
    describeEventDetail(event) || '',
    mergeSimpleRowSummary([event]),
    timeAgo(event.timestamp),
    searchableEventText(event),
  ];
  return parts.filter(Boolean).join(' ');
}

export function compactEvents(events: HookEvent[]): HookEvent[] {
  const result: HookEvent[] = [];
  for (const event of events) {
    const previous = result[result.length - 1];
    if (!previous) {
      result.push(event);
      continue;
    }
    if (canCollapse(previous, event)) {
      result[result.length - 1] = event;
      continue;
    }
    result.push(event);
  }
  return result;
}

function canCollapse(previous: HookEvent, current: HookEvent): boolean {
  if (previous.hook_event_type !== current.hook_event_type) return false;
  if (previous.session_id !== current.session_id) return false;
  if ((previous.agent_id || '__main__') !== (current.agent_id || '__main__')) return false;
  if ((previous.payload?.tool_name || '') !== (current.payload?.tool_name || '')) return false;
  if (previous.hook_event_type === 'PreToolUse' && previous.payload?.tool_name === 'Agent') {
    return false;
  }

  const previousTimestamp = previous.timestamp || 0;
  const currentTimestamp = current.timestamp || 0;
  if (Math.abs(currentTimestamp - previousTimestamp) > 1500) return false;

  const previousSignature = searchableEventText(previous).slice(0, 120);
  const currentSignature = searchableEventText(current).slice(0, 120);
  return previousSignature === currentSignature;
}
