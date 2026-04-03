import { Show, For, createMemo } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { xMark } from 'solid-heroicons/solid';
import { selectedAgent, selectAgent, filteredAgents, selectedProject, selectedSession } from '../lib/store';
import { events } from '../lib/ws';
import { formatTime } from '../lib/time';
import { describeEvent } from '../lib/describe';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';
import type { HookEvent } from '../lib/types';

export default function AgentDetail() {
  const agent = createMemo(() => {
    const id = selectedAgent();
    if (!id) return null;
    return filteredAgents().find(a => (a.agentId || '__main__') === id) ?? null;
  });

  const agentEvents = createMemo((): HookEvent[] => {
    const id = selectedAgent();
    if (!id) return [];
    let evts = events();
    const proj = selectedProject();
    if (proj) evts = evts.filter(e => e.source_app === proj);
    const sess = selectedSession();
    if (sess) evts = evts.filter(e => e.session_id === sess);
    return evts.filter(e => (e.agent_id || '__main__') === id).slice(-200).reverse();
  });

  const statusLabel = () => {
    const a = agent();
    if (!a) return 'Unknown';
    if (a.isActive) return 'Active';
    if (a.eventCount > 0) return 'Idle';
    return 'Completed';
  };

  const statusColor = () => {
    const a = agent();
    if (!a) return 'var(--text-dim)';
    if (a.isActive) return 'var(--green)';
    if (a.eventCount > 0) return 'var(--yellow)';
    return 'var(--text-dim)';
  };

  return (
    <div style="width:300px;flex-shrink:0;border-left:1px solid var(--border);background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
      {/* Header */}
      <div style="display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <span style={`width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${statusColor()};`} />
        <span style="font-size:13px;font-weight:600;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          {agent()?.displayName ?? 'Agent'}
        </span>
        <button
          onClick={() => selectAgent(null)}
          style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:2px;display:flex;align-items:center;"
          title="Close"
        >
          <Icon path={xMark} style="width:16px;height:16px;" />
        </button>
      </div>

      {/* Agent info */}
      <Show when={agent()}>
        <div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <Show when={agent()!.modelName}>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Model</span>
              <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                {agent()!.modelName!.replace('claude-', '')}
              </span>
            </div>
          </Show>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Events</span>
            <span style="font-size:11px;color:var(--text-secondary);">{agent()!.eventCount}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Status</span>
            <span style={`font-size:11px;font-weight:500;color:${statusColor()};`}>{statusLabel()}</span>
          </div>
        </div>
      </Show>

      {/* Event list header */}
      <div style="padding:8px 12px;flex-shrink:0;">
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
          Events ({agentEvents().length})
        </span>
      </div>

      {/* Event list */}
      <div style="flex:1;overflow-y:auto;">
        <For each={agentEvents()}>
          {(e) => (
            <div
              style="display:flex;align-items:center;gap:6px;padding:4px 12px;border-bottom:1px solid rgba(255,255,255,0.04);"
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style="font-size:9px;font-family:var(--font-mono);color:var(--text-dim);min-width:48px;flex-shrink:0;">
                {formatTime(e.timestamp)}
              </span>
              <span style={[
                'font-size:9px;font-weight:600;text-transform:uppercase;padding:1px 4px;border-radius:2px;flex-shrink:0;',
                `background:${getEventTypeBgColor(e.hook_event_type)};`,
                `color:${getEventTypeTextColor(e.hook_event_type)};`,
              ].join('')}>
                {getEventTypeLabel(e.hook_event_type)}
              </span>
              <span style="font-size:10px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                {describeEvent(e)}
              </span>
            </div>
          )}
        </For>
        <Show when={agentEvents().length === 0}>
          <div style="padding:20px 12px;text-align:center;font-size:11px;color:var(--text-dim);">
            No events
          </div>
        </Show>
      </div>
    </div>
  );
}
