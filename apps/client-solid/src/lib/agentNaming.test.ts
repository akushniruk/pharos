import { describe, expect, it } from 'vitest';
import type { AgentInfo } from './types';
import {
  agentListInitials,
  mapAgentTypeLabel,
  resolveAgentListPrimaryName,
  resolveAgentListSecondaryLine,
  resolveHybridAgentName,
  responsibilityFromPayload,
} from './agentNaming';

describe('agentNaming', () => {
  it('prefers responsibility over type and display names', () => {
    expect(resolveHybridAgentName({
      responsibility: 'review auth regressions',
      agentType: 'team-reviewer',
      displayName: 'Reviewer',
      agentName: 'Agent',
      fallback: 'Agent',
    })).toBe('review auth regressions');
  });

  it('maps known agent type labels', () => {
    expect(mapAgentTypeLabel('team-reviewer')).toBe('Code Reviewer');
    expect(mapAgentTypeLabel('full-stack-orchestrator')).toBe('Full Stack Orchestrator');
    expect(mapAgentTypeLabel('general-purpose')).toBe('General Purpose');
  });

  it('extracts responsibility from payload variants', () => {
    expect(responsibilityFromPayload({
      tool_input: { description: 'investigate websocket lag' },
    })).toBe('investigate websocket lag');

    expect(responsibilityFromPayload({
      description: '  draft release checklist  ',
    })).toBe('draft release checklist');
  });

  it('picks readable list titles for main vs subagents', () => {
    const base: Omit<AgentInfo, 'agentId' | 'displayName' | 'agentType'> = {
      avatarUrl: undefined,
      runtimeLabel: undefined,
      assignment: undefined,
      assignmentDetail: undefined,
      statusLabel: undefined,
      statusTone: undefined,
      statusDetail: undefined,
      currentProgress: undefined,
      currentProgressDetail: undefined,
      currentAction: undefined,
      currentActionDetail: undefined,
      nextAction: undefined,
      nextActionDetail: undefined,
      modelName: undefined,
      eventCount: 3,
      lastEventAt: 0,
      isActive: true,
      parentId: undefined,
    };

    expect(
      resolveAgentListPrimaryName({
        ...base,
        agentId: null,
        displayName: 'Session',
        agentType: 'main',
        modelName: 'claude-sonnet-4',
      }),
    ).toMatch(/sonnet/i);

    expect(
      resolveAgentListPrimaryName({
        ...base,
        agentId: 'abc-123-def',
        displayName: 'Agent',
        agentType: 'explorer',
      }),
    ).toContain('Explorer');

    expect(agentListInitials('Code Reviewer')).toBe('CR');
    expect(agentListInitials('Main')).toBe('M');
  });

  it('builds secondary line with model and activity', () => {
    const agent: AgentInfo = {
      agentId: 'x',
      displayName: 'Worker',
      agentType: 'general-purpose',
      modelName: 'claude-opus-4',
      assignment: 'Tighten websocket reconnect',
      eventCount: 12,
      lastEventAt: 0,
      isActive: true,
    };
    const line = resolveAgentListSecondaryLine(agent);
    expect(line.toLowerCase()).toContain('websocket');
    expect(line.toLowerCase()).toContain('opus');
  });

  it('formats primary name with runtime and role', () => {
    const base: Omit<AgentInfo, 'agentId' | 'displayName' | 'agentType'> = {
      avatarUrl: undefined,
      runtimeLabel: 'Cursor',
      assignment: undefined,
      assignmentDetail: undefined,
      statusLabel: undefined,
      statusTone: undefined,
      statusDetail: undefined,
      currentProgress: undefined,
      currentProgressDetail: undefined,
      currentAction: undefined,
      currentActionDetail: undefined,
      nextAction: undefined,
      nextActionDetail: undefined,
      modelName: undefined,
      eventCount: 3,
      lastEventAt: 0,
      isActive: true,
      parentId: undefined,
    };

    expect(
      resolveAgentListPrimaryName({
        ...base,
        agentId: 'sub-1',
        displayName: 'Explorer',
        agentType: 'explore',
      }),
    ).toBe('Cursor (Explorer)');

    expect(
      resolveAgentListPrimaryName({
        ...base,
        agentId: 'sub-2',
        displayName: 'Helper',
        agentType: 'code-reviewer',
      }),
    ).toBe('Cursor (Code Reviewer)');

    expect(
      resolveAgentListPrimaryName({
        ...base,
        agentId: null,
        displayName: 'Session',
        agentType: 'ceo',
      }),
    ).toBe('Cursor (CEO)');
  });
});
