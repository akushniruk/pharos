import { createSignal, createMemo, createEffect } from 'solid-js';
import type { View, Project, SessionInfo, AgentInfo, HookEvent } from './types';
import { agents, events, projectSnapshots } from './ws';
import { describeEvent, describeEventDetail } from './describe';

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

const HELP_STORAGE_KEY = 'pharos-help-visible';
export const [helpVisible, setHelpVisible] = createSignal(true);

export function initHelpState() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(HELP_STORAGE_KEY);
    if (saved === '0' || saved === '1') {
      setHelpVisible(saved === '1');
    }
  }

  createEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HELP_STORAGE_KEY, helpVisible() ? '1' : '0');
    }
  });
}

export function toggleHelpVisible() {
  setHelpVisible((current) => !current);
}

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
        const currentProgress = resolveCurrentProgress(aevts);
        const currentProgressDetail = resolveCurrentProgressDetail(aevts);
        const nextAction = resolveNextAction(aevts);
        const nextActionDetail = resolveNextActionDetail(aevts);
        const agentIsActive = isRegistryActive(registry, sid, aid);
        agentsArr.push({
          agentId: aid === '__main__' ? null : aid,
          displayName,
          runtimeLabel,
          assignment: nextAction,
          assignmentDetail: nextActionDetail,
          currentProgress,
          currentProgressDetail,
          currentAction: currentProgress,
          currentActionDetail: currentProgressDetail,
          nextAction,
          nextActionDetail,
          agentType: aevts.find((e) => e.payload?.agent_type)?.payload.agent_type,
          modelName: aevts.find((e) => e.model_name || e.payload?.model)?.model_name || aevts.find((e) => e.payload?.model)?.payload.model,
          eventCount: aevts.length,
          lastEventAt: aLast,
          isActive: agentIsActive,
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
        summary: sessionSummary.label,
        summaryDetail: sessionSummary.detail,
        currentProgress: sessionSummary.label,
        currentProgressDetail: sessionSummary.detail,
        currentAction: sessionSummary.nextAction,
        currentActionDetail: sessionSummary.nextActionDetail,
        nextAction: sessionSummary.nextAction,
        nextActionDetail: sessionSummary.nextActionDetail,
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
      summary: projectSummary.label,
      summaryDetail: projectSummary.detail,
      eventCount: data.events.length,
      agentCount: agentIds.size,
      activeSessionCount,
      lastEventAt,
      isActive: activeSessionCount > 0,
    });
  }

  return result.sort((a, b) => b.lastEventAt - a.lastEventAt);
});

export const selectedProjectSnapshot = createMemo((): Project | null => {
  const projectName = selectedProject();
  if (!projectName) return null;
  return projects().find((project) => project.name === projectName) ?? null;
});

export const selectedSessionSnapshot = createMemo((): SessionInfo | null => {
  const project = selectedProjectSnapshot();
  if (!project) return null;

  const agentId = selectedAgent();
  if (agentId) {
    const agentSession = project.sessions.find((session) =>
      session.agents.some((agent) => (agent.agentId || MAIN_AGENT_KEY) === agentId),
    );
    if (agentSession) {
      return agentSession;
    }
  }

  const sessionId = selectedSession();
  if (!sessionId) return null;
  return project.sessions.find((session) => session.sessionId === sessionId) ?? null;
});

export const selectedAgentSnapshot = createMemo((): AgentInfo | null => {
  const agentId = selectedAgent();
  if (!agentId) return null;
  const session = selectedSessionSnapshot();
  if (session) {
    return session.agents.find((agent) => (agent.agentId || MAIN_AGENT_KEY) === agentId) ?? null;
  }
  const project = selectedProjectSnapshot();
  if (!project) return null;
  return project.sessions
    .flatMap((session) => session.agents)
    .find((agent) => (agent.agentId || MAIN_AGENT_KEY) === agentId) ?? null;
});

type AgentStatusTone = 'active' | 'idle' | 'muted';

export interface ProjectFocusSnapshot {
  projectName: string;
  projectSummary: string;
  sessionId: string | null;
  sessionLabel: string | null;
  sessionSummary: string | null;
  currentProgress: string | null;
  currentProgressDetail: string | null;
  nextAction: string | null;
  nextActionDetail: string | null;
  agentId: string | null;
  agentLabel: string | null;
  agentSummary: string | null;
  scopeLabel: string;
  breadcrumb: string;
  headline: string;
  subheadline: string;
  eventCount: number;
  sessionCount: number;
  agentCount: number;
  hasSessionFocus: boolean;
  hasAgentFocus: boolean;
}

export interface RecentChangeItem {
  label: string;
  detail?: string;
  timestamp: number;
}

export interface RecentChangesSnapshot {
  scopeLabel: string;
  scopeDetail: string;
  headline: string;
  eventCount: number;
  lastEventAt: number;
  items: RecentChangeItem[];
}

export function buildProjectFocusSnapshot(
  project: Project | null,
  session: SessionInfo | null,
  agent: AgentInfo | null,
): ProjectFocusSnapshot | null {
  if (!project) return null;

  const projectSummary = project.summary
    || `${project.activeSessionCount} active · ${project.sessions.length} sessions`;
  const sessionLabel = session?.label || session?.sessionId || null;
  const sessionProgress = session
    ? session.currentProgress || session.summary || session.currentAction
    : null;
  const sessionProgressDetail = session
    ? session.currentProgressDetail || session.summaryDetail || session.currentActionDetail || null
    : null;
  const sessionNextAction = session?.nextAction || session?.currentAction || null;
  const sessionNextActionDetail = session?.nextActionDetail || session?.currentActionDetail || null;
  const agentLabel = agent?.displayName || null;
  const agentProgress = agent
    ? agent.currentProgress || agent.currentAction || agent.assignment || null
    : null;
  const agentProgressDetail = agent
    ? agent.currentProgressDetail || agent.currentActionDetail || agent.assignmentDetail || null
    : null;
  const agentNextAction = agent?.nextAction || agent?.assignment || null;
  const agentNextActionDetail = agent?.nextActionDetail || agent?.assignmentDetail || null;
  const sessionSummary = sessionProgress;
  const agentSummary = agentProgress;
  const focusSubject = agentLabel || sessionLabel || project.name;
  const focusAction = agentProgress || agentNextAction || sessionProgress || sessionNextAction || projectSummary;
  const scopeLabel = agent
    ? 'Agent focus'
    : session
      ? 'Session focus'
      : 'Project overview';
  const breadcrumb = [project.name, sessionLabel, agentLabel].filter(Boolean).join(' · ');
  const headline = formatNowHeadline(focusSubject, focusAction);
  const subheadline = agentNextAction
    ? formatContextLabel('Next action', agentNextAction)
    : sessionNextAction
      ? formatContextLabel('Next action', sessionNextAction)
      : agentProgressDetail
        ? formatContextLabel('Current progress', agentProgressDetail)
        : sessionProgressDetail
          ? formatContextLabel('Current progress', sessionProgressDetail)
          : projectSummary
            ? formatContextLabel('Project summary', projectSummary)
            : project.runtimeLabels[0]
              ? formatContextLabel('Runtime', project.runtimeLabels[0])
              : 'Watching recent activity';
  const currentProgress = agentProgress || sessionProgress || null;
  const currentProgressDetail = agentProgressDetail || sessionProgressDetail || null;
  const nextAction = agentNextAction || sessionNextAction || null;
  const nextActionDetail = agentNextActionDetail || sessionNextActionDetail || null;

  return {
    projectName: project.name,
    projectSummary,
    sessionId: session?.sessionId ?? null,
    sessionLabel,
    sessionSummary,
    currentProgress,
    currentProgressDetail,
    nextAction,
    nextActionDetail,
    agentId: agent?.agentId ?? null,
    agentLabel,
    agentSummary,
    scopeLabel,
    breadcrumb,
    headline,
    subheadline,
    eventCount: project.eventCount,
    sessionCount: project.sessions.length,
    agentCount: project.agentCount,
    hasSessionFocus: Boolean(session),
    hasAgentFocus: Boolean(agent),
  };
}

const RECENT_CHANGE_TYPES = new Set([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'UserPromptSubmit',
  'AssistantResponse',
  'SubagentStart',
  'SubagentStop',
  'SessionTitleChanged',
]);

export function buildRecentChangesSnapshot(
  project: Project | null,
  session: SessionInfo | null,
  evts: HookEvent[],
): RecentChangesSnapshot | null {
  if (!project) return null;

  const scopedEvents = evts
    .filter((event) => event.source_app === project.name)
    .filter((event) => !session || event.session_id === session.sessionId);

  if (scopedEvents.length === 0) return null;

  const recentEvents = [...scopedEvents]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .filter((event) => RECENT_CHANGE_TYPES.has(event.hook_event_type));

  const selectedEvents = (recentEvents.length > 0 ? recentEvents : [...scopedEvents]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0)))
    .slice(0, 3);

  const items = selectedEvents
    .map((event) => {
      const label = describeEvent(event).trim();
      const detail = describeEventDetail(event)?.trim() || undefined;
      if (!label && !detail) return null;
      return {
        label: label || detail || 'Observed an event',
        detail: detail && detail !== label ? detail : undefined,
        timestamp: event.timestamp || 0,
      };
    })
    .filter((item): item is RecentChangeItem => Boolean(item));

  if (items.length === 0) return null;

  const scopeLabel = session?.label || session?.sessionId || project.name;
  const scopeDetail = session
    ? `${session.eventCount} event${session.eventCount === 1 ? '' : 's'} in this session`
    : `${project.sessions.length} session${project.sessions.length === 1 ? '' : 's'} in this project`;

  return {
    scopeLabel,
    scopeDetail,
    headline: session
      ? `Recent changes in ${scopeLabel}`
      : `Recent changes in ${project.name}`,
    eventCount: scopedEvents.length,
    lastEventAt: items[0]?.timestamp ?? 0,
    items,
  };
}

interface SelectedAgentDetailSnapshot {
  agent: AgentInfo;
  session: SessionInfo | null;
  projectName: string | null;
  focus: ProjectFocusSnapshot | null;
  runtimeLabel: string;
  statusLabel: string;
  statusTone: AgentStatusTone;
  assignmentLabel: string;
  assignmentDetail?: string;
  currentActionLabel: string;
  currentActionDetail?: string;
  lastUsefulResultLabel: string;
  lastUsefulResultDetail?: string;
  lastUsefulResultAt: number | null;
  recentEvents: HookEvent[];
}

export const selectedAgentDetailSnapshot = createMemo((): SelectedAgentDetailSnapshot | null => {
  const agent = selectedAgentSnapshot();
  if (!agent) return null;

  const session = selectedSessionSnapshot();
  const project = selectedProjectSnapshot();
  const focus = buildProjectFocusSnapshot(project, session, agent);
  const scopedEvents = selectedAgentEvents(session, project, agent.agentId);
  const lastUsefulResult = resolveLastUsefulResult(scopedEvents);

  return {
    agent,
    session,
    projectName: project?.name ?? null,
    focus,
    runtimeLabel: agent.runtimeLabel || session?.runtimeLabel || 'Runtime unavailable',
    statusLabel: resolveAgentStatusLabel(agent),
    statusTone: resolveAgentStatusTone(agent),
    assignmentLabel: agent.nextAction?.trim() || agent.assignment?.trim() || 'No next action captured yet',
    assignmentDetail: agent.nextActionDetail?.trim() || agent.assignmentDetail?.trim() || undefined,
    currentActionLabel: agent.currentProgress?.trim() || agent.currentAction?.trim() || 'No current progress captured yet',
    currentActionDetail: agent.currentProgressDetail?.trim() || agent.currentActionDetail?.trim() || undefined,
    lastUsefulResultLabel: lastUsefulResult?.label || 'No useful result captured yet',
    lastUsefulResultDetail: lastUsefulResult?.detail ?? undefined,
    lastUsefulResultAt: lastUsefulResult?.timestamp ?? null,
    recentEvents: scopedEvents,
  };
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

function resolveNextAction(evts: HookEvent[]): string | undefined {
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

function resolveNextActionDetail(evts: HookEvent[]): string | undefined {
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

function resolveCurrentProgress(evts: HookEvent[]): string | undefined {
  const latest = latestMeaningfulEvent(evts) ?? latestEvent(evts);

  if (!latest) return undefined;

  const summary = describeEvent(latest).trim();
  return summary || undefined;
}

function resolveCurrentProgressDetail(evts: HookEvent[]): string | undefined {
  const latest = latestMeaningfulEvent(evts) ?? latestEvent(evts);

  if (!latest) return undefined;

  const detail = describeEventDetail(latest)?.trim();
  return detail || undefined;
}

function resolveSessionSummary(
  evts: HookEvent[],
  agents: AgentInfo[],
): { label?: string; detail?: string; nextAction?: string; nextActionDetail?: string } {
  const activeWorkers = agents
    .filter((agent) => agent.agentId && agent.isActive)
    .map((agent) => summarizeAgent(agent))
    .filter(Boolean)
    .slice(0, 2);
  if (activeWorkers.length > 0) {
    const activeCount = agents.filter((agent) => agent.agentId && agent.isActive).length;
    return {
      label: activeWorkers.join(' · '),
      detail: `${activeCount} active agent${activeCount === 1 ? '' : 's'}`,
      nextAction: resolveNextAction(evts),
      nextActionDetail: resolveNextActionDetail(evts),
    };
  }

  const recentWorkers = agents
    .filter((agent) => agent.agentId)
    .map((agent) => summarizeAgent(agent))
    .filter(Boolean)
    .slice(0, 2);
  if (recentWorkers.length > 0) {
    const totalWorkers = agents.filter((agent) => agent.agentId).length;
    return {
      label: recentWorkers.join(' · '),
      detail: `${totalWorkers} agent${totalWorkers === 1 ? '' : 's'} involved`,
      nextAction: resolveNextAction(evts),
      nextActionDetail: resolveNextActionDetail(evts),
    };
  }

  const latestUseful = latestUsefulEventSummary(evts);
  if (latestUseful?.label) {
    return {
      ...latestUseful,
      nextAction: resolveNextAction(evts),
      nextActionDetail: resolveNextActionDetail(evts),
    };
  }

  const nextAction = resolveNextAction(evts);
  if (nextAction) {
    return {
      label: nextAction,
      detail: resolveNextActionDetail(evts),
      nextAction,
      nextActionDetail: resolveNextActionDetail(evts),
    };
  }

  const currentProgress = resolveCurrentProgress(evts);
  if (currentProgress) {
    return {
      label: currentProgress,
      detail: resolveCurrentProgressDetail(evts),
      nextAction: resolveNextAction(evts),
      nextActionDetail: resolveNextActionDetail(evts),
    };
  }

  return {
    nextAction: resolveNextAction(evts),
    nextActionDetail: resolveNextActionDetail(evts),
  };
}

function latestUsefulEventSummary(evts: HookEvent[]): { label?: string; detail?: string } | undefined {
  const latest = latestUsefulEvent(evts);

  if (!latest) return undefined;

  if (latest.hook_event_type === 'AssistantResponse') {
    const text = latest.payload?.text;
    return {
      label: describeEvent(latest).trim(),
      detail: typeof text === 'string' && text.trim() ? truncate(text.trim(), 96) : undefined,
    };
  }

  if (latest.hook_event_type === 'UserPromptSubmit') {
    const prompt = latest.payload?.prompt || latest.payload?.message;
    return {
      label: describeEvent(latest).trim(),
      detail: typeof prompt === 'string' && prompt.trim() ? truncate(prompt.trim(), 96) : undefined,
    };
  }

  return {
    label: describeEvent(latest).trim(),
    detail: describeEventDetail(latest)?.trim() || undefined,
  };
}

function resolveProjectSummary(
  sessions: SessionInfo[],
  runtimeLabels: string[],
  activeSessionCount: number,
): { label?: string; detail?: string } {
  const topActiveSession = sessions.find((session) => session.isActive && session.summary);
  if (topActiveSession?.summary) {
    return {
      label: topActiveSession.summary,
      detail: topActiveSession.summaryDetail,
    };
  }

  const topSession = sessions.find((session) => session.summary);
  if (topSession?.summary) {
    return {
      label: topSession.summary,
      detail: topSession.summaryDetail,
    };
  }

  if (activeSessionCount > 0 && runtimeLabels.length > 0) {
    return {
      label: `${activeSessionCount} session${activeSessionCount === 1 ? '' : 's'} active`,
      detail: `${runtimeLabels.join(', ')} runtime`,
    };
  }

  if (runtimeLabels.length > 0) {
    return {
      label: 'Watching recent activity',
      detail: `${runtimeLabels.join(', ')} runtime`,
    };
  }

  if (activeSessionCount > 0) {
    return {
      label: `${activeSessionCount} session${activeSessionCount === 1 ? '' : 's'} active`,
    };
  }

  return {};
}

function latestUsefulEvent(evts: HookEvent[]): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => ['AssistantResponse', 'PostToolUse', 'PostToolUseFailure'].includes(event.hook_event_type));
}

function summarizeAgent(agent: AgentInfo): string | undefined {
  const action = agent.currentProgress || agent.currentAction || agent.assignment;
  if (!action) return agent.displayName;
  return `${agent.displayName}: ${truncate(action, 72)}`;
}

function resolveAgentStatusLabel(agent: AgentInfo): string {
  if (agent.isActive) return 'Active';
  if (agent.eventCount > 0) return 'Idle';
  return 'Completed';
}

function resolveAgentStatusTone(agent: AgentInfo): AgentStatusTone {
  if (agent.isActive) return 'active';
  if (agent.eventCount > 0) return 'idle';
  return 'muted';
}

function selectedAgentEvents(
  session: SessionInfo | null,
  project: Project | null,
  agentId: string | null,
): HookEvent[] {
  if (!agentId) return [];

  let scoped = events();
  if (project) {
    scoped = scoped.filter((event) => event.source_app === project.name);
  }
  if (session) {
    scoped = scoped.filter((event) => event.session_id === session.sessionId);
  }

  const key = agentId || MAIN_AGENT_KEY;
  return scoped
    .filter((event) => (event.agent_id || MAIN_AGENT_KEY) === key)
    .slice(-120)
    .reverse();
}

function resolveLastUsefulResult(
  evts: HookEvent[],
): { label: string; detail?: string; timestamp: number } | undefined {
  const latest = latestUsefulEvent(evts);
  if (!latest) return undefined;

  const summary = latestUsefulEventSummary([latest]);
  const label = summary?.label || describeEvent(latest).trim();
  if (!label) return undefined;

  return {
    label,
    detail: summary?.detail || describeEventDetail(latest)?.trim() || undefined,
    timestamp: latest.timestamp || 0,
  };
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

function formatNowHeadline(subject: string, action?: string | null): string {
  const trimmed = action?.trim();
  if (!trimmed) return `${subject} has no active work yet`;
  return `${subject} is ${trimmed[0].toLowerCase()}${trimmed.slice(1)}`;
}

function formatContextLabel(label: string, value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : undefined;
}

/** Filtered agents based on selection */
export const filteredAgents = createMemo((): AgentInfo[] => {
  const project = selectedProjectSnapshot();
  if (!project) return projects().flatMap(p => p.sessions.flatMap(s => s.agents));
  const session = selectedSessionSnapshot();
  if (session) {
    return session.agents;
  }
  return project.sessions.flatMap(s => s.agents);
});

export const selectedProjectFocusSnapshot = createMemo((): ProjectFocusSnapshot | null => {
  const project = selectedProjectSnapshot();
  if (!project) return null;
  return buildProjectFocusSnapshot(project, selectedSessionSnapshot(), selectedAgentSnapshot());
});

export const selectedRecentChangesSnapshot = createMemo((): RecentChangesSnapshot | null => {
  const project = selectedProjectSnapshot();
  if (!project) return null;
  return buildRecentChangesSnapshot(project, selectedSessionSnapshot(), events());
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
