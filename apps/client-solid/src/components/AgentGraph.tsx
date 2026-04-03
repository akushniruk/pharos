import { createMemo, createSignal } from 'solid-js';
import { SolidFlow } from 'solid-flow';
import { filteredAgents, filteredEvents, selectAgent, selectedAgent } from '../lib/store';
import type { AgentInfo, HookEvent } from '../lib/types';

export default function AgentGraph() {
  const graphData = createMemo(() => {
    const agents = filteredAgents();
    const evts = filteredEvents();
    if (agents.length === 0) return { nodes: [], edges: [] };

    // Build parent→child map from SubagentStart events
    const parentMap = new Map<string, string>(); // child agentId → parent agentId
    for (const e of evts) {
      if (e.hook_event_type === 'SubagentStart' && e.agent_id) {
        // The event's agent_id is the child, the main session agent is the parent
        parentMap.set(e.agent_id, '__main__');
      }
    }

    // Find root agents (no parent) and children
    const root = agents.find(a => a.agentId === null) ?? agents[0];
    const children = agents.filter(a => a.agentId !== null);

    // Layout: root at top center, children in rows below
    const nodeW = 220;
    const nodeH = 70;
    const hGap = 30;
    const vGap = 100;
    const maxPerRow = 4;

    const rows = [];
    for (let i = 0; i < children.length; i += maxPerRow) {
      rows.push(children.slice(i, i + maxPerRow));
    }

    const maxRowWidth = Math.max(1, ...rows.map(r => r.length)) * (nodeW + hGap) - hGap;
    const totalWidth = Math.max(nodeW, maxRowWidth);

    // Root node
    const nodes: any[] = [{
      id: '__main__',
      position: { x: (totalWidth - nodeW) / 2, y: 20 },
      data: {
        content: <AgentNode agent={root} />,
      },
      inputs: 0,
      outputs: children.length > 0 ? 1 : 0,
    }];

    // Child nodes in rows
    rows.forEach((row, rowIdx) => {
      const rowWidth = row.length * (nodeW + hGap) - hGap;
      const startX = (totalWidth - rowWidth) / 2;

      row.forEach((child, colIdx) => {
        const id = child.agentId || `child-${rowIdx}-${colIdx}`;
        nodes.push({
          id,
          position: {
            x: startX + colIdx * (nodeW + hGap),
            y: 20 + (rowIdx + 1) * (nodeH + vGap),
          },
          data: {
            content: <AgentNode agent={child} />,
          },
          inputs: 1,
          outputs: 0,
        });
      });
    });

    // Edges from root to all children
    const edges = children.map((child, i) => ({
      id: `edge-main-${child.agentId || i}`,
      sourceNode: '__main__',
      sourceOutput: 0,
      targetNode: child.agentId || `child-${Math.floor(i / maxPerRow)}-${i % maxPerRow}`,
      targetInput: 0,
    }));

    return { nodes, edges };
  });

  const [nodes, setNodes] = createSignal<any[]>([]);
  const [edges, setEdges] = createSignal<any[]>([]);

  // Sync from memo to signals (solid-flow needs signals)
  const syncedNodes = createMemo(() => {
    const data = graphData();
    setNodes(data.nodes);
    setEdges(data.edges);
    return data.nodes;
  });

  return (
    <div
      style="flex:1;overflow:hidden;background:var(--bg-primary);"
      class="agent-graph-container"
    >
      <style>{`
        .agent-graph-container .solid-flow-node {
          background: var(--bg-card) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          padding: 0 !important;
          min-width: 220px;
        }
        .agent-graph-container .solid-flow-node-selected {
          border-color: var(--accent) !important;
        }
        .agent-graph-container .solid-flow-edge {
          stroke: var(--border-hover) !important;
          stroke-width: 1.5 !important;
        }
        .agent-graph-container .solid-flow-handle {
          background: var(--text-dim) !important;
          width: 6px !important;
          height: 6px !important;
        }
        .agent-graph-container .solid-flow-canvas {
          background: var(--bg-primary) !important;
        }
      `}</style>
      {syncedNodes() && (
        <SolidFlow
          nodes={nodes()}
          edges={edges()}
          onNodesChange={(n: any) => setNodes(n)}
          onEdgesChange={(e: any) => setEdges(e)}
        />
      )}
    </div>
  );
}

function AgentNode(props: { agent: AgentInfo }) {
  const a = () => props.agent;
  const id = () => a().agentId || '__main__';
  const isSelected = () => selectedAgent() === id();

  const dotColor = () => {
    if (a().isActive) return '#22c55e';
    if (a().eventCount > 0) return '#eab308';
    return '#52525b';
  };

  const statusLabel = () => {
    if (a().isActive) return 'Online';
    if (a().eventCount > 0) return 'Idle';
    return 'Done';
  };

  return (
    <div
      style={`padding:10px 14px;cursor:pointer;border-left:3px solid ${isSelected() ? '#3b82f6' : a().isActive ? '#22c55e' : 'transparent'};min-width:200px;`}
      onClick={() => selectAgent(id())}
    >
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style={`width:7px;height:7px;border-radius:50%;background:${dotColor()};flex-shrink:0;${a().isActive ? 'box-shadow:0 0 6px ' + dotColor() : ''}`} />
        <span style="font-size:12px;font-weight:600;color:#fafafa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">
          {a().displayName}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#71717a;">
          {a().eventCount} events
        </span>
        <span style={`font-size:10px;font-weight:500;color:${a().isActive ? '#22c55e' : '#71717a'};`}>
          {statusLabel()}
        </span>
      </div>
      {a().modelName && (
        <div style="font-size:10px;font-family:monospace;color:#52525b;margin-top:2px;">
          {a().modelName?.replace('claude-', '')}
        </div>
      )}
    </div>
  );
}
