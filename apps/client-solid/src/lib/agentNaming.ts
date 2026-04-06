import type { HookEvent } from './types';

const AGENT_TYPE_LABELS: Record<string, string> = {
  'team-reviewer': 'Code Reviewer',
  'code-reviewer': 'Code Reviewer',
  reviewer: 'Code Reviewer',
  'pr-review-toolkit': 'PR Review Toolkit',
  'full-stack-orchestrator': 'Full Stack Orchestrator',
  orchestrator: 'Orchestrator',
  'general-purpose': 'General Purpose',
  'cursor_subagent': 'Cursor Helper',
  explorer: 'Explorer',
  explore: 'Explorer',
  planner: 'Planner',
  main: 'Session',
  ceo: 'CEO',
  cto: 'CTO',
  cmo: 'CMO',
  cfo: 'CFO',
  engineer: 'Engineer',
  'ux-designer': 'UXDesigner',
  uxdesigner: 'UXDesigner',
  ux_designer: 'UXDesigner',
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
      .replace(/^Goal:\s*/i, ''),
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
