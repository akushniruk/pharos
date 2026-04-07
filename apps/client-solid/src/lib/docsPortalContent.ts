import rootReadme from '../../../../README.md?raw';
import rootClaude from '../../../../CLAUDE.md?raw';
import rootAgents from '../../../../AGENTS.md?raw';
import rootContributing from '../../../../CONTRIBUTING.md?raw';

const docFiles = import.meta.glob('../../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Repo-relative paths with markdown bundled for the in-app reader (portal + extra `docs/**` files). */
export const BUNDLED_DOC_PATHS: readonly string[] = Object.freeze([
  'README.md',
  'CLAUDE.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  ...Object.keys(docFiles).map((key) => key.replace(/^\.\.\/\.\.\/\.\.\/\.\.\//, '')),
]);

export function docContentForPath(path: string): string | undefined {
  if (path === 'README.md') return rootReadme;
  if (path === 'CLAUDE.md') return rootClaude;
  if (path === 'AGENTS.md') return rootAgents;
  if (path === 'CONTRIBUTING.md') return rootContributing;
  return docFiles[`../../../../${path}`];
}
