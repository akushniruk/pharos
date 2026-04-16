import { describe, expect, it } from 'vitest';

import {
  buildProjectFocusSnapshot,
  buildRecentChangesSnapshot,
  buildViewedChangesSnapshot,
  deriveRuntimeBridgeCandidates,
  resolveActivityState,
  resolveConservativeStatusDetail,
} from './store/snapshots';
import { attentionBannerFingerprint } from './store';
import type { AgentInfo, HookEvent, Project, SessionInfo } from './types';

describe('attentionBannerFingerprint', () => {
  it('stays stable across detail and timestamp changes for same session+tone', () => {
    const base = {
      sessionId: 'sess-90',
      label: 'Session',
      eventCount: 1,
      agents: [],
      activeAgentCount: 0,
      isActive: false,
      statusTone: 'attention',
    } satisfies Partial<SessionInfo>;

    const first = attentionBannerFingerprint('pharos', {
      ...base,
      lastEventAt: 100,
      statusDetail: 'No progress for 8d',
    } as SessionInfo);
    const second = attentionBannerFingerprint('pharos', {
      ...base,
      lastEventAt: 200,
      statusDetail: 'No progress for 9d',
    } as SessionInfo);

    expect(first).toBe(second);
  });
});

describe('buildProjectFocusSnapshot', () => {
  it('builds a coherent digest for project, session, and agent focus', () => {
    const project = {
      name: 'pharos',
      runtimeLabels: ['codex'],
      eventCount: 24,
      agentCount: 3,
      activeSessionCount: 1,
      lastEventAt: 1_000,
      isActive: true,
      summary: 'Project is coordinating a handoff',
      sessions: [],
    } satisfies Project;

    const session = {
      sessionId: 'session-123',
      label: 'Deploy review',
      runtimeLabel: 'codex',
      summary: 'Waiting on final validation',
      currentAction: 'Checking rollout health',
      eventCount: 12,
      agents: [],
      activeAgentCount: 1,
      lastEventAt: 900,
      isActive: true,
    } satisfies SessionInfo;

    project.sessions = [session];

    const agent = {
      agentId: 'agent-7',
      displayName: 'Operator',
      runtimeLabel: 'codex',
      assignment: 'Own the release checklist',
      currentAction: 'Verifying canary metrics',
      agentType: 'subagent',
      modelName: 'gpt-5',
      eventCount: 6,
      lastEventAt: 950,
      isActive: true,
      parentId: undefined,
    } satisfies AgentInfo;

    expect(buildProjectFocusSnapshot(project, session, agent)).toEqual({
      projectName: 'pharos',
      projectSummary: 'Project is coordinating a handoff',
      sessionId: 'session-123',
      sessionLabel: 'Deploy review',
      sessionSummary: 'Waiting on final validation',
      currentProgress: 'Verifying canary metrics',
      currentProgressDetail: null,
      nextAction: 'Own the release checklist',
      nextActionDetail: null,
      agentId: 'agent-7',
      agentLabel: 'Operator',
      agentSummary: 'Verifying canary metrics',
      scopeLabel: 'Agent focus',
      breadcrumb: 'Pharos · Deploy review · Operator',
      headline: 'Operator: Verifying canary metrics',
      subheadline: 'Next action: Own the release checklist',
      eventCount: 24,
      sessionCount: 1,
      agentCount: 3,
      hasSessionFocus: true,
      hasAgentFocus: true,
    });
  });

  it('surfaces the runtime label before a generic project summary fallback', () => {
    const project = {
      name: 'pharos',
      runtimeLabels: ['claude'],
      eventCount: 2,
      agentCount: 1,
      activeSessionCount: 0,
      lastEventAt: 1_000,
      isActive: false,
      summary: 'Coordinating a handoff',
      sessions: [],
    } satisfies Project;

    expect(buildProjectFocusSnapshot(project, null, null)).toEqual({
      projectName: 'pharos',
      projectSummary: 'Coordinating a handoff',
      sessionId: null,
      sessionLabel: null,
      sessionSummary: null,
      currentProgress: null,
      currentProgressDetail: null,
      nextAction: null,
      nextActionDetail: null,
      agentId: null,
      agentLabel: null,
      agentSummary: null,
      scopeLabel: 'Project overview',
      breadcrumb: 'Pharos',
      headline: 'Pharos: Coordinating a handoff',
      subheadline: 'Runtime: Claude',
      eventCount: 2,
      sessionCount: 0,
      agentCount: 1,
      hasSessionFocus: false,
      hasAgentFocus: false,
    });
  });
});

describe('buildRecentChangesSnapshot', () => {
  it('summarizes the latest meaningful changes for the selected session', () => {
    const project = {
      name: 'pharos',
      runtimeLabels: ['codex'],
      eventCount: 4,
      agentCount: 1,
      activeSessionCount: 1,
      lastEventAt: 400,
      isActive: true,
      sessions: [],
    } satisfies Project;

    const session = {
      sessionId: 'session-123',
      label: 'Deploy review',
      summary: 'Waiting on final validation',
      eventCount: 4,
      agents: [],
      activeAgentCount: 0,
      lastEventAt: 400,
      isActive: true,
    } satisfies SessionInfo;

    project.sessions = [session];

    const events = [
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'SessionTitleChanged',
        payload: { title: 'Deploy review' },
        timestamp: 100,
      },
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'Bash',
          tool_input: {
            cmd: 'pnpm build',
            workdir: '/Users/akushniruk/home_projects/pharos/apps/client-solid',
          },
        },
        timestamp: 200,
      },
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'Edit',
          tool_input: {
            file_path: 'apps/client-solid/src/lib/store.ts',
          },
        },
        timestamp: 300,
      },
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'AssistantResponse',
        payload: {
          text: 'Updated the digest strip.',
        },
        timestamp: 400,
      },
    ] satisfies HookEvent[];

    expect(buildRecentChangesSnapshot(project, session, events)).toEqual({
      scopeLabel: 'Deploy review',
      scopeDetail: '4 events in this session',
      headline: 'Recent changes in Deploy review',
      eventCount: 4,
      lastEventAt: 400,
      items: [
        {
          label: 'Updated the digest strip.',
          detail: undefined,
          timestamp: 400,
        },
        {
          label: 'Editing a file',
          detail: 'src/lib/store.ts',
          timestamp: 300,
        },
        {
          label: 'Running a task in client-solid',
          detail: 'pnpm build',
          timestamp: 200,
        },
      ],
    });
  });
});

describe('buildViewedChangesSnapshot', () => {
  it('highlights only changes that landed after the last acknowledgement', () => {
    const project = {
      name: 'pharos',
      runtimeLabels: ['codex'],
      eventCount: 4,
      agentCount: 1,
      activeSessionCount: 1,
      lastEventAt: 400,
      isActive: true,
      sessions: [],
    } satisfies Project;

    const session = {
      sessionId: 'session-123',
      label: 'Deploy review',
      summary: 'Waiting on final validation',
      eventCount: 4,
      agents: [],
      activeAgentCount: 0,
      lastEventAt: 400,
      isActive: true,
    } satisfies SessionInfo;

    project.sessions = [session];

    const events = [
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'Edit',
          tool_input: {
            file_path: 'apps/client-solid/src/lib/store.ts',
          },
        },
        timestamp: 200,
      },
      {
        source_app: 'pharos',
        session_id: 'session-123',
        hook_event_type: 'AssistantResponse',
        payload: {
          text: 'Updated the digest strip.',
        },
        timestamp: 400,
      },
    ] satisfies HookEvent[];

    expect(buildViewedChangesSnapshot(project, session, events, 150)).toEqual({
      scopeKey: 'session:pharos:session-123',
      scopeLabel: 'Deploy review',
      scopeDetail: '4 events in this session',
      headline: 'New changes in Deploy review',
      body: '2 changes landed since your last acknowledgement.',
      lastViewedAt: 150,
      latestEventAt: 400,
      unreadCount: 2,
      hasUnreadChanges: true,
      items: [
        {
          label: 'Updated the digest strip.',
          detail: undefined,
          timestamp: 400,
        },
        {
          label: 'Editing a file',
          detail: 'src/lib/store.ts',
          timestamp: 200,
        },
      ],
    });
  });
});

describe('resolveActivityState', () => {
  it('marks explicit failures as needs attention even if later events exist', () => {
    const now = 20_000;

    expect(resolveActivityState([
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'PostToolUseFailure',
        payload: {
          tool_name: 'exec_command',
          content: 'pnpm build failed',
        },
        timestamp: 10_000,
        agent_id: 'agent-1',
      },
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'PostToolUse',
        payload: {
          tool_name: 'exec_command',
          content: 'pnpm build finished',
        },
        timestamp: 15_000,
        agent_id: 'agent-1',
      },
    ], { isActive: false, now })).toEqual({
      label: 'Needs attention',
      tone: 'attention',
      detail: 'Command failed',
    });
  });

  it('marks explicit waits as blocked even if other progress happened', () => {
    const now = 20_000;

    expect(resolveActivityState([
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'wait_agent',
        },
        timestamp: 9_000,
        agent_id: 'agent-1',
      },
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'AssistantResponse',
        payload: {
          text: 'Still working on it',
        },
        timestamp: 15_000,
        agent_id: 'agent-1',
      },
    ], { isActive: false, now })).toEqual({
      label: 'Blocked',
      tone: 'blocked',
      detail: 'Waiting for a helper agent to finish',
    });
  });

  it('marks stale in-flight work as needs attention after a quiet gap', () => {
    const now = 1_200_000;

    expect(resolveActivityState([
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'exec_command',
          tool_input: {
            command: 'pnpm build',
          },
        },
        timestamp: 300_000,
        agent_id: 'agent-1',
      },
    ], { isActive: false, now })).toEqual({
      label: 'Needs attention',
      tone: 'attention',
      detail: 'No progress for 15m after Running a task',
    });
  });

  it('does not flag editor patch pre-tools as stalled in-flight work', () => {
    const now = 1_200_000;

    expect(
      resolveActivityState(
        [
          {
            source_app: 'pharos',
            session_id: 'session-1',
            hook_event_type: 'PreToolUse',
            payload: {
              tool_name: 'ApplyPatch',
              tool_input: { path: 'README.md' },
            },
            timestamp: 300_000,
            agent_id: undefined,
          },
        ],
        { isActive: false, now },
      ),
    ).toEqual(
      expect.objectContaining({
        label: 'Done',
        tone: 'done',
      }),
    );
  });

  it('does not flag search/read pre-tools (e.g. rg) as stalled in-flight work', () => {
    const now = 1_200_000;

    expect(
      resolveActivityState(
        [
          {
            source_app: 'pharos',
            session_id: 'session-1',
            hook_event_type: 'PreToolUse',
            payload: {
              tool_name: 'rg',
              tool_input: { pattern: 'foo' },
            },
            timestamp: 300_000,
            agent_id: undefined,
          },
        ],
        { isActive: false, now },
      ),
    ).toEqual(
      expect.objectContaining({
        label: 'Done',
        tone: 'done',
      }),
    );
  });
});

describe('resolveConservativeStatusDetail', () => {
  it('uses a soft fallback reason when blocked or attention states lack an explicit detail', () => {
    const events = [
      {
        source_app: 'pharos',
        session_id: 'session-1',
        hook_event_type: 'PreToolUse',
        payload: {
          tool_name: 'Bash',
          tool_input: {
            command: 'pnpm build',
          },
        },
        timestamp: 10_000,
        agent_id: 'agent-1',
      },
    ] satisfies HookEvent[];

    expect(resolveConservativeStatusDetail('blocked', undefined, events)).toBe(
      'Waiting on the last step to finish after Running a task',
    );
    expect(resolveConservativeStatusDetail('attention', undefined, events)).toBe(
      'Stalled after Running a task with no follow-up progress',
    );
  });
});

describe('deriveRuntimeBridgeCandidates', () => {
  const baseAgent = {
    statusLabel: 'Active',
    statusTone: 'active',
    eventCount: 1,
    isActive: true,
  } satisfies Partial<AgentInfo>;

  it('creates runtime bridge candidates for overlapping active runtimes', () => {
    const agents = [
      {
        ...baseAgent,
        agentId: 'claude-1',
        displayName: 'Claude Lead',
        runtimeLabel: 'Claude',
        lastEventAt: 1_000,
      },
      {
        ...baseAgent,
        agentId: 'cursor-1',
        displayName: 'Cursor Helper',
        runtimeLabel: 'Cursor',
        lastEventAt: 1_060,
      },
      {
        ...baseAgent,
        agentId: 'codex-1',
        displayName: 'Codex Reviewer',
        runtimeLabel: 'Codex',
        lastEventAt: 1_090,
      },
    ] satisfies AgentInfo[];

    const events = [
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Claude' },
        timestamp: 1_000,
        agent_id: 'claude-1',
      },
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Cursor' },
        timestamp: 1_060,
        agent_id: 'cursor-1',
      },
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Codex' },
        timestamp: 1_090,
        agent_id: 'codex-1',
      },
    ] satisfies HookEvent[];

    const bridges = deriveRuntimeBridgeCandidates(agents, events, 120);
    expect(bridges.map((bridge) => bridge.key).sort()).toEqual([
      'claude<->codex',
      'claude<->cursor',
      'codex<->cursor',
    ]);
  });

  it('does not create bridges when only one runtime is active', () => {
    const agents = [
      {
        ...baseAgent,
        agentId: 'claude-1',
        displayName: 'Claude Lead',
        runtimeLabel: 'Claude',
        lastEventAt: 1_000,
      },
      {
        ...baseAgent,
        agentId: 'claude-2',
        displayName: 'Claude Worker',
        runtimeLabel: 'Claude',
        lastEventAt: 1_020,
      },
    ] satisfies AgentInfo[];

    const events = [
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Claude' },
        timestamp: 1_000,
        agent_id: 'claude-1',
      },
    ] satisfies HookEvent[];

    expect(deriveRuntimeBridgeCandidates(agents, events, 120)).toEqual([]);
  });

  it('deduplicates runtime pairs and skips non-overlapping windows', () => {
    const agents = [
      {
        ...baseAgent,
        agentId: 'cursor-a',
        displayName: 'Cursor A',
        runtimeLabel: 'Cursor',
        lastEventAt: 5_000,
      },
      {
        ...baseAgent,
        agentId: 'cursor-b',
        displayName: 'Cursor B',
        runtimeLabel: 'Cursor',
        lastEventAt: 4_950,
      },
      {
        ...baseAgent,
        agentId: 'claude-a',
        displayName: 'Claude A',
        runtimeLabel: 'Claude',
        lastEventAt: 4_980,
      },
      {
        ...baseAgent,
        agentId: 'gemini-a',
        displayName: 'Gemini A',
        runtimeLabel: 'Gemini',
        lastEventAt: 3_000,
      },
    ] satisfies AgentInfo[];

    const events = [
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Cursor' },
        timestamp: 5_000,
        agent_id: 'cursor-a',
      },
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Cursor' },
        timestamp: 4_950,
        agent_id: 'cursor-b',
      },
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Claude' },
        timestamp: 4_980,
        agent_id: 'claude-a',
      },
      {
        source_app: 'pharos',
        session_id: 's-1',
        hook_event_type: 'AssistantResponse',
        payload: { runtime_label: 'Gemini' },
        timestamp: 3_000,
        agent_id: 'gemini-a',
      },
    ] satisfies HookEvent[];

    const bridges = deriveRuntimeBridgeCandidates(agents, events, 120);
    expect(bridges).toHaveLength(1);
    expect(bridges[0]?.key).toBe('claude<->cursor');
  });
});
