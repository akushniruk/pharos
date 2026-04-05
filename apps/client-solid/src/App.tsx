import { Show, For, onMount, onCleanup, createSignal, createMemo, createEffect, type JSX } from 'solid-js';
import {
  selectedProject,
  selectedViewedChangesSnapshot,
  selectedAgent,
  projects,
  selectProject,
  selectAgent,
  filteredEvents,
} from './lib/store';
import { connectWs, connectionState, hasStreamData } from './lib/ws';
import { initTheme } from './lib/theme';
import { timeAgo } from './lib/time';
import { DOCS_PORTAL_SECTIONS } from './lib/docsPortal';
import rootReadme from '../../../README.md?raw';
import rootClaude from '../../../CLAUDE.md?raw';
import rootAgents from '../../../AGENTS.md?raw';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EventStream from './components/EventStream';
import AgentGraph from './components/AgentGraph';
import AgentDetail from './components/AgentDetail';
import ViewModeTabs from './components/ViewModeTabs';
import type { Project } from './lib/types';

type ViewMode = 'logs' | 'graph';
type AppRoute = 'main' | 'docs';
const VIEW_MODE_STORAGE_KEY = 'pharos.view-mode';
const DOC_ROUTE_SLUG_TO_PATH = new Map<string, string>();
const DOC_ROUTE_PATH_TO_SLUG = new Map<string, string>();
{
  const slugCounts = new Map<string, number>();
  const allEntries = DOCS_PORTAL_SECTIONS.flatMap((section) => section.entries);
  for (const entry of allEntries) {
    const base = slugifyHeading(entry.title) || slugifyHeading(entry.path) || 'doc';
    const seen = slugCounts.get(base) ?? 0;
    const slug = seen === 0 ? base : `${base}-${seen + 1}`;
    slugCounts.set(base, seen + 1);
    DOC_ROUTE_SLUG_TO_PATH.set(slug, entry.path);
    DOC_ROUTE_PATH_TO_SLUG.set(entry.path, slug);
  }
}

function docsSlugForPath(path: string): string {
  return DOC_ROUTE_PATH_TO_SLUG.get(path) ?? slugifyHeading(path.replace(/\.md$/i, ''));
}

function docsPathForSlug(slug: string): string | undefined {
  return DOC_ROUTE_SLUG_TO_PATH.get(slug);
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>('logs');
  const [route, setRoute] = createSignal<AppRoute>('main');
  const [docsQuery, setDocsQuery] = createSignal('');
  const [selectedDocPath, setSelectedDocPath] = createSignal(firstDocsPath());
  const [copiedValue, setCopiedValue] = createSignal<string | null>(null);

  const docsPortalSections = createMemo(() => {
    const query = docsQuery().trim().toLowerCase();
    if (!query) return DOCS_PORTAL_SECTIONS;
    return DOCS_PORTAL_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => {
        const haystack = `${entry.title} ${entry.path} ${entry.summary}`.toLowerCase();
        return haystack.includes(query);
      }),
    })).filter((section) => section.entries.length > 0);
  });
  const docsEntryCount = createMemo(() =>
    docsPortalSections().reduce((count, section) => count + section.entries.length, 0),
  );
  const selectedDocContent = createMemo(() => docContentForPath(selectedDocPath()));
  const navigateToPath = (path: string) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
  };

  const syncRouteFromLocation = () => {
    if (typeof window === 'undefined') {
      setRoute('main');
      return;
    }
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const docsByPath = path === '/docs' || path.startsWith('/docs/');
    const docsByHash = hash.startsWith('#/docs');
    const isDocs = docsByPath || docsByHash;
    setRoute(isDocs ? 'docs' : 'main');
    if (!isDocs) return;

    const pathParts = window.location.pathname.replace(/^\/+/, '').split('/');
    const hashParts = window.location.hash.replace(/^#\/?/, '').split('/');
    const slugFromPath = pathParts[0] === 'docs' ? decodeURIComponent(pathParts[1] ?? '') : '';
    const slugFromHash = hashParts[0] === 'docs' ? decodeURIComponent(hashParts[1] ?? '') : '';
    const slug = slugFromPath || slugFromHash;
    if (!slug) return;
    const resolved = docsPathForSlug(slug);
    if (resolved && resolved !== selectedDocPath()) {
      setSelectedDocPath(resolved);
    }
  };

  const navigateHome = () => {
    navigateToPath('/');
    setRoute('main');
    selectProject(null);
  };

  const navigateDocs = () => {
    const slug = docsSlugForPath(selectedDocPath());
    navigateToPath(`/docs/${encodeURIComponent(slug)}`);
    setRoute('docs');
  };

  const selectDocsDocument = (path: string) => {
    setSelectedDocPath(path);
    const slug = docsSlugForPath(path);
    navigateToPath(`/docs/${encodeURIComponent(slug)}`);
    setRoute('docs');
  };

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (savedViewMode === 'logs' || savedViewMode === 'graph') {
        setViewMode(savedViewMode);
      }
    }
    connectWs();
    initTheme();
    syncRouteFromLocation();
    const onHashChange = () => syncRouteFromLocation();
    const onPopState = () => syncRouteFromLocation();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    onCleanup(() => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    });
  });

  createEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode());
  });

  createEffect(() => {
    const current = selectedDocPath();
    const existsInFilter = docsPortalSections().some((section) =>
      section.entries.some((entry) => entry.path === current),
    );
    if (!existsInFilter) {
      const first = docsPortalSections()[0]?.entries[0]?.path;
      if (first) setSelectedDocPath(first);
    }
  });

  const copyToClipboard = async (value: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 1500);
    } catch {
      // No-op if clipboard write fails in current environment.
    }
  };

  return (
    <div class="app">
      {/* Zone 1: Header */}
      <Header
        isDocsRoute={route() === 'docs'}
        onNavigateHome={navigateHome}
        onNavigateDocs={navigateDocs}
      />

      {/* Zone 2 + 3 + 4 */}
      <div class="app-body">
        {/* Zone 2: Sidebar (explicit route states) */}
        <Show
          when={route() === 'docs'}
          fallback={
            <Sidebar
              collapsed={sidebarCollapsed()}
              onToggle={() => setSidebarCollapsed(c => !c)}
            />
          }
        >
          <Sidebar
            collapsed={sidebarCollapsed()}
            isDocsRoute
            docsQuery={docsQuery()}
            onDocsQueryChange={setDocsQuery}
            docsEntryCount={docsEntryCount()}
            docsSections={docsPortalSections()}
            selectedDocPath={selectedDocPath()}
            onSelectDoc={selectDocsDocument}
            copiedValue={copiedValue()}
            onCopy={(value) => void copyToClipboard(value)}
            onToggle={() => setSidebarCollapsed(c => !c)}
          />
        </Show>

        {/* Zone 3 + 4: Main content */}
        <div class="app-main">
          <Show
            when={route() === 'docs'}
            fallback={
              <Show when={selectedProject()} fallback={<ProjectsHome />}>
                {/* Content area */}
                <Show
                  when={viewMode() === 'logs'}
                  fallback={
                    <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
                      <div style="display:flex;align-items:center;justify-content:flex-start;min-height:40px;padding:6px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
                        <ViewModeTabs viewMode={viewMode()} onChange={setViewMode} />
                      </div>
                      <div style="display:flex;flex:1;overflow:hidden;">
                        <AgentGraph />
                        <Show when={selectedAgent() && viewMode() === 'graph'}>
                          <div style="width:300px;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;">
                            <AgentDetail />
                          </div>
                        </Show>
                      </div>
                    </div>
                  }
                >
                  <EventStream
                    viewMode={viewMode()}
                    onViewModeChange={setViewMode}
                  />
                </Show>
              </Show>
            }
          >
            <div class="docs-route-main">
              <ReadingGuide
                selectedDocContent={selectedDocContent()}
              />
            </div>
          </Show>
        </div>
      </div>

      {/* Status bar */}
      <div class="app-statusbar">
        <div style="display:flex;align-items:center;gap:6px">
          <span
            style={[
              'width:6px;height:6px;border-radius:50%;display:inline-block;',
              connectionState() === 'connected'
                ? 'background:var(--green);'
                : connectionState() === 'connecting'
                  ? 'background:var(--yellow);animation:blink 1.5s ease-in-out infinite;'
                  : 'background:var(--red);animation:blink 1.5s ease-in-out infinite;',
            ].join('')}
          />
          <span>{streamStatusLabel()}</span>
        </div>
        <span>
          {filteredEvents().length} events
          {selectedProject() ? ` · ${selectedProject()}` : ''}
          {selectedViewedChangesSnapshot()?.hasUnreadChanges
            ? ` · ${selectedViewedChangesSnapshot()?.unreadCount} new`
            : ''}
        </span>
      </div>
    </div>
  );
}


/** Deduplicate useful agent badges by displayName, keeping the most active */
function uniqueAgentBadges(p: Project): { name: string; isActive: boolean }[] {
  const seen = new Map<string, { isActive: boolean }>();
  for (const s of p.sessions) {
    for (const a of s.agents) {
      const cleanedName = a.displayName?.trim();
      if (!cleanedName) continue;
      const lower = cleanedName.toLowerCase();
      if (lower === 'unknown' || lower === 'agent' || lower === 'session') continue;
      const existing = seen.get(cleanedName);
      if (existing === undefined || a.isActive) {
        seen.set(cleanedName, { isActive: a.isActive });
      }
    }
  }
  return Array.from(seen, ([name, details]) => ({
    name,
    isActive: details.isActive,
  })).slice(0, 4);
}

function sanitizeDashboardText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[image\]/gi, 'image')
    .replace(/<image_files>/gi, '')
    .replace(/the following images were provided by the user.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function projectCardHeadline(p: Project): string {
  const summary = sanitizeDashboardText(p.summary);
  if (summary) {
    const concise = summary
      .replace(/^(responded|prompted|updated)\s*:\s*/i, '')
      .replace(/^local-command-stdout\s*/i, '')
      .trim();
    return concise.length > 92 ? `${concise.slice(0, 91)}…` : concise;
  }
  if (p.isActive) {
    return `${p.activeSessionCount} active session${p.activeSessionCount === 1 ? '' : 's'}`;
  }
  return 'No live activity right now';
}

function projectCardSubline(p: Project): string {
  const runtime = p.runtimeLabels.length > 0 ? p.runtimeLabels.join(', ') : 'Unknown runtime';
  const last = p.lastEventAt > 0 ? `Updated ${timeAgo(p.lastEventAt)}` : 'No events yet';
  return `${runtime} · ${last}`;
}

function projectStatusLabel(p: Project): string {
  if (p.isActive) return 'Active';
  if (p.eventCount > 0) return 'Idle';
  return 'New';
}

function projectInitials(name: string): string {
  const initials = name
    .trim()
    .split('')
    .filter((char) => /[a-z0-9]/i.test(char))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || 'P';
}

function projectFallbackIconDataUri(projectName: string): string {
  const initials = projectInitials(projectName);
  const escapedInitials = initials
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
<text x='16' y='16' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='11' font-weight='700' fill='#94A3B8'>${escapedInitials}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveProjectLogo(project: Project): string {
  return projectFallbackIconDataUri(project.name);
}

function agentInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function agentAvatarDataUri(name: string): string {
  const initials = agentInitials(name);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
<rect x='0' y='0' width='24' height='24' rx='12' fill='#1E293B'/>
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='9' font-weight='700' fill='white'>${initials}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Inline home view — shown when no project selected */
function ProjectsHome() {
  const [projectQuery, setProjectQuery] = createSignal('');
  const projectList = createMemo(() => projects());
  const orderedProjects = createMemo(() =>
    [...projectList()].sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      return right.lastEventAt - left.lastEventAt;
    }),
  );
  const filteredProjectList = createMemo(() => {
    const query = projectQuery().trim().toLowerCase();
    if (!query) return orderedProjects();
    return orderedProjects().filter((project) => {
      const fields = [
        project.name,
        project.summary || '',
        project.runtimeLabels.join(' '),
      ].join(' ').toLowerCase();
      return fields.includes(query);
    });
  });
  const activeCount = createMemo(() => projectList().filter((project) => project.isActive).length);
  const totalEvents = createMemo(() =>
    projectList().reduce((accumulator, project) => accumulator + project.eventCount, 0),
  );
  const totalAgents = createMemo(() =>
    projectList().reduce((accumulator, project) => accumulator + project.agentCount, 0),
  );
  const streamStateText = createMemo(() => {
    if (connectionState() === 'connecting') {
      return hasStreamData() ? 'Reconnecting to live data' : 'Loading live data';
    }

    if (connectionState() === 'connected') {
      return hasStreamData() ? 'Live data connected' : 'Connected, waiting for the first payload';
    }

    return hasStreamData()
      ? 'Disconnected, showing the last captured data'
      : 'Disconnected before any data arrived';
  });

  const streamStateDetail = createMemo(() => {
    if (projectList().length > 0) {
      return 'Pick a project to inspect its sessions, agents, and events.';
    }

    if (connectionState() === 'connected' || connectionState() === 'connecting') {
      return 'Waiting for the daemon to publish a project snapshot.';
    }

    return 'Start the daemon, or reconnect it, to populate this workspace.';
  });

  return (
    <div style="padding:24px 28px;max-width:1400px;margin:0 auto;overflow-y:auto;flex:1;width:100%;">
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:baseline;gap:12px;">
            <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.03em">Overview</h1>
            <span style="font-size:13px;color:var(--text-tertiary)">{projectList().length} projects</span>
          </div>
          <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">
            {streamStateText()}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <input
              type="text"
              value={projectQuery()}
              onInput={(event) => setProjectQuery(event.currentTarget.value)}
              placeholder="Search projects..."
              style="width:100%;height:34px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);padding:0 12px;font-size:12px;"
            />
          </div>
        </div>
      </div>

      <Show when={projectList().length === 0}>
        <div style="display:flex;flex-direction:column;align-items:center;padding:80px 20px;text-align:center;border:1px dashed var(--border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent);">
          <p style="font-size:16px;color:var(--text-secondary);margin-bottom:4px">No projects have been captured yet.</p>
          <p style="font-size:13px;color:var(--text-dim)">Open a session and wait for the first snapshot to land here.</p>
        </div>
      </Show>

      <div style="display:flex;align-items:center;gap:12px;margin:0 0 10px 0;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--text-secondary);">
          {activeCount()} active projects
        </span>
        <span style="font-size:11px;color:var(--text-secondary);">
          {totalAgents()} agents
        </span>
        <span style="font-size:11px;color:var(--text-secondary);">
          {totalEvents()} events
        </span>
        <span style="font-size:11px;color:var(--text-dim);">
          {streamStateDetail()}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
        <p style="font-size:12px;font-weight:600;color:var(--text-primary);">Projects</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;align-items:stretch;">
          <For each={filteredProjectList()}>
            {(p) => (
              <div
                style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;transition:border-color 0.15s;min-height:188px;display:flex;flex-direction:column;gap:8px;"
                onMouseOver={(el) => el.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseOut={(el) => el.currentTarget.style.borderColor = 'var(--border)'}
                onClick={() => selectProject(p.name)}
              >
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <div
                      style={[
                        'width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;',
                      ].join('')}
                    >
                      <img
                        src={resolveProjectLogo(p)}
                        alt=""
                        style="width:32px;height:32px;object-fit:cover;"
                      />
                    </div>
                    <div style="min-width:0;display:flex;flex-direction:column;gap:2px;">
                      <span style="font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{p.name}</span>
                      <span style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">
                        Project
                      </span>
                    </div>
                  </div>
                  <span style={`font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:${p.isActive ? 'var(--green-dim)' : 'var(--bg-elevated)'};color:${p.isActive ? 'var(--green)' : 'var(--text-secondary)'};font-weight:600;flex-shrink:0;`}>
                    {projectStatusLabel(p)}
                  </span>
                </div>

                <div style="display:flex;gap:14px;">
                  <div style="font-size:11px;color:var(--text-secondary);">{p.sessions.length} sessions</div>
                  <div style="font-size:11px;color:var(--text-secondary);">{p.agentCount} agents</div>
                  <div style="font-size:11px;color:var(--text-secondary);">{p.eventCount} events</div>
                </div>

                <div style="font-size:12px;color:var(--text-primary);line-height:1.5;min-height:36px;">
                  {projectCardHeadline(p)}
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;">
                  <div style="font-size:11px;color:var(--text-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    {projectCardSubline(p)}
                  </div>
                  <Show when={uniqueAgentBadges(p).length > 0}>
                    <div style="display:flex;align-items:center;margin-right:4px;">
                      <For each={uniqueAgentBadges(p).slice(0, 4)}>
                        {(badge, index) => (
                          <div
                            title={badge.name}
                            style={[
                              'width:20px;height:20px;border-radius:9999px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--text-primary);',
                              'background:var(--bg-elevated);',
                              `margin-left:${index() === 0 ? 0 : -6}px;`,
                              'overflow:hidden;',
                            ].join('')}
                          >
                            <img
                              src={agentAvatarDataUri(badge.name)}
                              alt=""
                              style="width:100%;height:100%;object-fit:cover;"
                            />
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

type InlinePart =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string };
interface DocHeading {
  id: string;
  level: number;
  title: string;
}

const docFiles = import.meta.glob('../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function firstDocsPath(): string {
  return DOCS_PORTAL_SECTIONS[0]?.entries[0]?.path ?? 'docs/README.md';
}

function docContentForPath(path: string): string | undefined {
  if (path === 'README.md') return rootReadme;
  if (path === 'CLAUDE.md') return rootClaude;
  if (path === 'AGENTS.md') return rootAgents;
  return docFiles[`../../../${path}`];
}

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let index = 0;
  while (index < text.length) {
    const codeStart = text.indexOf('`', index);
    const linkStart = text.indexOf('[', index);
    const strongStart = text.indexOf('**', index);
    const emStart = text.indexOf('*', index);
    let next = -1;
    let mode: 'code' | 'link' | 'strong' | 'em' | null = null;
    if (codeStart >= 0 && (next < 0 || codeStart < next)) {
      next = codeStart;
      mode = 'code';
    }
    if (linkStart >= 0 && (next < 0 || linkStart < next)) {
      next = linkStart;
      mode = 'link';
    }
    if (strongStart >= 0 && (next < 0 || strongStart < next)) {
      next = strongStart;
      mode = 'strong';
    }
    if (
      emStart >= 0
      && (next < 0 || emStart < next)
      && text.slice(emStart, emStart + 2) !== '**'
    ) {
      next = emStart;
      mode = 'em';
    }
    if (next < 0 || mode === null) {
      parts.push({ type: 'text', value: text.slice(index) });
      break;
    }
    if (next > index) {
      parts.push({ type: 'text', value: text.slice(index, next) });
    }
    if (mode === 'code') {
      const codeEnd = text.indexOf('`', next + 1);
      if (codeEnd > next) {
        parts.push({ type: 'code', value: text.slice(next + 1, codeEnd) });
        index = codeEnd + 1;
      } else {
        parts.push({ type: 'text', value: text.slice(next) });
        break;
      }
    } else {
      if (mode === 'link') {
        const labelEnd = text.indexOf(']', next + 1);
        const openParen = labelEnd >= 0 ? text.indexOf('(', labelEnd + 1) : -1;
        const closeParen = openParen >= 0 ? text.indexOf(')', openParen + 1) : -1;
        if (labelEnd > next && openParen === labelEnd + 1 && closeParen > openParen) {
          parts.push({
            type: 'link',
            label: text.slice(next + 1, labelEnd),
            href: text.slice(openParen + 1, closeParen),
          });
          index = closeParen + 1;
        } else {
          parts.push({ type: 'text', value: text.slice(next, next + 1) });
          index = next + 1;
        }
      } else if (mode === 'strong') {
        const end = text.indexOf('**', next + 2);
        if (end > next + 1) {
          parts.push({ type: 'strong', value: text.slice(next + 2, end) });
          index = end + 2;
        } else {
          parts.push({ type: 'text', value: text.slice(next) });
          break;
        }
      } else if (mode === 'em') {
        const end = text.indexOf('*', next + 1);
        if (end > next) {
          parts.push({ type: 'em', value: text.slice(next + 1, end) });
          index = end + 1;
        } else {
          parts.push({ type: 'text', value: text.slice(next) });
          break;
        }
      } else {
        parts.push({ type: 'text', value: text.slice(next, next + 1) });
        index = next + 1;
      }
    }
  }
  return parts;
}

function slugifyHeading(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return normalized || 'section';
}

function extractHeadings(markdown: string): DocHeading[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const counts = new Map<string, number>();
  const headings: DocHeading[] = [];
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level > 3) continue;
    const title = match[2].trim();
    const base = slugifyHeading(title);
    const seen = counts.get(base) ?? 0;
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    counts.set(base, seen + 1);
    headings.push({ id, level, title });
  }
  return headings;
}

function InlineText(props: { text: string }) {
  return (
    <For each={parseInline(props.text)}>
      {(part) => (
        <Show
          when={part.type !== 'text'}
          fallback={<>{part.type === 'text' ? part.value : ''}</>}
        >
          <Show when={part.type === 'code'}>
            <code class="docs-book-inline-code">{part.type === 'code' ? part.value : ''}</code>
          </Show>
          <Show when={part.type === 'link'}>
            <a
              class="docs-book-link"
              href={part.type === 'link' ? part.href : '#'}
              target="_blank"
              rel="noreferrer"
            >
              {part.type === 'link' ? part.label : ''}
            </a>
          </Show>
          <Show when={part.type === 'strong'}>
            <strong>{part.type === 'strong' ? part.value : ''}</strong>
          </Show>
          <Show when={part.type === 'em'}>
            <em>{part.type === 'em' ? part.value : ''}</em>
          </Show>
        </Show>
      )}
    </For>
  );
}

function splitTableRow(line: string): string[] {
  const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return stripped.split('|').map((cell) => cell.trim());
}

function MarkdownDocument(props: { markdown: string }) {
  const blocks = createMemo(() => {
    const source = props.markdown.replace(/\r\n/g, '\n');
    const lines = source.split('\n');
    const headingCounts = new Map<string, number>();
    const rendered: JSX.Element[] = [];
    let i = 0;
    let h2Index = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }
      if (line.startsWith('```')) {
        const language = line.slice(3).trim();
        const body: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) {
          body.push(lines[i]);
          i += 1;
        }
        if (i < lines.length && lines[i].startsWith('```')) i += 1;
        rendered.push(
          <div class="docs-book-codeblock">
            <Show when={language}>
              <div class="docs-book-codeblock-lang">{language}</div>
            </Show>
            <pre class="docs-book-raw-code">{body.join('\n')}</pre>
          </div>,
        );
        continue;
      }
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const title = heading[2].trim();
        const base = slugifyHeading(title);
        const seen = headingCounts.get(base) ?? 0;
        const id = seen === 0 ? base : `${base}-${seen + 1}`;
        headingCounts.set(base, seen + 1);
        if (level === 2) {
          h2Index += 1;
          rendered.push(
            <div id={id} class="docs-book-h2-row">
              <span class="docs-book-h2-index">{h2Index}</span>
              <div class="docs-book-h docs-book-h2">
                <InlineText text={title} />
              </div>
            </div>,
          );
        } else {
          rendered.push(
            <div id={id} class={`docs-book-h docs-book-h${level}`}>
              <InlineText text={title} />
            </div>,
          );
        }
        i += 1;
        continue;
      }
      const tableHeader = line.includes('|')
        && i + 1 < lines.length
        && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1]);
      if (tableHeader) {
        const head = splitTableRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          rows.push(splitTableRow(lines[i]));
          i += 1;
        }
        rendered.push(
          <div class="docs-book-table-wrap">
            <table class="docs-book-table">
              <thead>
                <tr>
                  <For each={head}>{(cell) => <th><InlineText text={cell} /></th>}</For>
                </tr>
              </thead>
              <tbody>
                <For each={rows}>
                  {(row) => (
                    <tr>
                      <For each={row}>{(cell) => <td><InlineText text={cell} /></td>}</For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i += 1;
        }
        rendered.push(
          <ul class="docs-book-ul">
            <For each={items}>{(item) => <li><InlineText text={item} /></li>}</For>
          </ul>,
        );
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        let start = 1;
        const startMatch = /^\s*(\d+)\.\s+/.exec(line);
        if (startMatch) start = Number.parseInt(startMatch[1], 10);
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i += 1;
        }
        rendered.push(
          <ol class="docs-book-ol" start={start}>
            <For each={items}>{(item) => <li><InlineText text={item} /></li>}</For>
          </ol>,
        );
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quoted: string[] = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^>\s?/, ''));
          i += 1;
        }
        rendered.push(
          <aside class="docs-book-callout">
            <For each={quoted}>
              {(item) => (
                <p class="docs-book-callout-line">
                  <InlineText text={item} />
                </p>
              )}
            </For>
          </aside>,
        );
        continue;
      }
      if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
        rendered.push(<hr class="docs-book-divider" />);
        i += 1;
        continue;
      }
      const paragraph: string[] = [];
      while (
        i < lines.length
        && lines[i].trim()
        && !/^(#{1,6})\s+/.test(lines[i])
        && !/^\s*[-*]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])
        && !/^>\s?/.test(lines[i])
        && !/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
        && !lines[i].startsWith('```')
      ) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      if (paragraph.length > 0) {
        rendered.push(
          <p class="docs-book-paragraph">
            <InlineText text={paragraph.join(' ')} />
          </p>,
        );
        continue;
      }
      i += 1;
    }
    return rendered;
  });
  return <div class="docs-book-markdown">{blocks()}</div>;
}

function ReadingGuide(props: {
  selectedDocContent?: string;
}) {
  const docHeadings = createMemo(() => extractHeadings(props.selectedDocContent ?? ''));
  const [activeHeadingId, setActiveHeadingId] = createSignal<string | null>(null);
  let markdownContainerRef: HTMLDivElement | undefined;

  createEffect(() => {
    const headings = docHeadings();
    setActiveHeadingId(headings[0]?.id ?? null);
  });

  createEffect(() => {
    const container = markdownContainerRef;
    if (!container) return;
    const onScroll = () => {
      const headings = docHeadings();
      if (headings.length === 0) {
        setActiveHeadingId(null);
        return;
      }
      const top = container.getBoundingClientRect().top + 64;
      let current = headings[0].id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= top) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(current);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.setTimeout(onScroll, 0);
    onCleanup(() => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
  });

  return (
    <div class="reading-guide-shell docs-layout">
      <div class="docs-book-content-shell">
        <section class="docs-book-content">
            <Show
              when={props.selectedDocContent}
              fallback={
                <p class="docs-portal-empty">
                  This document is not available in the app bundle.
                </p>
              }
            >
              <div class="docs-book-article-wrap" ref={markdownContainerRef}>
                <MarkdownDocument markdown={props.selectedDocContent || ''} />
              </div>
            </Show>
        </section>
        <aside class="docs-book-toc">
          <div class="docs-book-toc-title">On this page</div>
          <div class="docs-book-toc-list">
            <For each={docHeadings()}>
              {(heading) => (
                <button
                  type="button"
                  class="docs-book-toc-item"
                  classList={{
                    'is-active': activeHeadingId() === heading.id,
                    'is-level2': heading.level === 2,
                    'is-level3': heading.level === 3,
                  }}
                  onClick={() => {
                    const target = document.getElementById(heading.id);
                    setActiveHeadingId(heading.id);
                    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {heading.title}
                </button>
              )}
            </For>
          </div>
        </aside>
      </div>
    </div>
  );
}

function streamStatusLabel(): string {
  if (connectionState() === 'connecting') {
    return hasStreamData() ? 'Reconnecting' : 'Loading live data';
  }

  if (connectionState() === 'connected') {
    return hasStreamData() ? 'Connected' : 'Connected, waiting for first payload';
  }

  return hasStreamData()
    ? 'Disconnected, showing last data'
    : 'Disconnected before any data arrived';
}
