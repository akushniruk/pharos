import type { AgentInfo } from '../../lib/types';
import { mapAgentTypeLabel } from '../../lib/agentNaming';

/**
 * Graph layout constants — [PHA-20](/PHA/issues/PHA-20) ux-spec §1 (8px grid, node 200–280px wide).
 * `PAD` aliases spec `space.page-inline` (24px canvas inset); no separate token in theme yet.
 */
export const NODE_W = 240;
export const NODE_H = 104;
export const H_GAP = 24;
export const V_GAP = 80;
export const MAX_PER_ROW = 5;
export const PAD = 24;
export const CLUSTER_GAP = 32;
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

/** Placeholder display names that should not hide richer runtime / model labels on graph roots */
function isGenericRootDisplayName(value: string): boolean {
  const lower = value.replace(/\s+/g, ' ').trim().toLowerCase();
  return lower === '' || lower === 'unknown' || lower === 'session' || lower === 'agent' || lower === 'orchestrator';
}

function shortModelName(model: string): string {
  const trimmed = model.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const tail = trimmed.split('/').pop() || trimmed;
  return tail.length > 36 ? `${tail.slice(0, 33)}...` : tail;
}

export function agentLabel(agent: GraphNode): string {
  // Root / main session: show a real operator-facing name (runtime, model, registry name), not a generic "Orchestrator".
  if (!agent.parentGraphId) {
    const name = agent.displayName?.replace(/\s+/g, ' ').trim() || '';
    if (name && !isGenericRootDisplayName(name) && !isNoisyRoleLabel(name)) {
      return name;
    }
    if (agent.agentType && agent.agentType !== 'main') {
      const mapped = mapAgentTypeLabel(agent.agentType);
      if (mapped && mapped !== 'Session') return mapped;
    }
    const runtime = agent.runtimeLabel?.replace(/\s+/g, ' ').trim() || '';
    if (runtime && !isNoisyRoleLabel(runtime)) return runtime;
    const model = shortModelName(agent.modelName || '');
    if (model) return model;
    if (name && name.toLowerCase() !== 'unknown' && !isGenericRootDisplayName(name) && !isNoisyRoleLabel(name)) {
      return name;
    }
    return 'Main';
  }

  if (agent.agentType && agent.agentType !== 'main') {
    const mapped = mapAgentTypeLabel(agent.agentType);
    if (mapped && mapped !== 'Session') return mapped;
  }

  const childName = agent.displayName?.replace(/\s+/g, ' ').trim() || '';
  if (
    childName
    && childName.toLowerCase() !== 'unknown'
    && !isGenericRootDisplayName(childName)
    && !isNoisyRoleLabel(childName)
  ) {
    return childName;
  }
  return 'Worker';
}

export function summarizeMeta(agent: AgentInfo): string {
  const model = agent.modelName?.trim();
  if (model) return `${agent.eventCount} events · ${model}`;
  return `${agent.eventCount} events`;
}

/** Secondary line: role / adapter — spec `text-body-sm` (truncate tail). */
export function graphSecondaryLine(agent: GraphNode): string {
  const runtime = agent.runtimeLabel?.replace(/\s+/g, ' ').trim();
  if (runtime && !isNoisyRoleLabel(runtime)) {
    return runtime.length > 44 ? `${runtime.slice(0, 41)}…` : runtime;
  }
  if (agent.agentType && agent.agentType !== 'main') {
    const mapped = mapAgentTypeLabel(agent.agentType);
    if (mapped && mapped !== 'Session') return mapped;
  }
  const model = shortModelName(agent.modelName || '');
  return model.length > 44 ? `${model.slice(0, 41)}…` : model;
}

/** Caption meta: telemetry + optional parent hint (`text-caption` / tertiary). */
export function graphTelemetryMeta(agent: GraphNode, parentPrimaryLine?: string): string {
  const base = summarizeMeta(agent);
  if (!agent.parentGraphId || !parentPrimaryLine) return base;
  const hint =
    parentPrimaryLine.length > 20 ? `${parentPrimaryLine.slice(0, 17)}…` : parentPrimaryLine;
  return `${base} · via ${hint}`;
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

function sortGraphNodes(list: GraphNode[]): GraphNode[] {
  return [...list].sort((a, b) => {
    const d = (b.lastEventAt ?? 0) - (a.lastEventAt ?? 0);
    if (d !== 0) return d;
    return a.graphId.localeCompare(b.graphId);
  });
}

/**
 * Multi-level org layout: supports chains (e.g. CEO → CTO → Engineer) not only star trees.
 */
export function computeHierarchicalLayout(nodes: GraphNode[]): {
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
} {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) {
    return { width: PAD * 2 + NODE_W, height: PAD * 2 + NODE_H, positions };
  }

  const byId = new Map(nodes.map((n) => [n.graphId, n]));
  const effectiveParentId = (n: GraphNode): string | undefined => {
    const p = n.parentGraphId;
    if (!p || !byId.has(p)) return undefined;
    return p;
  };

  const childrenOf = new Map<string, GraphNode[]>();
  const roots: GraphNode[] = [];
  for (const n of nodes) {
    const p = effectiveParentId(n);
    if (!p) {
      roots.push(n);
    } else {
      const arr = childrenOf.get(p) ?? [];
      arr.push(n);
      childrenOf.set(p, arr);
    }
  }
  for (const id of byId.keys()) {
    const kids = childrenOf.get(id);
    if (kids) childrenOf.set(id, sortGraphNodes(kids));
  }

  function layoutSubtree(node: GraphNode, depth: number, xCursor: number): { endX: number } {
    const y = PAD + depth * (NODE_H + V_GAP);
    const kids = childrenOf.get(node.graphId) ?? [];
    if (kids.length === 0) {
      positions.set(node.graphId, { x: xCursor, y });
      return { endX: xCursor + NODE_W + H_GAP };
    }
    let x = xCursor;
    for (const kid of kids) {
      const sub = layoutSubtree(kid, depth + 1, x);
      x = sub.endX;
    }
    const firstX = positions.get(kids[0].graphId)!.x;
    const lastX = positions.get(kids[kids.length - 1].graphId)!.x;
    const spanMid = (firstX + lastX + NODE_W) / 2;
    const parentX = spanMid - NODE_W / 2;
    positions.set(node.graphId, { x: parentX, y });
    return { endX: Math.max(x, parentX + NODE_W + H_GAP) };
  }

  let nextX = PAD;
  for (const root of sortGraphNodes(roots)) {
    const sub = layoutSubtree(root, 0, nextX);
    nextX = sub.endX + CLUSTER_GAP;
  }

  let minX = Infinity;
  let maxRight = PAD;
  let maxBottom = PAD;
  for (const [, pos] of positions) {
    minX = Math.min(minX, pos.x);
    maxRight = Math.max(maxRight, pos.x + NODE_W);
    maxBottom = Math.max(maxBottom, pos.y + NODE_H);
  }
  const shift = minX < PAD ? PAD - minX : 0;
  if (shift !== 0) {
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + shift, y: pos.y });
    }
    maxRight += shift;
  }

  const width = Math.max(PAD * 2 + NODE_W, maxRight + PAD);
  const height = Math.max(PAD * 2 + NODE_H, maxBottom + PAD);
  return { width, height, positions };
}
