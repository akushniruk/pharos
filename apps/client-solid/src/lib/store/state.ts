import { createSignal, createMemo, createEffect } from 'solid-js';
import type {
  View,
  Project,
  SessionInfo,
  AgentInfo,
  AgentEntry,
  HookEvent,
  MemoryRuntimeStatus,
  ViewedChangesSnapshot,
  ActivityTone,
} from '../types';
import { agents, events, projectSnapshots } from '../ws';
import { describeEvent, describeEventDetail, formatRuntimeLabel } from '../describe';
import { truncate } from '../describe/text';
import { friendlyProjectName } from '../projectDisplayName';
import { sessionTitleForSidebar } from '../sessionSidebarTitle';
import {
  mapAgentTypeLabel,
  resolveEventAgentName,
  resolveHybridAgentName,
  responsibilityFromPayload,
} from '../agentNaming';
import { buildAttentionSuggestions } from '../attentionHints';
import {
  ACTIVE_THRESHOLD_MS,
  buildProjectFocusSnapshot,
  buildRecentChangesSnapshot,
  buildViewedChangesSnapshot,
  deriveRuntimeBridgeCandidates,
  buildMemoryRuntimeStatus,
  getScopeKey,
  getScopedEvents,
  latestEventOfType,
  latestMeaningfulEvent,
  MAIN_AGENT_KEY,
  resolveActivityState,
  resolveConservativeStatusDetail,
  truncate,
  formatRuntimeList,
  type ActivityState,
  type ActivityTone,
  type ProjectFocusSnapshot,
  type RecentChangesSnapshot,
  type RuntimeBridgeCandidate,
} from './snapshots';

export type { ActivityTone, ActivityState, ProjectFocusSnapshot, RecentChangesSnapshot, RuntimeBridgeCandidate, RecentChangeItem } from './snapshots';
export {
  buildProjectFocusSnapshot,
  buildRecentChangesSnapshot,
  buildViewedChangesSnapshot,
  buildMemoryRuntimeStatus,
  resolveActivityState,
  resolveConservativeStatusDetail,
  deriveRuntimeBridgeCandidates,
} from './snapshots';

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
export const [helpVisible, setHelpVisible] = createSignal(false);

const VIEWED_STORAGE_KEY = 'pharos-viewed-scopes-v1';
type ViewedScopeMap = Record<string, number>;
export const [viewedScopes, setViewedScopes] = createSignal<ViewedScopeMap>(loadViewedScopes());

const ATTENTION_BANNER_DISMISS_KEY = 'pharos.attention-banner.dismissed-v1';
const MAX_ATTENTION_DISMISS_KEYS = 400;

function loadAttentionBannerDismissed(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ATTENTION_BANNER_DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

function saveAttentionBannerDismissed(keys: Set<string>) {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = [...keys];
    const trimmed =
      list.length > MAX_ATTENTION_DISMISS_KEYS ? list.slice(-MAX_ATTENTION_DISMISS_KEYS) : list;
    localStorage.setItem(ATTENTION_BANNER_DISMISS_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota or private mode */
  }
}

/** Stable key so "Solved" stays dismissed for same session+tone. */
export function attentionBannerFingerprint(projectName: string, session: SessionInfo): string {
  const tone = session.statusTone ?? '';
  return `${projectName}\u001f${session.sessionId}\u001f${tone}`;
}

export const [dismissedAttentionBanners, setDismissedAttentionBanners] = createSignal<
  Set<string>
>(loadAttentionBannerDismissed());

/** Persist dismissal so banner and log highlights clear until daemon status changes. */
export function markAttentionSolved(fingerprint: string) {
  setDismissedAttentionBanners((previous) => {
    const next = new Set(previous);
    next.add(fingerprint);
    saveAttentionBannerDismissed(next);
    return next;
  });
}

/** @deprecated Use markAttentionSolved */
export const dismissAttentionBanner = markAttentionSolved;

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

export function initViewedScopeState() {
  createEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(viewedScopes()));
    }
  });
}

export function acknowledgeSelectedScope() {
  const project = selectedProjectSnapshot();
  if (!project) return;

  const session = selectedSessionSnapshot();
  const scopeKey = getScopeKey(project.name, session?.sessionId ?? null);
  const latestEventAt = getScopeLatestEventAt(project.name, session?.sessionId ?? null);
  const acknowledgedAt = latestEventAt || Date.now();

  setViewedScopes((current) => ({
    ...current,
    [scopeKey]: acknowledgedAt,
  }));
}

/** Toggle project selection (deselect if already selected) */
export function selectProject(name: string | null) {
  setSelectedProject(p => p === name ? null : name);
  setSelectedSession(null);
  setSelectedAgent(null);
}

/** Select a session, or clear the session when `id` is null. */
export function selectSession(id: string | null) {
  setSelectedSession(id);
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

const REGISTRY_GRACE_MS = 5 * 60_000;

interface RegistryInfo {
  lifecycle_status: string;
  last_seen_at: number;
  display_name: string;
  agent_id?: string;
  parent_id?: string;
}

const registryBySessionAgent = createMemo(() => {
  const map = new Map<string, RegistryInfo>();
  for (const entry of agents()) {
    const agentKey = entry.agent_id || MAIN_AGENT_KEY;
    map.set(`${entry.session_id}:${agentKey}`, {
      lifecycle_status: entry.lifecycle_status,
      last_seen_at: entry.last_seen_at,
      display_name: entry.display_name,
      agent_id: entry.agent_id,
      parent_id: entry.parent_id,
    });
  }
  return map;
});

function activityStateForEvents(evts: HookEvent[], isActive: boolean): ActivityState {
  const status = resolveActivityState(evts, { isActive });
  return {
    ...status,
    detail: resolveConservativeStatusDetail(status.tone, status.detail, evts),
  };
}

function enrichProjectsWithActivityState(
  snapshotProjects: Project[],
  registry: Map<string, RegistryInfo>,
  evts: HookEvent[],
): Project[] {
  return snapshotProjects.map((project) => {
    const projectEvents = evts.filter((event) => event.source_app === project.name);

    const sessions = project.sessions.map((session) => {
      const sessionEvents = projectEvents.filter((event) => event.session_id === session.sessionId);

      const agentsArr = session.agents.map((agent) => {
        const agentEvents = sessionEvents.filter((event) =>
          (event.agent_id || MAIN_AGENT_KEY) === (agent.agentId || MAIN_AGENT_KEY));
        const agentIsActive =
          isRegistryActive(registry, session.sessionId, agent.agentId)
          || agent.isActive;
        const status = activityStateForEvents(agentEvents, agentIsActive);

        // Prefer registry display name over snapshot name
        const registryName = resolveRegistryDisplayName(
          registry,
          session.sessionId,
          agent.agentId,
        );
        const displayName = registryName
          || (agent.displayName !== 'Agent' ? agent.displayName : undefined)
          || agent.displayName;
        const parentId = agent.parentId
          || resolveRegistryParentId(registry, session.sessionId, agent.agentId);

        return {
          ...agent,
          displayName,
          parentId,
          statusLabel: status.label,
          statusTone: status.tone,
          statusDetail: status.detail,
        };
      });

      const sessionIsActive =
        isRegistryActive(registry, session.sessionId, MAIN_AGENT_KEY)
        || agentsArr.some((agent) => agent.isActive);
      const status = activityStateForEvents(sessionEvents, sessionIsActive);

      return {
        ...session,
        agents: agentsArr,
        statusLabel: status.label,
        statusTone: status.tone,
        statusDetail: status.detail,
      };
    });

    return {
      ...project,
      sessions: sessions.sort((a, b) => b.lastEventAt - a.lastEventAt),
    };
  });
}

/** Derive projects from the event stream */
export const projects = createMemo((): Project[] => {
  const snapshots = projectSnapshots();
  const evts = events();
  const registry = registryBySessionAgent();
  if (snapshots.length > 0) {
    return enrichProjectsWithActivityState(snapshots, registry, evts);
  }

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
        const eventName = resolveAgentName(aevts, aid === '__main__');
        // Prefer registry display_name over event-derived name
        const registryName = resolveRegistryDisplayName(
          registry,
          sid,
          aid === '__main__' ? null : aid,
        );
        const displayName = registryName || eventName;
        const currentProgress = resolveCurrentProgress(aevts);
        const currentProgressDetail = resolveCurrentProgressDetail(aevts);
        const nextAction = resolveNextAction(aevts);
        const nextActionDetail = resolveNextActionDetail(aevts);
        const agentIsActive = isRegistryActive(registry, sid, aid);
        const agentStatus = activityStateForEvents(aevts, agentIsActive);
        const parentId = resolveParentId(aevts, registry, sid, aid);
        agentsArr.push({
          agentId: aid === '__main__' ? null : aid,
          displayName,
          runtimeLabel,
          assignment: nextAction,
          assignmentDetail: nextActionDetail,
          statusLabel: agentStatus.label,
          statusTone: agentStatus.tone,
          statusDetail: agentStatus.detail,
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
          parentId,
        });
      }

      const sessionSummary = resolveSessionSummary(sevts, agentsArr);
      const sessionIsActive =
        isRegistryActive(registry, sid, MAIN_AGENT_KEY)
        || agentsArr.some((agent) => agent.isActive);
      const sessionStatus = activityStateForEvents(sevts, sessionIsActive);
      sessions.push({
        sessionId: sid,
        label: resolveSessionLabel(sevts, name),
        runtimeLabel,
        summary: sessionSummary.label,
        summaryDetail: sessionSummary.detail,
        statusLabel: sessionStatus.label,
        statusTone: sessionStatus.tone,
        statusDetail: sessionStatus.detail,
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

/** Sessions in the current logs scope that need attention (for in-stream banner). */
export interface LogsAttentionAlert {
  sessionId: string;
  sessionTitle: string;
  tone: 'attention' | 'blocked';
  headline: string;
  detail: string;
  fingerprint: string;
  suggestions: string[];
}

export const logsAttentionAlerts = createMemo((): LogsAttentionAlert[] => {
  const project = selectedProjectSnapshot();
  if (!project) return [];

  const dismissed = dismissedAttentionBanners();
  const focusedSessionId = selectedSession();
  const candidates = focusedSessionId
    ? project.sessions.filter((session) => session.sessionId === focusedSessionId)
    : project.sessions;

  const alerts: LogsAttentionAlert[] = [];
  for (const session of candidates) {
    const tone = session.statusTone;
    if (tone !== 'attention' && tone !== 'blocked') continue;
    const idx = project.sessions.findIndex((entry) => entry.sessionId === session.sessionId);
    const sessionTitle =
      idx >= 0
        ? sessionTitleForSidebar(session.label, idx, session.sessionId, project.name)
        : session.sessionId.slice(0, 8);
    const headline = tone === 'blocked' ? 'Blocked' : 'Needs attention';
    const detail =
      session.statusDetail?.trim()
      || session.summary?.trim()
      || 'Review the latest tool results and prompts in the timeline below.';
    const fingerprint = attentionBannerFingerprint(project.name, session);
    if (dismissed.has(fingerprint)) continue;
    alerts.push({
      sessionId: session.sessionId,
      sessionTitle,
      tone,
      headline,
      detail,
      fingerprint,
      suggestions: buildAttentionSuggestions(detail, tone),
    });
  }
  return alerts;
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

const SIDEBAR_SESSION_ACTIVE_WINDOW_MS = 90_000;
const SIDEBAR_SESSION_IDLE_WINDOW_MS = 10 * 60_000;

/**
 * Session tone for sidebar (and project roll-up): shows daemon attention/blocked unless the user
 * marked that exact status fingerprint Solved in the log banner.
 */
export function sidebarSessionActivityTone(projectName: string, session: SessionInfo): ActivityTone {
  const explicit = session.statusTone;
  const dismissed = dismissedAttentionBanners();
  if (
    (explicit === 'attention' || explicit === 'blocked')
    && !dismissed.has(attentionBannerFingerprint(projectName, session))
  ) {
    return explicit;
  }

  const now = Date.now();
  const age = Math.max(0, now - (session.lastEventAt || 0));
  if ((session.isActive || session.activeAgentCount > 0) && age <= SIDEBAR_SESSION_ACTIVE_WINDOW_MS) {
    return 'active';
  }
  if (session.eventCount > 0 && age <= SIDEBAR_SESSION_IDLE_WINDOW_MS) {
    return 'idle';
  }
  if (session.eventCount > 0) {
    return 'done';
  }
  return 'done';
}

function loadViewedScopes(): ViewedScopeMap {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: ViewedScopeMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function getScopeLatestEventAt(projectName: string, sessionId: string | null): number {
  const project = selectedProjectSnapshot();
  if (!project || project.name !== projectName) {
    return 0;
  }

  const session = sessionId
    ? project.sessions.find((entry) => entry.sessionId === sessionId) ?? null
    : null;
  const scopedEvents = getScopedEvents(project, session, events());
  return scopedEvents.reduce((max, event) => Math.max(max, event.timestamp || 0), 0);
}

interface SelectedAgentDetailSnapshot {
  agent: AgentInfo;
  session: SessionInfo | null;
  projectName: string | null;
  focus: ProjectFocusSnapshot | null;
  runtimeLabel: string;
  statusLabel: string;
  statusTone: ActivityTone;
  statusDetail?: string;
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
  const status = activityStateForEvents(scopedEvents, agent.isActive);

  return {
    agent,
    session,
    projectName: project?.name ?? null,
    focus,
    runtimeLabel: agent.runtimeLabel || session?.runtimeLabel || 'Runtime unavailable',
    statusLabel: status.label,
    statusTone: status.tone,
    statusDetail: status.detail,
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
  const isMeaningfulName = (value?: string | null) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0
      && normalized !== 'agent'
      && normalized !== 'session'
      && normalized !== 'unknown'
      && !normalized.startsWith('<user_query>');
  };

  const byLatest = [...evts].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));

  if (!isMain) {
    const responsibility = byLatest
      .map((event) => responsibilityFromPayload(event.payload))
      .find(Boolean);
    if (responsibility) {
      return truncate(responsibility, 36);
    }
  }

  for (const event of byLatest) {
    const name = resolveEventAgentName(event, isMain ? 'Session' : 'Agent');
    if (isMeaningfulName(name)) return name;
    if (event.payload?.title && isMain) return event.payload.title;
    if (event.payload?.cwd && isMain) {
      const cwdName = workspaceNameFromCwd(event.payload.cwd);
      if (cwdName) return cwdName;
    }
  }

  const mappedType = byLatest
    .map((event) => mapAgentTypeLabel(event.payload?.agent_type || event.agent_type))
    .find((value) => value && value !== 'Session');
  if (mappedType) return mappedType;

  const fallback = byLatest
    .map((event) =>
      resolveHybridAgentName({
        displayName: event.display_name || event.payload?.display_name,
        agentName: event.agent_name || event.payload?.agent_name,
        fallback: isMain ? 'Session' : 'Agent',
      }))
    .find(isMeaningfulName);
  if (fallback) return fallback;

  return isMain ? 'Session' : 'Agent';
}

function isRegistryActive(
  registry: Map<string, RegistryInfo>,
  sessionId: string,
  agentId: string | null,
  now?: number,
): boolean {
  const key = `${sessionId}:${agentId || MAIN_AGENT_KEY}`;
  const info = registry.get(key);
  if (!info) return false;

  const currentTime = now ?? Date.now();
  const elapsed = Math.max(0, currentTime - info.last_seen_at);

  // Active if last seen within 60 seconds
  if (elapsed <= ACTIVE_THRESHOLD_MS) return true;

  // Registry says "active" AND last seen within 5 minutes => still active
  if (info.lifecycle_status === 'active' && elapsed <= REGISTRY_GRACE_MS) return true;

  return false;
}

function resolveRegistryDisplayName(
  registry: Map<string, RegistryInfo>,
  sessionId: string,
  agentId: string | null,
): string | undefined {
  const key = `${sessionId}:${agentId || MAIN_AGENT_KEY}`;
  const info = registry.get(key);
  if (!info) return undefined;
  const resolved = resolveHybridAgentName({
    displayName: info.display_name,
    fallback: agentId ? 'Agent' : 'Session',
  });
  if (!resolved || resolved === 'Agent' || resolved === 'Session') return undefined;
  return resolved;
}

function resolveRegistryParentId(
  registry: Map<string, RegistryInfo>,
  sessionId: string,
  agentId: string | null,
): string | undefined {
  const key = `${sessionId}:${agentId || MAIN_AGENT_KEY}`;
  return registry.get(key)?.parent_id;
}

function resolveParentId(
  evts: HookEvent[],
  registry: Map<string, RegistryInfo>,
  sessionId: string,
  agentId: string,
): string | undefined {
  if (agentId === MAIN_AGENT_KEY) return undefined;
  const registryParent = resolveRegistryParentId(registry, sessionId, agentId);
  if (registryParent) return registryParent;
  const payload = [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => event.hook_event_type === 'SubagentStart')
    ?.payload;
  return payload?.parent_agent_id || payload?.parent_id || payload?.parentId || 'main';
}

function resolveRuntimeLabel(evts: HookEvent[]): string | undefined {
  for (const e of evts) {
    const runtimeCandidate =
      (typeof e.payload?.runtime_label === 'string' ? e.payload.runtime_label : undefined)
      ?? (typeof e.payload?.runtime_source === 'string' ? e.payload.runtime_source : undefined);
    const formatted = formatRuntimeLabel(runtimeCandidate);
    if (formatted) {
      return formatted;
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

  const prompt = latestEventOfType(evts, 'UserPromptSubmit');
  const promptText = prompt?.payload?.prompt || prompt?.payload?.message;
  if (typeof promptText === 'string' && promptText.trim()) {
    return truncate(promptText.trim(), 96);
  }

  return friendlyProjectName(workspaceName);
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
      detail: `${formatRuntimeList(runtimeLabels)} runtime activity`,
    };
  }

  if (runtimeLabels.length > 0) {
    return {
      label: 'Watching recent activity',
      detail: `${formatRuntimeList(runtimeLabels)} runtime activity`,
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

/**
 * Graph-first agent list.
 * Prefer live registry topology in scoped views (session or single-session project),
 * and fall back to snapshot-derived agents when registry scope is ambiguous.
 */
export const graphAgents = createMemo((): AgentInfo[] => {
  const snapshotAgents = filteredAgents();
  const projectName = selectedProject();
  const sessionId = selectedSession();

  const scopedRegistry = agents().filter((entry) => {
    if (projectName && entry.source_app !== projectName) return false;
    if (sessionId && entry.session_id !== sessionId) return false;
    return true;
  });

  if (scopedRegistry.length === 0) {
    return snapshotAgents;
  }

  const uniqueSessions = new Set(scopedRegistry.map((entry) => entry.session_id));
  const useRegistryTopology = Boolean(sessionId) || uniqueSessions.size <= 1;
  if (!useRegistryTopology) {
    return snapshotAgents;
  }

  const mapped = new Map<string, AgentInfo>();
  for (const entry of scopedRegistry) {
    const key = entry.agent_id || MAIN_AGENT_KEY;
    const previous = mapped.get(key);
    const next = registryEntryToGraphAgent(entry);
    if (!previous || next.lastEventAt >= previous.lastEventAt) {
      mapped.set(key, next);
    }
  }

  return Array.from(mapped.values()).sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return right.lastEventAt - left.lastEventAt;
  });
});

/** Project/session-scoped events for graph topology (ignores the per-agent event filter). */
export const graphScopeEvents = createMemo((): HookEvent[] => {
  let scoped = events();
  const project = selectedProject();
  const session = selectedSession();
  if (project) scoped = scoped.filter((event) => event.source_app === project);
  if (session) scoped = scoped.filter((event) => event.session_id === session);
  return scoped;
});

export const runtimeBridgeCandidates = createMemo((): RuntimeBridgeCandidate[] => {
  return deriveRuntimeBridgeCandidates(graphAgents(), graphScopeEvents());
});

function registryStatusToTone(status: string): { label: string; tone: ActivityTone; isActive: boolean } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'active', isActive: true };
    case 'idle':
      return { label: 'Idle', tone: 'idle', isActive: false };
    case 'error':
      return { label: 'Error', tone: 'attention', isActive: false };
    case 'stopped':
      return { label: 'Stopped', tone: 'done', isActive: false };
    default:
      return { label: 'Idle', tone: 'idle', isActive: false };
  }
}

function registryEntryToGraphAgent(entry: AgentEntry): AgentInfo {
  const resolved = registryStatusToTone(entry.lifecycle_status);
  return {
    agentId: entry.agent_id || null,
    displayName: resolveHybridAgentName({
      displayName: entry.display_name,
      agentType: entry.agent_type,
      fallback: entry.agent_id ? 'Agent' : 'Session',
    }),
    statusLabel: resolved.label,
    statusTone: resolved.tone,
    statusDetail: undefined,
    agentType: entry.agent_type,
    modelName: entry.model_name,
    eventCount: entry.event_count || 0,
    lastEventAt: entry.last_seen_at || 0,
    isActive: resolved.isActive,
    parentId: entry.parent_id || undefined,
  };
}

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

export const selectedViewedChangesSnapshot = createMemo((): ViewedChangesSnapshot | null => {
  const project = selectedProjectSnapshot();
  if (!project) return null;

  const session = selectedSessionSnapshot();
  const scopeKey = getScopeKey(project.name, session?.sessionId ?? null);
  const viewedAt = viewedScopes()[scopeKey] ?? null;

  return buildViewedChangesSnapshot(project, session, events(), viewedAt);
});

export const selectedMemoryRuntimeStatus = createMemo((): MemoryRuntimeStatus | null => {
  const project = selectedProjectSnapshot();
  if (!project) return null;
  return buildMemoryRuntimeStatus(project, selectedSessionSnapshot(), events());
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
