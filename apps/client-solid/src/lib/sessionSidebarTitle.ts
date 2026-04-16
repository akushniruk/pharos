import { friendlyProjectName } from './projectDisplayName';

const MAX_SESSION_TITLE_CHARS = 52;

/** Strip markup noise from session titles for display. */
export function friendlySessionLabel(label?: string | null): string {
  if (!label) return 'Session';
  const cleaned = label
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[image\]/gi, ' ')
    .replace(/<image_files>/gi, ' ')
    .replace(/the following images were provided by the user and saved to the workspace/gi, ' ')
    .replace(/<user_query>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Current request';
  if (cleaned.toLowerCase() === 'pending') return 'Current request';
  return cleaned;
}

function isAmbiguousSessionTitle(friendly: string): boolean {
  const t = friendly.trim().toLowerCase();
  return t === 'session' || t === 'current request' || t.length < 2;
}

/** Last few id characters so duplicate-looking sessions stay distinct. */
export function compactSessionSuffix(sessionId?: string | null): string | undefined {
  if (!sessionId?.trim()) return undefined;
  const id = sessionId.trim();
  const stripped = id.replace(/^cursor-/i, '');
  const compact = stripped.replace(/-/g, '');
  if (compact.length >= 8) return compact.slice(-8);
  if (id.length >= 8) return id.slice(-8);
  return id.slice(0, Math.min(8, id.length));
}

/**
 * Primary line for a session in the sidebar (and attention banners).
 * Prefer the first meaningful title/prompt; use numbered fallback only when the label is generic
 * or only repeats the project folder name.
 */
export function sessionTitleForSidebar(
  label: string | undefined | null,
  index: number,
  sessionId?: string | null,
  projectName?: string | null,
): string {
  const friendly = friendlySessionLabel(label);
  const proj = projectName ? friendlyProjectName(projectName).trim().toLowerCase() : '';
  const weak =
    isAmbiguousSessionTitle(friendly)
    || (proj.length > 0 && friendly.trim().toLowerCase() === proj);
  if (weak) {
    const suffix = compactSessionSuffix(sessionId);
    return suffix ? `Session #${index + 1} · ${suffix}` : `Session #${index + 1}`;
  }
  if (friendly.length > MAX_SESSION_TITLE_CHARS) {
    return `${friendly.slice(0, MAX_SESSION_TITLE_CHARS - 1)}…`;
  }
  return friendly;
}
