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
  agentLabel,
  computeHierarchicalLayout,
  graphSecondaryLine,
  graphTelemetryMeta,
  METRO_COLORS,
  NODE_H,
  NODE_W,
  stableTextHash,
  statusDot,
  wrapLabel,
} from '../widgets/agent-graph/graphLayout';

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2;

export default function AgentGraph() {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<GraphAgentFilter>('all');
  const [selectedGraphId, setSelectedGraphId] = createSignal<string | null>(null);
  const [focusedRootGraphId, setFocusedRootGraphId] = createSignal<string | null>(null);
  const [graphViewport, setGraphViewport] = createSignal<HTMLDivElement | undefined>();
  const [hoveredEdgeKey, setHoveredEdgeKey] = createSignal<string | null>(null);
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
      return inferredParent ? { ...node, parentGraphId: inferredParent } : node;
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
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(cw / L.width, ch / L.height) * 0.92));
    setZoom(z);
    setPan({ x: (cw - L.width * z) / 2, y: (ch - L.height * z) / 2 });
  };

  /** Refit when visible nodes or viewport change. Filter is included via roots/children signatures (ux-spec §1 soft refit: layout recomputes immediately when filter changes). */
  createEffect(() => {
    graphViewport();
    layout().width;
    layout().height;
    filter();
    roots()
      .map((node) => node.graphId)
      .join('|');
    children()
      .map((node) => node.graphId)
      .join('|');
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
    return `M ${parentPos.x + NODE_W / 2} ${parentPos.y + NODE_H} C ${parentPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${childPos.y}`;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + (e.deltaY > 0 ? -0.08 : 0.08))));
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
  const rootCount = () => roots().length;

  const parentPrimaryForMeta = (child: GraphNode): string | undefined => {
    const pid = child.parentGraphId;
    if (!pid) return undefined;
    const parent = nodeById().get(pid);
    if (!parent) return undefined;
    const [lineOne] = wrapLabel(agentLabel(parent));
    return lineOne;
  };

  return (
    <div
      class="flex min-h-0 flex-1 select-none flex-col overflow-hidden bg-[var(--bg-canvas)]"
    >
      <div class="event-stream-toolbar graph-graph-toolbar">
        <GraphAgentFilterTabPanel
          value={filter()}
          onChange={setFilter}
          counts={{
            active: graphNodes().filter((node) => isNodeActive(node)).length,
            idle: graphNodes().filter((node) => !isNodeActive(node)).length,
            all: graphNodes().length,
          }}
        />
      </div>

      <div
        class="relative min-h-0 flex-1 cursor-grab"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Zoom controls bottom-right */}
        <div class="absolute bottom-3 right-3 z-10 flex gap-2">
          <button type="button" class="graph-zoom-btn" onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + 0.2))}>+</button>
          <button type="button" class="graph-zoom-btn graph-zoom-btn--fit" onClick={() => applyGraphFit()}>Fit</button>
          <button type="button" class="graph-zoom-btn" onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - 0.2))}>-</button>
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
            width={layout().width * zoom()}
            height={layout().height * zoom()}
            viewBox={`0 0 ${layout().width} ${layout().height}`}
            style={`transform:translate(${pan().x}px,${pan().y}px);`}
          >

          {/* Edges — rest 1px, hover/focus 1.5px (ux-spec §1). */}
          <For each={edges()}>
            {(edge) => {
              const pathD = () => edgePath(edge.parentId, edge.childId);
              const hovered = () => hoveredEdgeKey() === edge.key;
              const strokeW = () => (hovered() ? 1.5 : 1);
              return (
                <Show when={pathD()}>
                  <>
                    <path
                      d={pathD()!}
                      fill="none"
                      stroke={edge.lineColor}
                      stroke-opacity={edge.isActive ? '0.72' : '0.42'}
                      stroke-width={strokeW()}
                      stroke-dasharray={edge.isActive ? undefined : '6 6'}
                      stroke-linecap="round"
                      style={{ 'pointer-events': 'stroke' }}
                      onMouseEnter={() => setHoveredEdgeKey(edge.key)}
                      onMouseLeave={() => setHoveredEdgeKey(null)}
                    />
                    <Show when={edge.isActive}>
                      <circle r="2.5" fill={edge.lineColor} opacity="0.9" style={{ 'pointer-events': 'none' }}>
                        <animateMotion
                          dur={`${1.9 + (edge.key.length % 5) * 0.25}s`}
                          repeatCount="indefinite"
                          rotate="auto"
                          path={pathD()!}
                        />
                      </circle>
                    </Show>
                  </>
                </Show>
              );
            }}
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
              const secondary = graphSecondaryLine(agent);
              const hasSecondPrimary = Boolean(lineTwo);
              const secondaryBaseline = hasSecondPrimary ? 58 : 42;
              const metaBaseline = secondary
                ? (hasSecondPrimary ? 76 : 60)
                : (hasSecondPrimary ? 60 : 48);
              const statusBaseline = secondary
                ? (hasSecondPrimary ? 92 : 76)
                : (hasSecondPrimary ? 76 : 62);
              const lineColor = () => nodeLineColor(agent.graphId);
              const nodeStroke = () => (isSel() ? 'var(--accent)' : lineColor());
              return (
                <g
                  style="cursor:pointer;"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedGraphId(agent.graphId);
                    if (!agent.parentGraphId) {
                      setFocusedRootGraphId((current) =>
                        current === agent.graphId ? null : agent.graphId,
                      );
                    }
                    if (agent.agentId) {
                      selectAgent(agent.agentId);
                    } else {
                      selectAgent(null);
                    }
                  }}
                >
                  <rect
                    x={pos().x} y={pos().y} width={NODE_W} height={NODE_H} rx="8"
                    fill="var(--bg-secondary)"
                    stroke={nodeStroke()}
                    stroke-opacity={isSel() ? 1 : 0.72}
                    stroke-width={isSel() ? 2 : 1.5}
                  />
                  <circle cx={pos().x + 14} cy={pos().y + 20} r="5" fill={lineColor()} opacity="0.2" />
                  <circle cx={pos().x + 14} cy={pos().y + 20} r="3.5" fill={statusDot(agent)} />
                  <text
                    x={pos().x + 28}
                    y={pos().y + 24}
                    font-size="15"
                    font-weight="600"
                    fill="var(--text-primary)"
                    font-family="var(--font-sans)"
                  >
                    {lineOne}
                  </text>
                  <Show when={lineTwo}>
                    <text
                      x={pos().x + 28}
                      y={pos().y + 40}
                      font-size="15"
                      font-weight="600"
                      fill="var(--text-primary)"
                      font-family="var(--font-sans)"
                    >
                      {lineTwo}
                    </text>
                  </Show>
                  <Show when={secondary}>
                    <text
                      x={pos().x + 12}
                      y={pos().y + secondaryBaseline}
                      font-size="13"
                      font-weight="400"
                      fill="var(--text-secondary)"
                      font-family="var(--font-sans)"
                    >
                      {secondary}
                    </text>
                  </Show>
                  <text
                    x={pos().x + 12}
                    y={pos().y + metaBaseline}
                    font-size="12"
                    font-weight="400"
                    fill="var(--text-tertiary)"
                    font-family="var(--font-mono)"
                  >
                    {graphTelemetryMeta(agent, parentPrimaryForMeta(agent))}
                  </text>
                  <text
                    x={pos().x + 12}
                    y={pos().y + statusBaseline}
                    font-size="11"
                    font-weight="400"
                    fill="var(--text-tertiary)"
                    font-family="var(--font-sans)"
                  >
                    {!agent.parentGraphId
                      ? `${rootCount()} root${rootCount() === 1 ? '' : 's'}`
                      : agent.isActive
                        ? 'Active'
                        : agent.statusTone === 'blocked'
                          ? 'Blocked'
                          : 'Idle'}
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
