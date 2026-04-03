import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import {
  filteredAgents,
  selectAgent,
  selectedAgent,
  selectedProjectFocusSnapshot,
  selectedProjectSnapshot,
  selectedSessionSnapshot,
} from '../lib/store';
import { connectionState, hasStreamData } from '../lib/ws';
import type { AgentInfo, SessionInfo } from '../lib/types';

const NODE_W = 180;
const NODE_H = 76;
const H_GAP = 16;
const V_GAP = 20;
const LANE_HEADER_W = 238;
const LANE_ROW_H = 126;

export default function AgentGraph() {
  let containerRef: HTMLDivElement | undefined;
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [filter, setFilter] = createSignal<'active' | 'idle' | 'all'>('active');

  const visibleSessions = createMemo(() => {
    const project = selectedProjectSnapshot();
    if (!project) return [];

    const focusedSession = selectedSessionSnapshot();
    const sessions = focusedSession
      ? project.sessions.filter((session) => session.sessionId === focusedSession.sessionId)
      : project.sessions;

    return sessions
      .map((session) => ({
        ...session,
        agents: filterAgents(session.agents, filter()),
      }))
      .filter((session) => session.agents.length > 0 || session.isActive);
  });

  const activeCount = createMemo(() => filteredAgents().filter((agent) => agent.isActive).length);
  const idleCount = createMemo(() => filteredAgents().filter((agent) => !agent.isActive && agent.eventCount > 0).length);
  const totalCount = createMemo(() => filteredAgents().length);
  const focus = createMemo(() => selectedProjectFocusSnapshot());
  const emptyState = createMemo(() => {
    const project = selectedProjectSnapshot();
    const session = selectedSessionSnapshot();
    const visible = visibleSessions();

    if (connectionState() === 'connecting' && !hasStreamData()) {
      return {
        title: 'Loading agent graph',
        body: 'Waiting for the first project snapshot to populate this view.',
      };
    }

    if (connectionState() === 'disconnected' && !hasStreamData()) {
      return {
        title: 'Disconnected',
        body: 'No live project snapshot has arrived yet.',
      };
    }

    if ((project?.sessions ?? []).length === 0) {
      return {
        title: 'No sessions captured for this project yet',
        body: 'The daemon has not reported any sessions for the selected project.',
      };
    }

    if (visible.length === 0) {
      if (session) {
        return {
          title: 'No agents match the selected session',
          body: 'Try a different session or widen the agent filter.',
        };
      }

      if (filter() !== 'all') {
        return {
          title: 'No agents match the active graph filter',
          body: 'Switch to All to reveal every agent in the project.',
        };
      }

      return {
        title: 'No agents available for the current graph',
        body: 'This project has sessions, but none of them include drawable agent nodes yet.',
      };
    }

    return null;
  });

  const layout = createMemo(() => {
    const sessions = visibleSessions();
    if (sessions.length === 0) {
      return {
        nodes: [] as Array<{ agent: AgentInfo; session: SessionInfo; x: number; y: number }>,
        edges: [] as Array<{ x1: number; y1: number; x2: number; y2: number }>,
        lanes: [] as Array<{ session: SessionInfo; y: number }>,
        width: 520,
        height: 220,
      };
    }

    const maxAgents = Math.max(1, ...sessions.map((session) => Math.max(1, session.agents.length)));
    const width = LANE_HEADER_W + maxAgents * (NODE_W + H_GAP) - H_GAP + 48;
    const height = 28 + sessions.length * (LANE_ROW_H + V_GAP) + 24;

    const positions = new Map<string, { x: number; y: number }>();
    const nodes: Array<{ agent: AgentInfo; session: SessionInfo; x: number; y: number }> = [];
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const lanes: Array<{ session: SessionInfo; y: number }> = [];

    sessions.forEach((session, laneIndex) => {
      const y = 24 + laneIndex * (LANE_ROW_H + V_GAP);
      const nodeY = y + 38;
      lanes.push({ session, y });

      session.agents.forEach((agent, agentIndex) => {
        const x = LANE_HEADER_W + 20 + agentIndex * (NODE_W + H_GAP);
        const key = `${session.sessionId}:${agent.agentId || '__main__'}`;
        positions.set(key, { x, y: nodeY });
        nodes.push({ agent, session, x, y: nodeY });
      });
    });

    sessions.forEach((session) => {
      for (const agent of session.agents) {
        if (!agent.parentId) continue;

        const parentKey = `${session.sessionId}:${agent.parentId === 'main' ? '__main__' : agent.parentId}`;
        const childKey = `${session.sessionId}:${agent.agentId || '__main__'}`;
        const parent = positions.get(parentKey);
        const child = positions.get(childKey);

        if (!parent || !child) continue;
        edges.push({
          x1: parent.x + NODE_W / 2,
          y1: parent.y + NODE_H,
          x2: child.x + NODE_W / 2,
          y2: child.y,
        });
      }
    });

    return { nodes, edges, lanes, width, height };
  });

  onMount(() => {
    if (containerRef) {
      const cw = containerRef.clientWidth;
      const lw = layout().width;
      if (lw < cw) {
        setPan({ x: (cw - lw) / 2, y: 20 });
      }
    }
  });

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((value) => Math.max(0.3, Math.min(2.5, value + delta)));
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

  return (
    <div
      ref={containerRef}
      style="flex:1;overflow:hidden;position:relative;cursor:grab;user-select:none;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent);"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
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

      <Show when={focus()}>
        {(currentFocus) => (
          <div style="position:absolute;top:48px;left:12px;z-index:10;display:flex;flex-direction:column;gap:4px;max-width:360px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:rgba(15, 18, 22, 0.92);backdrop-filter:blur(8px);">
            <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
              {currentFocus().scopeLabel}
            </span>
            <span style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {currentFocus().breadcrumb}
            </span>
            <span style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {currentFocus().headline}
            </span>
            <span style="font-size:10px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              {currentFocus().subheadline}
            </span>
          </div>
        )}
      </Show>

      <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:4px;z-index:10;">
        <button onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))} class="graph-zoom-btn">+</button>
        <button onClick={() => setZoom(1)} class="graph-zoom-btn" style="font-size:10px;">Fit</button>
        <button onClick={() => setZoom((value) => Math.max(0.3, value - 0.2))} class="graph-zoom-btn">−</button>
      </div>

      <Show
        when={layout().lanes.length > 0}
        fallback={(
          <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:28px;">
            <div style="max-width:420px;padding:18px 20px;border:1px solid var(--border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);text-align:center;">
              <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
                {emptyState()?.title}
              </p>
              <p style="font-size:12px;line-height:1.5;color:var(--text-dim);">
                {emptyState()?.body}
              </p>
            </div>
          </div>
        )}
      >
        <svg
          width={layout().width * zoom()}
          height={layout().height * zoom()}
          viewBox={`0 0 ${layout().width} ${layout().height}`}
          style={`transform:translate(${pan().x}px,${pan().y}px);`}
        >
          <For each={layout().lanes}>
            {(lane) => {
              const isSelectedLane = () => selectedSessionSnapshot()?.sessionId === lane.session.sessionId;
              const isActiveLane = lane.session.isActive;
              const laneWidth = layout().width - 24;
              const headerFill = isSelectedLane() ? 'var(--bg-elevated)' : 'var(--bg-card)';
              const headerStroke = isSelectedLane() ? 'var(--accent)' : 'var(--border)';
              const laneSummary = lane.session.currentAction
                || lane.session.summary
                || `${lane.session.activeAgentCount}/${lane.session.agents.length} agents`;
              const laneRuntime = lane.session.runtimeLabel || 'Runtime unavailable';

              return (
                <g>
                  <rect
                    x="12"
                    y={lane.y - 4}
                    width={laneWidth}
                    height={LANE_ROW_H}
                    rx="12"
                    fill="var(--bg-primary)"
                    stroke="var(--border)"
                  />
                  <rect
                    x="18"
                    y={lane.y}
                    width={LANE_HEADER_W - 12}
                    height={LANE_ROW_H - 8}
                    rx="10"
                    fill={headerFill}
                    stroke={headerStroke}
                    stroke-width={isSelectedLane() ? 2 : 1}
                  />
                  <rect
                    x="18"
                    y={lane.y}
                    width="3"
                    height={LANE_ROW_H - 8}
                    rx="1.5"
                    fill={isActiveLane ? 'var(--green)' : 'var(--border-hover)'}
                  />
                  <circle
                    cx="36"
                    cy={lane.y + 20}
                    r="4"
                    fill={isActiveLane ? 'var(--green)' : lane.session.eventCount > 0 ? 'var(--yellow)' : 'var(--text-dim)'}
                  />
                  <text
                    x="46"
                    y={lane.y + 23}
                    font-size="12"
                    font-weight="600"
                    fill="var(--text-primary)"
                    font-family="var(--font-sans)"
                  >
                    {truncate(lane.session.label, 24)}
                  </text>
                  <text
                    x="26"
                    y={lane.y + 45}
                    font-size="10"
                    fill="var(--text-secondary)"
                    font-family="var(--font-sans)"
                  >
                    {truncate(`${laneRuntime} · ${laneSummary}`, 44)}
                  </text>
                  <text
                    x="26"
                    y={lane.y + 63}
                    font-size="10"
                    fill="var(--text-dim)"
                    font-family="var(--font-sans)"
                  >
                    {timeLabel(lane.session.lastEventAt)} · {lane.session.eventCount} events
                  </text>
                  <rect
                    x="26"
                    y={lane.y + LANE_ROW_H - 30}
                    width="66"
                    height="16"
                    rx="8"
                    fill={isActiveLane ? 'var(--green-dim)' : 'var(--bg-elevated)'}
                  />
                  <text
                    x="59"
                    y={lane.y + LANE_ROW_H - 18}
                    textAnchor="middle"
                    font-size="9"
                    font-weight="600"
                    fill={isActiveLane ? 'var(--green)' : 'var(--text-dim)'}
                    font-family="var(--font-sans)"
                  >
                    {isActiveLane ? 'Active' : 'Idle'}
                  </text>
                  {!lane.session.agents.length && (
                    <text
                      x={LANE_HEADER_W + 40}
                      y={lane.y + 66}
                      font-size="11"
                      fill="var(--text-dim)"
                      font-family="var(--font-sans)"
                    >
                      No agents match the current filter
                    </text>
                  )}
                </g>
              );
            }}
          </For>

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

          <For each={layout().nodes}>
            {(node) => {
              const id = node.agent.agentId || '__main__';
              const isSelected = () => selectedAgent() === id;
              const isActive = node.agent.isActive;
              const runtimeText = node.agent.runtimeLabel || node.session.runtimeLabel || 'Runtime unavailable';
              const statusText = isActive ? 'Online' : node.agent.eventCount > 0 ? 'Idle' : 'Done';
              const actionText = node.agent.currentAction
                || node.agent.assignment
                || node.agent.modelName
                || 'Waiting for next action';

              return (
                <g
                  style="cursor:pointer;"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAgent(id);
                  }}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx="10"
                    fill="var(--bg-card)"
                    stroke={isSelected() ? 'var(--accent)' : isActive ? 'var(--green)' : 'var(--border)'}
                    stroke-width={isSelected() ? 2 : 1}
                  />
                  {isActive && (
                    <rect
                      x={node.x}
                      y={node.y + 4}
                      width="3"
                      height={NODE_H - 8}
                      rx="1.5"
                      fill="var(--green)"
                    />
                  )}
                  <circle
                    cx={node.x + NODE_W - 14}
                    cy={node.y + 14}
                    r="4"
                    fill={isActive ? 'var(--green)' : node.agent.eventCount > 0 ? 'var(--yellow)' : 'var(--text-dim)'}
                  />
                  <text
                    x={node.x + 12}
                    y={node.y + 18}
                    font-size="12"
                    font-weight="600"
                    fill="var(--text-primary)"
                    font-family="var(--font-sans)"
                  >
                    {truncate(node.agent.displayName, 20)}
                  </text>
                  <text
                    x={node.x + 12}
                    y={node.y + 34}
                    font-size="10"
                    fill={isActive ? 'var(--green)' : 'var(--text-secondary)'}
                    font-family="var(--font-sans)"
                  >
                    {statusText} · {node.agent.eventCount} events
                  </text>
                  <text
                    x={node.x + 12}
                    y={node.y + 49}
                    font-size="10"
                    fill="var(--text-dim)"
                    font-family="var(--font-sans)"
                  >
                    {truncate(runtimeText, 24)}
                  </text>
                  <text
                    x={node.x + 12}
                    y={node.y + 64}
                    font-size="10"
                    fill="var(--text-dim)"
                    font-family="var(--font-sans)"
                  >
                    {truncate(actionText, 26)}
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

function filterAgents(agents: AgentInfo[], mode: 'active' | 'idle' | 'all'): AgentInfo[] {
  if (mode === 'all') return agents;
  if (mode === 'active') {
    return agents.filter((agent) => agent.agentId === null || agent.isActive);
  }
  return agents.filter((agent) => agent.agentId === null || (!agent.isActive && agent.eventCount > 0));
}

function timeLabel(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
