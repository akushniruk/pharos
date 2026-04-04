import { Show, For, onMount, createSignal, createMemo, createEffect } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { listBullet, share } from 'solid-heroicons/solid';
import {
  selectedProject,
  selectedProjectSnapshot,
  selectedProjectFocusSnapshot,
  selectedViewedChangesSnapshot,
  selectedAgent,
  helpVisible,
  toggleHelpVisible,
  initHelpState,
  initViewedScopeState,
  projects,
  selectProject,
  selectAgent,
  filteredEvents,
} from './lib/store';
import { connectWs, connectionState, hasStreamData } from './lib/ws';
import { initTheme } from './lib/theme';
import { timeAgo } from './lib/time';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EventStream from './components/EventStream';
import AgentGraph from './components/AgentGraph';
import AgentDetail from './components/AgentDetail';
import type { Project } from './lib/types';

type ViewMode = 'logs' | 'graph';
const DEFAULT_PROJECT_LOGO_STORAGE_KEY = 'pharos.default-project-logo';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>('logs');

  const toggleStyle = (mode: ViewMode) => [
    'display:flex;align-items:center;gap:4px;font-size:11px;font-weight:500;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
    'transition:background 0.15s,color 0.15s;',
    viewMode() === mode
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:none;color:var(--text-secondary);',
  ].join('');

  onMount(() => {
    connectWs();
    initTheme();
    initHelpState();
    initViewedScopeState();
  });

  return (
    <div class="app">
      {/* Zone 1: Header */}
      <Header />

      {/* Zone 2 + 3 + 4 */}
      <div class="app-body">
        {/* Zone 2: Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed()}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />

        {/* Zone 3 + 4: Main content */}
        <div class="app-main">
          <Show when={selectedProject()} fallback={<ProjectsHome />}>
            {/* Toolbar: project breadcrumb + view mode toggle */}
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
              <button
                onClick={() => selectProject(null)}
                style="background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-secondary);padding:4px 8px;border-radius:4px;transition:background 0.15s;"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Project: {selectedProject()}
              </button>
              <div style="display:flex;align-items:center;gap:2px;">
                <button style={toggleStyle('logs')} onClick={() => setViewMode('logs')}>
                  <Icon path={listBullet} style="width:14px;height:14px;" />
                  Logs
                </button>
                <button style={toggleStyle('graph')} onClick={() => setViewMode('graph')}>
                  <Icon path={share} style="width:14px;height:14px;" />
                  Graph
                </button>
              </div>
            </div>

            {/* Content area */}
            <Show
              when={viewMode() === 'logs'}
              fallback={
                <div style="display:flex;flex:1;overflow:hidden;">
                  <AgentGraph />
                  <Show when={selectedAgent() && viewMode() === 'graph'}>
                    <div style="width:300px;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;">
                      <AgentDetail />
                    </div>
                  </Show>
                </div>
              }
            >
              <EventStream />
            </Show>
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
function uniqueAgentBadges(p: Project): { name: string; isActive: boolean; avatarUrl?: string }[] {
  const seen = new Map<string, { isActive: boolean; avatarUrl?: string }>();
  for (const s of p.sessions) {
    for (const a of s.agents) {
      const cleanedName = a.displayName?.trim();
      if (!cleanedName) continue;
      const lower = cleanedName.toLowerCase();
      if (lower === 'unknown' || lower === 'agent' || lower === 'session') continue;
      const existing = seen.get(cleanedName);
      if (existing === undefined || a.isActive) {
        seen.set(cleanedName, { isActive: a.isActive, avatarUrl: a.avatarUrl });
      }
    }
  }
  return Array.from(seen, ([name, details]) => ({
    name,
    isActive: details.isActive,
    avatarUrl: details.avatarUrl,
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

function projectFallbackIconDataUri(_projectName: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
<style>
  .bg { fill: #F8FAFC; stroke: #CBD5E1; }
  .core { fill: #E2E8F0; stroke: #94A3B8; }
  .dot { fill: #334155; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #0F172A; stroke: #334155; }
    .core { fill: #1E293B; stroke: #94A3B8; }
    .dot { fill: #CBD5E1; }
  }
</style>
<rect class='bg' x='1' y='1' width='30' height='30' rx='9'/>
<rect class='core' x='8' y='8' width='16' height='16' rx='5' stroke-width='1.25'/>
<circle class='dot' cx='16' cy='16' r='2.9'/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalizeLogoUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return undefined;
}

function resolveProjectLogo(project: Project, configuredLogo?: string): string {
  return project.iconUrl || configuredLogo || projectFallbackIconDataUri(project.name);
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

/** Inline home view — shown when no project selected */
function ProjectsHome() {
  const [projectQuery, setProjectQuery] = createSignal('');
  const [sortMode, setSortMode] = createSignal<'activity' | 'name'>('activity');
  const [defaultProjectLogo, setDefaultProjectLogo] = createSignal<string | undefined>(undefined);
  const projectList = createMemo(() => projects());
  const orderedProjects = createMemo(() =>
    [...projectList()].sort((left, right) => {
      if (sortMode() === 'name') {
        return left.name.localeCompare(right.name);
      }
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

  const sortButtonStyle = (mode: 'activity' | 'name') => [
    'height:30px;padding:0 10px;border-radius:9999px;border:1px solid var(--border);font-size:11px;cursor:pointer;',
    'transition:background 0.15s,color 0.15s,border-color 0.15s;',
    sortMode() === mode
      ? 'background:var(--bg-elevated);color:var(--text-primary);border-color:var(--border-hover);font-weight:600;'
      : 'background:transparent;color:var(--text-secondary);',
  ].join('');

  onMount(() => {
    if (typeof localStorage === 'undefined') return;
    setDefaultProjectLogo(
      normalizeLogoUrl(localStorage.getItem(DEFAULT_PROJECT_LOGO_STORAGE_KEY)),
    );
  });

  createEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const value = defaultProjectLogo();
    if (value) {
      localStorage.setItem(DEFAULT_PROJECT_LOGO_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(DEFAULT_PROJECT_LOGO_STORAGE_KEY);
    }
  });

  return (
    <div style="padding:24px 28px;max-width:1400px;margin:0 auto;overflow-y:auto;flex:1;width:100%;">
      <Show when={helpVisible()}>
        <ReadingGuide mode="home" />
      </Show>

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
          <div style="display:flex;align-items:center;gap:6px;">
            <button
              onClick={() => setSortMode('activity')}
              aria-pressed={sortMode() === 'activity'}
              style={sortButtonStyle('activity')}
            >
              Activity
            </button>
            <button
              onClick={() => setSortMode('name')}
              aria-pressed={sortMode() === 'name'}
              style={sortButtonStyle('name')}
            >
              Name
            </button>
          </div>
          <button
            onClick={() => {
              const current = defaultProjectLogo() || '';
              const next = window.prompt('Default project logo URL (https://... or /path)', current);
              if (next === null) return;
              setDefaultProjectLogo(normalizeLogoUrl(next));
            }}
            style="height:34px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);padding:0 10px;font-size:12px;cursor:pointer;"
          >
            Set logo
          </button>
          <Show when={defaultProjectLogo()}>
            <button
              onClick={() => setDefaultProjectLogo(undefined)}
              style="height:34px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);padding:0 10px;font-size:12px;cursor:pointer;"
            >
              Reset logo
            </button>
          </Show>
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
                        'width:32px;height:32px;border-radius:9px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;',
                        'background:linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));',
                      ].join('')}
                    >
                      <img
                        src={resolveProjectLogo(p, defaultProjectLogo())}
                        alt=""
                        style="width:16px;height:16px;opacity:0.95;"
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
                            <Show
                              when={badge.avatarUrl}
                              fallback={agentInitials(badge.name)}
                            >
                              <img
                                src={badge.avatarUrl}
                                alt=""
                                style="width:100%;height:100%;object-fit:cover;"
                              />
                            </Show>
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

type GuideMode = 'home' | 'project';
type ReadingPanel = 'guide' | 'docs';

interface DocsPortalEntry {
  title: string;
  path: string;
  summary: string;
}

function ReadingGuide(props: { mode: GuideMode }) {
  const project = createMemo(() => selectedProjectSnapshot());
  const focus = createMemo(() => selectedProjectFocusSnapshot());
  const [panel, setPanel] = createSignal<ReadingPanel>('docs');
  const [copiedValue, setCopiedValue] = createSignal<string | null>(null);

  const docsPortalSections = createMemo((): Array<{ title: string; entries: DocsPortalEntry[] }> => [
    {
      title: 'Start Here',
      entries: [
        {
          title: 'Docs Portal Index',
          path: 'docs/README.md',
          summary: 'Primary entry point for all project documentation.',
        },
        {
          title: 'Event Stream UX Guide',
          path: 'docs/event-stream-ux-guide.md',
          summary: 'Simple/Detailed behavior, payload modes, and style rules.',
        },
      ],
    },
    {
      title: 'UI And Design',
      entries: [
        {
          title: 'Full Solid UI Design Spec',
          path: 'docs/superpowers/specs/2026-04-03-solidjs-full-ui-design.md',
          summary: 'Design contract for layout, interaction, and accessibility.',
        },
      ],
    },
    {
      title: 'Operations And Release',
      entries: [
        {
          title: 'macOS Desktop Release',
          path: 'docs/macos-desktop-release.md',
          summary: 'Release flow and operational runbook for desktop shipping.',
        },
      ],
    },
  ]);

  const quickRunCommands = [
    'make daemon',
    'make client',
    'make test',
  ];

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

  const content = createMemo(() => {
    const currentProject = project();
    const currentFocus = focus();

    if (props.mode === 'home' || !currentProject) {
      return {
        eyebrow: 'Quick guide',
        title: 'Start with a project, then narrow down by session or agent.',
        summary: 'Pharos groups activity into three layers: projects on the left, sessions in the middle, and agents inside each session.',
        steps: [
          'Pick a project to open its activity feed.',
          'Green means live; gray means the project is quiet.',
          'Use Logs for the timeline and Graph for relationships.',
        ],
      };
    }

    if (currentFocus?.hasAgentFocus) {
      return {
        eyebrow: 'Reading view',
        title: 'You are looking at one helper inside a session.',
        summary: 'The details on the right explain what the agent was asked to do, what it tried, and the most useful result it produced.',
        steps: [
          'Agent detail shows the current assignment and latest useful result.',
          'Logs show the exact events that led here.',
          'Graph shows how this agent connects to the rest of the run.',
        ],
      };
    }

    if (currentFocus?.hasSessionFocus) {
      return {
        eyebrow: 'Reading view',
        title: 'This session is one run inside the selected project.',
        summary: 'Use the session chips to move between runs and read the activity in the order it happened.',
        steps: [
          'The session strip at the top is the quickest way to switch runs.',
          'Logs read top to bottom like a live transcript of activity.',
          'Graph groups the same work into a visual map.',
        ],
      };
    }

    return {
      eyebrow: 'Reading view',
      title: 'This project is an overview of all activity in one workspace or folder.',
      summary: 'The timeline at the top explains what is active, and the main area lets you move between logs and graph without losing context.',
      steps: [
        'Project timeline summarizes the selected workspace or folder.',
        'Active sessions are marked so you can see what is still running.',
        'Logs explain the work; Graph explains who worked with whom.',
      ],
    };
  });

  return (
    <div class="reading-guide-shell">
      <div class="reading-guide-header">
        <div class="reading-guide-headcopy">
          <div class="reading-guide-eyebrow-row">
            <span class="reading-guide-eyebrow">
              {panel() === 'docs' ? 'Docs portal' : content().eyebrow}
            </span>
            <span class="reading-guide-dot" />
          </div>
          <div class="reading-guide-title">
            {panel() === 'docs' ? 'Pharos platform docs portal' : content().title}
          </div>
          <div class="reading-guide-summary">
            {panel() === 'docs'
              ? 'Browse implementation docs and copy exact run commands from inside the platform.'
              : content().summary}
          </div>
        </div>

        <div class="reading-guide-actions">
          <div class="reading-guide-tabs" role="tablist" aria-label="Guide panel switcher">
            <button
              type="button"
              role="tab"
              class="reading-guide-tab"
              classList={{ 'is-active': panel() === 'docs' }}
              aria-selected={panel() === 'docs'}
              onClick={() => setPanel('docs')}
            >
              Docs
            </button>
            <button
              type="button"
              role="tab"
              class="reading-guide-tab"
              classList={{ 'is-active': panel() === 'guide' }}
              aria-selected={panel() === 'guide'}
              onClick={() => setPanel('guide')}
            >
              Guide
            </button>
          </div>
          <button
            onClick={toggleHelpVisible}
            class="reading-guide-hide"
            type="button"
          >
            Hide
          </button>
        </div>
      </div>

      <Show
        when={panel() === 'docs'}
        fallback={
          <div class="reading-guide-steps-grid">
            <For each={content().steps}>
              {(step, index) => (
                <div class="reading-guide-step">
                  <div class="reading-guide-step-index">
                    {index() + 1}
                  </div>
                  <div class="reading-guide-step-text">
                    {step}
                  </div>
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="docs-portal-grid">
          <For each={docsPortalSections()}>
            {(section) => (
              <section class="docs-portal-section">
                <h3 class="docs-portal-section-title">{section.title}</h3>
                <div class="docs-portal-section-items">
                  <For each={section.entries}>
                    {(entry) => (
                      <article class="docs-portal-entry">
                        <div class="docs-portal-entry-title">{entry.title}</div>
                        <p class="docs-portal-entry-summary">{entry.summary}</p>
                        <div class="docs-portal-entry-footer">
                          <code class="docs-portal-entry-path">{entry.path}</code>
                          <button
                            type="button"
                            class="docs-portal-copy"
                            onClick={() => void copyToClipboard(entry.path)}
                          >
                            {copiedValue() === entry.path ? 'Copied' : 'Copy path'}
                          </button>
                        </div>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>

          <section class="docs-portal-section">
            <h3 class="docs-portal-section-title">Run The Platform</h3>
            <div class="docs-portal-runlist">
              <For each={quickRunCommands}>
                {(command) => (
                  <div class="docs-portal-runitem">
                    <code class="docs-portal-runcommand">{command}</code>
                    <button
                      type="button"
                      class="docs-portal-copy"
                      onClick={() => void copyToClipboard(command)}
                    >
                      {copiedValue() === command ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>
      </Show>
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
