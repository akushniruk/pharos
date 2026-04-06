import { For, Show, createMemo, createSignal } from 'solid-js';

import type { Project } from '../lib/types';
import { projects, selectProject } from '../lib/store';
import { connectionState, hasStreamData } from '../lib/ws';
import { timeAgo } from '../lib/time';

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
<text x='16' y='16' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='15' font-weight='700' fill='#94A3B8'>${escapedInitials}</text>
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
<text x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='13' font-weight='700' fill='white'>${initials}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
            <h1 style="font-size: 27px;font-weight:600;letter-spacing:-0.03em">Overview</h1>
            <span style="font-size:var(--text-base);color:var(--text-tertiary)">{projectList().length} projects</span>
          </div>
          <span style="font-size:var(--text-sm);color:var(--text-dim);font-family:var(--font-mono);">
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
              style="width:100%;height:40px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);padding:0 12px;font-size:var(--text-base);"
            />
          </div>
        </div>
      </div>

      <Show when={projectList().length === 0}>
        <div style="display:flex;flex-direction:column;align-items:center;padding:80px 20px;text-align:center;border:1px dashed var(--border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent);">
          <p style="font-size: 18px;color:var(--text-secondary);margin-bottom:4px">No projects have been captured yet.</p>
          <p style="font-size:var(--text-sm);color:var(--text-dim)">Open a session and wait for the first snapshot to land here.</p>
        </div>
      </Show>

      <div style="display:flex;align-items:center;gap:12px;margin:0 0 10px 0;flex-wrap:wrap;">
        <span style="font-size:var(--text-sm);color:var(--text-secondary);">
          {activeCount()} active projects
        </span>
        <span style="font-size:var(--text-sm);color:var(--text-secondary);">
          {totalAgents()} agents
        </span>
        <span style="font-size:var(--text-sm);color:var(--text-secondary);">
          {totalEvents()} events
        </span>
        <span style="font-size:var(--text-sm);color:var(--text-dim);">
          {streamStateDetail()}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
        <p style="font-size:var(--text-base);font-weight:600;color:var(--text-primary);">Projects</p>
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
                      <span style="font-size: 17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{p.name}</span>
                      <span style="font-size:var(--text-sm);color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em;">
                        Project
                      </span>
                    </div>
                  </div>
                  <span style={`font-size:var(--text-sm);padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:${p.isActive ? 'var(--green-dim)' : 'var(--bg-elevated)'};color:${p.isActive ? 'var(--green)' : 'var(--text-secondary)'};font-weight:600;flex-shrink:0;`}>
                    {projectStatusLabel(p)}
                  </span>
                </div>

                <div style="display:flex;gap:14px;">
                  <div style="font-size:var(--text-sm);color:var(--text-secondary);">{p.sessions.length} sessions</div>
                  <div style="font-size:var(--text-sm);color:var(--text-secondary);">{p.agentCount} agents</div>
                  <div style="font-size:var(--text-sm);color:var(--text-secondary);">{p.eventCount} events</div>
                </div>

                <div style="font-size:var(--text-base);color:var(--text-primary);line-height:1.5;min-height:36px;">
                  {projectCardHeadline(p)}
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;">
                  <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    {projectCardSubline(p)}
                  </div>
                  <Show when={uniqueAgentBadges(p).length > 0}>
                    <div style="display:flex;align-items:center;margin-right:4px;">
                      <For each={uniqueAgentBadges(p).slice(0, 4)}>
                        {(badge, index) => (
                          <div
                            title={badge.name}
                            style={[
                              'width:20px;height:20px;border-radius:9999px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:var(--text-sm);font-weight:700;color:var(--text-primary);',
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
