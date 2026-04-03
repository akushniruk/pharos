import { createSignal, createMemo } from 'solid-js';
import type { View, Project, SessionInfo, AgentInfo, HookEvent } from './types';
import { agents, events, projectSnapshots } from './ws';
import { describeEvent } from './describe';

/** Navigation state (legacy, kept for compatibility) */
export const [view, setView] = createSignal<View>({ page: 'projects' });

/** Navigate to projects overview (legacy) */
export const goProjects = () => setView({ page: 'projects' });

/** Navigate to a specific project (legacy) */
export const goProject = (name: string) => setView({ page: 'project', projectName: name });

// ---- Selection signals ----
export const [selectedProject, setSelectedProject] = createSignal<string | null>(null);
export const [selectedSession, setSelectedSession] = createSignal<string | null>(null);
export const [selectedAgent, setSelectedAgent] = createSignal<string | null>(null);

/** Toggle project selection (deselect if already selected) */
export function selectProject(name: string | null) {
  setSelectedProject(p => p === name ? null : name);
  setSelectedSession(null);
  setSelectedAgent(null);
}

/** Toggle session selection (deselect if already selected) */
export function selectSession(id: string | null) {
  setSelectedSession(s => s === id ? null : id);
  setSelectedAgent(null);
}

/** Toggle agent selection (deselect if already selected) */
export function selectAgent(id: string | null) {
  setSelectedAgent(a => a === id ? null : id);
}

/** Clear all selections */
export function clearSelection() {
  setSelectedProject(null);
  setSelectedSession(null);
  setSelectedAgent(null);
}

const ACTIVE_THRESHOLD_MS = 30_000;
const MAIN_AGENT_KEY = '__main__';

const registryBySessionAgent = createMemo(() => {
  const map = new Map<string, string>();
  for (const entry of agents()) {
    const agentKey = entry.agent_id || MAIN_AGENT_KEY;
    map.set(`${entry.session_id}:${agentKey}`, entry.lifecycle_status);
  }
  return map;
});

/** Derive projects from the event stream */
export const projects = createMemo((): Project[] => {
  const snapshots = projectSnapshots();
  if (snapshots.length > 0) {
    return snapshots;
  }

  const evts = events();
  const registry = registryBySessionAgent();
  const map = new Map<string, { events: HookEvent[]; sessions: Map<string, HookEvent[]> }>();

  for (const e of evts) {
    const key = e.source_app;
    if (!map.has(key)) {
      map.set(key, { events: [], sessions: new Map() });
    }
    const proj = map.get(key)!;
    proj.events.push(e);

    const sid = e.session_id;
    if (!proj.sessions.has(sid)) {
      proj.sessions.set(sid, []);
    }
    proj.sessions.get(sid)!.push(e);
  }

  const result: Project[] = [];
  for (const [name, data] of map) {
    const lastEventAt = Math.max(...data.events.map((e) => e.timestamp || 0));
    const sessions: SessionInfo[] = [];
    const agentIds = new Set<string>();
    const runtimeLabels = new Set<string>();

    for (const [sid, sevts] of data.sessions) {
      const sLastEvent = Math.max(...sevts.map((e) => e.timestamp || 0));
      const runtimeLabel = resolveRuntimeLabel(sevts);
      if (runtimeLabel) runtimeLabels.add(runtimeLabel);
      const agentMap = new Map<string, HookEvent[]>();

      for (const e of sevts) {
        const aid = e.agent_id || '__main__';
        agentIds.add(aid);
        if (!agentMap.has(aid)) agentMap.set(aid, []);
        agentMap.get(aid)!.push(e);
      }

      const agentsArr: AgentInfo[] = [];
      for (const [aid, aevts] of agentMap) {
        const aLast = Math.max(...aevts.map((e) => e.timestamp || 0));
        const displayName = resolveAgentName(aevts, aid === '__main__');
        const assignment = resolveAssignment(aevts);
        const currentAction = resolveCurrentAction(aevts);
        agentsArr.push({
          agentId: aid === '__main__' ? null : aid,
          displayName,
          runtimeLabel,
          assignment,
          currentAction,
          agentType: aevts.find((e) => e.payload?.agent_type)?.payload.agent_type,
          modelName: aevts.find((e) => e.model_name || e.payload?.model)?.model_name || aevts.find((e) => e.payload?.model)?.payload.model,
          eventCount: aevts.length,
          lastEventAt: aLast,
          isActive: isRegistryActive(registry, sid, aid),
          parentId: undefined,
        });
      }

      const sessionSummary = resolveSessionSummary(sevts, agentsArr);
      const sessionIsActive =
        isRegistryActive(registry, sid, MAIN_AGENT_KEY)
        || agentsArr.some((agent) => agent.isActive);
      sessions.push({
        sessionId: sid,
        label: resolveSessionLabel(sevts, name),
        runtimeLabel,
        summary: sessionSummary,
        currentAction: resolveCurrentAction(sevts),
        eventCount: sevts.length,
        agents: agentsArr.sort((a, b) => b.eventCount - a.eventCount),
        activeAgentCount: agentsArr.filter((agent) => agent.isActive).length,
        lastEventAt: sLastEvent,
        isActive: sessionIsActive,
      });
    }

    const activeSessionCount = sessions.filter((session) => session.isActive).length;
    const projectSummary = resolveProjectSummary(
      sessions,
      Array.from(runtimeLabels),
      activeSessionCount,
    );
    result.push({
      name,
      runtimeLabels: Array.from(runtimeLabels),
      sessions: sessions.sort((a, b) => b.lastEventAt - a.lastEventAt),
      summary: projectSummary,
      eventCount: data.events.length,
      agentCount: agentIds.size,
      activeSessionCount,
      lastEventAt,
      isActive: activeSessionCount > 0,
    });
  }

  return result.sort((a, b) => b.lastEventAt - a.lastEventAt);
});

function resolveAgentName(evts: HookEvent[], isMain: boolean): string {
  for (const e of evts) {
    if (e.display_name) return e.display_name;
    if (e.agent_name) return e.agent_name;
    if (e.payload?.display_name) return e.payload.display_name;
    if (e.payload?.agent_name) return e.payload.agent_name;
    if (e.payload?.agent_type && e.payload.agent_type !== 'main') {
      return e.payload.agent_type;
    }
    if (e.payload?.title && isMain) return e.payload.title;
    if (e.payload?.description && isMain) return e.payload.description;
    if (e.payload?.cwd && isMain) {
      const cwdName = workspaceNameFromCwd(e.payload.cwd);
      if (cwdName) return cwdName;
    }
  }
  const agentType = evts.find((e) => e.payload?.agent_type)?.payload.agent_type;
  if (agentType && agentType !== 'main') return agentType;
  return isMain ? 'Session' : 'Agent';
}

function isRegistryActive(
  registry: Map<string, string>,
  sessionId: string,
  agentId: string | null,
): boolean {
  const key = `${sessionId}:${agentId || MAIN_AGENT_KEY}`;
  const status = registry.get(key);
  if (status) {
    return status === 'active';
  }
  return false;
}

function resolveRuntimeLabel(evts: HookEvent[]): string | undefined {
  for (const e of evts) {
    if (typeof e.payload?.runtime_label === 'string' && e.payload.runtime_label.trim()) {
      return e.payload.runtime_label;
    }
  }
  return undefined;
}

function resolveSessionLabel(evts: HookEvent[], workspaceName: string): string {
  const titled = evts.find((e) => e.hook_event_type === 'SessionTitleChanged' && e.payload?.title);
  if (titled?.payload?.title) return titled.payload.title;

  const mainName = resolveAgentName(
    evts.filter((e) => !e.agent_id),
    true,
  );
  if (!isGenericName(mainName)) return mainName;

  return workspaceName;
}

function resolveAssignment(evts: HookEvent[]): string | undefined {
  const subagentStart = latestEventOfType(evts, 'SubagentStart');
  const description = subagentStart?.payload?.description;
  if (typeof description === 'string' && description.trim()) {
    return truncate(description.trim(), 100);
  }

  const delegatedTask = [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) =>
      event.hook_event_type === 'PreToolUse'
      && event.payload?.tool_name === 'Agent'
      && typeof event.payload?.tool_input?.description === 'string',
    )
    ?.payload?.tool_input?.description;
  if (typeof delegatedTask === 'string' && delegatedTask.trim()) {
    return truncate(delegatedTask.trim(), 100);
  }

  const prompt = latestEventOfType(evts, 'UserPromptSubmit');
  const promptText = prompt?.payload?.prompt || prompt?.payload?.message;
  if (typeof promptText === 'string' && promptText.trim()) {
    return truncate(promptText.trim(), 100);
  }

  return undefined;
}

function workspaceNameFromCwd(cwd: string): string | null {
  const parts = cwd.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function isGenericName(name: string): boolean {
  return name === 'Session' || name === 'Agent';
}

function resolveCurrentAction(evts: HookEvent[]): string | undefined {
  const latest = latestMeaningfulEvent(evts) ?? latestEvent(evts);

  if (!latest) return undefined;
  if (latest.hook_event_type === 'SubagentStart') return undefined;

  const summary = describeEvent(latest).trim();
  return summary || undefined;
}

function resolveSessionSummary(evts: HookEvent[], agents: AgentInfo[]): string | undefined {
  const activeWorkers = agents
    .filter((agent) => agent.agentId && agent.isActive)
    .map((agent) => summarizeAgent(agent))
    .filter(Boolean)
    .slice(0, 2);
  if (activeWorkers.length > 0) {
    return activeWorkers.join(' · ');
  }

  const recentWorkers = agents
    .filter((agent) => agent.agentId)
    .map((agent) => summarizeAgent(agent))
    .filter(Boolean)
    .slice(0, 2);
  if (recentWorkers.length > 0) {
    return recentWorkers.join(' · ');
  }

  const assignment = resolveAssignment(evts);
  if (assignment) return assignment;

  return resolveCurrentAction(evts);
}

function resolveProjectSummary(
  sessions: SessionInfo[],
  runtimeLabels: string[],
  activeSessionCount: number,
): string | undefined {
  const topActiveSession = sessions.find((session) => session.isActive && session.summary);
  if (topActiveSession?.summary) {
    return topActiveSession.summary;
  }

  const topSession = sessions.find((session) => session.summary);
  if (topSession?.summary) {
    return topSession.summary;
  }

  if (activeSessionCount > 0 && runtimeLabels.length > 0) {
    return `${runtimeLabels.join(', ')} active`;
  }

  if (runtimeLabels.length > 0) {
    return runtimeLabels.join(', ');
  }

  return undefined;
}

function summarizeAgent(agent: AgentInfo): string | undefined {
  const action = agent.currentAction && agent.currentAction !== agent.assignment
    ? agent.currentAction
    : agent.assignment;
  if (!action) return agent.displayName;
  return `${agent.displayName}: ${truncate(action, 72)}`;
}

function latestEvent(evts: HookEvent[]): HookEvent | undefined {
  return [...evts].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))[0];
}

function latestMeaningfulEvent(evts: HookEvent[]): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => !['SessionStart', 'SessionEnd', 'SessionTitleChanged'].includes(event.hook_event_type));
}

function latestEventOfType(evts: HookEvent[], type: string): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => event.hook_event_type === type);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Filtered agents based on selection */
export const filteredAgents = createMemo((): AgentInfo[] => {
  const proj = selectedProject();
  if (!proj) return projects().flatMap(p => p.sessions.flatMap(s => s.agents));
  const project = projects().find(p => p.name === proj);
  if (!project) return [];
  const sess = selectedSession();
  if (sess) {
    const session = project.sessions.find(s => s.sessionId === sess);
    return session?.agents || [];
  }
  return project.sessions.flatMap(s => s.agents);
});

/** Get events filtered by selection signals */
export const filteredEvents = createMemo((): HookEvent[] => {
  let result = events();
  const proj = selectedProject();
  if (proj) result = result.filter(e => e.source_app === proj);
  const sess = selectedSession();
  if (sess) result = result.filter(e => e.session_id === sess);
  const agent = selectedAgent();
  if (agent) result = result.filter(e => (e.agent_id || '__main__') === agent);
  return result;
});
