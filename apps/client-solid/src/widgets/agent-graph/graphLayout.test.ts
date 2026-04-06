import { describe, expect, it } from 'vitest';
import { agentLabel, computeHierarchicalLayout, type GraphNode } from './graphLayout';

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

describe('computeHierarchicalLayout', () => {
  it('stacks a parent → child → grandchild chain vertically', () => {
    const root = node({ graphId: 'ceo', agentId: '1', displayName: 'CEO' });
    const mid = node({
      graphId: 'cto',
      agentId: '2',
      displayName: 'CTO',
      parentGraphId: 'ceo',
    });
    const leaf = node({
      graphId: 'eng',
      agentId: '3',
      displayName: 'Engineer',
      parentGraphId: 'cto',
    });
    const { positions } = computeHierarchicalLayout([root, mid, leaf]);
    expect(positions.get('ceo')!.y).toBeLessThan(positions.get('cto')!.y);
    expect(positions.get('cto')!.y).toBeLessThan(positions.get('eng')!.y);
  });
});
