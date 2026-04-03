<template>
  <div class="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
    <!-- Header (full width) -->
    <header class="app-header scanline short:hidden">
      <div class="app-header__inner">
        <!-- Left: Brand -->
        <div class="app-header__brand">
          <span class="app-header__title">Pharos</span>
        </div>

        <!-- Center: spacer (project selection moved to sidebar) -->
        <div></div>

        <!-- Right: Controls -->
        <div class="app-header__controls">
          <!-- Clear button (trash) -->
          <button
            v-if="!confirmingClear"
            @click="confirmingClear = true"
            class="app-icon-btn"
            title="Clear events"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2.5 4.5h11M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5M6.5 7v4M9.5 7v4M3.5 4.5l.5 8a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5l.5-8" />
            </svg>
          </button>
          <!-- Inline clear confirmation -->
          <span v-else class="app-header__confirm">
            <span class="app-header__confirm-label">Clear?</span>
            <button
              @click="handleClearConfirm"
              class="app-header__confirm-yes"
            >Yes</button>
            <button
              @click="confirmingClear = false"
              class="app-header__confirm-no"
            >No</button>
          </span>

          <!-- Filters toggle (funnel) -->
          <button
            @click="showFilters = !showFilters"
            class="app-icon-btn"
            :class="{ 'app-icon-btn--active': showFilters }"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3.5h12M4 7.5h8M6 11.5h4" />
            </svg>
          </button>

          <!-- Notification settings (bell) -->
          <button
            @click="showNotificationSettings = !showNotificationSettings"
            class="app-icon-btn"
            :class="{ 'app-icon-btn--active': showNotificationSettings }"
            title="Notification settings"
            style="position: relative;"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 1.5a4 4 0 014 4c0 4 1.5 5 1.5 5H2.5s1.5-1 1.5-5a4 4 0 014-4zM6.5 12.5a1.5 1.5 0 003 0" />
            </svg>
            <span
              v-if="notifPermission !== 'granted'"
              class="app-notif-badge"
            ></span>
          </button>

          <!-- Theme toggle (sun/moon) -->
          <button
            @click="handleThemeToggle"
            class="app-icon-btn"
            :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="isDarkMode" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5v1M8 13.5v1M3.4 3.4l.7.7M11.9 11.9l.7.7M1.5 8h1M13.5 8h1M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
            </svg>
            <svg v-else width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13.5 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Sidebar + Content row -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Project Sidebar (left) -->
      <ProjectSidebar
        :events="events"
        :selected-project="selectedProject"
        :selected-session="selectedSession"
        :collapsed="sidebarCollapsed"
        @update:selected-project="selectedProject = $event"
        @update:selected-session="selectedSession = $event"
        @update:collapsed="sidebarCollapsed = $event"
      />

      <!-- Main Content (right, takes remaining space) -->
      <div class="flex-1 flex flex-col overflow-hidden">

    <!-- Filters (smooth slide) -->
    <Transition name="slide-down">
      <FilterPanel
        v-if="showFilters"
        class="short:hidden"
        :filters="filters"
        @update:filters="filters = $event"
      />
    </Transition>

    <!-- Live Pulse Chart -->
    <LivePulseChart
      :events="filteredEvents"
      @update-unique-apps="uniqueAppNames = $event"
      @update-all-apps="allAppNames = $event"
      @update-time-range="currentTimeRange = $event"
    />

    <!-- Agent Swim Lane Container -->
    <div v-if="selectedAgentLanes.length > 0" class="w-full bg-[var(--theme-bg-secondary)] px-3 py-2 mobile:px-2 mobile:py-1.5 overflow-hidden border-t border-[var(--theme-border-primary)]">
      <AgentSwimLaneContainer
        :selected-agents="selectedAgentLanes"
        :events="filteredEvents"
        :time-range="currentTimeRange"
        @update:selected-agents="selectedAgentLanes = $event"
      />
    </div>

    <!-- Timeline -->
    <div class="flex flex-col flex-1 overflow-hidden">
      <EventTimeline
        :events="filteredEvents"
        :unique-app-names="uniqueAppNames"
        :all-app-names="allAppNames"
        :selected-agent-id="selectedMetroAgent"
        v-model:stick-to-bottom="stickToBottom"
        @select-agent="toggleAgentLane"
        @clear-agent-filter="clearMetroFilter"
      />
    </div>

    <!-- Error toast -->
    <Transition name="toast-error">
      <div
        v-if="error"
        class="fixed bottom-4 right-4 mobile:bottom-3 mobile:left-3 mobile:right-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] text-xs text-[var(--theme-text-secondary)]"
        style="box-shadow: 0 4px 12px -2px var(--theme-shadow-lg);"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--theme-accent-error)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3M8 10.5v.5" />
        </svg>
        <span>{{ error }}</span>
      </div>
    </Transition>

    <!-- Toast Notifications -->
    <ToastNotification
      v-for="(toast, index) in toasts"
      :key="toast.id"
      :index="index"
      :agent-name="toast.agentName"
      :agent-color="toast.agentColor"
      @dismiss="dismissToast(toast.id)"
    />
    <!-- Notification Settings Modal -->
    <NotificationSettings
      :is-open="showNotificationSettings"
      @close="showNotificationSettings = false"
    />

      </div><!-- end main content -->
    </div><!-- end sidebar + content row -->

    <!-- Status bar (bottom, full width) -->
    <div class="app-statusbar">
      <div class="app-statusbar__left">
        <span
          class="app-statusbar__dot"
          :class="isConnected ? 'app-statusbar__dot--connected' : 'app-statusbar__dot--disconnected'"
        ></span>
        <span class="app-statusbar__text">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>
      <span class="app-statusbar__text">{{ filteredEvents.length }} events</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { TimeRange } from './types';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useEventColors } from './composables/useEventColors';
import { useAgentSelection } from './composables/useAgentSelection';
import { useAgentRegistry } from './composables/useAgentRegistry';
import { useNotifications } from './composables/useNotifications';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import ToastNotification from './components/ToastNotification.vue';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer.vue';
import ProjectSidebar from './components/ProjectSidebar.vue';
import NotificationSettings from './components/NotificationSettings.vue';
import { WS_URL } from './config';

// WebSocket connection
const { events, isConnected, error, clearEvents, onMessageType } = useWebSocket(WS_URL);

// Notifications
const { notify: notifyEvent, permission: notifPermission } = useNotifications();

// Agent registry
const { fetchRegistry, handleRegistryUpdate } = useAgentRegistry();

// Subscribe to agent_registry WebSocket messages
onMessageType('agent_registry', (data) => {
  handleRegistryUpdate(data)
});

// Fetch initial registry on mount
onMounted(() => {
  fetchRegistry()
});

// Theme management (sets up theme system)
const { state: themeState, setTheme } = useThemes();

// Event colors
const { getHexColorForApp } = useEventColors();

// Project + session selection
const selectedProject = ref<string | null>(null);
const selectedSession = ref<string | null>(null);

// Filters (moved before filteredEvents so the computed can reference them)
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: '',
  agentType: ''
});

// Filtered events based on selected project AND filter panel
const filteredEvents = computed(() => {
  let result = events.value;

  // Apply project sidebar filter (source_app level)
  if (selectedProject.value) {
    result = result.filter(e => e.source_app === selectedProject.value);
  }

  // Apply session filter
  if (selectedSession.value) {
    result = result.filter(e => e.session_id === selectedSession.value);
  }

  // Apply filter panel filters
  const f = filters.value;
  if (f.sourceApp) {
    result = result.filter(e => e.source_app === f.sourceApp);
  }
  if (f.sessionId) {
    result = result.filter(e => e.session_id === f.sessionId);
  }
  if (f.eventType) {
    result = result.filter(e => e.hook_event_type === f.eventType);
  }
  if (f.agentType) {
    result = result.filter(e => (e.agent_type || '') === f.agentType);
  }

  return result;
});

// Agent selection (for timeline filtering)
const { selectedAgentId: selectedMetroAgent, clearSelection: clearMetroFilter } = useAgentSelection();

// Sidebar / modal state
const sidebarCollapsed = ref(false);


// UI state
const stickToBottom = ref(true);
const showFilters = ref(false);
const showNotificationSettings = ref(false);
const confirmingClear = ref(false);
const uniqueAppNames = ref<string[]>([]); // Apps active in current time window
const allAppNames = ref<string[]>([]); // All apps ever seen in session
const selectedAgentLanes = ref<string[]>([]);
const currentTimeRange = ref<TimeRange>('1m'); // Current time range from LivePulseChart

// Theme toggle
const isDarkMode = computed(() => {
  const t = themeState.value.currentTheme;
  return t === 'dark' || t === 'dark-blue' || t === 'midnight-purple';
});

const handleThemeToggle = () => {
  setTheme(isDarkMode.value ? 'light' : 'dark');
};

// Toast notifications
interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}
const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;
const seenAgents = new Set<string>();

// Watch for new agents and show toast
watch(uniqueAppNames, (newAppNames) => {
  // Find agents that are new (not in seenAgents set)
  newAppNames.forEach(appName => {
    if (!seenAgents.has(appName)) {
      seenAgents.add(appName);
      // Show toast for new agent
      const toast: Toast = {
        id: toastIdCounter++,
        agentName: appName,
        agentColor: getHexColorForApp(appName)
      };
      toasts.value.push(toast);
    }
  });
}, { deep: true });

const dismissToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Handle agent tag clicks for swim lanes
const toggleAgentLane = (agentName: string) => {
  const index = selectedAgentLanes.value.indexOf(agentName);
  if (index >= 0) {
    // Remove from comparison
    selectedAgentLanes.value.splice(index, 1);
  } else {
    // Add to comparison
    selectedAgentLanes.value.push(agentName);
  }
};

// Watch for new events and trigger notifications
watch(() => events.value.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    // Notify for each new event added
    const newEvents = events.value.slice(oldLen);
    for (const event of newEvents) {
      notifyEvent(event);
    }
  }
});

// Handle clear with inline confirmation
const handleClearConfirm = () => {
  clearEvents();
  selectedAgentLanes.value = [];
  selectedProject.value = null;
  selectedSession.value = null;
  confirmingClear.value = false;
};
</script>

<style scoped>
/* ---- App Header ---- */
.app-header {
  height: 40px;
  flex-shrink: 0;
  background-color: var(--theme-bg-primary);
  border-bottom: 1px solid var(--theme-border-primary);
}

.app-header__inner {
  height: 100%;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-header__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text-primary);
  letter-spacing: -0.01em;
}

.app-header__controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-header__confirm {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.app-header__confirm-label {
  color: var(--theme-text-quaternary);
}

.app-header__confirm-yes {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-accent-error);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.app-header__confirm-yes:hover {
  background-color: var(--theme-bg-quaternary);
}

.app-header__confirm-no {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--theme-text-quaternary);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.app-header__confirm-no:hover {
  color: var(--theme-text-secondary);
}

/* ---- Icon button base ---- */
.app-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--theme-text-tertiary);
  transition: color 0.15s ease, background-color 0.15s ease;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
}

.app-icon-btn:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-hover-bg);
}

.app-icon-btn--active {
  color: var(--theme-primary);
  background-color: var(--theme-primary-light);
}

.app-icon-btn--active:hover {
  color: var(--theme-primary);
  background-color: var(--theme-active-bg);
}

/* ---- Notification badge ---- */
.app-notif-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--theme-accent-error);
  pointer-events: none;
}

/* ---- Filter panel slide ---- */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 200px;
  transform: translateY(0);
}

/* ---- Error toast ---- */
.toast-error-enter-active {
  transition: all 0.25s ease-out;
}

.toast-error-leave-active {
  transition: all 0.2s ease-in;
}

.toast-error-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.toast-error-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ---- Status bar (bottom) ---- */
.app-statusbar {
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background-color: var(--theme-bg-primary);
  border-top: 1px solid var(--theme-border-primary);
}

.app-statusbar__left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.app-statusbar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.app-statusbar__dot--connected {
  background-color: var(--theme-accent-success);
}

.app-statusbar__dot--disconnected {
  background-color: var(--theme-accent-error);
  animation: statusbar-blink 1.5s ease-in-out infinite;
}

@keyframes statusbar-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.app-statusbar__text {
  font-size: 11px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
}
</style>