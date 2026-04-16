/** Human-readable labels for `source_app` / workspace slugs (still use raw slug for selection + API). */

const WELL_KNOWN_SLUGS: Record<string, string> = {
  integrations: 'Integrations',
  projects: 'Projects',
  brain: 'Brain',
  default: 'Default',
  pharos: 'Pharos',
  unknown: 'Unknown',
};

function isHexWorkspaceSlug(raw: string): boolean {
  return /^[0-9a-f]{12,}$/i.test(raw) && raw.length >= 12 && !/[g-z]/i.test(raw);
}

export function friendlyProjectName(slug: string): string {
  const raw = slug.trim();
  if (!raw) return 'Unknown';

  const lower = raw.toLowerCase();
  if (WELL_KNOWN_SLUGS[lower]) return WELL_KNOWN_SLUGS[lower];

  if (isHexWorkspaceSlug(raw)) {
    return `Workspace ${raw.slice(0, 8)}…`;
  }

  if (raw.includes('-') || raw.includes('_')) {
    return raw
      .split(/[-_]+/g)
      .filter(Boolean)
      .map((segment) => {
        const segLower = segment.toLowerCase();
        if (WELL_KNOWN_SLUGS[segLower]) return WELL_KNOWN_SLUGS[segLower];
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
