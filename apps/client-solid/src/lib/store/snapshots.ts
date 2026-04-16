/**
 * Pure snapshot builders and activity resolution — no Solid primitives.
 * Tests import from this module to avoid pulling in reactive store initialization.
 */
import type {
  AgentInfo,
  HookEvent,
  MemoryRuntimeStatus,
  Project,
  SessionInfo,
  ViewedChangesSnapshot,
} from '../types';
import { describeEvent, describeEventDetail, formatRuntimeLabel } from '../describe';
import { friendlyProjectName } from '../projectDisplayName';

export const MAIN_AGENT_KEY = '__main__';

export const ACTIVE_THRESHOLD_MS = 60_000;
export const IDLE_THRESHOLD_MS = 10 * 60_000;
const STALL_THRESHOLD_MS = 10 * 60_000;
const SESSION_BRIDGE_WINDOW_MS = 120_000;

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

export type ActivityTone = 'active' | 'blocked' | 'attention' | 'idle' | 'done';

export interface ActivityState {
  label: string;
  tone: ActivityTone;
  detail?: string;
}

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

export interface RuntimeBridgeCandidate {
  key: string;
  fromAgentId: string;
  toAgentId: string;
  fromRuntime: string;
  toRuntime: string;
  fromLastEventAt: number;
  toLastEventAt: number;
}

interface RuntimeRepresentative {
  runtimeLabel: string;
  runtimeKey: string;
  agentId: string;
  lastEventAt: number;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function sanitizeFocusText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\[image\]/gi, 'image')
    .replace(/\s+/g, ' ')
    .replace(/the following images were provided by the user.*$/i, '')
    .trim();
  return cleaned || undefined;
}

function formatNowHeadline(subject: string, action?: string | null): string {
  const trimmed = sanitizeFocusText(action);
  if (!trimmed) return `${subject} has no active work yet`;
  return `${subject}: ${truncate(trimmed, 96)}`;
}

function formatContextLabel(label: string, value?: string | null): string | undefined {
  const trimmed = sanitizeFocusText(value);
  return trimmed ? `${label}: ${truncate(trimmed, 110)}` : undefined;
}

export function formatRuntimeList(runtimeLabels: string[]): string {
  const formatted = runtimeLabels
    .map((label) => formatRuntimeLabel(label))
    .filter((label): label is string => Boolean(label));

  if (formatted.length === 0) {
    return 'Recent';
  }
  if (formatted.length === 1) {
    return formatted[0];
  }
  if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}`;
  }
  return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
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
  const focusSubject = agentLabel || sessionLabel || friendlyProjectName(project.name);
  const focusAction = agentProgress || agentNextAction || sessionProgress || sessionNextAction || projectSummary;
  const scopeLabel = agent
    ? 'Agent focus'
    : session
      ? 'Session focus'
      : 'Project overview';
  const breadcrumb = [friendlyProjectName(project.name), sessionLabel, agentLabel].filter(Boolean).join(' · ');
  const headline = formatNowHeadline(focusSubject, focusAction);
  const subheadline = agentNextAction
    ? formatContextLabel('Next action', agentNextAction)
    : sessionNextAction
      ? formatContextLabel('Next action', sessionNextAction)
      : agentProgressDetail
        ? formatContextLabel('Current progress', agentProgressDetail)
        : sessionProgressDetail
          ? formatContextLabel('Current progress', sessionProgressDetail)
          : project.runtimeLabels[0]
            ? formatContextLabel('Runtime', formatRuntimeLabel(project.runtimeLabels[0]))
            : projectSummary
              ? formatContextLabel('Project summary', projectSummary)
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

export function getScopeKey(projectName: string, sessionId: string | null): string {
  return sessionId ? `session:${projectName}:${sessionId}` : `project:${projectName}`;
}

function getScopeLabel(project: Project, session: SessionInfo | null): string {
  return session?.label || session?.sessionId || friendlyProjectName(project.name);
}

function getScopeDetail(project: Project, session: SessionInfo | null): string {
  return session
    ? `${session.eventCount} event${session.eventCount === 1 ? '' : 's'} in this session`
    : `${project.sessions.length} session${project.sessions.length === 1 ? '' : 's'} in this project`;
}

export function getScopedEvents(
  project: Project,
  session: SessionInfo | null,
  evts: HookEvent[],
): HookEvent[] {
  return evts
    .filter((event) => event.source_app === project.name)
    .filter((event) => !session || event.session_id === session.sessionId);
}

function buildChangeItems(eventsForScope: HookEvent[]): RecentChangeItem[] {
  const sorted = [...eventsForScope].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));
  const selectedEvents = sorted
    .filter((event) => RECENT_CHANGE_TYPES.has(event.hook_event_type))
    .slice(0, 3);

  const eventsToSummarize = selectedEvents.length > 0
    ? selectedEvents
    : sorted.slice(0, 3);

  return eventsToSummarize
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
}

export function buildRecentChangesSnapshot(
  project: Project | null,
  session: SessionInfo | null,
  evts: HookEvent[],
): RecentChangesSnapshot | null {
  if (!project) return null;

  const scopedEvents = getScopedEvents(project, session, evts);

  if (scopedEvents.length === 0) return null;

  const items = buildChangeItems(scopedEvents);

  if (items.length === 0) return null;

  const scopeLabel = getScopeLabel(project, session);
  const scopeDetail = getScopeDetail(project, session);

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

export function buildViewedChangesSnapshot(
  project: Project | null,
  session: SessionInfo | null,
  evts: HookEvent[],
  viewedAt: number | null,
): ViewedChangesSnapshot | null {
  if (!project) return null;

  const scopedEvents = getScopedEvents(project, session, evts);
  if (scopedEvents.length === 0) return null;

  const scopeLabel = getScopeLabel(project, session);
  const scopeDetail = getScopeDetail(project, session);
  const scopeKey = getScopeKey(project.name, session?.sessionId ?? null);
  const normalizedViewedAt = typeof viewedAt === 'number' && Number.isFinite(viewedAt)
    ? viewedAt
    : null;
  const unreadEvents = normalizedViewedAt === null
    ? scopedEvents
    : scopedEvents.filter((event) => (event.timestamp || 0) > normalizedViewedAt);
  const latestEventAt = scopedEvents.reduce((max, event) => Math.max(max, event.timestamp || 0), 0);
  const items = buildChangeItems(unreadEvents);
  const hasUnreadChanges = unreadEvents.length > 0;
  const unreadCount = unreadEvents.length;

  return {
    scopeKey,
    scopeLabel,
    scopeDetail,
    headline: hasUnreadChanges
      ? `New changes in ${scopeLabel}`
      : `Up to date in ${scopeLabel}`,
    body: hasUnreadChanges
      ? `${unreadCount} change${unreadCount === 1 ? '' : 's'} landed since your last acknowledgement.`
      : normalizedViewedAt
        ? 'Nothing has changed since your last acknowledgement.'
        : 'This scope has not been acknowledged yet.',
    lastViewedAt: normalizedViewedAt,
    latestEventAt,
    unreadCount,
    hasUnreadChanges,
    items,
  };
}

function payloadContains(value: unknown, needle: string): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.toLowerCase().includes(needle);
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (Array.isArray(value)) {
    return value.some((item) => payloadContains(item, needle));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      payloadContains(entry, needle)
    );
  }
  return false;
}

function eventUsesMcp(event: HookEvent): boolean {
  const toolName = String(event.payload?.tool_name || '').toLowerCase();
  return (
    toolName === 'callmcptool'
    || toolName === 'fetchmcpresource'
    || toolName === 'listmcpresources'
  );
}

export function buildMemoryRuntimeStatus(
  project: Project | null,
  session: SessionInfo | null,
  evts: HookEvent[],
): MemoryRuntimeStatus | null {
  if (!project) return null;
  const scopedEvents = getScopedEvents(project, session, evts);
  if (scopedEvents.length === 0) return null;

  const memoryObserved = scopedEvents.some((event) => {
    const toolName = String(event.payload?.tool_name || '').toLowerCase();
    const eventText = [
      event.hook_event_type,
      toolName,
      JSON.stringify(event.payload ?? {}),
    ]
      .join(' ')
      .toLowerCase();
    return eventText.includes('memory');
  });
  const aiMemoryBrainObserved = scopedEvents.some((event) => {
    if (!eventUsesMcp(event)) return false;
    const server = String(event.payload?.tool_input?.server || '').toLowerCase();
    return server === 'ai-memory-brain' || payloadContains(event.payload, 'ai-memory-brain');
  });
  const ollamaObserved = scopedEvents.some((event) => payloadContains(event.payload, 'ollama'));
  const gemmaObserved = scopedEvents.some((event) => payloadContains(event.payload, 'gemma'));

  let statusLabel = 'No memory signal observed';
  let statusDetail = 'No ai-memory-brain or memory-related MCP events were detected in this scope yet.';
  if (memoryObserved && !aiMemoryBrainObserved) {
    statusLabel = 'Memory signal detected';
    statusDetail =
      'Memory-related activity is present, but ai-memory-brain MCP server usage is not clearly observed yet.';
  } else if (aiMemoryBrainObserved && !gemmaObserved) {
    statusLabel = 'Memory brain active (Gemma not observed)';
    statusDetail =
      'ai-memory-brain MCP activity is detected, but no Gemma usage signal appears in recent events.';
  } else if (aiMemoryBrainObserved && gemmaObserved) {
    statusLabel = 'Memory brain + Gemma observed';
    statusDetail =
      'ai-memory-brain MCP activity and Gemma-related signals are visible in this scope.';
  }

  return {
    scopeLabel: session?.label || project.name,
    memoryObserved,
    aiMemoryBrainObserved,
    ollamaObserved,
    gemmaObserved,
    statusLabel,
    statusDetail,
  };
}

export function latestMeaningfulEvent(evts: HookEvent[]): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => !['SessionStart', 'SessionEnd', 'SessionTitleChanged'].includes(event.hook_event_type));
}

export function latestEventOfType(evts: HookEvent[], type: string): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => event.hook_event_type === type);
}

export function resolveConservativeStatusDetail(
  tone: ActivityTone,
  detail: string | undefined,
  evts: HookEvent[],
): string | undefined {
  const trimmedDetail = detail?.trim();
  if (trimmedDetail) {
    return trimmedDetail;
  }

  if (tone !== 'blocked' && tone !== 'attention') {
    return trimmedDetail || undefined;
  }

  const latestMeaningful = latestMeaningfulEvent(evts);
  const latestSummary = latestMeaningful ? describeEvent(latestMeaningful).trim() : undefined;
  const latestFailure = latestEventOfType(evts, 'PostToolUseFailure');
  const latestWait = latestExplicitWaitEvent(evts);
  const stalledEvent = latestMeaningful && isInFlightEvent(latestMeaningful)
    ? latestMeaningful
    : undefined;

  if (tone === 'blocked') {
    if (latestWait) {
      return `Blocked by wait request after ${describeEvent(latestWait)}`;
    }
    return latestSummary
      ? `Waiting on the last step to finish after ${latestSummary}`
      : 'Waiting on the last step to finish';
  }

  if (latestFailure) {
    return `Latest failure: ${describeEvent(latestFailure)}`;
  }
  if (stalledEvent) {
    return `Stalled after ${describeEvent(stalledEvent)} with no follow-up progress`;
  }

  return latestSummary
    ? `No new progress after ${latestSummary}`
    : 'No new progress after recent activity';
}

function latestExplicitWaitEvent(evts: HookEvent[]): HookEvent | undefined {
  return [...evts]
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))
    .find((event) => event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'wait_agent');
}

/** PreToolUse tools that usually finish quickly and should not drive "stalled after …" attention. */
function isEditorishPreTool(toolName: string): boolean {
  const n = toolName.trim().toLowerCase();
  return (
    n === 'applypatch'
    || n === 'apply_patch'
    || n === 'strreplace'
    || n === 'search_replace'
    || n === 'write'
    || n === 'edit'
    || n === 'multiedit'
    || n === 'single_edit'
  );
}

function isInFlightEvent(event: HookEvent): boolean {
  if (event.hook_event_type === 'SubagentStart') {
    return true;
  }
  if (event.hook_event_type !== 'PreToolUse') {
    return false;
  }
  if (event.payload?.tool_name === 'wait_agent') {
    return false;
  }
  const tool = typeof event.payload?.tool_name === 'string' ? event.payload.tool_name : '';
  if (tool && isEditorishPreTool(tool)) {
    return false;
  }
  return true;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function resolveActivityState(
  evts: HookEvent[],
  options: { isActive: boolean; now?: number },
): ActivityState {
  const now = options.now ?? Date.now();
  const latestFailure = latestEventOfType(evts, 'PostToolUseFailure');
  if (latestFailure) {
    return {
      label: 'Needs attention',
      tone: 'attention',
      detail: describeEvent(latestFailure),
    };
  }

  const explicitWait = latestExplicitWaitEvent(evts);
  if (explicitWait) {
    return {
      label: 'Blocked',
      tone: 'blocked',
      detail: describeEvent(explicitWait),
    };
  }

  if (options.isActive) {
    return {
      label: 'Active',
      tone: 'active',
    };
  }

  const latestMeaningful = latestMeaningfulEvent(evts);
  if (latestMeaningful && isInFlightEvent(latestMeaningful)) {
    const age = Math.max(0, now - (latestMeaningful.timestamp || 0));
    if (age >= STALL_THRESHOLD_MS) {
      return {
        label: 'Needs attention',
        tone: 'attention',
        detail: `No progress for ${formatDuration(age)} after ${describeEvent(latestMeaningful)}`,
      };
    }
  }

  if (evts.length > 0) {
    const latestTs = Math.max(...evts.map((e) => e.timestamp || 0));
    const elapsed = Math.max(0, now - latestTs);

    if (elapsed <= ACTIVE_THRESHOLD_MS) {
      return {
        label: 'Active',
        tone: 'active',
      };
    }

    if (elapsed <= IDLE_THRESHOLD_MS) {
      return {
        label: 'Idle',
        tone: 'idle',
      };
    }

    return {
      label: 'Done',
      tone: 'done',
    };
  }

  return {
    label: 'Done',
    tone: 'done',
  };
}

function runtimeKey(runtimeLabel: string): string {
  return runtimeLabel.trim().toLowerCase();
}

function resolveAgentRuntimeLabel(
  agent: AgentInfo,
  runtimeByAgentId: Map<string, string>,
): string | undefined {
  const direct = agent.runtimeLabel?.trim();
  if (direct) return direct;
  const fallback = runtimeByAgentId.get(agent.agentId || MAIN_AGENT_KEY)?.trim();
  return fallback || undefined;
}

function resolveRuntimeByAgentId(scopedEvents: HookEvent[]): Map<string, string> {
  const runtimeByAgent = new Map<string, string>();
  for (const event of scopedEvents) {
    const key = event.agent_id || MAIN_AGENT_KEY;
    const runtime = event.payload?.runtime_label || event.payload?.runtime_source;
    if (typeof runtime === 'string' && runtime.trim()) {
      runtimeByAgent.set(key, runtime.trim());
    }
  }
  return runtimeByAgent;
}

function deriveRuntimeRepresentatives(
  agentsList: AgentInfo[],
  scopedEvents: HookEvent[],
): RuntimeRepresentative[] {
  const runtimeByAgent = resolveRuntimeByAgentId(scopedEvents);
  const perRuntime = new Map<string, RuntimeRepresentative>();
  for (const agent of agentsList) {
    if (!agent.agentId) continue;
    if (!agent.isActive && agent.statusTone !== 'active') continue;
    const runtimeLabel = resolveAgentRuntimeLabel(agent, runtimeByAgent);
    if (!runtimeLabel) continue;
    const key = runtimeKey(runtimeLabel);
    const previous = perRuntime.get(key);
    if (!previous || agent.lastEventAt > previous.lastEventAt) {
      perRuntime.set(key, {
        runtimeLabel,
        runtimeKey: key,
        agentId: agent.agentId,
        lastEventAt: agent.lastEventAt || 0,
      });
    }
  }
  return Array.from(perRuntime.values()).sort((left, right) => right.lastEventAt - left.lastEventAt);
}

export function deriveRuntimeBridgeCandidates(
  agentsList: AgentInfo[],
  scopedEvents: HookEvent[],
  windowMs: number = SESSION_BRIDGE_WINDOW_MS,
): RuntimeBridgeCandidate[] {
  const runtimeHeads = deriveRuntimeRepresentatives(agentsList, scopedEvents);
  if (runtimeHeads.length < 2) return [];

  const bridges: RuntimeBridgeCandidate[] = [];
  const seenPairs = new Set<string>();
  for (let index = 0; index < runtimeHeads.length; index += 1) {
    const left = runtimeHeads[index];
    for (let inner = index + 1; inner < runtimeHeads.length; inner += 1) {
      const right = runtimeHeads[inner];
      if (Math.abs(left.lastEventAt - right.lastEventAt) > windowMs) continue;
      const pairKey = [left.runtimeKey, right.runtimeKey].sort().join('<->');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      bridges.push({
        key: pairKey,
        fromAgentId: left.agentId,
        toAgentId: right.agentId,
        fromRuntime: left.runtimeLabel,
        toRuntime: right.runtimeLabel,
        fromLastEventAt: left.lastEventAt,
        toLastEventAt: right.lastEventAt,
      });
    }
  }
  return bridges;
}
