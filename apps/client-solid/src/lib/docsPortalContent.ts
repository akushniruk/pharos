import rootReadme from '../../../../README.md?raw';
import rootClaude from '../../../../CLAUDE.md?raw';
import rootAgents from '../../../../AGENTS.md?raw';

const docFiles = import.meta.glob('../../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function docContentForPath(path: string): string | undefined {
  if (path === 'README.md') return rootReadme;
  if (path === 'CLAUDE.md') return rootClaude;
  if (path === 'AGENTS.md') return rootAgents;
  return docFiles[`../../../../${path}`];
}
