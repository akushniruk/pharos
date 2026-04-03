<template>
  <div class="project-picker" ref="pickerRef">
    <button
      class="project-picker__trigger"
      @click="isOpen = !isOpen"
      :title="selectedProject ? `Project: ${selectedProject}` : 'All Projects'"
    >
      <span
        v-if="selectedProject"
        class="project-picker__dot"
        :style="{ backgroundColor: getAgentColor(selectedProject) }"
      ></span>
      <span
        v-else
        class="project-picker__dot project-picker__dot--all"
      ></span>
      <span class="project-picker__label">
        {{ selectedProject ? prettifyProjectName(selectedProject) : 'All Projects' }}
      </span>
      <svg
        class="project-picker__chevron"
        :class="{ 'project-picker__chevron--open': isOpen }"
        width="10"
        height="10"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="project-picker__dropdown">
        <!-- All Projects option -->
        <button
          class="project-picker__option"
          :class="{ 'project-picker__option--active': !selectedProject }"
          @click="selectProject(null)"
        >
          <span class="project-picker__dot project-picker__dot--all"></span>
          <span class="project-picker__option-name">All Projects</span>
          <span class="project-picker__option-stats">
            {{ totalEventCount }} events
          </span>
        </button>

        <div v-if="projects.length > 0" class="project-picker__divider"></div>

        <!-- Individual projects -->
        <button
          v-for="project in projects"
          :key="project.name"
          class="project-picker__option"
          :class="{ 'project-picker__option--active': selectedProject === project.name }"
          @click="selectProject(project.name)"
        >
          <span
            class="project-picker__dot"
            :style="{ backgroundColor: getAgentColor(project.name) }"
          ></span>
          <span class="project-picker__option-name" :title="project.name">{{ prettifyProjectName(project.name) }}</span>
          <span class="project-picker__option-stats">
            {{ project.eventCount }} events &middot; {{ project.agentCount }} agents
          </span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { HookEvent } from '../types'
import { getAgentColor } from '../composables/useEventColors'

const props = defineProps<{
  events: HookEvent[]
  selectedProject: string | null
}>()

const emit = defineEmits<{
  'update:selectedProject': [project: string | null]
}>()

const isOpen = ref(false)
const pickerRef = ref<HTMLElement | null>(null)


// Prettify source_app into a readable project name
// e.g. "cc-hook-multi-agent-obvs" → "Cc Hook Multi Agent Obvs"
function prettifyProjectName(name: string): string {
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Compute project list from events
const projects = computed(() => {
  const map = new Map<string, { eventCount: number; agentIds: Set<string> }>()

  for (const event of props.events) {
    const app = event.source_app
    if (!map.has(app)) {
      map.set(app, { eventCount: 0, agentIds: new Set() })
    }
    const entry = map.get(app)!
    entry.eventCount++
    // Build unique agent key from source_app + session_id (+ agent_id if present)
    const suffix = event.agent_id ? event.agent_id.slice(0, 8) : event.session_id.slice(0, 8)
    entry.agentIds.add(`${app}:${suffix}`)
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      eventCount: data.eventCount,
      agentCount: data.agentIds.size,
    }))
    .sort((a, b) => b.eventCount - a.eventCount)
})

const totalEventCount = computed(() => props.events.length)

function selectProject(project: string | null) {
  emit('update:selectedProject', project)
  isOpen.value = false
}

// Close dropdown on outside click
function handleClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.project-picker {
  position: relative;
}

.project-picker__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--theme-border-primary);
  background-color: var(--theme-bg-primary);
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
  max-width: 320px;
}

.project-picker__trigger:hover {
  border-color: var(--theme-border-secondary);
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
}

.project-picker__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.project-picker__dot--all {
  background: conic-gradient(
    #fbbf24 0deg,
    #3b82f6 90deg,
    #22c55e 180deg,
    #ef4444 270deg,
    #fbbf24 360deg
  );
}

.project-picker__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-picker__chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
  opacity: 0.5;
}

.project-picker__chevron--open {
  transform: rotate(180deg);
}

/* Dropdown */
.project-picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 260px;
  max-width: 400px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--theme-border-primary);
  background-color: var(--theme-bg-primary);
  box-shadow: 0 8px 24px -4px var(--theme-shadow-lg);
  z-index: 100;
}

.project-picker__divider {
  height: 1px;
  background-color: var(--theme-border-primary);
  margin: 2px 4px;
}

.project-picker__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  text-align: left;
}

.project-picker__option:hover {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

.project-picker__option--active {
  background-color: var(--theme-bg-tertiary);
  color: var(--theme-text-primary);
}

.project-picker__option-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.project-picker__option-stats {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
}

/* Dropdown transition */
.dropdown-enter-active {
  transition: all 0.15s ease-out;
}

.dropdown-leave-active {
  transition: all 0.1s ease-in;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
