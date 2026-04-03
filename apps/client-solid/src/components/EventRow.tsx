import { Show, createSignal } from 'solid-js';
import type { HookEvent } from '../lib/types';
import { formatTime, timeAgo } from '../lib/time';
import { describeEvent } from '../lib/describe';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';

interface Props {
  event: HookEvent;
  detailed: boolean;
}

function resolveAgentName(e: HookEvent): string {
  return e.display_name || e.agent_name || e.payload?.agent_name || e.agent_type || e.source_app || 'Agent';
}

function resolveRuntimeLabel(e: HookEvent): string | undefined {
  return typeof e.payload?.runtime_label === 'string' ? e.payload.runtime_label : undefined;
}

function resolveActionSummary(e: HookEvent): string {
  const summary = describeEvent(e);
  const runtimeLabel = resolveRuntimeLabel(e);
  if (runtimeLabel && e.hook_event_type === 'SessionStart') {
    return `${runtimeLabel} started`;
  }
  if (runtimeLabel && e.hook_event_type === 'SessionEnd') {
    return `${runtimeLabel} ended`;
  }
  return summary;
}

function resolveProjectName(e: HookEvent): string {
  if (typeof e.payload?.project_name === 'string' && e.payload.project_name.trim()) {
    return e.payload.project_name;
  }
  return e.source_app;
}

export default function EventRow(props: Props) {
  const [expanded, setExpanded] = createSignal(false);
  const e = () => props.event;
  const isTool = () => e().hook_event_type.includes('Tool');

  const copyJson = (ev: MouseEvent) => {
    ev.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(e().payload, null, 2));
  };

  return (
    <div
      style="border-bottom:1px solid rgba(255,255,255,0.04);"
      onClick={() => props.detailed && setExpanded(x => !x)}
    >
      {/* Always-visible row */}
      <div
        style={[
          'display:flex;flex-direction:column;gap:4px;padding:8px 16px;',
          props.detailed ? 'cursor:pointer;' : '',
        ].join('')}
        onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
        onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span style="font-size:10px;font-family:var(--font-mono);color:var(--text-dim);min-width:56px;flex-shrink:0;">
            {formatTime(e().timestamp)}
          </span>
          <span style="font-size:11px;font-weight:600;color:var(--text-primary);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">
            {resolveAgentName(e())}
          </span>
          <Show when={resolveRuntimeLabel(e())}>
            <span style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {resolveRuntimeLabel(e())}
            </span>
          </Show>
          <span style={[
            'font-size:10px;font-weight:600;text-transform:uppercase;padding:1px 6px;border-radius:3px;flex-shrink:0;',
            `background:${getEventTypeBgColor(e().hook_event_type)};`,
            `color:${getEventTypeTextColor(e().hook_event_type)};`,
          ].join('')}>
            {getEventTypeLabel(e().hook_event_type)}
          </span>
          <Show when={isTool()}>
            <span style="font-size:11px;color:var(--accent);min-width:40px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {e().payload?.tool_name}
            </span>
          </Show>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;min-width:0;padding-left:64px;">
          <span style="font-size:11px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {resolveActionSummary(e())}
          </span>
          <span style="font-size:10px;color:var(--text-dim);flex-shrink:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {[resolveProjectName(e()), timeAgo(e().timestamp)].join(' · ')}
          </span>
        </div>
      </div>

      {/* Expanded payload section */}
      <Show when={props.detailed && expanded()}>
        <div style="padding:0 16px 10px 16px;position:relative;">
          <button
            onClick={copyJson}
            style={[
              'position:absolute;top:4px;right:20px;font-size:10px;padding:2px 8px;border-radius:3px;',
              'background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);',
              'cursor:pointer;',
            ].join('')}
          >
            Copy
          </button>
          <pre style={[
            'font-family:var(--font-mono);font-size:11px;background:var(--bg-elevated);',
            'padding:12px;border-radius:4px;overflow-x:auto;max-height:300px;',
            'color:var(--text-primary);margin:0;white-space:pre-wrap;word-break:break-all;',
          ].join('')}>
            {JSON.stringify(e().payload, null, 2)}
          </pre>
        </div>
      </Show>
    </div>
  );
}
