import { BUNDLED_DOC_PATHS } from '../../lib/docsPortalContent';
import { DOCS_PORTAL_SECTIONS } from '../../lib/docsPortal';

export function slugifyHeading(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return normalized || 'section';
}

const slugCounts = new Map<string, number>();
const allEntries = DOCS_PORTAL_SECTIONS.flatMap((section) => section.entries);

export const DOC_ROUTE_SLUG_TO_PATH = new Map<string, string>();
export const DOC_ROUTE_PATH_TO_SLUG = new Map<string, string>();

for (const entry of allEntries) {
  const base = slugifyHeading(entry.title) || slugifyHeading(entry.path) || 'doc';
  const seen = slugCounts.get(base) ?? 0;
  const slug = seen === 0 ? base : `${base}-${seen + 1}`;
  slugCounts.set(base, seen + 1);
  DOC_ROUTE_SLUG_TO_PATH.set(slug, entry.path);
  DOC_ROUTE_PATH_TO_SLUG.set(entry.path, slug);
}

function uniqueSlugForBundledPath(docPath: string): string {
  const base =
    slugifyHeading(docPath.replace(/\.md$/i, '').replace(/\//g, ' ').replace(/-/g, ' ')) ||
    'doc';
  let slug = base;
  let suffix = 1;
  while (
    DOC_ROUTE_SLUG_TO_PATH.has(slug)
    && DOC_ROUTE_SLUG_TO_PATH.get(slug) !== docPath
  ) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

for (const docPath of BUNDLED_DOC_PATHS) {
  if (DOC_ROUTE_PATH_TO_SLUG.has(docPath)) continue;
  const slug = uniqueSlugForBundledPath(docPath);
  DOC_ROUTE_SLUG_TO_PATH.set(slug, docPath);
  DOC_ROUTE_PATH_TO_SLUG.set(docPath, slug);
}

/** Every navigable `/docs/:slug` (insertion order matches portal nav). For Playwright + parity tooling. */
export const ALL_DOC_ROUTE_SLUGS: readonly string[] = Object.freeze([
  ...DOC_ROUTE_SLUG_TO_PATH.keys(),
]);

export function docsSlugForPath(path: string): string {
  return DOC_ROUTE_PATH_TO_SLUG.get(path) ?? slugifyHeading(path.replace(/\.md$/i, ''));
}

/** Absolute in-app URL for a docs route slug (respects Vite `base`, e.g. Tauri `./`). */
export function docsRouteUrlForSlug(slug: string, fragment?: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const h = fragment ? `#${fragment}` : '';
  return `${prefix}/docs/${encodeURIComponent(slug)}${h}`;
}

export function docsPathForSlug(slug: string): string | undefined {
  return DOC_ROUTE_SLUG_TO_PATH.get(slug);
}

export function firstDocsPath(): string {
  return DOCS_PORTAL_SECTIONS[0]?.entries[0]?.path ?? 'docs/README.md';
}
