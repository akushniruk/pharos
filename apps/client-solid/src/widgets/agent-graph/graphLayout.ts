import type { AgentInfo } from '../../lib/types';
import { mapAgentTypeLabel } from '../../lib/agentNaming';

export const NODE_W = 248;
export const NODE_H = 94;
export const H_GAP = 30;
export const V_GAP = 86;
export const MAX_PER_ROW = 5;
export const PAD = 40;
export const CLUSTER_GAP = 36;
export const METRO_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
];

export type StatusColor = 'var(--green)' | 'var(--yellow)' | 'var(--accent)' | 'var(--text-dim)';
export type GraphNode = AgentInfo & {
  graphId: string;
  parentGraphId?: string;
};

export function statusDot(agent: AgentInfo): StatusColor {
  if (agent.statusTone === 'active' || agent.isActive) return 'var(--green)';
  if (agent.statusTone === 'blocked' || agent.statusTone === 'attention') return 'var(--yellow)';
  if (agent.statusTone === 'idle') return 'var(--accent)';
  return 'var(--text-dim)';
}

function isNoisyRoleLabel(value: string): boolean {
  if (!value) return true;
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length > 40) return true;
  const words = compact.split(' ').filter(Boolean);
  if (words.length > 6) return true;
  if (/[<>\[\]`]/.test(compact)) return true;
  if (/^(respond|build|write|fix|investigate|update)\b/i.test(compact)) return true;
  if (/^(user|prompt|message)\b/i.test(compact)) return true;
  return false;
}

export function agentLabel(agent: GraphNode): string {
  if (!agent.parentGraphId) return 'Orchestrator';

  if (agent.agentType && agent.agentType !== 'main') {
    const mapped = mapAgentTypeLabel(agent.agentType);
    if (mapped && mapped !== 'Session') return mapped;
  }

  const name = agent.displayName?.replace(/\s+/g, ' ').trim() || '';
  if (name && name.toLowerCase() !== 'unknown' && !isNoisyRoleLabel(name)) {
    return name;
  }
  return 'Worker';
}

export function summarizeMeta(agent: AgentInfo): string {
  const model = agent.modelName?.trim();
  if (model) return `${agent.eventCount} events · ${model}`;
  return `${agent.eventCount} events`;
}

export function stableTextHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function wrapLabel(label: string): [string, string?] {
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

export function computeClusterLayout(
  rootsList: GraphNode[],
  childrenList: GraphNode[],
): {
  width: number;
  height: number;
  rootPositions: Map<string, { x: number; y: number }>;
  childPositions: Map<string, { x: number; y: number }>;
} {
  const rootPositions = new Map<string, { x: number; y: number }>();
  const childPositions = new Map<string, { x: number; y: number }>();

  if (rootsList.length === 0) {
    return { width: PAD * 2 + NODE_W, height: PAD * 2 + NODE_H, rootPositions, childPositions };
  }

  let xCursor = PAD;
  let maxBottom = PAD + NODE_H;

  for (const root of rootsList) {
    const kids = childrenList.filter((child) => child.parentGraphId === root.graphId);
    const kidCount = kids.length;
    const colsForWidth = kidCount === 0 ? 1 : Math.min(MAX_PER_ROW, kidCount);
    const clusterW = Math.max(NODE_W, colsForWidth * (NODE_W + H_GAP) - H_GAP);

    const rootX = xCursor + (clusterW - NODE_W) / 2;
    rootPositions.set(root.graphId, { x: rootX, y: PAD });

    let clusterBottom = PAD + NODE_H;
    if (kidCount > 0) {
      const rows = Math.ceil(kidCount / MAX_PER_ROW);
      for (let row = 0; row < rows; row += 1) {
        const slice = kids.slice(row * MAX_PER_ROW, (row + 1) * MAX_PER_ROW);
        const rowCols = slice.length;
        const rowW = rowCols * (NODE_W + H_GAP) - H_GAP;
        const rowStartX = xCursor + (clusterW - rowW) / 2;
        slice.forEach((kid, j) => {
          childPositions.set(kid.graphId, {
            x: rowStartX + j * (NODE_W + H_GAP),
            y: PAD + NODE_H + V_GAP + row * (NODE_H + V_GAP),
          });
        });
        clusterBottom = PAD + NODE_H + V_GAP + row * (NODE_H + V_GAP) + NODE_H;
      }
    }

    maxBottom = Math.max(maxBottom, clusterBottom);
    xCursor += clusterW + CLUSTER_GAP;
  }

  const width = Math.max(PAD * 2 + NODE_W, xCursor - CLUSTER_GAP + PAD);
  const height = maxBottom + PAD;

  return { width, height, rootPositions, childPositions };
}
