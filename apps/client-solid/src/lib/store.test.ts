import { describe, expect, it } from 'vitest';

import { buildProjectFocusSnapshot, buildRecentChangesSnapshot, resolveActivityState } from './store';
import type { AgentInfo, HookEvent, Project, SessionInfo } from './types';

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
      breadcrumb: 'pharos · Deploy review · Operator',
      headline: 'Operator is verifying canary metrics',
      subheadline: 'Next action: Own the release checklist',
      eventCount: 24,
      sessionCount: 1,
      agentCount: 3,
      hasSessionFocus: true,
      hasAgentFocus: true,
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
          label: 'Shared an update',
          detail: 'Updated the digest strip.',
          timestamp: 400,
        },
        {
          label: 'Editing a file',
          detail: 'src/lib/store.ts',
          timestamp: 300,
        },
        {
          label: 'Running a command in client-solid',
          detail: 'pnpm build',
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
      detail: 'No progress for 15m after Running a command',
    });
  });
});
