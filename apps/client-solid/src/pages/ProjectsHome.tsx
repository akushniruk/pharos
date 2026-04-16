import { For, Show, createMemo, createSignal } from 'solid-js';

import type { Project } from '../lib/types';
import { projects, selectProject } from '../lib/store';
import { connectionState, hasStreamData } from '../lib/ws';
import { timeAgo } from '../lib/time';
import { friendlyProjectName } from '../lib/projectDisplayName';
import {
  agentAvatarDataUri,
  projectFallbackIconDataUri,
  resolveProjectLogo,
} from '../widgets/sidebar/sidebarPresentation';

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

/** Inline home view — shown when no project selected */
export default function ProjectsHome() {
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
        friendlyProjectName(project.name),
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
    <div class="phx-shell flex flex-1 justify-center overflow-y-auto">
      <div class="flex w-full max-w-[1400px] flex-col gap-3.5 p-10">
        <div class="mb-2 flex flex-col gap-3.5">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <div class="flex items-baseline gap-3">
              <h1 class="phx-title text-[27px]">Overview</h1>
              <span class="text-[var(--text-base)] text-[var(--text-tertiary)]">{projectList().length} projects</span>
            </div>
            <span class="font-mono text-[var(--text-sm)] text-[var(--text-dim)]">
              {streamStateText()}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-[240px] flex-1">
            <input
              type="text"
              value={projectQuery()}
              onInput={(event) => setProjectQuery(event.currentTarget.value)}
              placeholder="Search projects..."
                class="phx-input"
            />
            </div>
          </div>
        </div>
      <Show when={projectList().length === 0}>
        <div class="my-4 flex flex-col items-center rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-5 py-20 text-center">
          <p class="mb-1 text-[18px] text-[var(--text-secondary)]">No projects have been captured yet.</p>
          <p class="text-[var(--text-sm)] text-[var(--text-dim)]">Open a session and wait for the first snapshot to land here.</p>
        </div>
      </Show>

      <div class="mb-1 flex flex-wrap items-center gap-3">
        <span class="text-[var(--text-sm)] text-[var(--text-secondary)]">
          {activeCount()} active projects
        </span>
        <span class="text-[var(--text-sm)] text-[var(--text-secondary)]">
          {totalAgents()} agents
        </span>
        <span class="text-[var(--text-sm)] text-[var(--text-secondary)]">
          {totalEvents()} events
        </span>
        <span class="text-[var(--text-sm)] text-[var(--text-dim)]">
          {streamStateDetail()}
        </span>
      </div>

      <div class="mt-2 flex min-w-0 flex-col gap-2.5">
        <p class="text-[var(--text-base)] font-semibold text-[var(--text-primary)]">Projects</p>
        <div class="phx-card-grid items-stretch">
          <For each={filteredProjectList()}>
            {(p) => (
              <div
                class="phx-panel flex min-h-[188px] cursor-pointer flex-col gap-2 p-3.5 transition-colors hover:border-[var(--border-hover)]"
                onClick={() => selectProject(p.name)}
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px]">
                      <img
                        src={resolveProjectLogo(p)}
                        alt=""
                        class="h-8 w-8 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = projectFallbackIconDataUri(friendlyProjectName(p.name));
                          e.currentTarget.onerror = null;
                        }}
                      />
                    </div>
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <span
                        title={p.name !== friendlyProjectName(p.name) ? p.name : undefined}
                        class="overflow-hidden text-ellipsis whitespace-nowrap text-[17px] font-semibold"
                      >
                        {friendlyProjectName(p.name)}
                      </span>
                      <span class="text-[var(--text-sm)] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Project
                      </span>
                    </div>
                  </div>
                  <span class="shrink-0 rounded-full border border-[var(--border)] px-2 py-[2px] text-[var(--text-sm)] font-semibold" style={{ background: p.isActive ? 'var(--green-dim)' : 'var(--bg-elevated)', color: p.isActive ? 'var(--green)' : 'var(--text-secondary)' }}>
                    {projectStatusLabel(p)}
                  </span>
                </div>

                <div class="flex gap-3.5">
                  <div class="text-[var(--text-sm)] text-[var(--text-secondary)]">{p.sessions.length} sessions</div>
                  <div class="text-[var(--text-sm)] text-[var(--text-secondary)]">{p.agentCount} agents</div>
                  <div class="text-[var(--text-sm)] text-[var(--text-secondary)]">{p.eventCount} events</div>
                </div>

                <div class="min-h-9 text-[var(--text-base)] leading-[1.5] text-[var(--text-primary)]">
                  {projectCardHeadline(p)}
                </div>

                <div class="mt-auto flex items-center justify-between gap-2.5">
                  <div class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-sm)] leading-[1.4] text-[var(--text-secondary)]">
                    {projectCardSubline(p)}
                  </div>
                  <Show when={uniqueAgentBadges(p).length > 0}>
                    <div class="mr-1 flex items-center">
                      <For each={uniqueAgentBadges(p).slice(0, 4)}>
                        {(badge, index) => (
                          <div
                            title={badge.name}
                            class="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-sm)] font-bold text-[var(--text-primary)]"
                            style={{ 'margin-left': `${index() === 0 ? 0 : -6}px` }}
                          >
                            <img
                              src={agentAvatarDataUri(badge.name)}
                              alt=""
                              class="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = agentAvatarDataUri('Unknown');
                                e.currentTarget.onerror = null;
                              }}
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
    </div>
  );
}
