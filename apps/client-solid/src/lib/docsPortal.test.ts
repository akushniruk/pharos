import { describe, expect, it } from 'vitest';
import { docsPortalEntryTitle } from './docsPortal';

describe('docsPortalEntryTitle', () => {
  it('returns title for known paths', () => {
    expect(docsPortalEntryTitle('docs/README.md')).toBe('Docs overview');
    expect(docsPortalEntryTitle('README.md')).toBe('Repository overview (README)');
  });

  it('returns undefined for unknown paths', () => {
    expect(docsPortalEntryTitle('missing.md')).toBeUndefined();
  });
});
