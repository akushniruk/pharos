// Paths are relative to this file: apps/landing-svelte/src/lib/docs/ → five `../` to repo root.
const docsGlob = import.meta.glob('../../../../../docs/**/*.md', {
  query: '?raw',
  eager: true,
}) as Record<string, { default: string }>;

const rootFiles: Record<string, { default: string }> = {
  README: import.meta.glob('../../../../../README.md', { query: '?raw', eager: true }) as any,
  CONTRIBUTING: import.meta.glob('../../../../../CONTRIBUTING.md', {
    query: '?raw',
    eager: true,
  }) as any,
  CLAUDE: import.meta.glob('../../../../../CLAUDE.md', { query: '?raw', eager: true }) as any,
  AGENTS: import.meta.glob('../../../../../AGENTS.md', { query: '?raw', eager: true }) as any,
};

function extractDefault(mod: Record<string, { default: string }>): string | undefined {
  const first = Object.values(mod)[0];
  return first?.default;
}

const contentMap = new Map<string, string>();

for (const [rawPath, mod] of Object.entries(docsGlob)) {
  const repoPath = rawPath.replace(/^.*?\/docs\//, 'docs/');
  contentMap.set(repoPath, mod.default);
}

const rootMappings: [string, string][] = [
  ['README.md', 'README'],
  ['CONTRIBUTING.md', 'CONTRIBUTING'],
  ['CLAUDE.md', 'CLAUDE'],
  ['AGENTS.md', 'AGENTS'],
];

for (const [path, key] of rootMappings) {
  const content = extractDefault(rootFiles[key] as any);
  if (content) contentMap.set(path, content);
}

export function docContentForPath(path: string): string | undefined {
  return contentMap.get(path);
}

export function allDocPaths(): string[] {
  return [...contentMap.keys()];
}
