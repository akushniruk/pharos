import { describe, expect, it } from 'vitest';
import { docsPortalEntryTitle } from './docsPortal';

describe('docsPortalEntryTitle', () => {
  it('returns title for known paths', () => {
    expect(docsPortalEntryTitle('docs/README.md')).toBe('Docs Portal Index');
    expect(docsPortalEntryTitle('README.md')).toBe('Repository Overview');
  });

  it('returns undefined for unknown paths', () => {
    expect(docsPortalEntryTitle('missing.md')).toBeUndefined();
  });
});
