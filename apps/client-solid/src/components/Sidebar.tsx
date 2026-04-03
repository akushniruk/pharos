import { For, Show, createMemo } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { chevronLeft, chevronRight, commandLine, folder, folderOpen, bolt, clock } from 'solid-heroicons/solid';
import { projects, selectedProject, selectedSession, selectProject, selectSession } from '../lib/store';
import { getAgentColor } from '../lib/colors';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const selectedProjectSessions = createMemo(() => {
    const proj = selectedProject();
    if (!proj) return [];
    return projects().find(p => p.name === proj)?.sessions ?? [];
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

  return (
    <Show
      when={!props.collapsed}
      fallback={
        /* Collapsed: 40px bar with dots + toggle */
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
          <For each={projects()}>
            {(p) => (
              <span
                title={p.name}
                style={`width:6px;height:6px;border-radius:50%;display:block;flex-shrink:0;background:${p.isActive ? 'var(--green)' : 'var(--text-dim)'};${p.isActive ? 'box-shadow:0 0 6px var(--green);' : ''}cursor:pointer;`}
                onClick={() => selectProject(p.name)}
              />
            )}
          </For>
        </div>
      }
    >
      {/* Expanded sidebar */}
      <div
        style="width:220px;flex-shrink:0;background:var(--bg-primary);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;"
      >
        {/* Toggle + Projects header */}
        <div style="display:flex;align-items:center;justify-content:space-between;padding-right:8px;">
          <span style={labelStyle}>Projects</span>
          <button
            onClick={props.onToggle}
            title="Collapse sidebar"
            style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:4px;line-height:1;display:flex;align-items:center;justify-content:center;"
          >
            <Icon path={chevronLeft} style="width:12px;height:12px;" />
          </button>
        </div>

        {/* Project list */}
        <div style="overflow-y:auto;flex:1;">
          <For each={projects()}>
            {(p) => {
              const isSelected = () => selectedProject() === p.name;
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
                    <Icon
                      path={isSelected() ? folderOpen : folder}
                      style="width:13px;height:13px;color:var(--text-secondary);flex-shrink:0;"
                    />
                    {/* Active dot */}
                    <span style={`width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${p.isActive ? 'var(--green)' : 'var(--text-dim)'};${p.isActive ? 'box-shadow:0 0 6px var(--green);' : ''}`} />
                    {/* Name */}
                    <span style="font-size:12px;font-weight:500;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      {p.name}
                    </span>
                    {/* Event count */}
                    <span style="font-size:10px;color:var(--text-dim);flex-shrink:0;">{p.eventCount}</span>
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
                            {type}
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
                const isSelected = () => selectedSession() === s.sessionId;
                const shortId = s.sessionId.slice(0, 8);
                const statusIcon = () => (s.isActive ? bolt : clock);
                return (
                  <div
                    onClick={() => selectSession(s.sessionId)}
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
                  >
                    <Icon path={commandLine} style="width:12px;height:12px;color:var(--text-secondary);flex-shrink:0;" />
                    <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;">
                      <span style="font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {s.label}
                      </span>
                      <span style="font-size:10px;font-family:var(--font-mono);color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        {shortId}
                      </span>
                    </div>
                    {/* Active/Idle badge */}
                    <div style={[
                      'display:flex;align-items:center;gap:4px;font-size:9px;padding:1px 5px;border-radius:9999px;font-weight:500;flex-shrink:0;',
                      s.isActive
                        ? 'background:var(--green-dim);color:var(--green);'
                        : 'background:var(--bg-elevated);color:var(--text-dim);',
                    ].join('')}>
                      <Icon path={statusIcon()} style="width:10px;height:10px;" />
                      <span>{s.isActive ? 'Active' : 'Idle'}</span>
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
