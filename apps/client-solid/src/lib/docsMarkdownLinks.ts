/** Repo-relative URL for markdown files that exist in Git but are not shipped in the app bundle. */
export const PHAROS_REPO_MAIN_BLOB =
  'https://github.com/akushniruk/pharos/blob/main' as const;

export type ResolvedMarkdownLink =
  | { kind: 'internal'; docPath: string; fragment?: string }
  | { kind: 'external'; href: string }
  | { kind: 'asset'; href: string };

/** Collapse `.` / `..` segments for repo-relative paths (POSIX-style). */
export function normalizeRepoRelativePath(sourcePath: string, rawLinkPath: string): string {
  const cleaned = rawLinkPath.replace(/^\.\//, '');
  const sourceDir = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : '';
  const segments = [...(sourceDir ? sourceDir.split('/') : []), ...cleaned.split('/')];
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function splitPathAndFragment(href: string): { pathPart: string; fragment?: string } {
  const hash = href.indexOf('#');
  if (hash < 0) return { pathPart: href };
  return {
    pathPart: href.slice(0, hash),
    fragment: href.slice(hash + 1) || undefined,
  };
}

/**
 * True when the author meant a path under `public/` (e.g. `docs-supported/…`) from a doc under `docs/`.
 * Without this, `docs/README.md` + `docs-supported/x.svg` would become `docs/docs-supported/x.svg`.
 */
function isPublicRootShortPath(linkPath: string): boolean {
  const p = linkPath.replace(/^\.\//, '').replace(/^\//, '');
  return p.startsWith('docs-supported/');
}

export function resolveMarkdownDocLink(
  href: string,
  sourcePath: string,
  isBundled: (repoRelativeMdPath: string) => boolean,
  resolveAssetHref: (repoRelativePath: string) => string,
): ResolvedMarkdownLink {
  const trimmed = href.trim();
  const { pathPart, fragment } = splitPathAndFragment(trimmed);

  if (pathPart && /^https?:\/\//i.test(pathPart)) {
    return { kind: 'external', href: trimmed };
  }
  if (pathPart && /^mailto:/i.test(pathPart)) {
    return { kind: 'external', href: trimmed };
  }

  if ((!pathPart || pathPart === '') && fragment) {
    return { kind: 'internal', docPath: sourcePath, fragment };
  }

  if (!pathPart) {
    return { kind: 'external', href: trimmed };
  }

  if (pathPart.startsWith('//')) {
    return { kind: 'external', href: trimmed };
  }

  if (isPublicRootShortPath(pathPart)) {
    const p = pathPart.replace(/^\.\//, '').replace(/^\//, '');
    return { kind: 'asset', href: resolveAssetHref(p) };
  }

  const resolved = normalizeRepoRelativePath(sourcePath, pathPart);

  if (resolved.endsWith('.md')) {
    if (isBundled(resolved)) {
      return { kind: 'internal', docPath: resolved, fragment };
    }
    return { kind: 'external', href: `${PHAROS_REPO_MAIN_BLOB}/${resolved}${fragment ? `#${fragment}` : ''}` };
  }

  return { kind: 'asset', href: resolveAssetHref(resolved) };
}
