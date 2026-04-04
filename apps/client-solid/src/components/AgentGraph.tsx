import { For, Show, createMemo, createSignal } from 'solid-js';
import { graphAgents, filteredEvents, selectAgent, selectedAgent } from '../lib/store';
import type { AgentInfo } from '../lib/types';
import { mapAgentTypeLabel } from '../lib/agentNaming';

const NODE_W = 248;
const NODE_H = 94;
const H_GAP = 30;
const V_GAP = 86;
const MAX_PER_ROW = 5;
const MAX_PEER_PULSES = 6;
const METRO_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
];

type StatusColor = 'var(--green)' | 'var(--yellow)' | 'var(--accent)' | 'var(--text-dim)';
type GraphNode = AgentInfo & {
  graphId: string;
  parentGraphId?: string;
};

function statusDot(agent: AgentInfo): StatusColor {
  if (agent.statusTone === 'active' || agent.isActive) return 'var(--green)';
  if (agent.statusTone === 'blocked' || agent.statusTone === 'attention') return 'var(--yellow)';
  if (agent.statusTone === 'idle') return 'var(--accent)';
  return 'var(--text-dim)';
}

function agentLabel(agent: AgentInfo): string {
  const name = agent.displayName?.trim();
  if (name && name.toLowerCase() !== 'unknown') {
    return name;
  }
  const task = agent.assignment || agent.currentAction || agent.nextAction;
  if (task) {
    return task.length > 32 ? `${task.slice(0, 31)}…` : task;
  }
  if (agent.agentType && agent.agentType !== 'main') {
    return mapAgentTypeLabel(agent.agentType) || agent.agentType;
  }
  return 'Session';
}

function summarizeMeta(agent: AgentInfo): string {
  const model = agent.modelName?.trim();
  if (model) return `${agent.eventCount} events · ${model}`;
  return `${agent.eventCount} events`;
}

function stableTextHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function wrapLabel(label: string): [string, string?] {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (!normalized) return ['Session'];
  if (normalized.length <= 30) return [normalized];

  const words = normalized.split(' ');
  let first = '';
  let second = '';
  for (const word of words) {
    const firstCandidate = first ? `${first} ${word}` : word;
    if (firstCandidate.length <= 26) {
      first = firstCandidate;
      continue;
    }

    const secondCandidate = second ? `${second} ${word}` : word;
    if (secondCandidate.length <= 28) {
      second = secondCandidate;
    } else {
      second = `${second.slice(0, 25)}...`;
      break;
    }
  }

  if (!first) {
    return [normalized.slice(0, 26), `${normalized.slice(26, 54)}...`];
  }
  return second ? [first, second] : [first];
}

export default function AgentGraph() {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<'active' | 'idle' | 'all'>('all');
  const [selectedGraphId, setSelectedGraphId] = createSignal<string | null>(null);
  const graphNodes = createMemo<GraphNode[]>(() => {
    const all = graphAgents();
    if (all.length === 0) return [];

    const evts = filteredEvents();
    const parentMap = new Map<string, string>();
    for (const agent of all) {
      if (agent.parentId && agent.agentId) parentMap.set(agent.agentId, agent.parentId);
    }
    for (const event of evts) {
      if (event.hook_event_type === 'SubagentStart' && event.agent_id) {
        const parent =
          event.payload?.parent_agent_id
          || event.payload?.parent_id
          || event.payload?.parentId
          || 'main';
        parentMap.set(event.agent_id, parent);
      }
    }

    const graphIdByAgentId = new Map<string, string>();
    const mapped = all.map((agent, index) => {
      const fallbackKey = stableTextHash(
        `${agent.displayName}:${agent.lastEventAt}:${agent.eventCount}:${index}`,
      );
      const graphId = agent.agentId ?? `main-${fallbackKey}`;
      if (agent.agentId) graphIdByAgentId.set(agent.agentId, graphId);
      return { ...agent, graphId } satisfies GraphNode;
    });

    const primaryRootId = mapped.find((node) => node.agentId === null)?.graphId;
    return mapped.map((node) => {
      if (!node.agentId) return node;
      const rawParent = node.parentId || parentMap.get(node.agentId);
      if (!rawParent) return node;
      if (rawParent === 'main' && primaryRootId) {
        return { ...node, parentGraphId: primaryRootId };
      }
      const inferredParent = graphIdByAgentId.get(rawParent);
      return inferredParent ? { ...node, parentGraphId: inferredParent } : node;
    });
  });

  const nodes = createMemo(() => {
    const all = graphNodes();
    if (filter() === 'all') return all;
    const isRoot = (node: GraphNode) => !node.parentGraphId;
    if (filter() === 'active') {
      return all.filter((node) => isRoot(node) || node.isActive || node.statusTone === 'active');
    }
    return all.filter((node) => isRoot(node) || (!node.isActive && node.statusTone !== 'active'));
  });

  const roots = createMemo(() => nodes().filter((node) => !node.parentGraphId));
  const children = createMemo(() => nodes().filter((node) => Boolean(node.parentGraphId)));
  const nodeById = createMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of nodes()) map.set(node.graphId, node);
    return map;
  });
  const rootColorById = createMemo(() => {
    const map = new Map<string, string>();
    roots().forEach((root, index) => {
      map.set(root.graphId, METRO_COLORS[index % METRO_COLORS.length]);
    });
    return map;
  });
  const nodeLineColor = (graphId: string): string => {
    let currentId: string | undefined = graphId;
    let hops = 0;
    while (currentId && hops < 16) {
      const color = rootColorById().get(currentId);
      if (color) return color;
      const current = nodeById().get(currentId);
      currentId = current?.parentGraphId;
      hops += 1;
    }
    return '#22c55e';
  };

  const edges = createMemo(() => {
    const visibleIds = new Set(nodes().map((node) => node.graphId));
    return children()
      .map((child) => ({
        key: `${child.parentGraphId}->${child.graphId}`,
        childId: child.graphId,
        parentId: child.parentGraphId!,
        lineColor: nodeLineColor(child.graphId),
        childActive: child.isActive || child.statusTone === 'active',
      }))
      .filter((edge) => visibleIds.has(edge.parentId) && visibleIds.has(edge.childId));
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
      rootPositions.set(agent.graphId, { x: rootStartX + i * (NODE_W + H_GAP), y: 40 });
    });

    const childPositions = new Map<string, { x: number; y: number }>();
    c.forEach((agent, i) => {
      const row = Math.floor(i / MAX_PER_ROW);
      const col = i % MAX_PER_ROW;
      const rowCols = Math.min(c.length - row * MAX_PER_ROW, MAX_PER_ROW);
      const rowStartX = (width - (rowCols * (NODE_W + H_GAP) - H_GAP)) / 2;
      childPositions.set(agent.graphId, {
        x: rowStartX + col * (NODE_W + H_GAP),
        y: 40 + NODE_H + V_GAP + row * (NODE_H + V_GAP),
      });
    });

    return { width, height, rootPositions, childPositions };
  });
  const nodePos = (node: GraphNode) => {
    return layout().rootPositions.get(node.graphId) ?? layout().childPositions.get(node.graphId) ?? { x: 0, y: 0 };
  };
  const edgePath = (parentId: string, childId: string) => {
    const parentPos = layout().rootPositions.get(parentId) ?? layout().childPositions.get(parentId);
    const childPos = layout().rootPositions.get(childId) ?? layout().childPositions.get(childId);
    if (!parentPos || !childPos) return undefined;
    return `M ${parentPos.x + NODE_W / 2} ${parentPos.y + NODE_H} C ${parentPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${childPos.y}`;
  };
  const peerEdges = createMemo(() => {
    const activeChildren = children()
      .filter((node) => (node.isActive || node.statusTone === 'active') && node.parentGraphId)
      .sort((left, right) => (left.lastEventAt || 0) - (right.lastEventAt || 0));
    const grouped = new Map<string, GraphNode[]>();
    for (const child of activeChildren) {
      const parentId = child.parentGraphId!;
      const list = grouped.get(parentId) || [];
      list.push(child);
      grouped.set(parentId, list);
    }
    const links: Array<{ key: string; d: string; lineColor: string }> = [];
    for (const [parentId, siblingNodes] of grouped) {
      for (let index = 0; index < siblingNodes.length - 1; index += 1) {
        if (links.length >= MAX_PEER_PULSES) break;
        const left = siblingNodes[index];
        const right = siblingNodes[index + 1];
        const leftPos = nodePos(left);
        const rightPos = nodePos(right);
        const y = Math.min(leftPos.y, rightPos.y) - 16;
        const d = `M ${leftPos.x + NODE_W / 2} ${leftPos.y} C ${leftPos.x + NODE_W / 2} ${y}, ${rightPos.x + NODE_W / 2} ${y}, ${rightPos.x + NODE_W / 2} ${rightPos.y}`;
        links.push({
          key: `${parentId}:${left.graphId}:${right.graphId}`,
          d,
          lineColor: nodeLineColor(left.graphId),
        });
      }
      if (links.length >= MAX_PEER_PULSES) break;
    }
    return links;
  });

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
  const activeCount = () => graphNodes().filter((node) => node.isActive || node.statusTone === 'active').length;
  const idleCount = () => graphNodes().filter((node) => !node.isActive && node.statusTone !== 'active').length;

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
          { key: 'all' as const, label: `All (${graphAgents().length})` },
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

      <Show when={nodes().length > 0} fallback={
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
          <defs>
            <filter id="metro-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          <For each={edges()}>
            {(edge) => {
              const pathD = () => edgePath(edge.parentId, edge.childId);
              return (
                <Show when={pathD()}>
                  <>
                    <path
                      d={pathD()!}
                      fill="none"
                      stroke={edge.lineColor}
                      stroke-opacity="0.68"
                      stroke-width="2.8"
                      stroke-linecap="round"
                      filter="url(#metro-glow)"
                    />
                    <Show when={edge.childActive}>
                      <path
                        class="graph-edge-flow"
                        style={{ 'animation-delay': `${(edge.key.length % 7) * 120}ms` }}
                        d={pathD()!}
                        fill="none"
                        stroke={edge.lineColor}
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-dasharray="9 11"
                      />
                    </Show>
                  </>
                </Show>
              );
            }}
          </For>

          <For each={peerEdges()}>
            {(peer, index) => (
              <>
                <path
                  d={peer.d}
                  fill="none"
                  stroke={peer.lineColor}
                  stroke-opacity="0.28"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path
                  class="graph-peer-flow"
                  style={{ 'animation-delay': `${index() * 140}ms` }}
                  d={peer.d}
                  fill="none"
                  stroke={peer.lineColor}
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-dasharray="4 12"
                />
                <path
                  class="graph-peer-flow graph-peer-flow-reverse"
                  style={{ 'animation-delay': `${index() * 140 + 240}ms` }}
                  d={peer.d}
                  fill="none"
                  stroke={peer.lineColor}
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-dasharray="4 12"
                />
              </>
            )}
          </For>

          {/* All nodes */}
          <For each={[...roots(), ...children()]}>
            {(agent) => {
              const pos = () => nodePos(agent);
              const selectedId = selectedAgent();
              const isSel = () =>
                selectedGraphId() === agent.graphId
                || (agent.agentId ? selectedId === agent.agentId : false);
              const [lineOne, lineTwo] = wrapLabel(agentLabel(agent));
              const lineColor = () => nodeLineColor(agent.graphId);
              const nodeStroke = () => (isSel() ? 'var(--accent)' : lineColor());
              return (
                <g
                  style="cursor:pointer;"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedGraphId(agent.graphId);
                    if (agent.agentId) {
                      selectAgent(agent.agentId);
                    } else {
                      selectAgent(null);
                    }
                  }}
                >
                  <rect
                    x={pos().x} y={pos().y} width={NODE_W} height={NODE_H} rx="10"
                    fill="var(--bg-secondary)"
                    stroke={nodeStroke()}
                    stroke-opacity={isSel() ? 1 : 0.72}
                    stroke-width={isSel() ? 2.4 : 1.8}
                  />
                  <circle cx={pos().x + 16} cy={pos().y + 18} r="6.5" fill={lineColor()} opacity="0.22" />
                  <circle cx={pos().x + 16} cy={pos().y + 18} r="4.5" fill={statusDot(agent)} />
                  <text x={pos().x + 30} y={pos().y + 22} font-size="13" font-weight="700" fill="var(--text-primary)" font-family="var(--font-sans)">
                    {lineOne}
                  </text>
                  <Show when={lineTwo}>
                    <text x={pos().x + 30} y={pos().y + 38} font-size="13" font-weight="700" fill="var(--text-primary)" font-family="var(--font-sans)">
                      {lineTwo}
                    </text>
                  </Show>
                  <text x={pos().x + 16} y={pos().y + 62} font-size="10" fill="var(--text-secondary)" font-family="var(--font-sans)">
                    {summarizeMeta(agent)}
                  </text>
                  <text x={pos().x + 16} y={pos().y + 78} font-size="10" fill="var(--text-dim)" font-family="var(--font-sans)">
                    {agent.isActive ? 'Active' : agent.statusTone === 'blocked' ? 'Blocked' : 'Idle'}
                  </text>
                </g>
              );
            }}
          </For>

          {/* Decorative metro rail */}
          <g opacity="0.5">
            <line
              x1={layout().width - 26}
              y1={26}
              x2={layout().width - 26}
              y2={layout().height - 26}
              stroke="#22c55e"
              stroke-width="2"
              stroke-linecap="round"
            />
            <For each={[0, 1, 2, 3, 4, 5, 6]}>
              {(index) => (
                <line
                  x1={layout().width - 34}
                  y1={42 + index * 52}
                  x2={layout().width - 18}
                  y2={42 + index * 52}
                  stroke="#22c55e"
                  stroke-width="1.2"
                />
              )}
            </For>
          </g>
        </svg>
      </Show>
    </div>
  );
}
