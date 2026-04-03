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

  ws = new WebSocket(WS_URL);

  ws.onopen = () => setConnected(true);
  ws.onclose = () => {
    setConnected(false);
    ws = null;
    setTimeout(connectWs, 3000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'initial') {
        const initial = Array.isArray(msg.data) ? msg.data : [];
        setEvents(initial.slice(-MAX_EVENTS));
      } else if (msg.type === 'event') {
        setEvents((prev) => {
          const next = [...prev, msg.data];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      } else if (msg.type === 'agent_registry') {
        if (Array.isArray(msg.data)) {
          setAgents(msg.data);
        }
        void fetchProjects();
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
    if (res.ok) setProjectSnapshots(await res.json());
  } catch {}
}

export function clearEvents() {
  setEvents([]);
}
