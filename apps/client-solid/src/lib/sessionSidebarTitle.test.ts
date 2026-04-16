import { describe, expect, it } from 'vitest';

import { compactSessionSuffix, sessionTitleForSidebar } from './sessionSidebarTitle';

describe('sessionTitleForSidebar', () => {
  it('uses the resolved label when it is specific', () => {
    expect(sessionTitleForSidebar('Fix sidebar contrast', 0, 'cursor-abc', 'pharos')).toBe(
      'Fix sidebar contrast',
    );
  });

  it('truncates very long labels', () => {
    const long = 'a'.repeat(80);
    const out = sessionTitleForSidebar(long, 0, 's1', 'pharos');
    expect(out.length).toBeLessThanOrEqual(52);
    expect(out.endsWith('…')).toBe(true);
  });

  it('falls back to Session #n · suffix when label only repeats project name', () => {
    expect(sessionTitleForSidebar('Pharos', 2, 'cursor-deadbeef00', 'pharos')).toMatch(
      /^Session #3 · [a-z0-9]{8}$/i,
    );
  });

  it('uses numbered title when label is generic', () => {
    expect(sessionTitleForSidebar('Session', 0, 'cursor-xyz', 'work')).toContain('Session #1');
  });
});

describe('compactSessionSuffix', () => {
  it('returns last compact segment of a cursor session id', () => {
    expect(compactSessionSuffix('cursor-550e8400-e29b-41d4-a716-446655440000')).toMatch(/^[a-f0-9]{8}$/i);
  });
});
