import { For, createMemo } from 'solid-js';
import { filteredAgents, filteredEvents, selectAgent, selectedAgent } from '../lib/store';
import type { AgentInfo } from '../lib/types';

const NODE_W = 180;
const NODE_H = 50;
const V_GAP = 80;
const H_GAP = 20;
const PAD = 24;

interface NodeLayout {
  agent: AgentInfo;
  x: number;
  y: number;
}

export default function AgentGraph() {
  const layout = createMemo((): { nodes: NodeLayout[]; width: number; height: number } => {
    const agents = filteredAgents();
    if (agents.length === 0) return { nodes: [], width: 300, height: 120 };

    // Find root: agentId is null (Orchestrator) or no parentId
    const root = agents.find(a => a.agentId === null) ?? agents[0];

    // Find children via SubagentStart events: events where hook_event_type === 'SubagentStart'
    const evts = filteredEvents();
    const childIds = new Set<string>();
    for (const e of evts) {
      if (e.hook_event_type === 'SubagentStart' && e.payload?.agent_id) {
        childIds.add(e.payload.agent_id as string);
      }
    }

    const children = agents.filter(a => a.agentId !== null && a.agentId !== root.agentId);

    if (children.length === 0) {
      const cx = PAD + NODE_W / 2;
      const w = NODE_W + PAD * 2;
      const h = NODE_H + PAD * 2;
      return {
        nodes: [{ agent: root, x: PAD, y: PAD }],
        width: w,
        height: h,
      };
    }

    const totalChildW = children.length * NODE_W + (children.length - 1) * H_GAP;
    const totalW = Math.max(NODE_W, totalChildW) + PAD * 2;

    // Root centered at top
    const rootX = (totalW - NODE_W) / 2;
    const rootY = PAD;

    // Children spaced evenly at second row
    const childY = PAD + NODE_H + V_GAP;
    const childStartX = (totalW - totalChildW) / 2;

    const nodes: NodeLayout[] = [{ agent: root, x: rootX, y: rootY }];
    children.forEach((child, i) => {
      nodes.push({
        agent: child,
        x: childStartX + i * (NODE_W + H_GAP),
        y: childY,
      });
    });

    return {
      nodes,
      width: totalW,
      height: childY + NODE_H + PAD,
    };
  });

  const dotColor = (agent: AgentInfo) => {
    if (agent.isActive) return 'var(--green)';
    if (agent.eventCount > 0) return 'var(--yellow)';
    return 'var(--text-dim)';
  };

  const rootNode = createMemo(() => layout().nodes[0]);

  return (
    <div style="flex:1;padding:12px 16px;overflow:auto;display:flex;align-items:center;justify-content:center;">
      <svg
        width="100%"
        viewBox={`0 0 ${layout().width} ${layout().height}`}
        style={`display:block;max-height:100%;min-height:${layout().height}px;`}
      >
        {/* Edges: from root bottom-center to each child top-center */}
        <For each={layout().nodes.slice(1)}>
          {(child) => {
            const root = rootNode();
            const x1 = root.x + NODE_W / 2;
            const y1 = root.y + NODE_H;
            const x2 = child.x + NODE_W / 2;
            const y2 = child.y;
            const midY = (y1 + y2) / 2;
            return (
              <path
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                stroke-width="1"
              />
            );
          }}
        </For>

        {/* Nodes */}
        <For each={layout().nodes}>
          {(node) => {
            const id = node.agent.agentId || '__main__';
            const isSelected = () => selectedAgent() === id;
            const stroke = () => {
              if (isSelected()) return 'var(--accent)';
              if (node.agent.isActive) return 'var(--green)';
              return 'var(--border)';
            };
            const truncated = node.agent.displayName.length > 23
              ? node.agent.displayName.slice(0, 22) + '…'
              : node.agent.displayName;
            const model = node.agent.modelName?.replace('claude-', '') ?? '';
            const modelTrunc = model.length > 18 ? model.slice(0, 17) + '…' : model;
            const typeLabel = node.agent.agentType ?? (node.agent.agentId ? 'subagent' : 'session');

            return (
              <g
                style="cursor:pointer;"
                onClick={() => selectAgent(id)}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="6"
                  ry="6"
                  fill="var(--bg-card)"
                  stroke={stroke()}
                  stroke-width="1.5"
                />
                {/* Status dot */}
                <circle
                  cx={node.x + NODE_W - 10}
                  cy={node.y + 10}
                  r="4"
                  fill={dotColor(node.agent)}
                />
                {/* Agent name */}
                <text
                  x={node.x + 10}
                  y={node.y + 20}
                  font-size="11"
                  font-weight="500"
                  fill="var(--text-primary)"
                  font-family="inherit"
                >
                  {truncated}
                </text>
                <text
                  x={node.x + 10}
                  y={node.y + 33}
                  font-size="9"
                  fill="var(--text-secondary)"
                  font-family="inherit"
                >
                  {typeLabel}
                </text>
                {/* Model name */}
                <text
                  x={node.x + 10}
                  y={node.y + 44}
                  font-size="10"
                  fill="var(--text-dim)"
                  font-family="var(--font-mono)"
                >
                  {modelTrunc}
                </text>
              </g>
            );
          }}
        </For>
      </svg>
    </div>
  );
}
