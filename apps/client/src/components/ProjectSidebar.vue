<template>
  <aside
    class="project-sidebar"
    :class="{ 'project-sidebar--collapsed': collapsed }"
  >
    <!-- Collapsed state: thin bar with expand arrow -->
    <div v-if="collapsed" class="project-sidebar__collapsed-content">
      <button
        class="project-sidebar__toggle"
        @click="emit('update:collapsed', false)"
        title="Expand sidebar"
      >
        <svg class="project-sidebar__toggle-icon project-sidebar__toggle-icon--collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <!-- Collapsed project dots -->
      <div class="project-sidebar__collapsed-dots">
        <div
          v-for="project in projectTree"
          :key="project.name"
          class="project-sidebar__collapsed-dot"
          :class="{ 'project-sidebar__collapsed-dot--active': project.isActive }"
          :title="`${project.name} (${project.eventCount} events)`"
          @click="handleProjectClick(project.name)"
        ></div>
      </div>
    </div>

    <!-- Expanded state -->
    <div v-else class="project-sidebar__content">
      <!-- Header -->
      <div class="project-sidebar__header">
        <span class="project-sidebar__label">PROJECTS</span>
        <button
          class="project-sidebar__collapse-btn"
          @click="emit('update:collapsed', true)"
          title="Collapse sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <!-- Scrollable tree -->
      <div class="project-sidebar__tree">
        <!-- Project items -->
        <div
          v-for="project in projectTree"
          :key="project.name"
          class="project-sidebar__project"
        >
          <!-- Project row -->
          <button
            class="project-sidebar__project-row"
            :class="{
              'project-sidebar__project-row--selected': selectedProject === project.name,
            }"
            @click="handleProjectClick(project.name)"
          >
            <!-- Expand/collapse chevron -->
            <svg
              class="project-sidebar__chevron"
              :class="{ 'project-sidebar__chevron--expanded': expandedProjects.has(project.name) }"
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              @click.stop="toggleProjectExpand(project.name)"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>

            <!-- Active dot -->
            <span
              class="project-sidebar__activity-dot"
              :class="project.isActive ? 'project-sidebar__activity-dot--active' : 'project-sidebar__activity-dot--idle'"
            ></span>

            <!-- Project name -->
            <span class="project-sidebar__project-name">{{ project.name }}</span>

            <!-- Stats -->
            <span class="project-sidebar__project-stats">
              {{ project.eventCount }}
            </span>
          </button>

          <!-- Sessions (expandable) -->
          <Transition name="expand">
            <div
              v-if="expandedProjects.has(project.name)"
              class="project-sidebar__sessions"
            >
              <div
                v-for="session in project.sessions"
                :key="session.sessionId"
                class="project-sidebar__session"
              >
                <!-- Session row -->
                <button
                  class="project-sidebar__session-row"
                  :class="{
                    'project-sidebar__session-row--selected': selectedSession === session.sessionId,
                  }"
                  @click="handleSessionClick(session.sessionId)"
                >
                  <!-- Expand/collapse chevron for agents -->
                  <svg
                    v-if="session.agents.length > 0"
                    class="project-sidebar__chevron"
                    :class="{ 'project-sidebar__chevron--expanded': expandedSessions.has(session.sessionId) }"
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    @click.stop="toggleSessionExpand(session.sessionId)"
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <span v-else class="project-sidebar__chevron-spacer"></span>

                  <!-- Session ID (truncated) -->
                  <span class="project-sidebar__session-id">{{ session.sessionId.slice(0, 8) }}</span>

                  <!-- Status badge -->
                  <span
                    class="project-sidebar__status-badge"
                    :class="session.isActive ? 'project-sidebar__status-badge--active' : 'project-sidebar__status-badge--idle'"
                  >
                    {{ session.isActive ? 'Active' : 'Idle' }}
                  </span>

                  <!-- Event count -->
                  <span class="project-sidebar__session-count">{{ session.eventCount }}</span>
                </button>

                <!-- Agents (expandable under session) -->
                <Transition name="expand">
                  <div
                    v-if="expandedSessions.has(session.sessionId) && session.agents.length > 0"
                    class="project-sidebar__agents"
                  >
                    <div
                      v-for="agent in session.agents"
                      :key="agent.agentKey"
                      class="project-sidebar__agent-row"
                    >
                      <span class="project-sidebar__agent-dot"></span>
                      <span class="project-sidebar__agent-name">{{ agent.displayName }}</span>
                      <span class="project-sidebar__agent-count">{{ agent.eventCount }}</span>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Empty state -->
        <div v-if="projectTree.length === 0" class="project-sidebar__empty">
          No events yet
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HookEvent } from '../types'

interface AgentInfo {
  agentKey: string
  displayName: string
  eventCount: number
}

interface SessionInfo {
  sessionId: string
  eventCount: number
  lastEventTime: number
  isActive: boolean
  agents: AgentInfo[]
}

interface ProjectInfo {
  name: string
  eventCount: number
  activeSessions: number
  lastEventTime: number
  isActive: boolean
  sessions: SessionInfo[]
}

const props = defineProps<{
  events: HookEvent[]
  selectedProject: string | null
  selectedSession: string | null
  collapsed: boolean
}>()

const emit = defineEmits<{
  'update:selectedProject': [project: string | null]
  'update:selectedSession': [session: string | null]
  'update:collapsed': [collapsed: boolean]
}>()

// Local expand/collapse state
const expandedProjects = ref<Set<string>>(new Set())
const expandedSessions = ref<Set<string>>(new Set())

// Active threshold: 30 seconds
const ACTIVE_THRESHOLD_MS = 30_000

// Derive the full project -> session -> agent tree from events
const projectTree = computed<ProjectInfo[]>(() => {
  const now = Date.now()
  const projectMap = new Map<string, {
    eventCount: number
    lastEventTime: number
    sessions: Map<string, {
      eventCount: number
      lastEventTime: number
      agents: Map<string, {
        displayName: string
        eventCount: number
      }>
    }>
  }>()

  for (const event of props.events) {
    const app = event.source_app
    const sid = event.session_id
    const ts = event.timestamp || 0

    // Project level
    if (!projectMap.has(app)) {
      projectMap.set(app, {
        eventCount: 0,
        lastEventTime: 0,
        sessions: new Map(),
      })
    }
    const project = projectMap.get(app)!
    project.eventCount++
    if (ts > project.lastEventTime) project.lastEventTime = ts

    // Session level
    if (!project.sessions.has(sid)) {
      project.sessions.set(sid, {
        eventCount: 0,
        lastEventTime: 0,
        agents: new Map(),
      })
    }
    const session = project.sessions.get(sid)!
    session.eventCount++
    if (ts > session.lastEventTime) session.lastEventTime = ts

    // Agent level
    const agentKey = event.agent_id
      ? `${app}:${sid}:${event.agent_id}`
      : `${app}:${sid}:orchestrator`
    const displayName = event.display_name || event.agent_name || event.agent_id || 'Orchestrator'

    if (!session.agents.has(agentKey)) {
      session.agents.set(agentKey, {
        displayName,
        eventCount: 0,
      })
    }
    const agent = session.agents.get(agentKey)!
    agent.eventCount++
    // Update display name if a better one comes along
    if (event.display_name) {
      agent.displayName = event.display_name
    }
  }

  // Convert map to sorted array
  const result: ProjectInfo[] = []

  for (const [name, pData] of projectMap) {
    const sessions: SessionInfo[] = []

    for (const [sid, sData] of pData.sessions) {
      const agents: AgentInfo[] = Array.from(sData.agents.entries())
        .map(([agentKey, aData]) => ({
          agentKey,
          displayName: aData.displayName,
          eventCount: aData.eventCount,
        }))
        .sort((a, b) => b.eventCount - a.eventCount)

      sessions.push({
        sessionId: sid,
        eventCount: sData.eventCount,
        lastEventTime: sData.lastEventTime,
        isActive: (now - sData.lastEventTime) < ACTIVE_THRESHOLD_MS,
        agents,
      })
    }

    // Sort sessions by most recent event
    sessions.sort((a, b) => b.lastEventTime - a.lastEventTime)

    const activeSessions = sessions.filter(s => s.isActive).length

    result.push({
      name,
      eventCount: pData.eventCount,
      activeSessions,
      lastEventTime: pData.lastEventTime,
      isActive: (now - pData.lastEventTime) < ACTIVE_THRESHOLD_MS,
      sessions,
    })
  }

  // Sort projects by most recent event
  result.sort((a, b) => b.lastEventTime - a.lastEventTime)

  return result
})

// Toggle project expand/collapse
function toggleProjectExpand(projectName: string) {
  const set = new Set(expandedProjects.value)
  if (set.has(projectName)) {
    set.delete(projectName)
  } else {
    set.add(projectName)
  }
  expandedProjects.value = set
}

// Toggle session expand/collapse
function toggleSessionExpand(sessionId: string) {
  const set = new Set(expandedSessions.value)
  if (set.has(sessionId)) {
    set.delete(sessionId)
  } else {
    set.add(sessionId)
  }
  expandedSessions.value = set
}

// Handle project click: select/deselect as filter, auto-expand
function handleProjectClick(projectName: string) {
  if (props.selectedProject === projectName) {
    // Deselect
    emit('update:selectedProject', null)
    emit('update:selectedSession', null)
  } else {
    emit('update:selectedProject', projectName)
    emit('update:selectedSession', null)
    // Auto-expand
    if (!expandedProjects.value.has(projectName)) {
      toggleProjectExpand(projectName)
    }
  }
}

// Handle session click: select/deselect as filter, auto-expand
function handleSessionClick(sessionId: string) {
  if (props.selectedSession === sessionId) {
    // Deselect
    emit('update:selectedSession', null)
  } else {
    emit('update:selectedSession', sessionId)
    // Auto-expand agents
    if (!expandedSessions.value.has(sessionId)) {
      toggleSessionExpand(sessionId)
    }
  }
}
</script>

<style scoped>
/* ---- Root ---- */
.project-sidebar {
  position: relative;
  width: 280px;
  min-width: 280px;
  height: 100%;
  background-color: var(--theme-bg-primary);
  border-right: 1px solid var(--theme-border-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow: hidden;
}

.project-sidebar--collapsed {
  width: 40px;
  min-width: 40px;
}

/* ---- Collapsed state ---- */
.project-sidebar__collapsed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8px;
  gap: 8px;
}

.project-sidebar__toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--theme-text-tertiary);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  padding: 0;
}

.project-sidebar__toggle:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
  border-color: var(--theme-border-primary);
}

.project-sidebar__toggle-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.project-sidebar__toggle-icon--collapsed {
  transform: rotate(180deg);
}

.project-sidebar__collapsed-dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.project-sidebar__collapsed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--theme-text-quaternary);
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.project-sidebar__collapsed-dot:hover {
  transform: scale(1.4);
}

.project-sidebar__collapsed-dot--active {
  background-color: var(--theme-accent-success);
}

/* ---- Expanded content ---- */
.project-sidebar__content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ---- Header ---- */
.project-sidebar__header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--theme-border-primary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-sidebar__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.project-sidebar__collapse-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--theme-text-tertiary);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  padding: 0;
  flex-shrink: 0;
}

.project-sidebar__collapse-btn:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
  border-color: var(--theme-border-primary);
}

/* ---- Tree area ---- */
.project-sidebar__tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

/* ---- Project row ---- */
.project-sidebar__project-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: none;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  text-align: left;
}

.project-sidebar__project-row:hover {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

.project-sidebar__project-row--selected {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
  border-left: 2px solid var(--theme-accent-primary);
  padding-left: 10px;
}

/* ---- Chevron ---- */
.project-sidebar__chevron {
  flex-shrink: 0;
  color: var(--theme-text-quaternary);
  transition: transform 0.15s ease;
  cursor: pointer;
}

.project-sidebar__chevron--expanded {
  transform: rotate(90deg);
}

.project-sidebar__chevron-spacer {
  width: 10px;
  flex-shrink: 0;
}

/* ---- Activity dot ---- */
.project-sidebar__activity-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.project-sidebar__activity-dot--active {
  background-color: var(--theme-accent-success);
}

.project-sidebar__activity-dot--idle {
  background-color: var(--theme-text-quaternary);
}

/* ---- Project name & stats ---- */
.project-sidebar__project-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-sidebar__project-stats {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

/* ---- Sessions container ---- */
.project-sidebar__sessions {
  border-left: 1px solid var(--theme-border-primary);
  margin-left: 20px;
}

/* ---- Session row ---- */
.project-sidebar__session-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 10px 4px 8px;
  border: none;
  background: none;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  text-align: left;
}

.project-sidebar__session-row:hover {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

.project-sidebar__session-row--selected {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

/* ---- Session ID (monospace) ---- */
.project-sidebar__session-id {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--theme-text-secondary);
  letter-spacing: -0.02em;
}

/* ---- Status badge ---- */
.project-sidebar__status-badge {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: 3px;
  line-height: 1.4;
}

.project-sidebar__status-badge--active {
  color: var(--theme-accent-success);
  background-color: color-mix(in srgb, var(--theme-accent-success) 12%, transparent);
}

.project-sidebar__status-badge--idle {
  color: var(--theme-text-quaternary);
  background-color: color-mix(in srgb, var(--theme-text-quaternary) 10%, transparent);
}

/* ---- Session count ---- */
.project-sidebar__session-count {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 10px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

/* ---- Agents container ---- */
.project-sidebar__agents {
  border-left: 1px solid var(--theme-border-primary);
  margin-left: 18px;
  padding: 2px 0;
}

/* ---- Agent row ---- */
.project-sidebar__agent-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 10px;
  font-size: 11px;
  color: var(--theme-text-tertiary);
}

.project-sidebar__agent-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--theme-text-quaternary);
  flex-shrink: 0;
}

.project-sidebar__agent-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-sidebar__agent-count {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 10px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

/* ---- Empty state ---- */
.project-sidebar__empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 11px;
  color: var(--theme-text-quaternary);
}

/* ---- Expand/collapse transition ---- */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
