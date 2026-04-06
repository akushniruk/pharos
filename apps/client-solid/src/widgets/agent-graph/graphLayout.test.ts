import { describe, expect, it } from 'vitest';
import { agentLabel, type GraphNode } from './graphLayout';

function node(partial: Partial<GraphNode> & Pick<GraphNode, 'graphId'>): GraphNode {
  return {
    agentId: null,
    displayName: 'Session',
    eventCount: 0,
    lastEventAt: 0,
    isActive: true,
    ...partial,
  };
}

describe('agentLabel', () => {
  it('uses display name on root when it is specific', () => {
    expect(
      agentLabel(
        node({
          graphId: 'r1',
          displayName: 'Paperclip CTO',
          parentGraphId: undefined,
        }),
      ),
    ).toBe('Paperclip CTO');
  });

  it('prefers runtime over generic Session on root', () => {
    expect(
      agentLabel(
        node({
          graphId: 'r1',
          displayName: 'Session',
          runtimeLabel: 'Cursor',
          modelName: 'gpt-4.1',
          parentGraphId: undefined,
        }),
      ),
    ).toBe('Cursor');
  });

  it('falls back to short model name on root', () => {
    expect(
      agentLabel(
        node({
          graphId: 'r1',
          displayName: 'Session',
          modelName: 'anthropic/claude-3-5-sonnet',
          parentGraphId: undefined,
        }),
      ),
    ).toBe('claude-3-5-sonnet');
  });

  it('uses Main when root has no better signal', () => {
    expect(
      agentLabel(
        node({
          graphId: 'r1',
          displayName: 'Session',
          parentGraphId: undefined,
        }),
      ),
    ).toBe('Main');
  });

  it('still labels child workers without a clean name', () => {
    expect(
      agentLabel(
        node({
          graphId: 'c1',
          agentId: 'a1',
          displayName: 'Session',
          parentGraphId: 'r1',
        }),
      ),
    ).toBe('Worker');
  });
});
