import { For, Show, createMemo, createSignal } from 'solid-js';
import { Icon } from 'solid-heroicons';
import {
  chevronLeft,
  chevronRight,
  bolt,
  clock,
} from 'solid-heroicons/solid';
import { projects, selectedProject, selectedSession, selectProject, selectSession } from '../lib/store';
import { getAgentColor } from '../lib/colors';
import { timeAgo } from '../lib/time';
import { DOCS_PORTAL_RUN_COMMANDS, DOCS_PORTAL_SECTIONS, type DocsPortalSection } from '../lib/docsPortal';
import { mapAgentTypeLabel } from '../lib/agentNaming';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isDocsRoute?: boolean;
  docsQuery?: string;
  onDocsQueryChange?: (value: string) => void;
  docsEntryCount?: number;
  docsSections?: DocsPortalSection[];
  selectedDocPath?: string;
  onSelectDoc?: (path: string) => void;
  copiedValue?: string | null;
  onCopy?: (value: string) => void;
}

type ActivityTone = 'active' | 'blocked' | 'attention' | 'idle' | 'done';

function statusPalette(tone: ActivityTone) {
  switch (tone) {
    case 'active':
      return { background: 'var(--green-dim)', text: 'var(--green)', dot: 'var(--green)' };
    case 'blocked':
      return { background: 'rgba(245, 158, 11, 0.16)', text: 'var(--yellow)', dot: 'var(--yellow)' };
    case 'attention':
      return { background: 'rgba(239, 68, 68, 0.16)', text: 'var(--red)', dot: 'var(--red)' };
    case 'idle':
      return { background: 'var(--bg-elevated)', text: 'var(--text-dim)', dot: 'var(--text-dim)' };
    case 'done':
    default:
      return { background: 'var(--bg-elevated)', text: 'var(--text-dim)', dot: 'var(--text-dim)' };
  }
}

function resolveProjectTone(project: ReturnType<typeof projects>[number]): ActivityTone {
  const tones = project.sessions.map((session) =>
    session.statusTone || (session.isActive ? 'active' : session.eventCount > 0 ? 'idle' : 'done'));
  if (tones.includes('attention')) return 'attention';
  if (tones.includes('blocked')) return 'blocked';
  if (tones.includes('active')) return 'active';
  if (tones.includes('idle')) return 'idle';
  return 'done';
}

function friendlySessionLabel(label?: string | null): string {
  if (!label) return 'Session';
  const cleaned = label.replace(/^<[^>]+>\s*/i, '').trim();
  if (!cleaned) return 'Current request';
  if (cleaned.toLowerCase() === 'pending') return 'Current request';
  return cleaned;
}

function friendlySummary(text?: string | null): string {
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

function friendlyProjectSummary(text?: string | null): string | undefined {
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
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
<style>
  .bg { fill: #F8FAFC; stroke: #CBD5E1; }
  .core { fill: #E2E8F0; stroke: #94A3B8; }
  .txt { fill: #334155; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #0F172A; stroke: #334155; }
    .core { fill: #1E293B; stroke: #94A3B8; }
    .txt { fill: #CBD5E1; }
  }
</style>
<rect class='bg' x='1' y='1' width='22' height='22' rx='7'/>
<rect class='core' x='6' y='6' width='12' height='12' rx='3.7' stroke-width='1.1'/>
<text class='txt' x='12' y='12' text-anchor='middle' dominant-baseline='central' font-family='Inter,Arial,sans-serif' font-size='6.4' font-weight='700'>${initials}</text>
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

function resolveProjectLogo(project: ReturnType<typeof projects>[number]): string {
  const custom = typeof localStorage === 'undefined'
    ? undefined
    : normalizeLogoUrl(localStorage.getItem(DEFAULT_PROJECT_LOGO_STORAGE_KEY));
  return custom || projectFallbackIconDataUri(project.name);
}

function projectInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = trimmed.match(/[A-Za-z0-9]/)?.[0] ?? trimmed[0];
  return first.toUpperCase();
}

function projectCollapsedTitle(project: ReturnType<typeof projects>[number]): string {
  const state = project.isActive ? 'Active' : 'Idle';
  return `${project.name} · ${state} · ${project.sessions.length} sessions`;
}

export default function Sidebar(props: SidebarProps) {
  const [activityFilter, setActivityFilter] = createSignal<'all' | 'active'>('all');
  const [expandedDocSections, setExpandedDocSections] = createSignal<Record<string, boolean>>({});

  const selectedProjectSessions = createMemo(() => {
    const proj = selectedProject();
    if (!proj) return [];
    const sessions = projects().find(p => p.name === proj)?.sessions ?? [];
    return activityFilter() === 'active' ? sessions.filter(s => s.isActive) : sessions;
  });

  const selectedProjectAgentTypes = createMemo(() => {
    const proj = selectedProject();
    if (!proj) return [];
    const project = projects().find(p => p.name === proj);
    if (!project) return [];
    const types = new Set<string>();
    for (const s of project.sessions) {
      for (const a of s.agents) {
        if (a.agentType) types.add(a.agentType);
      }
    }
    return Array.from(types);
  });

  const labelStyle = [
    'display:block;padding:10px 12px 4px;',
    'font-size:10px;font-weight:600;text-transform:uppercase;',
    'letter-spacing:0.08em;color:var(--text-dim);',
  ].join('');

  const filterStyle = (mode: 'all' | 'active') => [
    'font-size:9px;font-weight:600;padding:2px 8px;border-radius:9999px;border:none;cursor:pointer;',
    'transition:background 0.15s,color 0.15s;',
    activityFilter() === mode
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:transparent;color:var(--text-dim);',
  ].join('');

  const visibleProjects = createMemo(() =>
    activityFilter() === 'active'
      ? projects().filter(p => p.isActive)
      : projects(),
  );

  if (props.isDocsRoute) {
    const docsSections = () => props.docsSections ?? DOCS_PORTAL_SECTIONS;
    const docsEntryCount = () => props.docsEntryCount ?? docsSections().reduce((count, section) => count + section.entries.length, 0);
    const isDocSectionExpanded = (title: string) => expandedDocSections()[title] ?? true;
    const toggleDocSection = (title: string) => {
      setExpandedDocSections((current) => ({ ...current, [title]: !isDocSectionExpanded(title) }));
    };
    return (
      <Show
        when={!props.collapsed}
        fallback={
          <div class="docs-sidebar-collapsed">
            <button
              onClick={props.onToggle}
              title="Expand sidebar"
              class="docs-sidebar-toggle"
            >
              <Icon path={chevronRight} style="width:12px;height:12px;" />
            </button>
          </div>
        }
      >
        <div class="docs-sidebar-root">
          <div class="docs-sidebar-head">
            <div class="docs-sidebar-headcopy">
              <span class="docs-sidebar-kicker">Documentation</span>
              <div class="docs-sidebar-title-row">
                <span class="docs-sidebar-title">Pharos Docs</span>
                <span class="docs-sidebar-count">{docsEntryCount()} entries</span>
              </div>
            </div>
            <button
              onClick={props.onToggle}
              title="Collapse sidebar"
              class="docs-sidebar-toggle"
            >
              <Icon path={chevronLeft} style="width:12px;height:12px;" />
            </button>
          </div>

          <div class="docs-sidebar-search-wrap">
            <input
              type="text"
              value={props.docsQuery ?? ''}
              onInput={(event) => props.onDocsQueryChange?.(event.currentTarget.value)}
              placeholder="Search docs..."
              class="docs-sidebar-search"
            />
          </div>

          <div class="docs-sidebar-scroll">
            <For each={docsSections()}>
              {(section) => (
                <div class="docs-sidebar-section">
                  <button
                    type="button"
                    class="docs-sidebar-section-head"
                    onClick={() => toggleDocSection(section.title)}
                  >
                    <span class="docs-sidebar-section-title">{section.title}</span>
                    <Icon
                      path={chevronRight}
                      style={`width:11px;height:11px;transition:transform 0.18s;transform:${isDocSectionExpanded(section.title) ? 'rotate(90deg)' : 'rotate(0deg)'};`}
                    />
                  </button>
                  <div class="docs-sidebar-section-items" style={{ display: isDocSectionExpanded(section.title) ? 'flex' : 'none' }}>
                    <For each={section.entries}>
                      {(entry) => (
                        <button
                          type="button"
                          onClick={() => props.onSelectDoc?.(entry.path)}
                          class="docs-sidebar-entry"
                          classList={{ 'is-active': props.selectedDocPath === entry.path }}
                        >
                          <div class="docs-sidebar-entry-title">{entry.title}</div>
                          <div class="docs-sidebar-entry-path">{entry.path}</div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>

            <div class="docs-sidebar-section docs-sidebar-commands">
              <div class="docs-sidebar-section-title">
                Run The Platform
              </div>
              <div class="docs-sidebar-command-list">
                <For each={DOCS_PORTAL_RUN_COMMANDS}>
                  {(command) => (
                    <div class="docs-sidebar-command-item">
                      <code class="docs-sidebar-command-code">{command}</code>
                      <button
                        type="button"
                        onClick={() => props.onCopy?.(command)}
                        class="docs-sidebar-command-copy"
                      >
                        {props.copiedValue === command ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    );
  }

  return (
    <Show
      when={!props.collapsed}
      fallback={
        /* Collapsed: 40px bar with project icons + toggle */
        <div
          style="width:40px;flex-shrink:0;background:var(--bg-primary);border-right:1px solid var(--border);display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:6px;"
        >
          <button
            onClick={props.onToggle}
            title="Expand sidebar"
            style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:4px;line-height:1;display:flex;align-items:center;justify-content:center;"
          >
            <Icon path={chevronRight} style="width:12px;height:12px;" />
          </button>
          <For each={visibleProjects()}>
            {(p) => {
              const isSelected = () => selectedProject() === p.name;
              const tone = () => resolveProjectTone(p);
              const palette = () => statusPalette(tone());
              return (
                <button
                  title={projectCollapsedTitle(p)}
                  aria-label={`Open project ${p.name}`}
                  style={[
                    'background:none;cursor:pointer;padding:0;line-height:1;display:flex;align-items:center;justify-content:center;position:relative;',
                    'width:24px;height:24px;border-radius:7px;border:1px solid var(--border);font-size:10px;font-weight:700;',
                    `color:${isSelected() ? 'var(--text-primary)' : 'var(--text-secondary)'};`,
                    `background:${isSelected() ? 'var(--bg-elevated)' : 'transparent'};`,
                    `border-color:${isSelected() ? 'var(--accent)' : 'var(--border)'};`,
                  ].join('')}
                  onClick={() => selectProject(p.name)}
                >
                  <span>{projectInitial(p.name)}</span>
                  <span
                    style={[
                      'position:absolute;width:5px;height:5px;border-radius:9999px;transform:translate(8px,8px);',
                      `background:${palette().dot};`,
                    ].join('')}
                  />
                </button>
              );
            }}
          </For>
        </div>
      }
    >
      {/* Expanded sidebar */}
      <div
        style="width:220px;flex-shrink:0;background:var(--bg-primary);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;"
      >
        {/* Toggle + Projects header */}
        <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-right:8px;">
          <div style="display:flex;flex-direction:column;gap:6px;min-width:0;">
            <span style={labelStyle}>Projects</span>
            <div style="display:flex;align-items:center;gap:4px;padding:0 12px 8px;">
              <button style={filterStyle('all')} onClick={() => setActivityFilter('all')}>
                All
              </button>
              <button style={filterStyle('active')} onClick={() => setActivityFilter('active')}>
                Active
              </button>
            </div>
          </div>
          <button
            onClick={props.onToggle}
            title="Collapse sidebar"
            style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:4px;line-height:1;display:flex;align-items:center;justify-content:center;margin-top:6px;"
          >
            <Icon path={chevronLeft} style="width:12px;height:12px;" />
          </button>
        </div>

        {/* Project list */}
        <div style="overflow-y:auto;flex:1;">
          <For each={visibleProjects()}>
            {(p) => {
              const isSelected = () => selectedProject() === p.name;
              const projectTone = () => resolveProjectTone(p);
              const projectPalette = () => statusPalette(projectTone());
              const primarySummary = () =>
                friendlyProjectSummary(p.summary)
                || (p.isActive
                  ? `${p.activeSessionCount} session${p.activeSessionCount === 1 ? '' : 's'} active`
                  : `${p.sessions.length} session${p.sessions.length === 1 ? '' : 's'}`);
              const secondarySummary = () =>
                [
                  p.summaryDetail,
                  p.runtimeLabels.length > 0 ? `${p.runtimeLabels.join(', ')} runtime` : undefined,
                  `${p.eventCount} events`,
                  timeAgo(p.lastEventAt),
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined;
              return (
                <div>
                  {/* Project row */}
                  <div
                    onClick={() => selectProject(p.name)}
                    style={[
                      'display:flex;align-items:center;gap:6px;padding:7px 12px;cursor:pointer;',
                      `border-left:2px solid ${isSelected() ? 'var(--accent)' : 'transparent'};`,
                      `background:${isSelected() ? 'var(--bg-elevated)' : 'transparent'};`,
                      'transition:background 0.1s;',
                    ].join('')}
                    onMouseEnter={(e) => {
                      if (!isSelected()) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                    >
                    <div style="width:16px;height:16px;border-radius:5px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                      <img
                        src={resolveProjectLogo(p)}
                        alt=""
                        style="width:100%;height:100%;object-fit:cover;"
                      />
                    </div>
                    {/* Name */}
                    <div style="display:flex;flex-direction:column;min-width:0;flex:1;gap:2px;">
                      <span style="font-size:12px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {p.name}
                      </span>
                      <span
                        title={primarySummary()}
                        style="font-size:10px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                      >
                        {primarySummary()}
                      </span>
                      <Show when={secondarySummary()}>
                        <span title={secondarySummary()} style="font-size:9px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          {secondarySummary()}
                        </span>
                      </Show>
                    </div>
                    <div style={[
                      'display:flex;align-items:center;gap:4px;font-size:9px;padding:1px 5px;border-radius:9999px;font-weight:500;flex-shrink:0;',
                      `background:${projectPalette().background};`,
                      `color:${projectPalette().text};`,
                    ].join('')}>
                      <Icon path={projectTone() === 'active' ? bolt : clock} style="width:10px;height:10px;" />
                      <Show when={projectTone() !== 'attention'}>
                        <span>
                          {projectTone() === 'active'
                            ? 'Active'
                            : projectTone() === 'blocked'
                              ? 'Blocked'
                              : projectTone() === 'idle'
                                ? 'Idle'
                                : 'Done'}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Agent type badges (only under selected project) */}
                  <Show when={isSelected() && selectedProjectAgentTypes().length > 0}>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px 20px;">
                      <For each={selectedProjectAgentTypes()}>
                        {(type) => (
                          <span style={[
                            'font-size:9px;padding:1px 5px;border-radius:9999px;font-weight:500;',
                            `background:${getAgentColor(type)}22;color:${getAgentColor(type)};`,
                          ].join('')}>
                            {mapAgentTypeLabel(type) || type}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        {/* Sessions section — only when a project is selected */}
        <Show when={selectedProject()}>
          <div style="border-top:1px solid var(--border);flex-shrink:0;max-height:40%;overflow-y:auto;">
            <span style={labelStyle}>Sessions</span>
            <For each={selectedProjectSessions()}>
              {(s) => {
                const sessionId = () => (s.sessionId && s.sessionId.trim() ? s.sessionId : null);
                const isSelected = () => selectedSession() === sessionId();
                const statusTone = () => s.statusTone || (s.isActive ? 'active' : s.eventCount > 0 ? 'idle' : 'done');
                const statusPaletteForSession = () => statusPalette(statusTone());
                const statusLabel = () =>
                  s.statusLabel
                  || (statusTone() === 'active'
                    ? 'Active'
                    : statusTone() === 'blocked'
                      ? 'Blocked'
                      : statusTone() === 'attention'
                        ? 'Needs attention'
                        : statusTone() === 'idle'
                          ? 'Idle'
                          : 'Done');
                const statusIcon = () => (statusTone() === 'active' ? bolt : clock);
                const primarySummary = () =>
                  statusTone() === 'blocked' || statusTone() === 'attention'
                    ? s.statusDetail || s.summary || s.currentAction || 'Waiting for the next action'
                    : s.summary || s.currentAction || 'Waiting for the next action';
                const secondarySummary = () =>
                  [
                    s.summaryDetail,
                    s.currentActionDetail,
                    s.runtimeLabel ? `Using ${s.runtimeLabel}` : undefined,
                    s.isActive
                      ? `${s.activeAgentCount} helper${s.activeAgentCount === 1 ? '' : 's'} active`
                      : undefined,
                    timeAgo(s.lastEventAt),
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined;
                return (
                  <div
                    onClick={() => {
                      if (sessionId()) {
                        selectSession(sessionId());
                      }
                    }}
                    style={[
                      'display:flex;align-items:center;gap:6px;padding:6px 12px;cursor:pointer;',
                      `border-left:2px solid ${isSelected() ? 'var(--accent)' : 'transparent'};`,
                      `background:${isSelected() ? 'var(--bg-elevated)' : 'transparent'};`,
                      'transition:background 0.1s;',
                    ].join('')}
                    onMouseEnter={(e) => {
                      if (!isSelected()) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                    aria-label={`Open session ${friendlySessionLabel(s.label)}`}
                  >
                    <Icon path={statusIcon()} style="width:12px;height:12px;color:var(--text-secondary);flex-shrink:0;" />
                    <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;">
                      <span style="font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {friendlySessionLabel(s.label)}
                      </span>
                      <span
                        title={friendlySummary(primarySummary())}
                        style="font-size:10px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                      >
                        {friendlySummary(primarySummary())}
                      </span>
                      <Show when={secondarySummary()}>
                        <span title={secondarySummary()} style="font-size:9px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          {secondarySummary()}
                        </span>
                      </Show>
                    </div>
                    {/* Status badge */}
                    <div style={[
                      'display:flex;align-items:center;gap:4px;font-size:9px;padding:1px 5px;border-radius:9999px;font-weight:500;flex-shrink:0;',
                      `background:${statusPaletteForSession().background};`,
                      `color:${statusPaletteForSession().text};`,
                    ].join('')}>
                      <Icon path={statusIcon()} style="width:10px;height:10px;" />
                      <Show when={statusTone() !== 'attention'}>
                        <span>{statusLabel()}</span>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
