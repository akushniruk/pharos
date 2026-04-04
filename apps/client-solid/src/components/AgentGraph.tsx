import { For, Show, createMemo, createSignal } from 'solid-js';
import { filteredAgents, filteredEvents, selectAgent, selectedAgent } from '../lib/store';
import type { AgentInfo } from '../lib/types';

const NODE_W = 200;
const NODE_H = 64;
const H_GAP = 24;
const V_GAP = 80;
const MAX_PER_ROW = 5;

type StatusColor = 'var(--green)' | 'var(--yellow)' | 'var(--text-dim)';

function statusDot(agent: AgentInfo): StatusColor {
  if (agent.statusTone === 'active' || agent.isActive) return 'var(--green)';
  if (agent.statusTone === 'blocked' || agent.statusTone === 'attention') return 'var(--yellow)';
  return 'var(--text-dim)';
}

export default function AgentGraph() {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<'active' | 'idle' | 'all'>('all');
  const agents = createMemo(() => {
    const all = filteredAgents();
    if (filter() === 'all') return all;
    // Always include roots (orchestrators) so the tree has anchor nodes
    const isRoot = (a: AgentInfo) => a.agentId === null || !a.parentId;
    if (filter() === 'active') return all.filter(a => isRoot(a) || a.isActive || a.statusTone === 'active');
    return all.filter(a => isRoot(a) || (!a.isActive && a.statusTone !== 'active'));
  });
  const roots = createMemo(() => agents().filter(a => a.agentId === null || !a.parentId));
  const children = createMemo(() => agents().filter(a => a.agentId !== null && a.parentId));

  const edges = createMemo(() => {
    const evts = filteredEvents();
    const parentMap = new Map<string, string>();
    for (const a of agents()) {
      if (a.parentId && a.agentId) parentMap.set(a.agentId, a.parentId);
    }
    for (const e of evts) {
      if (e.hook_event_type === 'SubagentStart' && e.agent_id && e.payload?.parent_id) {
        parentMap.set(e.agent_id, e.payload.parent_id);
      }
    }
    return parentMap;
  });
  const layout = createMemo(() => {
    const r = roots();
    const c = children();
    const rootCount = Math.max(r.length, 1);
    const childRows = Math.ceil(c.length / MAX_PER_ROW) || 0;
    const maxCols = Math.max(rootCount, Math.min(c.length, MAX_PER_ROW));
    const width = maxCols * (NODE_W + H_GAP) - H_GAP + 80;
    const height = NODE_H + (childRows > 0 ? childRows * (NODE_H + V_GAP) + V_GAP : 0) + 80;

    const rootPositions = new Map<string, { x: number; y: number }>();
    const rootStartX = (width - (rootCount * (NODE_W + H_GAP) - H_GAP)) / 2;
    r.forEach((agent, i) => {
      const key = agent.agentId ?? '__root__';
      rootPositions.set(key, { x: rootStartX + i * (NODE_W + H_GAP), y: 40 });
    });

    const childPositions = new Map<string, { x: number; y: number }>();
    c.forEach((agent, i) => {
      const row = Math.floor(i / MAX_PER_ROW);
      const col = i % MAX_PER_ROW;
      const rowCols = Math.min(c.length - row * MAX_PER_ROW, MAX_PER_ROW);
      const rowStartX = (width - (rowCols * (NODE_W + H_GAP) - H_GAP)) / 2;
      const key = agent.agentId ?? '__child__';
      childPositions.set(key, {
        x: rowStartX + col * (NODE_W + H_GAP),
        y: 40 + NODE_H + V_GAP + row * (NODE_H + V_GAP),
      });
    });

    return { width, height, rootPositions, childPositions };
  });
  const nodePos = (agent: AgentInfo) => {
    const key = agent.agentId ?? '__root__';
    return layout().rootPositions.get(key) ?? layout().childPositions.get(key) ?? { x: 0, y: 0 };
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2.5, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  };
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan().x, y: e.clientY - pan().y });
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging()) return;
    setPan({ x: e.clientX - dragStart().x, y: e.clientY - dragStart().y });
  };
  const onMouseUp = () => setDragging(false);
  const activeCount = () => filteredAgents().filter(a => a.isActive || a.statusTone === 'active').length;
  const idleCount = () => filteredAgents().filter(a => !a.isActive && a.statusTone !== 'active').length;

  return (
    <div
      style="flex:1;overflow:hidden;position:relative;cursor:grab;user-select:none;"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Filter buttons top-left */}
      <div style="position:absolute;top:12px;left:12px;display:flex;gap:4px;z-index:10;">
        <For each={[
          { key: 'active' as const, label: `Active (${activeCount()})` },
          { key: 'idle' as const, label: `Idle (${idleCount()})` },
          { key: 'all' as const, label: `All (${filteredAgents().length})` },
        ]}>
          {(f) => (
            <button
              class="graph-zoom-btn"
              style={`font-size:10px;width:auto;padding:0 10px;${filter() === f.key ? 'background:var(--bg-elevated);color:var(--text-primary);border-color:var(--accent);' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          )}
        </For>
      </div>

      {/* Zoom controls bottom-right */}
      <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:4px;z-index:10;">
        <button class="graph-zoom-btn" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>+</button>
        <button class="graph-zoom-btn" style="font-size:10px;" onClick={() => setZoom(1)}>Fit</button>
        <button class="graph-zoom-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}>-</button>
      </div>

      <Show when={agents().length > 0} fallback={
        <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:28px;">
          <div style="max-width:420px;padding:18px 20px;border:1px solid var(--border);border-radius:14px;text-align:center;">
            <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">No agents to display</p>
            <p style="font-size:12px;line-height:1.5;color:var(--text-dim);">Try changing the filter or selecting a different project.</p>
          </div>
        </div>
      }>
        <svg
          width={layout().width * zoom()}
          height={layout().height * zoom()}
          viewBox={`0 0 ${layout().width} ${layout().height}`}
          style={`transform:translate(${pan().x}px,${pan().y}px);`}
        >
          {/* Edges */}
          <For each={children()}>
            {(child) => {
              const parentKey = child.parentId === 'main' ? '__root__' : child.parentId!;
              const parentPos = () => layout().rootPositions.get(parentKey) ?? layout().childPositions.get(parentKey);
              const childPos = () => nodePos(child);
              return (
                <Show when={parentPos()}>
                  <path
                    d={`M ${parentPos()!.x + NODE_W / 2} ${parentPos()!.y + NODE_H} C ${parentPos()!.x + NODE_W / 2} ${(parentPos()!.y + NODE_H + childPos().y) / 2}, ${childPos().x + NODE_W / 2} ${(parentPos()!.y + NODE_H + childPos().y) / 2}, ${childPos().x + NODE_W / 2} ${childPos().y}`}
                    fill="none"
                    stroke="var(--border-hover)"
                    stroke-width="1.5"
                  />
                </Show>
              );
            }}
          </For>

          {/* All nodes */}
          <For each={[...roots(), ...children()]}>
            {(agent) => {
              const pos = () => nodePos(agent);
              const id = agent.agentId ?? '__main__';
              const isSel = () => selectedAgent() === id;
              return (
                <g style="cursor:pointer;" onClick={(e) => { e.stopPropagation(); selectAgent(id); }}>
                  <rect
                    x={pos().x} y={pos().y} width={NODE_W} height={NODE_H} rx="10"
                    fill="var(--bg-card)"
                    stroke={isSel() ? 'var(--accent)' : 'var(--border)'}
                    stroke-width={isSel() ? 2 : 1}
                  />
                  <circle cx={pos().x + 14} cy={pos().y + 16} r="4" fill={statusDot(agent)} />
                  <text x={pos().x + 24} y={pos().y + 20} font-size="12" font-weight="600" fill="var(--text-primary)" font-family="var(--font-sans)">
                    {agent.displayName.length > 22 ? agent.displayName.slice(0, 21) + '...' : agent.displayName}
                  </text>
                  <text x={pos().x + 14} y={pos().y + 38} font-size="10" fill="var(--text-secondary)" font-family="var(--font-sans)">
                    {agent.eventCount} events{agent.modelName ? ` · ${agent.modelName}` : ''}
                  </text>
                  <text x={pos().x + 14} y={pos().y + 54} font-size="10" fill="var(--text-dim)" font-family="var(--font-sans)">
                    {agent.isActive ? 'Active' : agent.statusTone === 'blocked' ? 'Blocked' : 'Idle'}
                  </text>
                </g>
              );
            }}
          </For>
        </svg>
      </Show>
    </div>
  );
}
