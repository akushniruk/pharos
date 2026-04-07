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
  const statusDetail = () =>
    detail()?.statusDetail
    || (detail()?.statusTone === 'blocked' || detail()?.statusTone === 'attention'
      ? 'No new progress after recent activity'
      : undefined);

  const statusColors = () => {
    const tone = detail()?.statusTone;
    if (tone === 'active') {
      return {
        dot: 'var(--green)',
        text: 'var(--green)',
        background: 'var(--green-dim)',
      };
    }
    if (tone === 'blocked') {
      return {
        dot: 'var(--yellow)',
        text: 'var(--yellow)',
        background: 'rgba(245, 158, 11, 0.12)',
      };
    }
    if (tone === 'attention') {
      return {
        dot: 'var(--red)',
        text: 'var(--red)',
        background: 'rgba(239, 68, 68, 0.12)',
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
    return parts.length > 0 ? `Now tracking: ${parts.join(' · ')}` : 'Live agent context';
  };

  return (
    <div class="phx-shell flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-[var(--border)]">
      <div class="flex shrink-0 items-start gap-2.5 border-b border-[var(--border)] p-3">
        <span
          style={`width:7px;height:7px;border-radius:50%;margin-top:6px;flex-shrink:0;background:${statusColors().dot};`}
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-base)] font-semibold text-[var(--text-primary)]">
            {detail()?.agent.displayName ?? 'Agent'}
          </span>
          <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-sm)] text-[var(--text-dim)]">
            {headerContext()}
          </span>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div
            style={[
              'display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 8px;font-size:var(--text-sm);font-weight:600;',
              `background:${statusColors().background};`,
              `color:${statusColors().text};`,
            ].join('')}
          >
            <span style={`width:6px;height:6px;border-radius:50%;background:${statusColors().dot};`} />
            <span>{detail()?.statusLabel ?? 'Unknown'}</span>
          </div>
          <Show when={statusDetail()}>
            <span class="max-w-[170px] text-right text-[var(--text-sm)] leading-[1.35] text-[var(--text-dim)]">
              {statusDetail()}
            </span>
          </Show>
        </div>
        <button
          onClick={() => selectAgent(null)}
          class="flex items-center p-0.5 text-[var(--text-dim)]"
          title="Close"
        >
          <Icon path={xMark} style="width:16px;height:16px;" />
        </button>
      </div>

      <Show when={detail()} fallback={
        <div class="px-3 py-[18px] text-[var(--text-sm)] leading-[1.5] text-[var(--text-dim)]">
          The selected agent is present, but its live snapshot is not available yet.
        </div>
      }>
        <div class="flex shrink-0 flex-col gap-2.5 border-b border-[var(--border)] p-3">
          <Show when={detail()!.focus}>
            {(focus) => (
              <div class="phx-panel-elevated flex flex-col gap-2 p-2.5">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                  <span style="font-size:var(--text-sm);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
                    {focus().scopeLabel}
                  </span>
                  <span style="font-size:var(--text-sm);padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);">
                    {focus().eventCount} events
                  </span>
                </div>
                <span style="font-size:var(--text-base);font-weight:600;color:var(--text-primary);line-height:1.35;">
                  {focus().headline}
                </span>
                <span style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.45;">
                  {focus().subheadline}
                </span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  <span style="font-size:var(--text-sm);padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                    {focus().projectName}
                  </span>
                  <Show when={focus().sessionLabel}>
                    <span style="font-size:var(--text-sm);padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                      Session {focus().sessionLabel}
                    </span>
                  </Show>
                  <Show when={focus().agentLabel}>
                    <span style="font-size:var(--text-sm);padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-dim);">
                      Agent {focus().agentLabel}
                    </span>
                  </Show>
                </div>
              </div>
            )}
          </Show>

          <div class="grid grid-cols-2 gap-2">
            <div class="phx-panel flex flex-col gap-1 p-2.5">
              <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Runtime in use</span>
              <span style="font-size:var(--text-sm);color:var(--text-primary);line-height:1.4;">
                {detail()!.runtimeLabel}
              </span>
            </div>
            <div class="phx-panel flex flex-col gap-1 p-2.5">
              <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Current status</span>
              <span style={`font-size:var(--text-sm);font-weight:600;line-height:1.4;color:${statusColors().text};`}>
                {detail()!.statusLabel}
              </span>
            </div>
          </div>

          <Show when={detail()!.statusTone === 'blocked' || detail()!.statusTone === 'attention'}>
            <div class="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[rgba(239,68,68,0.08)] p-2.5">
              <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">
                Needs review
              </span>
              <span style={`font-size:var(--text-sm);font-weight:600;line-height:1.45;color:${statusColors().text};`}>
                {detail()!.statusLabel}
              </span>
              <Show when={statusDetail()}>
                <span style="font-size:var(--text-sm);color:var(--text-dim);line-height:1.45;">
                  {statusDetail()}
                </span>
              </Show>
            </div>
          </Show>

          <div class="phx-panel flex flex-col gap-1 p-2.5">
            <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Current progress</span>
            <span style="font-size:var(--text-sm);color:var(--text-primary);line-height:1.45;">
              {detail()!.currentActionLabel}
            </span>
            <Show when={detail()!.currentActionDetail}>
              <span style="font-size:var(--text-sm);color:var(--text-dim);line-height:1.45;">
                {detail()!.currentActionDetail}
              </span>
            </Show>
          </div>

          <div class="phx-panel flex flex-col gap-1 p-2.5">
            <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Next action</span>
            <span style="font-size:var(--text-sm);color:var(--text-primary);line-height:1.45;">
              {detail()!.assignmentLabel}
            </span>
            <Show when={detail()!.assignmentDetail}>
              <span style="font-size:var(--text-sm);color:var(--text-dim);line-height:1.45;">
                {detail()!.assignmentDetail}
              </span>
            </Show>
          </div>

          <div class="phx-panel flex flex-col gap-1 p-2.5">
            <span style="font-size:var(--text-sm);color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Most recent useful output</span>
            <span style="font-size:var(--text-sm);color:var(--text-primary);line-height:1.45;">
              {detail()!.lastUsefulResultLabel}
            </span>
            <Show when={detail()!.lastUsefulResultDetail}>
              <span style="font-size:var(--text-sm);color:var(--text-dim);line-height:1.45;">
                {detail()!.lastUsefulResultDetail}
              </span>
            </Show>
            <Show when={detail()!.lastUsefulResultAt}>
              <span style="font-size:var(--text-sm);color:var(--text-dim);">
                {formatTime(detail()!.lastUsefulResultAt!)}
              </span>
            </Show>
          </div>
        </div>

        <div style="padding:8px 12px;flex-shrink:0;">
          <span style="font-size:var(--text-sm);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
            Activity trail ({detail()!.recentEvents.length})
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
                <span style="font-size:var(--text-sm);font-family:var(--font-mono);color:var(--text-dim);min-width:48px;flex-shrink:0;">
                  {formatTime(e.timestamp)}
                </span>
                <span
                  style={[
                    'font-size:var(--text-sm);font-weight:600;text-transform:uppercase;padding:1px 4px;border-radius:2px;flex-shrink:0;',
                    `background:${getEventTypeBgColor(e.hook_event_type)};`,
                    `color:${getEventTypeTextColor(e.hook_event_type)};`,
                  ].join('')}
                >
                  {getEventTypeLabel(e.hook_event_type)}
                </span>
                <span style="font-size:var(--text-sm);color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {describeEvent(e)}
                </span>
              </div>
            )}
          </For>
          <Show when={detail()!.recentEvents.length === 0}>
            <div style="padding:20px 12px;text-align:center;font-size:var(--text-sm);color:var(--text-dim);">
              No recent activity for this agent
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
