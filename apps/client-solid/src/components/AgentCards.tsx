import { For, Show, createSignal } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { listBullet, share } from 'solid-heroicons/solid';
import { graphAgents, selectedAgent, selectAgent } from '../lib/store';
import {
  statusPalette,
  statusToneIcon,
  type SidebarActivityTone,
} from '../widgets/sidebar/sidebarPresentation';
import { getAgentColor } from '../lib/colors';
import {
  agentListInitials,
  resolveAgentListPrimaryName,
  resolveAgentListSecondaryLine,
} from '../lib/agentNaming';
import type { AgentInfo } from '../lib/types';
import AgentGraph from './AgentGraph';

type ViewMode = 'list' | 'graph';

function agentRowTone(agent: AgentInfo): SidebarActivityTone {
  const t = agent.statusTone;
  if (t === 'active' || t === 'blocked' || t === 'attention' || t === 'idle' || t === 'done') {
    return t;
  }
  if (agent.isActive) return 'active';
  if (agent.eventCount > 0) return 'idle';
  return 'done';
}

function statusPillLabel(agent: AgentInfo): string {
  if (agent.statusLabel?.trim()) return agent.statusLabel.trim();
  if (agent.isActive) return 'Active';
  if (agent.eventCount > 0) return 'Idle';
  return 'Done';
}

export default function AgentCards() {
  const [viewMode, setViewMode] = createSignal<ViewMode>('list');

  const tabStyle = (mode: ViewMode) => [
    'font-size:var(--text-sm);font-weight:500;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
    'transition:background 0.15s,color 0.15s;',
    viewMode() === mode
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:none;color:var(--text-secondary);',
  ].join('');

  return (
    <div style="border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:4px;padding:6px 12px;border-bottom:1px solid var(--border);">
        <button style={tabStyle('list')} onClick={() => setViewMode('list')}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={listBullet} style="width:12px;height:12px;" />
            List
          </span>
        </button>
        <button style={tabStyle('graph')} onClick={() => setViewMode('graph')}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={share} style="width:12px;height:12px;" />
            Graph
          </span>
        </button>
      </div>

      <Show when={viewMode() === 'list'}>
        <div style="display:flex;flex-direction:column;padding:8px 12px 12px;gap:2px;">
          <For each={graphAgents()}>
            {(agent) => {
              const id = agent.agentId || '__main__';
              const primary = () => resolveAgentListPrimaryName(agent);
              const secondary = () => resolveAgentListSecondaryLine(agent);
              const tone = () => agentRowTone(agent);
              const palette = () => statusPalette(tone());
              const isSelected = () => selectedAgent() === id;
              const rowAccent = () => {
                const t = tone();
                if (t === 'attention') return 'border-left:2px solid var(--red);';
                if (t === 'blocked') return 'border-left:2px solid var(--yellow);';
                return 'border-left:2px solid transparent;';
              };
              const rowBackground = () => {
                if (isSelected()) return 'var(--bg-elevated)';
                const t = tone();
                if (t === 'attention') return 'rgba(239, 68, 68, 0.08)';
                if (t === 'blocked') return 'rgba(245, 158, 11, 0.08)';
                return 'transparent';
              };
              const colorKey = agent.agentType || primary();
              return (
                <div
                  style={[
                    'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;cursor:pointer;',
                    rowAccent(),
                    `background:${rowBackground()};`,
                    isSelected() ? 'box-shadow:inset 0 0 0 1px var(--accent);' : '',
                  ].join('')}
                  onClick={() => selectAgent(id)}
                  onMouseEnter={(e) => {
                    if (isSelected()) return;
                    const el = e.currentTarget as HTMLDivElement;
                    const t = tone();
                    if (t === 'attention') el.style.background = 'rgba(239, 68, 68, 0.12)';
                    else if (t === 'blocked') el.style.background = 'rgba(245, 158, 11, 0.12)';
                    else el.style.background = 'var(--bg-card)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected()) return;
                    (e.currentTarget as HTMLDivElement).style.background = rowBackground();
                  }}
                  aria-label={`${primary()}, ${statusPillLabel(agent)}. ${secondary()}`}
                >
                  <div
                    style={[
                      'width:30px;height:30px;border-radius:9999px;flex-shrink:0;display:flex;',
                      'align-items:center;justify-content:center;font-size:11px;font-weight:700;',
                      `background:${getAgentColor(colorKey)}22;color:${getAgentColor(colorKey)};`,
                      'border:1px solid var(--border);',
                    ].join('')}
                    aria-hidden
                  >
                    {agentListInitials(primary())}
                  </div>
                  <Icon
                    path={statusToneIcon(tone())}
                    style={`width:10px;height:10px;color:${palette().text};flex-shrink:0;`}
                  />
                  <div style="display:flex;flex-direction:column;min-width:0;flex:1;gap:2px;">
                    <span style="font-size:var(--text-base);font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {primary()}
                    </span>
                    <span
                      style={[
                        'font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
                        tone() === 'attention' || tone() === 'blocked'
                          ? `color:${palette().text};font-weight:600;`
                          : 'color:var(--text-dim);',
                      ].join('')}
                      title={secondary()}
                    >
                      {secondary()}
                    </span>
                  </div>
                  <div style={[
                    'display:flex;align-items:center;gap:3px;font-size:var(--text-sm);padding:2px 7px;',
                    'border-radius:9999px;font-weight:600;flex-shrink:0;max-width:min(140px,38%);',
                    `background:${palette().background};`,
                    `color:${palette().text};`,
                  ].join('')}>
                    <Icon path={statusToneIcon(tone())} style="width:9px;height:9px;flex-shrink:0;" />
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {statusPillLabel(agent)}
                    </span>
                  </div>
                </div>
              );
            }}
          </For>

          <Show when={graphAgents().length === 0}>
            <span style="font-size:var(--text-sm);color:var(--text-dim);padding:8px 4px;">No agents</span>
          </Show>
        </div>
      </Show>

      <Show when={viewMode() === 'graph'}>
        <AgentGraph />
      </Show>
    </div>
  );
}
