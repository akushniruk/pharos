import { createSignal } from 'solid-js';
import type { HookEvent, AgentEntry, Project } from './types';

const SERVER_PORT = import.meta.env.VITE_API_PORT || '4000';
const DEFAULT_HOST = resolveApiHost(
  typeof window !== 'undefined' ? window.location.hostname : undefined,
);
const API_BASE =
  import.meta.env.VITE_API_URL || `http://${DEFAULT_HOST}:${SERVER_PORT}`;
const WS_URL =
  import.meta.env.VITE_WS_URL || `ws://${DEFAULT_HOST}:${SERVER_PORT}/stream`;

export const [events, setEvents] = createSignal<HookEvent[]>([]);
export const [agents, setAgents] = createSignal<AgentEntry[]>([]);
export const [projectSnapshots, setProjectSnapshots] = createSignal<Project[]>([]);
export const [connected, setConnected] = createSignal(false);
export const [connectionState, setConnectionState] = createSignal<'connecting' | 'connected' | 'disconnected'>('connecting');
export const [hasStreamData, setHasStreamData] = createSignal(false);

const MAX_EVENTS = 2000;

let ws: WebSocket | null = null;

export function resolveApiHost(hostname?: string): string {
  const normalized = hostname?.trim().toLowerCase() ?? '';
  if (!normalized) return 'localhost';
  if (normalized === '::1' || normalized === '[::1]') return 'localhost';
  if (normalized !== 'localhost' && normalized.endsWith('.localhost')) {
    return 'localhost';
  }
  return hostname!;
}

export function connectWs() {
  if (ws) return;

  setConnectionState('connecting');
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setConnected(true);
    setConnectionState('connected');
  };
  ws.onclose = () => {
    setConnected(false);
    setConnectionState('disconnected');
    ws = null;
    setTimeout(connectWs, 3000);
  };

  ws.onmessage = (e) => {
    try {
      setHasStreamData(true);
      const msg = JSON.parse(e.data);
      if (msg.type === 'initial') {
        const initial = Array.isArray(msg.data) ? msg.data : [];
        setEvents(initial.slice(-MAX_EVENTS));
      } else if (msg.type === 'projects') {
        setProjectSnapshots(normalizeProjects(msg.data));
      } else if (msg.type === 'event') {
        setEvents((prev) => {
          const next = [...prev, msg.data];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      } else if (msg.type === 'agent_registry') {
        if (Array.isArray(msg.data)) {
          setAgents(msg.data);
        }
      }
    } catch {}
  };
}

export async function fetchAgents() {
  try {
    const res = await fetch(`${API_BASE}/api/agents`);
    if (res.ok) setAgents(await res.json());
  } catch {}
}

export async function fetchProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    if (res.ok) {
      const data = await res.json();
      setProjectSnapshots(normalizeProjects(data));
    }
  } catch {}
}

export function clearEvents() {
  setEvents([]);
}

function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((project: any) => ({
    name: project.name,
    runtimeLabels: Array.isArray(project.runtime_labels)
      ? project.runtime_labels
      : Array.isArray(project.runtimeLabels)
        ? project.runtimeLabels
        : [],
    sessions: normalizeSessions(project.sessions),
    summary: project.summary ?? undefined,
    eventCount: numberField(project.event_count, project.eventCount),
    agentCount: numberField(project.agent_count, project.agentCount),
    activeSessionCount: numberField(project.active_session_count, project.activeSessionCount),
    lastEventAt: numberField(project.last_event_at, project.lastEventAt),
    isActive: Boolean(project.is_active ?? project.isActive),
  }));
}

function normalizeSessions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((session: any, index: number) => ({
    sessionId:
      session.session_id
      ?? session.sessionId
      ?? (typeof session.label === 'string' && session.label.trim()
        ? `session-${index}-${session.label.trim().toLowerCase().replace(/\s+/g, '-')}`
        : `session-${index}`),
    label: session.label ?? 'Session',
    runtimeLabel: session.runtime_label ?? session.runtimeLabel ?? undefined,
    summary: session.summary ?? undefined,
    currentAction: session.current_action ?? session.currentAction ?? undefined,
    eventCount: numberField(session.event_count, session.eventCount),
    agents: normalizeAgents(session.agents),
    activeAgentCount: numberField(session.active_agent_count, session.activeAgentCount),
    lastEventAt: numberField(session.last_event_at, session.lastEventAt),
    isActive: Boolean(session.is_active ?? session.isActive),
  }));
}

function normalizeAgents(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((agent: any) => ({
    agentId: agent.agent_id ?? agent.agentId ?? null,
    displayName: agent.display_name ?? agent.displayName ?? 'Agent',
    runtimeLabel: agent.runtime_label ?? agent.runtimeLabel ?? undefined,
    assignment: agent.assignment ?? undefined,
    currentAction: agent.current_action ?? agent.currentAction ?? undefined,
    agentType: agent.agent_type ?? agent.agentType ?? undefined,
    modelName: agent.model_name ?? agent.modelName ?? undefined,
    eventCount: numberField(agent.event_count, agent.eventCount),
    lastEventAt: numberField(agent.last_event_at, agent.lastEventAt),
    isActive: Boolean(agent.is_active ?? agent.isActive),
    parentId: agent.parent_id ?? agent.parentId ?? undefined,
  }));
}

function numberField(primary: unknown, fallback: unknown): number {
  const value = primary ?? fallback;
  return typeof value === 'number' ? value : 0;
}
