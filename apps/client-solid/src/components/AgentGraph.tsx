import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { squares_2x2 } from 'solid-heroicons/solid';
import {
  graphAgents,
  graphScopeEvents,
  selectAgent,
  selectedAgent,
} from '../lib/store';
import GraphAgentFilterTabPanel, {
  PANEL_ID,
  TAB_IDS,
  type GraphAgentFilter,
} from './GraphAgentFilterTabPanel';
import {
  type GraphNode,
  computeHierarchicalLayout,
  graphPrimaryLabel,
  graphRuntimeLine,
  graphSubtitle,
  METRO_COLORS,
  NODE_H,
  NODE_W,
  nodeTooltip,
  stableTextHash,
  statusDot,
} from '../widgets/agent-graph/graphLayout';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_FACTOR = 1.12;

export default function AgentGraph() {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [panStart, setPanStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<GraphAgentFilter>('all');
  const [selectedGraphId, setSelectedGraphId] = createSignal<string | null>(null);
  const [focusedRootGraphId, setFocusedRootGraphId] = createSignal<string | null>(null);
  const [graphViewport, setGraphViewport] = createSignal<HTMLDivElement | undefined>();
  const [hoveredNodeId, setHoveredNodeId] = createSignal<string | null>(null);

  const graphNodes = createMemo<GraphNode[]>(() => {
    const all = graphAgents();
    if (all.length === 0) return [];

    const evts = graphScopeEvents();
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

    const mainRoots = mapped.filter((node) => node.agentId === null);
    const primaryRootId = mapped.find((node) => node.agentId === null)?.graphId;
    const closestMainRootId = (child: GraphNode): string | undefined => {
      if (mainRoots.length === 0) return undefined;
      const childRuntime = child.runtimeLabel?.trim().toLowerCase();
      const childModel = child.modelName?.trim().toLowerCase();
      let bestRoot = mainRoots[0];
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const root of mainRoots) {
        let score = -Math.abs((root.lastEventAt || 0) - (child.lastEventAt || 0));
        if (childRuntime && root.runtimeLabel?.trim().toLowerCase() === childRuntime) {
          score += 60_000;
        }
        if (childModel && root.modelName?.trim().toLowerCase() === childModel) {
          score += 30_000;
        }
        if (score > bestScore) {
          bestScore = score;
          bestRoot = root;
        }
      }
      return bestRoot.graphId;
    };
    return mapped.map((node) => {
      if (!node.agentId) return node;
      const rawParent = node.parentId || parentMap.get(node.agentId);
      if (!rawParent) return node;
      if (rawParent === 'main' && primaryRootId) {
        return { ...node, parentGraphId: closestMainRootId(node) || primaryRootId };
      }
      const inferredParent = graphIdByAgentId.get(rawParent);
      if (inferredParent) return { ...node, parentGraphId: inferredParent };
      return node;
    });
  });

  const isNodeActive = (node: GraphNode) => node.isActive || node.statusTone === 'active';
  const rootsAll = createMemo(() => graphNodes().filter((node) => !node.parentGraphId));
  const childrenAll = createMemo(() => graphNodes().filter((node) => Boolean(node.parentGraphId)));
  const rootsByMode = createMemo(() => {
    if (filter() === 'all') return rootsAll();
    if (filter() === 'active') return rootsAll().filter((node) => isNodeActive(node));
    return rootsAll().filter((node) => !isNodeActive(node));
  });
  const childrenByMode = createMemo(() => {
    if (filter() === 'all') return childrenAll();
    if (filter() === 'active') return childrenAll().filter((node) => isNodeActive(node));
    return childrenAll().filter((node) => !isNodeActive(node));
  });

  createEffect(() => {
    const focusId = focusedRootGraphId();
    if (!focusId) return;
    if (!rootsByMode().some((root) => root.graphId === focusId)) {
      setFocusedRootGraphId(null);
    }
  });

  const roots = createMemo(() => {
    const focusId = focusedRootGraphId();
    const r = rootsByMode();
    if (!focusId) return r;
    return r.filter((root) => root.graphId === focusId);
  });
  const children = createMemo(() => {
    const focusId = focusedRootGraphId();
    const c = childrenByMode();
    if (!focusId) return c;
    return c.filter((child) => child.parentGraphId === focusId);
  });
  const nodes = createMemo(() => [...roots(), ...children()]);
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
        isActive:
          (child.isActive || child.statusTone === 'active')
          && (nodeById().get(child.parentGraphId || '')?.isActive
            || nodeById().get(child.parentGraphId || '')?.statusTone === 'active'),
      }))
      .filter((edge) => visibleIds.has(edge.parentId) && visibleIds.has(edge.childId));
  });

  const layout = createMemo(() => computeHierarchicalLayout(nodes()));

  const applyGraphFit = () => {
    const el = graphViewport();
    if (!el || nodes().length === 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw < 24 || ch < 24) return;
    const L = layout();
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(cw / L.width, ch / L.height) * 0.88));
    setZoom(z);
    setPan({ x: (cw - L.width * z) / 2, y: (ch - L.height * z) / 2 });
  };

  createEffect(() => {
    graphViewport();
    layout().width;
    layout().height;
    filter();
    roots().map((n) => n.graphId).join('|');
    children().map((n) => n.graphId).join('|');
    requestAnimationFrame(() => requestAnimationFrame(() => applyGraphFit()));
  });

  createEffect(() => {
    const el = graphViewport();
    if (!el) return;
    const ro = new ResizeObserver(() => applyGraphFit());
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const nodePos = (node: GraphNode) => {
    return layout().positions.get(node.graphId) ?? { x: 0, y: 0 };
  };

  const edgePath = (parentId: string, childId: string) => {
    const parentPos = layout().positions.get(parentId);
    const childPos = layout().positions.get(childId);
    if (!parentPos || !childPos) return undefined;
    const px = parentPos.x + NODE_W / 2;
    const py = parentPos.y + NODE_H;
    const cx = childPos.x + NODE_W / 2;
    const cy = childPos.y;
    const midY = py + (cy - py) / 2;
    return `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const el = graphViewport();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldZ = zoom();
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newZ = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZ * factor));
    const p = pan();
    const worldX = (mx - p.x) / oldZ;
    const worldY = (my - p.y) / oldZ;
    setPan({ x: mx - worldX * newZ, y: my - worldY * newZ });
    setZoom(newZ);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart(pan());
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging()) return;
    const ds = dragStart();
    const ps = panStart();
    setPan({ x: ps.x + (e.clientX - ds.x), y: ps.y + (e.clientY - ds.y) });
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div class="flex min-h-0 flex-1 select-none flex-col overflow-hidden bg-[var(--bg-canvas)]">
      <div class="event-stream-toolbar graph-graph-toolbar">
        <GraphAgentFilterTabPanel
          value={filter()}
          onChange={setFilter}
          counts={{
            active: graphNodes().filter((n) => isNodeActive(n)).length,
            idle: graphNodes().filter((n) => !isNodeActive(n)).length,
            all: graphNodes().length,
          }}
        />
      </div>

      <div
        class="relative min-h-0 flex-1"
        style={{ cursor: dragging() ? 'grabbing' : 'grab' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div class="absolute bottom-3 right-3 z-10 flex gap-1.5">
          <button type="button" class="graph-zoom-btn" onClick={() => {
            const el = graphViewport();
            if (!el) return;
            const cw = el.clientWidth / 2;
            const ch = el.clientHeight / 2;
            const oldZ = zoom();
            const newZ = Math.min(ZOOM_MAX, oldZ * ZOOM_FACTOR);
            const p = pan();
            const wx = (cw - p.x) / oldZ;
            const wy = (ch - p.y) / oldZ;
            setPan({ x: cw - wx * newZ, y: ch - wy * newZ });
            setZoom(newZ);
          }}>+</button>
          <button type="button" class="graph-zoom-btn graph-zoom-btn--fit" onClick={() => applyGraphFit()}>Fit</button>
          <button type="button" class="graph-zoom-btn" onClick={() => {
            const el = graphViewport();
            if (!el) return;
            const cw = el.clientWidth / 2;
            const ch = el.clientHeight / 2;
            const oldZ = zoom();
            const newZ = Math.max(ZOOM_MIN, oldZ / ZOOM_FACTOR);
            const p = pan();
            const wx = (cw - p.x) / oldZ;
            const wy = (ch - p.y) / oldZ;
            setPan({ x: cw - wx * newZ, y: ch - wy * newZ });
            setZoom(newZ);
          }}>-</button>
        </div>

        <div
          ref={setGraphViewport}
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={TAB_IDS[filter()]}
          style="position:absolute;inset:0;overflow:hidden;background:var(--bg-canvas);"
        >
        <Show when={nodes().length > 0} fallback={
          <div class="flex h-full items-center justify-center px-4 py-6">
            <div class="flex max-w-[360px] flex-col items-center gap-3 text-center">
              <Icon path={squares_2x2} style="width:28px;height:28px;color:var(--text-tertiary);flex-shrink:0;" />
              <p style="font-size:var(--text-base);font-weight:600;color:var(--text-primary);margin:0;">No agents to show</p>
              <p style="font-size:var(--text-sm);line-height:1.5;color:var(--text-secondary);margin:0;">
                Add an agent or adjust filters to see relationships on the graph.
              </p>
              <Show when={filter() !== 'all'}>
                <button
                  type="button"
                  class="graph-empty-clear-filters"
                  onClick={() => setFilter('all')}
                >
                  Clear filters
                </button>
              </Show>
            </div>
          </div>
        }>
          <svg
            width="100%"
            height="100%"
            viewBox={`${-pan().x / zoom()} ${-pan().y / zoom()} ${(graphViewport()?.clientWidth ?? layout().width) / zoom()} ${(graphViewport()?.clientHeight ?? layout().height) / zoom()}`}
          >
          {/* Edges — org-chart style right-angle lines */}
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
                      stroke-opacity={edge.isActive ? '0.6' : '0.3'}
                      stroke-width={1}
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <Show when={edge.isActive}>
                      <circle r="2.5" fill={edge.lineColor} opacity="0.8" style={{ 'pointer-events': 'none' }}>
                        <animateMotion
                          dur={`${2 + (edge.key.length % 5) * 0.3}s`}
                          repeatCount="indefinite"
                          path={pathD()!}
                        />
                      </circle>
                    </Show>
                  </>
                </Show>
              );
            }}
          </For>

          {/* Nodes */}
          <For each={nodes()}>
            {(agent) => {
              const pos = () => nodePos(agent);
              const selId = selectedAgent();
              const isSel = () =>
                selectedGraphId() === agent.graphId
                || (agent.agentId ? selId === agent.agentId : false);
              const isHovered = () => hoveredNodeId() === agent.graphId;
              const primary = graphPrimaryLabel(agent);
              const subtitle = graphSubtitle(agent);
              const runtime = graphRuntimeLine(agent);
              const lineColor = () => nodeLineColor(agent.graphId);
              const nodeStroke = () => (isSel() ? 'var(--accent)' : 'var(--border)');
              const fillColor = () => {
                if (isSel()) return 'var(--bg-elevated)';
                if (isHovered()) return 'var(--bg-card-hover)';
                return 'var(--bg-card)';
              };
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
                  onDblClick={(event) => {
                    event.stopPropagation();
                    if (!agent.parentGraphId) {
                      setFocusedRootGraphId((current) =>
                        current === agent.graphId ? null : agent.graphId,
                      );
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(agent.graphId)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <title>{nodeTooltip(agent)}</title>
                  <rect
                    x={pos().x} y={pos().y} width={NODE_W} height={NODE_H} rx="8"
                    fill={fillColor()}
                    stroke={nodeStroke()}
                    stroke-opacity={isSel() ? 1 : 0.6}
                    stroke-width={isSel() ? 1.5 : 1}
                  />
                  {/* Primary label */}
                  <text
                    x={pos().x + 14}
                    y={pos().y + 22}
                    font-size="14"
                    font-weight="600"
                    fill="var(--text-primary)"
                    font-family="var(--font-sans)"
                  >
                    {primary}
                  </text>
                  {/* Subtitle */}
                  <Show when={subtitle}>
                    <text
                      x={pos().x + 14}
                      y={pos().y + 40}
                      font-size="12"
                      font-weight="400"
                      fill="var(--text-secondary)"
                      font-family="var(--font-sans)"
                    >
                      {subtitle}
                    </text>
                  </Show>
                  {/* Runtime */}
                  <Show when={runtime}>
                    <text
                      x={pos().x + 14}
                      y={pos().y + (subtitle ? 56 : 40)}
                      font-size="11"
                      font-weight="500"
                      fill="var(--text-secondary)"
                      font-family="var(--font-mono)"
                    >
                      {runtime}
                    </text>
                  </Show>
                  {/* Status dot — bottom left */}
                  <circle
                    cx={pos().x + 14}
                    cy={pos().y + NODE_H - 14}
                    r="3.5"
                    fill={statusDot(agent)}
                  >
                    <Show when={agent.statusTone === 'active' || agent.isActive}>
                      <animate
                        attributeName="opacity"
                        values="1;0.4;1"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </Show>
                  </circle>
                  <text
                    x={pos().x + 22}
                    y={pos().y + NODE_H - 10}
                    font-size="9"
                    font-weight="500"
                    fill="var(--text-dim)"
                    font-family="var(--font-sans)"
                  >
                    {agent.statusLabel || (agent.isActive ? 'Active' : 'Idle')}
                  </text>
                  {/* Event count — bottom right */}
                  <text
                    x={pos().x + NODE_W - 14}
                    y={pos().y + NODE_H - 10}
                    font-size="10"
                    font-weight="400"
                    fill="var(--text-secondary)"
                    font-family="var(--font-mono)"
                    text-anchor="end"
                  >
                    {`${agent.eventCount} events`}
                  </text>
                </g>
              );
            }}
          </For>

          </svg>
        </Show>
        </div>
      </div>
    </div>
  );
}
