import { describe, expect, it } from 'vitest';

import { buildProjectFocusSnapshot } from './store';
import type { AgentInfo, Project, SessionInfo } from './types';

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
      agentId: 'agent-7',
      agentLabel: 'Operator',
      agentSummary: 'Verifying canary metrics',
      scopeLabel: 'Agent focus',
      breadcrumb: 'pharos · Deploy review · Operator',
      headline: 'Verifying canary metrics',
      subheadline: 'Own the release checklist',
      eventCount: 24,
      sessionCount: 1,
      agentCount: 3,
      hasSessionFocus: true,
      hasAgentFocus: true,
    });
  });
});
