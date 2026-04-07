import { describe, expect, it } from 'vitest';
import {
  normalizeRepoRelativePath,
  resolveMarkdownDocLink,
  PHAROS_REPO_MAIN_BLOB,
} from './docsMarkdownLinks';

const isBundled = (p: string) =>
  new Set([
    'docs/README.md',
    'docs/foo.md',
    'docs/getting-started-desktop.md',
    'README.md',
    'CONTRIBUTING.md',
  ]).has(p);

const asset = (p: string) => `ASSET:${p}`;

describe('normalizeRepoRelativePath', () => {
  it('resolves sibling and parent paths', () => {
    expect(normalizeRepoRelativePath('docs/README.md', 'bar.md')).toBe('docs/bar.md');
    expect(normalizeRepoRelativePath('docs/README.md', '../README.md')).toBe('README.md');
    expect(normalizeRepoRelativePath('docs/nested/x.md', '../y.md')).toBe('docs/y.md');
  });
});

describe('resolveMarkdownDocLink', () => {
  it('treats http(s) as external', () => {
    const r = resolveMarkdownDocLink(
      'https://diataxis.fr/',
      'docs/README.md',
      isBundled,
      asset,
    );
    expect(r).toEqual({ kind: 'external', href: 'https://diataxis.fr/' });
  });

  it('resolves bundled .md to internal', () => {
    const r = resolveMarkdownDocLink(
      'getting-started-desktop.md',
      'docs/README.md',
      isBundled,
      asset,
    );
    expect(r).toEqual({
      kind: 'internal',
      docPath: 'docs/getting-started-desktop.md',
      fragment: undefined,
    });
  });

  it('resolves hash-only link to same doc', () => {
    const r = resolveMarkdownDocLink('#quick-links', 'docs/README.md', isBundled, asset);
    expect(r).toEqual({ kind: 'internal', docPath: 'docs/README.md', fragment: 'quick-links' });
  });

  it('sends missing bundled .md to GitHub', () => {
    const r = resolveMarkdownDocLink(
      '../CHANGELOG.md',
      'docs/releases.md',
      isBundled,
      asset,
    );
    expect(r).toEqual({
      kind: 'external',
      href: `${PHAROS_REPO_MAIN_BLOB}/CHANGELOG.md`,
    });
  });

  it('maps docs-supported paths to site-root assets', () => {
    const r = resolveMarkdownDocLink('docs-supported/x.svg', 'docs/README.md', isBundled, asset);
    expect(r).toEqual({ kind: 'asset', href: 'ASSET:docs-supported/x.svg' });
  });
});
