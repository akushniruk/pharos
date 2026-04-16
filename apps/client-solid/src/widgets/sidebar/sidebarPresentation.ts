import {
  bolt,
  clock,
  exclamationCircle,
  exclamationTriangle,
} from 'solid-heroicons/solid';

import type { Project } from '../../lib/types';
import { friendlyProjectName } from '../../lib/projectDisplayName';
import { sidebarSessionActivityTone } from '../../lib/store';

export type SidebarActivityTone = 'active' | 'blocked' | 'attention' | 'idle' | 'done';

export function statusPalette(tone: SidebarActivityTone) {
  switch (tone) {
    case 'active':
      return { background: 'var(--green-dim)', text: 'var(--green)', dot: 'var(--green)' };
    case 'blocked':
      return { background: 'rgba(245, 158, 11, 0.16)', text: 'var(--yellow)', dot: 'var(--yellow)' };
    case 'attention':
      return { background: 'rgba(239, 68, 68, 0.16)', text: 'var(--red)', dot: 'var(--red)' };
    case 'idle':
      return { background: 'var(--bg-card)', text: 'var(--text-secondary)', dot: 'var(--text-secondary)' };
    case 'done':
    default:
      return { background: 'var(--bg-card)', text: 'var(--text-secondary)', dot: 'var(--text-secondary)' };
  }
}

export function statusToneIcon(tone: SidebarActivityTone) {
  switch (tone) {
    case 'active':
      return bolt;
    case 'attention':
      return exclamationTriangle;
    case 'blocked':
      return exclamationCircle;
    default:
      return clock;
  }
}

export function resolveProjectTone(project: Project): SidebarActivityTone {
  const tones = project.sessions.map((session) => sidebarSessionActivityTone(project.name, session));
  if (tones.includes('attention')) return 'attention';
  if (tones.includes('blocked')) return 'blocked';
  if (tones.includes('active')) return 'active';
  if (tones.includes('idle')) return 'idle';
  return 'done';
}

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

export function sessionTitleForSidebar(_label: string | undefined | null, index: number): string {
  return `Session #${index + 1}`;
}

export function displayedProjectSessions(
  projectName: string,
  sessions: Array<{
    sessionId: string;
    statusTone?: SidebarActivityTone;
    isActive: boolean;
    eventCount: number;
    lastEventAt: number;
    activeAgentCount: number;
  }>,
): Array<{ sessionId: string; tone: SidebarActivityTone }> {
  const withBaseTone = sessions.map((session) => ({
    sessionId: session.sessionId,
    tone: sidebarSessionActivityTone(projectName, session),
    lastEventAt: session.lastEventAt,
  }));
  const activeCandidates = withBaseTone
    .filter((entry) => entry.tone === 'active')
    .sort((left, right) => right.lastEventAt - left.lastEventAt);
  const primaryActiveId = activeCandidates[0]?.sessionId;
  return withBaseTone.map((entry) => ({
    sessionId: entry.sessionId,
    tone: entry.tone === 'active' && entry.sessionId !== primaryActiveId ? 'idle' : entry.tone,
  }));
}

export function friendlySummary(text?: string | null): string {
  if (!text) return 'Working on your request';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/^Responded:\s*/i, 'Updated: ')
    .replace(/^Prompted:\s*/i, '')
    .replace(/^local-command-stdout\s*/i, '')
    .replace(/^Using a tool$/i, 'Working on your request')
    .replace(/\s+/g, ' ')
    .trim();
}

export function friendlyProjectSummary(text?: string | null): string | undefined {
  if (!text) return undefined;
  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/^Responded:\s*/i, '')
    .replace(/^Prompted:\s*/i, '')
    .replace(/^Updated:\s*/i, '')
    .replace(/^local-command-stdout\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

const DEFAULT_PROJECT_LOGO_STORAGE_KEY = 'pharos.default-project-logo';

export function projectInitials(name: string): string {
  const initials = name
    .trim()
    .split('')
    .filter((char) => /[a-z0-9]/i.test(char))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || 'P';
}

function escapeSvgTextNode(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function projectFallbackIconDataUri(projectName: string): string {
  const initials = projectInitials(projectName);
  const escapedInitials = escapeSvgTextNode(initials);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='10' font-weight='700' fill='#94A3B8'>${escapedInitials}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Two-letter badge for agent rows; avoids lone surrogate pairs from emoji-heavy names. */
function agentDisplayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const pickLetter = (word: string): string => {
    for (const ch of word) {
      if (/\p{L}|\p{N}/u.test(ch)) return ch.toUpperCase();
    }
    return '';
  };
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    let out = '';
    for (const ch of parts[0]) {
      if (/\p{L}|\p{N}/u.test(ch)) {
        out += ch.toUpperCase();
        if (out.length >= 2) break;
      }
    }
    return out || '?';
  }
  const a = pickLetter(parts[0]);
  const b = pickLetter(parts[1]);
  const pair = `${a}${b}`.slice(0, 2);
  return pair || '?';
}

export function agentAvatarDataUri(name: string): string {
  const initials = escapeSvgTextNode(agentDisplayInitials(name));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
<rect x='0' y='0' width='24' height='24' rx='12' fill='#1E293B'/>
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='13' font-weight='700' fill='white'>${initials}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Only http(s) and data: — root-relative URLs break in Tauri / file-based loads. */
function normalizeLogoUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return undefined;
}

export function resolveProjectLogo(project: Project): string {
  const custom = typeof localStorage === 'undefined'
    ? undefined
    : normalizeLogoUrl(localStorage.getItem(DEFAULT_PROJECT_LOGO_STORAGE_KEY));
  return custom || projectFallbackIconDataUri(friendlyProjectName(project.name));
}
