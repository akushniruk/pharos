<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col">
    <!-- Fixed Header -->
    <div class="timeline-header px-4 py-2.5 mobile:py-2 mobile:px-2 border-b border-[var(--theme-border-primary)] relative z-10">
      <!-- Active filter banner (driven by metro sidebar selection) -->
      <div v-if="selectedAgentId" class="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)]">
        <span class="w-2 h-2 rounded-full bg-[var(--theme-text-secondary)] flex-shrink-0"></span>
        <span class="text-xs font-medium text-[var(--theme-text-secondary)]">Filtered to: {{ selectedAgentDisplayName }}</span>
        <button
          @click="emit('clearAgentFilter')"
          class="ml-auto text-[10px] px-1.5 py-0.5 rounded text-[var(--theme-text-quaternary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-colors"
        >Clear</button>
      </div>

      <!-- Search Bar + View Toggle -->
      <div class="w-full flex items-center gap-2">
        <!-- View Mode Toggle -->
        <div class="timeline-toggle-group">
          <button
            class="timeline-toggle-option"
            :class="{ 'timeline-toggle-option--active': viewMode === 'simple' }"
            @click="setViewMode('simple')"
          >Simple</button>
          <button
            class="timeline-toggle-option"
            :class="{ 'timeline-toggle-option--active': viewMode === 'detailed' }"
            @click="setViewMode('detailed')"
          >Detailed</button>
        </div>
        <div class="relative flex-1">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            :value="searchPattern"
            @input="updateSearchPattern(($event.target as HTMLInputElement).value)"
            placeholder="Search events (regex)..."
            :class="[
              'search-input obs-input pl-8 pr-7 py-1.5 text-xs mobile:text-[11px] font-mono-tight',
              searchError ? 'search-input--error' : ''
            ]"
            aria-label="Search events with regex pattern"
          />
          <button
            v-if="searchPattern"
            @click="clearSearch"
            class="search-clear"
            title="Clear search"
            aria-label="Clear search"
          >
            &#x2715;
          </button>
        </div>
        <div
          v-if="searchError"
          class="mt-1 px-2 py-1 bg-[var(--theme-accent-error)]/8 border border-[var(--theme-accent-error)]/30 rounded text-[11px] text-[var(--theme-accent-error)] font-medium"
          role="alert"
        >
          {{ searchError }}
        </div>
      </div>
    </div>

    <!-- Scrollable Event List -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-0 py-0 relative bg-[var(--theme-bg-secondary)]"
      @scroll="handleScroll"
    >
      <!-- Grouped-by-agent view (simple mode) -->
      <div v-if="viewMode === 'simple'" class="event-list" style="padding: 6px;">
        <AgentEventGroup
          v-for="group in groupedByAgent"
          :key="group.key"
          :agent-key="group.key"
          :agent-name="group.name"
          :agent-color="group.color"
          :events="group.events"
          :default-expanded="groupedByAgent.length === 1"
        />
      </div>
      <!-- Detailed view -->
      <TransitionGroup
        v-else
        name="event"
        tag="div"
        class="event-list"
      >
        <EventRow
          v-for="(event, index) in filteredEvents"
          :key="`${event.id}-${event.timestamp}`"
          :event="event"
          :gradient-class="getGradientForSession(event.session_id)"
          :color-class="getColorForSession(event.session_id)"
          :app-gradient-class="getGradientForApp(event.source_app)"
          :app-color-class="getColorForApp(event.source_app)"
          :app-hex-color="getAgentColor(event.source_app)"
          :row-index="index"
        />
      </TransitionGroup>

      <div v-if="filteredEvents.length === 0" class="empty-state">
        <p class="empty-state__text">No events yet</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { HookEvent } from '../types';
import EventRow from './EventRow.vue';
import AgentEventGroup from './AgentEventGroup.vue';
import { useEventColors, getAgentColor } from '../composables/useEventColors';
import { useEventSearch } from '../composables/useEventSearch';
import { useAgentRegistry } from '../composables/useAgentRegistry';

const props = defineProps<{
  events: HookEvent[];
  stickToBottom: boolean;
  uniqueAppNames?: string[]; // Agent IDs (app:session) active in current time window
  allAppNames?: string[]; // All agent IDs (app:session) ever seen in session
  selectedAgentId?: string | null; // Metro sidebar selection filter
}>();

const emit = defineEmits<{
  'update:stickToBottom': [value: boolean];
  selectAgent: [agentName: string];
  clearAgentFilter: [];
}>();

const scrollContainer = ref<HTMLElement>();
const { getGradientForSession, getColorForSession, getGradientForApp, getColorForApp } = useEventColors();
const { searchPattern, searchError, searchEvents, updateSearchPattern, clearSearch } = useEventSearch();
const { findAgent } = useAgentRegistry();

// Resolve raw agent ID to a friendly display name
const selectedAgentDisplayName = computed(() => {
  if (!props.selectedAgentId) return ''

  // Try agent registry first (most reliable)
  const registryAgent = findAgent(props.selectedAgentId)
  if (registryAgent?.display_name) return registryAgent.display_name

  // Try events
  for (const event of props.events) {
    const key = event.agent_id
      ? `${event.source_app}:${event.agent_id.slice(0, 8)}`
      : `${event.source_app}:${(event.session_id || '').slice(0, 8)}`
    if (key === props.selectedAgentId) {
      if (event.display_name) return event.display_name
      if (event.agent_name) return event.agent_name
    }
  }

  // Check if this is the main agent (no agent_id on matching events)
  const matchingEvents = props.events.filter(e => {
    const key = e.agent_id
      ? `${e.source_app}:${e.agent_id.slice(0, 8)}`
      : `${e.source_app}:${(e.session_id || '').slice(0, 8)}`
    return key === props.selectedAgentId
  })
  if (matchingEvents.length > 0 && !matchingEvents.some(e => e.agent_id)) {
    return 'Orchestrator'
  }

  // Last resort: prettify the ID
  const parts = props.selectedAgentId.split(':')
  return parts[0] || props.selectedAgentId
})

// View mode: simple (default) or detailed, persisted in localStorage
const STORAGE_KEY = 'pharos-log-view-mode';
const storedMode = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const viewMode = ref<'simple' | 'detailed'>((storedMode === 'simple' || storedMode === 'detailed') ? storedMode : 'detailed');

const setViewMode = (mode: 'simple' | 'detailed') => {
  viewMode.value = mode;
  localStorage.setItem(STORAGE_KEY, mode);
};

const filteredEvents = computed(() => {
  // Filter panel filters (sourceApp, sessionId, eventType, agentType) are already
  // applied at the App.vue root level, so props.events is pre-filtered.
  let filtered = props.events.filter(event => {
    // Metro sidebar agent filter
    if (props.selectedAgentId) {
      const eventAgentKey = event.agent_id
        ? `${event.source_app}:${event.agent_id.slice(0, 8)}`
        : `${event.source_app}:${event.session_id.slice(0, 8)}`;
      if (eventAgentKey !== props.selectedAgentId) {
        return false;
      }
    }
    return true;
  });

  // Apply regex search filter
  if (searchPattern.value) {
    filtered = searchEvents(filtered, searchPattern.value);
  }

  // Newest first
  return filtered.slice().reverse();
});

// Resolve a friendly name from all events in a group
function resolveGroupName(events: HookEvent[], fallback: string): string {
  // Check all events for a display name, agent name, or description
  for (const e of events) {
    if (e.display_name) return e.display_name
    if (e.agent_name) return e.agent_name
  }
  for (const e of events) {
    if (e.description) {
      const desc = String(e.description).split(/[.\n]/)[0].slice(0, 40)
      return desc
    }
  }
  // Fallback to agent_type prettified
  for (const e of events) {
    if (e.agent_type) {
      const typeMap: Record<string, string> = {
        'builder': 'Engineer', 'Explore': 'Explorer', 'Plan': 'Architect',
        'general-purpose': 'Agent', 'security-scanning:security-auditor': 'Security',
        'comprehensive-review:code-reviewer': 'Reviewer',
      }
      return typeMap[e.agent_type] || e.agent_type.split(/[-_:]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
  }
  // If no agent_id on any event, this is the main/orchestrator agent
  const hasAgentId = events.some(e => e.agent_id)
  if (!hasAgentId) return 'Orchestrator'

  // Last resort: use source_app
  return fallback
}

// Grouped-by-agent view for simple mode
const groupedByAgent = computed(() => {
  if (viewMode.value !== 'simple') return [];
  // First pass: group events by agent key
  const groups = new Map<string, { fallback: string; color: string; events: HookEvent[] }>();
  for (const event of filteredEvents.value) {
    const key = event.agent_id
      ? `${event.source_app}:${event.agent_id.slice(0, 8)}`
      : `${event.source_app}:${(event.session_id || '').slice(0, 8)}`;
    if (!groups.has(key)) {
      const color = getAgentColor(key);
      groups.set(key, { fallback: event.source_app, color, events: [] });
    }
    groups.get(key)!.events.push(event);
  }
  // Second pass: resolve names from all events in each group
  return Array.from(groups.entries()).map(([key, g]) => ({
    key,
    name: resolveGroupName(g.events, g.fallback),
    color: g.color,
    events: g.events,
  }));
});

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const handleScroll = () => {
  if (!scrollContainer.value) return;

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

  if (isAtBottom !== props.stickToBottom) {
    emit('update:stickToBottom', isAtBottom);
  }
};

watch(() => props.events.length, async () => {
  if (props.stickToBottom) {
    await nextTick();
    scrollToBottom();
  }
});

watch(() => props.stickToBottom, (shouldStick) => {
  if (shouldStick) {
    scrollToBottom();
  }
});
</script>

<style scoped>
/* Header */
.timeline-header {
  background-color: var(--theme-bg-primary);
}

/* Agent pills - subtle, understated chips */
.agent-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-text-secondary);
  background: transparent;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
  line-height: 1.4;
}

.agent-pill:hover {
  border-color: var(--theme-border-tertiary);
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

.agent-pill--inactive {
  opacity: 0.5;
}

.agent-pill--inactive:hover {
  opacity: 0.75;
}

.agent-pill__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* View mode toggle (matches MetroSidebar segmented pill pattern) */
.timeline-toggle-group {
  display: flex;
  border-radius: 6px;
  border: 1px solid var(--theme-border-primary);
  background-color: var(--theme-bg-primary);
  overflow: hidden;
  flex-shrink: 0;
}

.timeline-toggle-option {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  color: var(--theme-text-quaternary);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
}

.timeline-toggle-option:hover {
  color: var(--theme-text-secondary);
}

.timeline-toggle-option--active {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
}

/* Search */
.search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--theme-text-quaternary);
  pointer-events: none;
}

.search-input {
  background-color: var(--theme-bg-secondary);
  border-color: var(--theme-border-primary);
}

.search-input:focus {
  border-color: var(--theme-border-tertiary);
  background-color: var(--theme-bg-primary);
}

.search-input--error {
  border-color: var(--theme-accent-error);
}

.search-input--error:focus {
  border-color: var(--theme-accent-error);
}

.search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--theme-text-quaternary);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
  line-height: 1;
  transition: color 0.12s ease;
}

.search-clear:hover {
  color: var(--theme-text-primary);
}

/* Event list */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* Empty state */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

.empty-state__text {
  font-size: 13px;
  color: var(--theme-text-quaternary);
}

/* Transition animations */
.event-enter-active {
  transition: all 0.15s ease-out;
}

.event-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.event-leave-active {
  transition: all 0.1s ease-in;
}

.event-leave-to {
  opacity: 0;
}
</style>
