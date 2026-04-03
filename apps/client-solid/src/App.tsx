import { Show, For, onMount, createSignal, createMemo } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { listBullet, share, folder, bolt, cpuChip } from 'solid-heroicons/solid';
import {
  selectedProject,
  selectedProjectSnapshot,
  selectedProjectFocusSnapshot,
  selectedSession,
  selectedAgent,
  helpVisible,
  toggleHelpVisible,
  initHelpState,
  projects,
  selectProject,
  selectSession,
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
            <Show when={helpVisible()}>
              <ReadingGuide mode="project" />
            </Show>

            <ProjectTimeline />

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
                  <Show when={selectedAgent()}>
                    <AgentDetail />
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
        </span>
      </div>
    </div>
  );
}

function ProjectTimeline() {
  const project = createMemo(() => selectedProjectSnapshot());
  const sessions = createMemo(() => project()?.sessions ?? []);
  const focus = createMemo(() => selectedProjectFocusSnapshot());

  return (
    <Show when={project()}>
      {(currentProject) => (
        <div
          style="display:flex;gap:12px;align-items:stretch;padding:10px 16px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);flex-shrink:0;"
        >
          <div style="min-width:180px;max-width:240px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card);">
            <div style="display:flex;align-items:center;gap:8px;">
              <Icon path={folder} style="width:14px;height:14px;color:var(--text-secondary);" />
              <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
                Project timeline
              </span>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
              <span style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                {currentProject().name}
              </span>
              <span style="font-size:11px;color:var(--text-dim);line-height:1.45;">
                {currentProject().summary
                  ?? `${currentProject().activeSessionCount} active · ${currentProject().sessions.length} sessions`}
              </span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <For each={currentProject().runtimeLabels.slice(0, 3)}>
                {(runtime) => (
                  <span
                    style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);"
                  >
                    {runtime}
                  </span>
                )}
              </For>
            </div>
          </div>

          <Show when={focus()}>
            {(currentFocus) => (
              <div style="min-width:240px;max-width:360px;flex:0 1 340px;display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                  <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                    <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);">
                      {currentFocus().scopeLabel}
                    </span>
                    <span style="font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {currentFocus().breadcrumb}
                    </span>
                  </div>
                  <span style="font-size:10px;padding:2px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);flex-shrink:0;">
                    {currentFocus().eventCount} events
                  </span>
                </div>
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.35;">
                  {currentFocus().headline}
                </span>
                <span style="font-size:11px;color:var(--text-secondary);line-height:1.45;">
                  {currentFocus().subheadline}
                </span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  <button
                    onClick={() => {
                      if (currentFocus().sessionId) {
                        selectSession(currentFocus().sessionId);
                      }
                    }}
                    style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;"
                    title="Focus session"
                  >
                    Session {currentFocus().sessionLabel ?? 'n/a'}
                  </button>
                  <Show when={currentFocus().agentId}>
                    <button
                      onClick={() => {
                        if (currentFocus().agentId) {
                          selectAgent(currentFocus().agentId);
                        }
                      }}
                      style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;"
                      title="Focus agent"
                    >
                      Agent {currentFocus().agentLabel ?? 'n/a'}
                    </button>
                  </Show>
                  <button
                    onClick={() => selectSession(null)}
                    style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-dim);cursor:pointer;"
                    title="Clear session and agent focus"
                  >
                    Clear focus
                  </button>
                </div>
              </div>
            )}
          </Show>

          <div style="flex:1;overflow-x:auto;padding-bottom:2px;">
            <div style="display:flex;gap:8px;min-width:max-content;">
              <For each={sessions()}>
                {(session) => {
                  const isSelected = () => selectedSession() === session.sessionId;
                  const title = () => session.label || session.sessionId;
                  const primaryContext = () =>
                    session.currentAction
                    || session.summary
                    || `${session.activeAgentCount}/${session.agents.length} agents`;
                  const secondaryContext = () =>
                    session.runtimeLabel
                    ? `${session.runtimeLabel} runtime · ${timeAgo(session.lastEventAt)}`
                    : `${timeAgo(session.lastEventAt)} · ${session.eventCount} events`;

                  return (
                    <button
                      onClick={() => selectSession(session.sessionId)}
                      style={[
                        'min-width:210px;max-width:260px;text-align:left;display:flex;flex-direction:column;gap:7px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);cursor:pointer;',
                        'background:var(--bg-card);transition:background 0.15s,border-color 0.15s,transform 0.15s;',
                        isSelected()
                          ? 'border-color:var(--accent);background:var(--bg-elevated);transform:translateY(-1px);'
                          : '',
                      ].join('')}
                      onMouseEnter={(e) => {
                        if (!isSelected()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
                      }}
                    >
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;">
                        <span style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          {title()}
                        </span>
                        <span
                          style={[
                            'font-size:9px;font-weight:600;padding:1px 6px;border-radius:9999px;flex-shrink:0;',
                            session.isActive
                              ? 'background:var(--green-dim);color:var(--green);'
                              : 'background:var(--bg-elevated);color:var(--text-dim);',
                          ].join('')}
                        >
                          {session.isActive ? 'Active' : 'Idle'}
                        </span>
                      </div>
                      <span style="font-size:11px;color:var(--text-secondary);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {primaryContext()}
                      </span>
                      <span style="font-size:10px;color:var(--text-dim);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {secondaryContext()} · {session.sessionId.slice(0, 8)}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}

/** Deduplicate agent badges by displayName, keeping the most active */
function uniqueAgentBadges(p: Project): { name: string; isActive: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const s of p.sessions) {
    for (const a of s.agents) {
      const existing = seen.get(a.displayName);
      if (existing === undefined || a.isActive) {
        seen.set(a.displayName, a.isActive);
      }
    }
  }
  return Array.from(seen, ([name, isActive]) => ({ name, isActive })).slice(0, 6);
}

/** Inline home view — shown when no project selected */
function ProjectsHome() {
  const projectList = createMemo(() => projects());
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
    <div style="padding:32px;max-width:1200px;margin:0 auto;overflow-y:auto;flex:1">
      <Show when={helpVisible()}>
        <ReadingGuide mode="home" />
      </Show>

      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.03em">Projects</h1>
        <span style="font-size:13px;color:var(--text-tertiary)">{projectList().length} projects</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <p style="font-size:14px;font-weight:600;color:var(--text-primary);">
            Nothing selected yet
          </p>
          <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">
            {streamStateText()}
          </span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;">
          {streamStateDetail()}
        </p>
        <p style="font-size:12px;color:var(--text-dim);line-height:1.5;">
          Select a project from the left sidebar to populate the timeline, event stream, and agent graph.
        </p>
      </div>

      <Show when={projectList().length === 0}>
        <div style="display:flex;flex-direction:column;align-items:center;padding:80px 20px;text-align:center;border:1px dashed var(--border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.015),transparent);">
          <p style="font-size:16px;color:var(--text-secondary);margin-bottom:4px">No projects have been captured yet.</p>
          <p style="font-size:13px;color:var(--text-dim)">Open a session and wait for the first snapshot to land here.</p>
        </div>
      </Show>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
        <For each={projectList()}>
          {(p) => (
            <div
              style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:20px;cursor:pointer;transition:border-color 0.15s"
              onMouseOver={(el) => el.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseOut={(el) => el.currentTarget.style.borderColor = 'var(--border)'}
              onClick={() => selectProject(p.name)}
            >
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <Icon path={folder} style="width:16px;height:16px;color:var(--text-secondary);" />
                <span style={`width:8px;height:8px;border-radius:50%;background:${p.isActive ? 'var(--green)' : 'var(--text-dim)'}`} />
                <span style="font-size:15px;font-weight:600">{p.name}</span>
              </div>
              <div style="display:flex;gap:24px;margin-bottom:12px">
                <div>
                  <div style="font-size:20px;font-weight:600">{p.sessions.length}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">sessions</div>
                </div>
                <div>
                  <div style="font-size:20px;font-weight:600">{p.agentCount}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">agents</div>
                </div>
                <div>
                  <div style="font-size:20px;font-weight:600">{p.eventCount}</div>
                  <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">events</div>
                </div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
                <For each={uniqueAgentBadges(p)}>
                  {(badge) => (
                    <span style={`font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:${badge.isActive ? 'var(--green-dim)' : 'var(--bg-elevated)'};color:${badge.isActive ? 'var(--green)' : 'var(--text-secondary)'};display:inline-flex;align-items:center;gap:5px;`}>
                      <Icon path={badge.isActive ? bolt : cpuChip} style="width:11px;height:11px;" />
                      <span>{badge.name}</span>
                    </span>
                  )}
                </For>
              </div>
              <div style="font-size:12px;color:var(--text-tertiary)">
                {p.summary
                  ? p.summary
                  : p.isActive
                    ? 'Active now'
                    : `Last activity ${Math.floor((Date.now() - p.lastEventAt) / 60000)}m ago`}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

type GuideMode = 'home' | 'project';

function ReadingGuide(props: { mode: GuideMode }) {
  const project = createMemo(() => selectedProjectSnapshot());
  const focus = createMemo(() => selectedProjectFocusSnapshot());

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
    <div
      style={[
        'margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;',
        'background:linear-gradient(135deg,rgba(59,130,246,0.10),rgba(255,255,255,0.02));',
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);',
      ].join('')}
    >
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <div style="min-width:0;max-width:840px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent);">
              {content().eyebrow}
            </span>
            <span style="width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px rgba(59,130,246,0.45);" />
          </div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary);line-height:1.35;">
            {content().title}
          </div>
          <div style="margin-top:5px;font-size:12px;line-height:1.55;color:var(--text-secondary);max-width:900px;">
            {content().summary}
          </div>
        </div>

        <button
          onClick={toggleHelpVisible}
          style="background:none;border:1px solid var(--border);border-radius:9999px;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-secondary);flex-shrink:0;transition:border-color 0.15s,color 0.15s,background 0.15s;"
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
        >
          Hide guide
        </button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
        <For each={content().steps}>
          {(step, index) => (
            <div
              style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);min-height:72px;"
            >
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:6px;">
                {index() + 1}
              </div>
              <div style="font-size:12px;line-height:1.5;color:var(--text-primary);">
                {step}
              </div>
            </div>
          )}
        </For>
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
