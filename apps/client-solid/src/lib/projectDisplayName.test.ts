import { describe, expect, it } from 'vitest';

import { friendlyProjectName } from './projectDisplayName';

describe('friendlyProjectName', () => {
  it('maps common Pharos workspace buckets', () => {
    expect(friendlyProjectName('integrations')).toBe('Integrations');
    expect(friendlyProjectName('projects')).toBe('Projects');
    expect(friendlyProjectName('brain')).toBe('Brain');
    expect(friendlyProjectName('pharos')).toBe('Pharos');
  });

  it('title-cases opaque short slugs', () => {
    expect(friendlyProjectName('var')).toBe('Var');
    expect(friendlyProjectName('afouren')).toBe('Afouren');
  });

  it('formats hyphenated repo slugs', () => {
    expect(friendlyProjectName('my-cool-app')).toBe('My Cool App');
  });

  it('abbreviates long hex-like workspace ids', () => {
    expect(friendlyProjectName('abcdef0123456789abcdef012345')).toMatch(/^Workspace abcdef01/);
  });
});
