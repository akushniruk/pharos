import type { AgentInfo, HookEvent } from './types';

const AGENT_TYPE_LABELS: Record<string, string> = {
  'team-reviewer': 'Code Reviewer',
  'code-reviewer': 'Code Reviewer',
  reviewer: 'Reviewer',
  architect: 'Architect',
  coder: 'Coder',
  'security-architect': 'Security Architect',
  researcher: 'Researcher',
  optimizer: 'Optimizer',
  documenter: 'Documenter',
  'queen-coordinator': 'Queen Coordinator',
  'memory-specialist': 'Memory Specialist',
  'perf-engineer': 'Perf Engineer',
  'pr-review-toolkit': 'PR Review Toolkit',
  'full-stack-orchestrator': 'Full Stack Orchestrator',
  orchestrator: 'Orchestrator',
  'general-purpose': 'General Purpose',
  generalpurpose: 'General Purpose',
  'cursor-subagent': 'Helper',
  cursor_subagent: 'Helper',
  explorer: 'Explorer',
  explore: 'Explorer',
  planner: 'Planner',
  shell: 'Shell',
  'browser-use': 'Browser',
  'best-of-n-runner': 'Runner',
  'ai-architect': 'AI Architect',
  'deployment-expert': 'Deploy Expert',
  'performance-optimizer': 'Perf Optimizer',
  'ci-watcher': 'CI Watcher',
  'agents-memory-updater': 'Memory Updater',
  'svelte-file-editor': 'Svelte Editor',
  developer: 'Developer',
  writer: 'Code Writer',
  runner: 'Runner',
  browser: 'Browser',
  designer: 'Designer',
  analyst: 'Analyst',
  integrator: 'Integrator',
  deployer: 'Deployer',
  debugger: 'Debugger',
  tester: 'Tester',
  main: 'Session',
  ceo: 'CEO',
  cto: 'CTO',
  cmo: 'CMO',
  cfo: 'CFO',
  engineer: 'Engineer',
  'ux-designer': 'UX Designer',
  uxdesigner: 'UX Designer',
  ux_designer: 'UX Designer',
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizeResponsibility(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = collapseWhitespace(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/^Task:\s*/i, '')
      .replace(/^Objective:\s*/i, '')
      .replace(/^Goal:\s*/i, '')
      .replace(/^You are an? agent\b[^.]*\.\s*/i, '')
      .replace(/^You are an? \w+\b[^.]*\.\s*/i, '')
      .replace(/^As an? agent\b[^.]*\.\s*/i, ''),
  );
  return cleaned || undefined;
}

export function mapAgentTypeLabel(agentType?: string | null): string | undefined {
  if (typeof agentType !== 'string') return undefined;
  const normalized = collapseWhitespace(agentType).toLowerCase().replace(/_/g, '-');
  if (!normalized) return undefined;
  if (AGENT_TYPE_LABELS[normalized]) return AGENT_TYPE_LABELS[normalized];

  const words = normalized.split('-').filter(Boolean);
  if (words.length === 0) return undefined;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function responsibilityFromPayload(payload?: Record<string, any> | null): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  return (
    sanitizeResponsibility(payload.responsibility)
    || sanitizeResponsibility(payload.description)
    || sanitizeResponsibility(payload.task_description)
    || sanitizeResponsibility(payload.tool_input?.description)
    || sanitizeResponsibility(payload.tool_input?.message)
    || sanitizeResponsibility(payload.message)
  );
}

interface HybridNameOptions {
  responsibility?: string | null;
  agentType?: string | null;
  displayName?: string | null;
  agentName?: string | null;
  fallback?: string;
}

export function resolveHybridAgentName(options: HybridNameOptions): string {
  const responsibility = sanitizeResponsibility(options.responsibility);
  if (responsibility) return responsibility;

  const mappedType = mapAgentTypeLabel(options.agentType);
  if (mappedType && mappedType !== 'Session') return mappedType;

  const displayName = sanitizeResponsibility(options.displayName);
  if (displayName) return displayName;

  const agentName = sanitizeResponsibility(options.agentName);
  if (agentName) return agentName;

  return options.fallback || 'Agent';
}

export function resolveEventAgentName(event: HookEvent, fallback = 'Agent'): string {
  return resolveHybridAgentName({
    responsibility: responsibilityFromPayload(event.payload),
    agentType:
      (typeof event.payload?.agent_type === 'string' ? event.payload.agent_type : undefined)
      || event.agent_type,
    displayName:
      event.display_name
      || (typeof event.payload?.display_name === 'string' ? event.payload.display_name : undefined),
    agentName:
      event.agent_name
      || (typeof event.payload?.agent_name === 'string' ? event.payload.agent_name : undefined),
    fallback,
  });
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

function shortTailModel(model: string): string {
  const trimmed = model.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const tail = trimmed.split('/').pop() || trimmed;
  return tail.length > 40 ? `${tail.slice(0, 37)}…` : tail;
}

function isMeaningfulListTitle(raw: string): boolean {
  const t = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  if (['agent', 'session', 'unknown', 'worker', 'main', 'orchestrator'].includes(t)) return false;
  if (/^[0-9a-f]{32}$/i.test(t)) return false;
  if (/^[0-9a-f-]{36}$/i.test(t)) return false;
  return true;
}

function shortAgentFingerprint(agentId: string | null): string | undefined {
  if (agentId == null || agentId === '') return undefined;
  if (agentId.length <= 12) return agentId;
  return agentId.slice(0, 8);
}

function sanitizeListSecondaryLine(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

function withRuntime(runtime: string | undefined, role: string): string {
  if (!runtime) return role;
  const rt = runtime.replace(/\s+/g, ' ').trim();
  if (!rt || rt.toLowerCase() === role.toLowerCase()) return role;
  const r = role.trim();
  const rtl = rt.toLowerCase();
  const rl = r.toLowerCase();
  if (rl === rtl || rl.startsWith(`${rtl} `)) return r;
  return `${rt} (${role})`;
}

function truncateLabel(value: string, max = 32): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** Primary line for agent rows (sidebar + list): readable operator-facing title. */
export function resolveAgentListPrimaryName(agent: AgentInfo): string {
  const raw = agent.displayName?.replace(/\s+/g, ' ').trim() || '';
  const isMain = !agent.agentId;
  const rt = agent.runtimeLabel?.replace(/\s+/g, ' ').trim() || '';

  if (isMain) {
    if (agent.agentType && agent.agentType !== 'main') {
      const mapped = mapAgentTypeLabel(agent.agentType);
      if (mapped && mapped !== 'Session') return withRuntime(rt, mapped);
    }
    if (raw && isMeaningfulListTitle(raw) && !isNoisyRoleLabel(raw)) return raw;
    if (rt) return rt;
    const model = agent.modelName ? shortTailModel(agent.modelName) : '';
    if (model) return model;
    if (raw) return raw;
    return 'Main';
  }

  const mapped = agent.agentType && agent.agentType !== 'main'
    ? mapAgentTypeLabel(agent.agentType) : undefined;
  const hasUsefulType = mapped && mapped !== 'Session' && mapped !== 'Helper';

  if (hasUsefulType) return withRuntime(rt, mapped);

  if (raw && isMeaningfulListTitle(raw) && !isNoisyRoleLabel(raw)) {
    return truncateLabel(raw);
  }

  if (mapped && mapped !== 'Session') return withRuntime(rt, mapped);

  const fp = shortAgentFingerprint(agent.agentId);
  if (rt) return fp ? `${rt} (${fp})` : rt;
  return fp ? `Agent · ${fp}` : 'Agent';
}

/** Secondary line under the agent title (type, model, current focus). */
export function resolveAgentListSecondaryLine(agent: AgentInfo): string {
  const action = sanitizeListSecondaryLine(
    agent.assignment || agent.currentAction || agent.currentProgress,
  );
  const modelRaw = agent.modelName ? shortTailModel(agent.modelName).replace(/^claude-/i, '') : '';
  const model = modelRaw.length > 48 ? `${modelRaw.slice(0, 45)}…` : modelRaw;

  if (action && model) return `${model} — ${action}`;
  if (action) return action;
  if (model) return model;
  return `${agent.eventCount} event${agent.eventCount === 1 ? '' : 's'}`;
}

export function agentListInitials(primaryName: string): string {
  const trimmed = primaryName.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0].match(/[A-Za-z0-9]/)?.[0] ?? parts[0][0];
    const b = parts[parts.length - 1].match(/[A-Za-z0-9]/)?.[0] ?? parts[parts.length - 1][0];
    return `${a}${b}`.toUpperCase();
  }
  const first = trimmed.match(/[A-Za-z0-9]/)?.[0] ?? trimmed[0];
  return first.toUpperCase();
}
