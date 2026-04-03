import { For, Show, createSignal } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { squares2X2, share, cpuChip, commandLine, bolt, clock } from 'solid-heroicons/solid';
import { filteredAgents, selectedAgent, selectAgent } from '../lib/store';
import AgentGraph from './AgentGraph';

type ViewMode = 'cards' | 'graph';

export default function AgentCards() {
  const [viewMode, setViewMode] = createSignal<ViewMode>('cards');

  const tabStyle = (mode: ViewMode) => [
    'font-size:11px;font-weight:500;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
    'transition:background 0.15s,color 0.15s;',
    viewMode() === mode
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:none;color:var(--text-secondary);',
  ].join('');

  const dotColor = (agent: ReturnType<typeof filteredAgents>[number]) => {
    if (agent.isActive) return 'var(--green)';
    if (agent.eventCount > 0) return 'var(--yellow)';
    return 'var(--text-dim)';
  };

  const statusLabel = (agent: ReturnType<typeof filteredAgents>[number]) => {
    if (agent.isActive) return 'Online';
    if (agent.eventCount > 0) return 'Idle';
    return 'Completed';
  };

  const cardBorderLeft = (agent: ReturnType<typeof filteredAgents>[number]) => {
    const id = agent.agentId || '__main__';
    if (selectedAgent() === id) return '3px solid var(--accent)';
    if (agent.isActive) return '3px solid var(--green)';
    return '3px solid transparent';
  };

  return (
    <div style="border-bottom:1px solid var(--border);">
      {/* Tab bar */}
      <div style="display:flex;align-items:center;gap:4px;padding:6px 12px;border-bottom:1px solid var(--border);">
        <button style={tabStyle('cards')} onClick={() => setViewMode('cards')}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={squares2X2} style="width:12px;height:12px;" />
            Cards
          </span>
        </button>
        <button style={tabStyle('graph')} onClick={() => setViewMode('graph')}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={share} style="width:12px;height:12px;" />
            Graph
          </span>
        </button>
      </div>

      {/* Cards view */}
      <Show when={viewMode() === 'cards'}>
        <div style="display:flex;gap:10px;overflow-x:auto;padding:12px 16px;">
          <For each={filteredAgents()}>
            {(agent) => {
              const id = agent.agentId || '__main__';
              return (
                <div
                  style={[
                    'min-width:160px;background:var(--bg-card);border:1px solid var(--border);',
                    'border-radius:6px;padding:10px 12px;cursor:pointer;',
                    `border-left:${cardBorderLeft(agent)};`,
                    'flex-shrink:0;display:flex;flex-direction:column;gap:4px;',
                    'transition:border-color 0.15s,background 0.15s;',
                  ].join('')}
                  onClick={() => selectAgent(id)}
                  onMouseEnter={(e) => {
                    if (selectedAgent() !== id) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
                  }}
                >
                  {/* Status dot + name */}
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style={`width:5px;height:5px;border-radius:50%;background:${dotColor(agent)};flex-shrink:0;`} />
                    <Icon
                      path={agent.agentId ? cpuChip : commandLine}
                      style="width:12px;height:12px;color:var(--text-secondary);flex-shrink:0;"
                    />
                    <span style="font-size:12px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      {agent.displayName}
                    </span>
                  </div>

                  {/* Model */}
                  <Show when={agent.modelName}>
                    <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      {agent.modelName!.replace('claude-', '')}
                    </span>
                  </Show>
                  <Show when={agent.runtimeLabel}>
                    <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">
                      {agent.runtimeLabel}
                    </span>
                  </Show>

                  {/* Footer: event count + status */}
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                    <span style="font-size:11px;color:var(--text-tertiary);">{agent.eventCount} evts</span>
                    <span style="font-size:11px;color:var(--text-tertiary);display:flex;align-items:center;gap:4px;">
                      <Icon path={agent.isActive ? bolt : clock} style="width:11px;height:11px;" />
                      {statusLabel(agent)}
                    </span>
                  </div>
                </div>
              );
            }}
          </For>

          <Show when={filteredAgents().length === 0}>
            <span style="font-size:11px;color:var(--text-dim);padding:8px 0;">No agents</span>
          </Show>
        </div>
      </Show>

      {/* Graph view */}
      <Show when={viewMode() === 'graph'}>
        <AgentGraph />
      </Show>
    </div>
  );
}
