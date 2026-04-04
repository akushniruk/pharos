import { describe, expect, it } from 'vitest';
import { mapAgentTypeLabel, resolveHybridAgentName, responsibilityFromPayload } from './agentNaming';

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
});
