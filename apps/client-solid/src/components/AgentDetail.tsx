import { Show, For, createMemo } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { xMark } from 'solid-heroicons/solid';
import {
  selectAgent,
  selectedAgentDetailSnapshot,
} from '../lib/store';
import { formatTime } from '../lib/time';
import { describeEvent } from '../lib/describe';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';

export default function AgentDetail() {
  const detail = createMemo(() => selectedAgentDetailSnapshot());

  const statusColors = () => {
    const tone = detail()?.statusTone;
    if (tone === 'active') {
      return {
        dot: 'var(--green)',
        text: 'var(--green)',
        background: 'var(--green-dim)',
      };
    }
    if (tone === 'idle') {
      return {
        dot: 'var(--yellow)',
        text: 'var(--yellow)',
        background: 'rgba(245, 158, 11, 0.12)',
      };
    }
    return {
      dot: 'var(--text-dim)',
      text: 'var(--text-dim)',
      background: 'var(--bg-elevated)',
    };
  };

  const headerContext = () => {
    const current = detail();
    if (!current) return 'Agent snapshot unavailable';
    if (current.focus?.breadcrumb) return current.focus.breadcrumb;

    const parts = [current.projectName, current.session?.label || current.session?.sessionId]
      .filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(' · ') : 'Live agent context';
  };

  return (
    <div style="width:320px;flex-shrink:0;border-left:1px solid var(--border);background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
      <div style="display:flex;align-items:flex-start;gap:10px;padding:12px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <span
          style={`width:7px;height:7px;border-radius:50%;margin-top:6px;flex-shrink:0;background:${statusColors().dot};`}
        />
        <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {detail()?.agent.displayName ?? 'Agent'}
          </span>
          <span style="font-size:10px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            {headerContext()}
          </span>
        </div>
        <div
          style={[
            'display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:600;',
            `background:${statusColors().background};`,
            `color:${statusColors().text};`,
          ].join('')}
        >
          <span style={`width:6px;height:6px;border-radius:50%;background:${statusColors().dot};`} />
          <span>{detail()?.statusLabel ?? 'Unknown'}</span>
        </div>
        <button
          onClick={() => selectAgent(null)}
          style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:2px;display:flex;align-items:center;"
          title="Close"
        >
          <Icon path={xMark} style="width:16px;height:16px;" />
        </button>
      </div>

      <Show when={detail()} fallback={
        <div style="padding:18px 12px;color:var(--text-dim);font-size:12px;line-height:1.5;">
          The agent selection is present, but the snapshot data is not available yet.
        </div>
      }>
        <div style="padding:12px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:10px;flex-shrink:0;">
          <Show when={detail()!.focus}>
            {(focus) => (
              <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                  <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
                    {focus().scopeLabel}
                  </span>
                  <span style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);">
                    {focus().eventCount} events
                  </span>
                </div>
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.35;">
                  {focus().headline}
                </span>
                <span style="font-size:11px;color:var(--text-secondary);line-height:1.45;">
                  {focus().subheadline}
                </span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  <span style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                    {focus().projectName}
                  </span>
                  <Show when={focus().sessionLabel}>
                    <span style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                      Session {focus().sessionLabel}
                    </span>
                  </Show>
                  <Show when={focus().agentLabel}>
                    <span style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                      Agent {focus().agentLabel}
                    </span>
                  </Show>
                </div>
              </div>
            )}
          </Show>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
            <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Runtime</span>
              <span style="font-size:11px;color:var(--text-primary);line-height:1.4;">
                {detail()!.runtimeLabel}
              </span>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Status</span>
              <span style={`font-size:11px;font-weight:600;line-height:1.4;color:${statusColors().text};`}>
                {detail()!.statusLabel}
              </span>
            </div>
          </div>

          <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);display:flex;flex-direction:column;gap:4px;">
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Assignment</span>
            <span style="font-size:11px;color:var(--text-primary);line-height:1.45;">
              {detail()!.assignmentLabel}
            </span>
          </div>

          <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);display:flex;flex-direction:column;gap:4px;">
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Current action</span>
            <span style="font-size:11px;color:var(--text-primary);line-height:1.45;">
              {detail()!.currentActionLabel}
            </span>
            <Show when={detail()!.currentActionDetail}>
              <span style="font-size:10px;color:var(--text-dim);line-height:1.45;">
                {detail()!.currentActionDetail}
              </span>
            </Show>
          </div>

          <div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);display:flex;flex-direction:column;gap:4px;">
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Last useful result</span>
            <span style="font-size:11px;color:var(--text-primary);line-height:1.45;">
              {detail()!.lastUsefulResultLabel}
            </span>
            <Show when={detail()!.lastUsefulResultDetail}>
              <span style="font-size:10px;color:var(--text-dim);line-height:1.45;">
                {detail()!.lastUsefulResultDetail}
              </span>
            </Show>
            <Show when={detail()!.lastUsefulResultAt}>
              <span style="font-size:10px;color:var(--text-dim);">
                {formatTime(detail()!.lastUsefulResultAt!)}
              </span>
            </Show>
          </div>
        </div>

        <div style="padding:8px 12px;flex-shrink:0;">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
            Recent activity ({detail()!.recentEvents.length})
          </span>
        </div>

        <div style="flex:1;overflow-y:auto;">
          <For each={detail()!.recentEvents}>
            {(e) => (
              <div
                style="display:flex;align-items:center;gap:6px;padding:4px 12px;border-bottom:1px solid rgba(255,255,255,0.04);"
                onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style="font-size:9px;font-family:var(--font-mono);color:var(--text-dim);min-width:48px;flex-shrink:0;">
                  {formatTime(e.timestamp)}
                </span>
                <span
                  style={[
                    'font-size:9px;font-weight:600;text-transform:uppercase;padding:1px 4px;border-radius:2px;flex-shrink:0;',
                    `background:${getEventTypeBgColor(e.hook_event_type)};`,
                    `color:${getEventTypeTextColor(e.hook_event_type)};`,
                  ].join('')}
                >
                  {getEventTypeLabel(e.hook_event_type)}
                </span>
                <span style="font-size:10px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {describeEvent(e)}
                </span>
              </div>
            )}
          </For>
          <Show when={detail()!.recentEvents.length === 0}>
            <div style="padding:20px 12px;text-align:center;font-size:11px;color:var(--text-dim);">
              No recent activity
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
