import { Show, For, onMount, createSignal } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { listBullet, share } from 'solid-heroicons/solid';
import { selectedProject, selectedAgent, projects, selectProject, filteredEvents } from './lib/store';
import { connected, connectWs, fetchAgents } from './lib/ws';
import { initTheme } from './lib/theme';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EventStream from './components/EventStream';
import AgentGraph from './components/AgentGraph';
import AgentDetail from './components/AgentDetail';

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
    fetchAgents();
    initTheme();
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
            <Show when={viewMode() === 'logs'} fallback={
              <div style="display:flex;flex:1;overflow:hidden;">
                <AgentGraph />
                <Show when={selectedAgent()}>
                  <AgentDetail />
                </Show>
              </div>
            }>
              <EventStream />
            </Show>
          </Show>
        </div>
      </div>

      {/* Status bar */}
      <div class="app-statusbar">
        <div style="display:flex;align-items:center;gap:6px">
          <span class={`status-dot ${connected() ? 'connected' : 'disconnected'}`} />
          <span>{connected() ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span>
          {filteredEvents().length} events
          {selectedProject() ? ` · ${selectedProject()}` : ''}
        </span>
      </div>
    </div>
  );
}

import type { Project } from './lib/types';

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
  return (
    <div style="padding:32px;max-width:1200px;margin:0 auto;overflow-y:auto;flex:1">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.03em">Projects</h1>
        <span style="font-size:13px;color:var(--text-tertiary)">{projects().length} projects</span>
      </div>

      <Show when={projects().length === 0}>
        <div style="display:flex;flex-direction:column;align-items:center;padding:80px 20px;text-align:center">
          <p style="font-size:16px;color:var(--text-secondary);margin-bottom:4px">Waiting for agent sessions...</p>
          <p style="font-size:13px;color:var(--text-dim)">Start Claude or another AI agent in any folder</p>
        </div>
      </Show>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
        <For each={projects()}>
          {(p) => (
            <div
              style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:20px;cursor:pointer;transition:border-color 0.15s"
              onMouseOver={(el) => el.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseOut={(el) => el.currentTarget.style.borderColor = 'var(--border)'}
              onClick={() => selectProject(p.name)}
            >
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
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
                    <span style={`font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:${badge.isActive ? 'var(--green-dim)' : 'var(--bg-elevated)'};color:${badge.isActive ? 'var(--green)' : 'var(--text-secondary)'}`}>
                      {badge.name}
                    </span>
                  )}
                </For>
              </div>
              <div style="font-size:12px;color:var(--text-tertiary)">
                {p.isActive ? 'Active now' : `Last activity ${Math.floor((Date.now() - p.lastEventAt) / 60000)}m ago`}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
