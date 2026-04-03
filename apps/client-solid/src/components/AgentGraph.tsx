import { For, createMemo, createSignal, onMount } from 'solid-js';
import { filteredAgents, filteredEvents, selectAgent, selectedAgent } from '../lib/store';
import type { AgentInfo } from '../lib/types';

const NODE_W = 200;
const NODE_H = 64;
const H_GAP = 24;
const V_GAP = 80;
const MAX_PER_ROW = 5;

export default function AgentGraph() {
  let containerRef: HTMLDivElement | undefined;
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<'active' | 'idle' | 'all'>('active');

  const visibleAgents = createMemo(() => {
    const agents = filteredAgents();
    const f = filter();
    if (f === 'all') return agents;
    if (f === 'active') return agents.filter(a => a.agentId === null || a.isActive);
    // idle = not active but has events
    return agents.filter(a => a.agentId === null || (!a.isActive && a.eventCount > 0));
  });

  const activeCount = createMemo(() => filteredAgents().filter(a => a.isActive).length);
  const idleCount = createMemo(() => filteredAgents().filter(a => !a.isActive && a.eventCount > 0).length);
  const totalCount = createMemo(() => filteredAgents().length);

  const layout = createMemo(() => {
    const agents = visibleAgents();
    if (agents.length === 0) return { nodes: [] as { agent: AgentInfo; x: number; y: number }[], edges: [] as { x1: number; y1: number; x2: number; y2: number }[], width: 400, height: 200 };

    const root = agents.find(a => a.agentId === null) ?? agents[0];
    const children = agents.filter(a => a.agentId !== null && a.agentId !== root.agentId);

    // Layout in rows
    const rows: AgentInfo[][] = [];
    for (let i = 0; i < children.length; i += MAX_PER_ROW) {
      rows.push(children.slice(i, i + MAX_PER_ROW));
    }

    const maxRowWidth = Math.max(1, ...rows.map(r => r.length)) * (NODE_W + H_GAP) - H_GAP;
    const totalW = Math.max(NODE_W, maxRowWidth) + 60;
    const totalH = 40 + NODE_H + (rows.length > 0 ? rows.length * (NODE_H + V_GAP) : 0) + 40;

    const nodes: { agent: AgentInfo; x: number; y: number }[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Root
    const rootX = (totalW - NODE_W) / 2;
    const rootY = 30;
    nodes.push({ agent: root, x: rootX, y: rootY });

    // Children
    rows.forEach((row, rowIdx) => {
      const rowW = row.length * (NODE_W + H_GAP) - H_GAP;
      const startX = (totalW - rowW) / 2;
      const y = 30 + (rowIdx + 1) * (NODE_H + V_GAP);

      row.forEach((child, colIdx) => {
        const x = startX + colIdx * (NODE_W + H_GAP);
        nodes.push({ agent: child, x, y });
        edges.push({
          x1: rootX + NODE_W / 2,
          y1: rootY + NODE_H,
          x2: x + NODE_W / 2,
          y2: y,
        });
      });
    });

    return { nodes, edges, width: totalW, height: totalH };
  });

  // Center on mount
  onMount(() => {
    if (containerRef) {
      const cw = containerRef.clientWidth;
      const lw = layout().width;
      if (lw < cw) {
        setPan({ x: (cw - lw) / 2, y: 20 });
      }
    }
  });

  // Zoom with mouse wheel
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.max(0.3, Math.min(2.5, z + delta)));
  };

  // Pan with mouse drag
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

  return (
    <div
      ref={containerRef}
      style="flex:1;overflow:hidden;position:relative;cursor:grab;user-select:none;"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Top-left: filter controls */}
      <div style="position:absolute;top:12px;left:12px;display:flex;gap:4px;z-index:10;">
        <button
          onClick={() => setFilter('active')}
          class="graph-zoom-btn"
          style={`font-size:10px;width:auto;padding:0 10px;${filter() === 'active' ? 'background:var(--green-dim);color:var(--green);border-color:var(--green);' : ''}`}
        >
          Active ({activeCount()})
        </button>
        <button
          onClick={() => setFilter('idle')}
          class="graph-zoom-btn"
          style={`font-size:10px;width:auto;padding:0 10px;${filter() === 'idle' ? 'background:var(--yellow-dim);color:var(--yellow);border-color:var(--yellow);' : ''}`}
        >
          Idle ({idleCount()})
        </button>
        <button
          onClick={() => setFilter('all')}
          class="graph-zoom-btn"
          style={`font-size:10px;width:auto;padding:0 10px;${filter() === 'all' ? 'background:var(--bg-elevated);color:var(--text-primary);border-color:var(--accent);' : ''}`}
        >
          All ({totalCount()})
        </button>
      </div>

      {/* Bottom-right: zoom controls */}
      <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:4px;z-index:10;">
        <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} class="graph-zoom-btn">+</button>
        <button onClick={() => setZoom(1)} class="graph-zoom-btn" style="font-size:10px;">Fit</button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} class="graph-zoom-btn">−</button>
      </div>

      <svg
        width={layout().width * zoom()}
        height={layout().height * zoom()}
        viewBox={`0 0 ${layout().width} ${layout().height}`}
        style={`transform:translate(${pan().x}px,${pan().y}px);`}
      >
        {/* Edges */}
        <For each={layout().edges}>
          {(edge) => {
            const midY = (edge.y1 + edge.y2) / 2;
            return (
              <path
                d={`M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke="var(--border-hover)"
                stroke-width="1.5"
                stroke-dasharray="4 2"
              />
            );
          }}
        </For>

        {/* Nodes */}
        <For each={layout().nodes}>
          {(node) => {
            const id = node.agent.agentId || '__main__';
            const isSelected = () => selectedAgent() === id;
            const isActive = node.agent.isActive;

            const strokeColor = () => {
              if (isSelected()) return 'var(--accent)';
              if (isActive) return 'var(--green)';
              return 'var(--border)';
            };

            const dotColor = isActive ? 'var(--green)' : node.agent.eventCount > 0 ? 'var(--yellow)' : 'var(--text-dim)';
            const statusText = isActive ? 'Online' : node.agent.eventCount > 0 ? 'Idle' : 'Done';
            const name = node.agent.displayName.length > 22 ? node.agent.displayName.slice(0, 21) + '…' : node.agent.displayName;
            const model = node.agent.modelName?.replace('claude-', '') || '';
            const modelTrunc = model.length > 24 ? model.slice(0, 23) + '…' : model;

            return (
              <g
                style="cursor:pointer;"
                onClick={(e) => { e.stopPropagation(); selectAgent(id); }}
              >
                {/* Card background */}
                <rect
                  x={node.x} y={node.y}
                  width={NODE_W} height={NODE_H}
                  rx="8" ry="8"
                  fill="var(--bg-card)"
                  stroke={strokeColor()}
                  stroke-width={isSelected() ? 2 : 1}
                />
                {/* Active left border */}
                {isActive && (
                  <rect
                    x={node.x} y={node.y + 4}
                    width="3" height={NODE_H - 8}
                    rx="1.5"
                    fill="var(--green)"
                  />
                )}
                {/* Status dot */}
                <circle
                  cx={node.x + NODE_W - 14} cy={node.y + 14}
                  r="4" fill={dotColor}
                />
                {/* Agent name */}
                <text
                  x={node.x + 12} y={node.y + 18}
                  font-size="12" font-weight="600"
                  fill="var(--text-primary)"
                  font-family="var(--font-sans)"
                >{name}</text>
                {/* Status */}
                <text
                  x={node.x + 12} y={node.y + 33}
                  font-size="10"
                  fill={isActive ? 'var(--green)' : 'var(--text-tertiary)'}
                  font-family="var(--font-sans)"
                >{statusText} · {node.agent.eventCount} events</text>
                {/* Model */}
                <text
                  x={node.x + 12} y={node.y + 48}
                  font-size="10"
                  fill="var(--text-dim)"
                  font-family="var(--font-mono)"
                >{modelTrunc}</text>
              </g>
            );
          }}
        </For>
      </svg>
    </div>
  );
}
