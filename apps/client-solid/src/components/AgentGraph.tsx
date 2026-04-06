import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import {
  graphAgents,
  filteredEvents,
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
  computeClusterLayout,
  METRO_COLORS,
  NODE_H,
  NODE_W,
  stableTextHash,
  statusDot,
  summarizeMeta,
  wrapLabel,
} from '../widgets/agent-graph/graphLayout';

export default function AgentGraph() {
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<GraphAgentFilter>('all');
  const [selectedGraphId, setSelectedGraphId] = createSignal<string | null>(null);
  const [focusedRootGraphId, setFocusedRootGraphId] = createSignal<string | null>(null);
  const [graphViewport, setGraphViewport] = createSignal<HTMLDivElement | undefined>();
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

  const layout = createMemo(() => computeClusterLayout(roots(), children()));

  const applyGraphFit = () => {
    const el = graphViewport();
    if (!el || nodes().length === 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw < 24 || ch < 24) return;
    const L = layout();
    const z = Math.min(2.5, Math.max(0.3, Math.min(cw / L.width, ch / L.height) * 0.92));
    setZoom(z);
    setPan({ x: (cw - L.width * z) / 2, y: (ch - L.height * z) / 2 });
  };

  createEffect(() => {
    filter();
    graphViewport();
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
    return layout().rootPositions.get(node.graphId) ?? layout().childPositions.get(node.graphId) ?? { x: 0, y: 0 };
  };
  const edgePath = (parentId: string, childId: string) => {
    const parentPos = layout().rootPositions.get(parentId) ?? layout().childPositions.get(parentId);
    const childPos = layout().rootPositions.get(childId) ?? layout().childPositions.get(childId);
    if (!parentPos || !childPos) return undefined;
    return `M ${parentPos.x + NODE_W / 2} ${parentPos.y + NODE_H} C ${parentPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${(parentPos.y + NODE_H + childPos.y) / 2}, ${childPos.x + NODE_W / 2} ${childPos.y}`;
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
  const rootCount = () => roots().length;

  return (
    <div
      style="flex:1;overflow:hidden;position:relative;cursor:grab;user-select:none;"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <GraphAgentFilterTabPanel
        value={filter()}
        onChange={setFilter}
        counts={{
          active: graphNodes().filter((node) => isNodeActive(node)).length,
          idle: graphNodes().filter((node) => !isNodeActive(node)).length,
          all: graphNodes().length,
        }}
      />

      {/* Zoom controls bottom-right */}
      <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:4px;z-index:10;">
        <button class="graph-zoom-btn" onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>+</button>
        <button class="graph-zoom-btn graph-zoom-btn--fit" type="button" onClick={() => applyGraphFit()}>Fit</button>
        <button class="graph-zoom-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}>-</button>
      </div>

      <div
        ref={setGraphViewport}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={TAB_IDS[filter()]}
        style="position:absolute;inset:0;overflow:hidden;"
      >
        <Show when={nodes().length > 0} fallback={
          <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:28px;">
            <div style="max-width:420px;padding:18px 20px;border:1px solid var(--border);border-radius:14px;text-align:center;">
              <p style="font-size:var(--text-base);font-weight:600;color:var(--text-primary);margin-bottom:6px;">No agents to display</p>
              <p style="font-size:var(--text-sm);line-height:1.5;color:var(--text-dim);">Try changing the filter or selecting a different project.</p>
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
                      stroke-opacity={edge.isActive ? '0.68' : '0.34'}
                      stroke-width={edge.isActive ? '2.8' : '1.9'}
                      stroke-dasharray={edge.isActive ? undefined : '8 8'}
                      stroke-linecap="round"
                      filter="url(#metro-glow)"
                    />
                    <Show when={edge.isActive}>
                      <circle r="3.2" fill={edge.lineColor} opacity="0.95">
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
                    x={pos().x} y={pos().y} width={NODE_W} height={NODE_H} rx="10"
                    fill="var(--bg-secondary)"
                    stroke={nodeStroke()}
                    stroke-opacity={isSel() ? 1 : 0.72}
                    stroke-width={isSel() ? 2.4 : 1.8}
                  />
                  <circle cx={pos().x + 16} cy={pos().y + 18} r="6.5" fill={lineColor()} opacity="0.22" />
                  <circle cx={pos().x + 16} cy={pos().y + 18} r="4.5" fill={statusDot(agent)} />
                  <text x={pos().x + 30} y={pos().y + 22} font-size="16" font-weight="700" fill="var(--text-primary)" font-family="var(--font-sans)">
                    {lineOne}
                  </text>
                  <Show when={lineTwo}>
                    <text x={pos().x + 30} y={pos().y + 38} font-size="16" font-weight="700" fill="var(--text-primary)" font-family="var(--font-sans)">
                      {lineTwo}
                    </text>
                  </Show>
                  <text x={pos().x + 16} y={pos().y + 62} font-size="14" fill="var(--text-secondary)" font-family="var(--font-sans)">
                    {summarizeMeta(agent)}
                  </text>
                  <text x={pos().x + 16} y={pos().y + 78} font-size="14" fill="var(--text-dim)" font-family="var(--font-sans)">
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
  );
}
