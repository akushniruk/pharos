<template>
  <div class="lpc-root">
    <!-- Top Stats Bar (always visible) -->
    <div class="lpc-stats-bar">
      <div class="lpc-stat">
        <span class="lpc-health-dot" :class="healthDotClass"></span>
        <span class="lpc-stat__value">{{ uniqueAgentCount }}</span>
        <span class="lpc-stat__label">{{ uniqueAgentCount === 1 ? 'agent' : 'agents' }}</span>
      </div>

      <div class="lpc-stat lpc-stat--divider" v-if="primaryModelName">
        <span class="lpc-stat__value">{{ primaryModelName }}</span>
      </div>

      <div class="lpc-stat lpc-stat--divider">
        <span class="lpc-stat__value">{{ formattedSessionDuration }}</span>
      </div>

      <div class="lpc-stat lpc-stat--divider">
        <span class="lpc-stat__value" :class="successRateColorClass">{{ toolSuccessRate }}%</span>
        <span class="lpc-stat__label">tools ok</span>
      </div>

      <div class="lpc-stat lpc-stat--divider">
        <span class="lpc-stat__value">{{ eventsPerMinute }}</span>
        <span class="lpc-stat__label">evt/min</span>
      </div>

      <div class="lpc-stat lpc-stat--divider lpc-stat--right">
        <span class="lpc-stat__value">{{ totalEventCount }}</span>
        <span class="lpc-stat__label">events</span>
      </div>

      <button class="lpc-collapse-toggle" @click="panelCollapsed = !panelCollapsed" :title="panelCollapsed ? 'Expand panel' : 'Collapse panel'">
        <svg
          class="lpc-chevron"
          :class="{ 'lpc-chevron--collapsed': panelCollapsed }"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path d="M3.5 8.75L7 5.25L10.5 8.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Collapsible Panel -->
    <div class="lpc-panel" :class="{ 'lpc-panel--collapsed': panelCollapsed }">
      <div class="lpc-panel__content">
        <!-- Left Column: Agent Activity -->
        <div class="lpc-activity">
          <div class="lpc-activity__header">
            <span class="lpc-section-title">Agent Activity</span>
            <div class="lpc-range">
              <button
                v-for="range in timeRanges"
                :key="range"
                @click="setTimeRange(range)"
                :class="['lpc-range-btn', { 'lpc-range-btn--active': timeRange === range }]"
              >{{ range }}</button>
            </div>
          </div>
          <div class="lpc-activity__rows" v-if="agentActivityEnhanced.length > 0">
            <div
              v-for="agent in agentActivityEnhanced"
              :key="agent.id"
              class="lpc-activity-row lpc-activity-row--clickable"
              @click="$emit('selectAgent', agent.id)"
            >
              <span class="lpc-activity-dot" :style="{ backgroundColor: agent.color }">
                <span v-if="agent.hasFailure" class="lpc-failure-dot"></span>
              </span>
              <span class="lpc-activity-name">{{ agent.label }}</span>
              <div class="lpc-activity-bar-bg">
                <div
                  class="lpc-activity-bar-fill"
                  :style="{ width: agent.pct + '%', backgroundColor: agent.color }"
                ></div>
              </div>
              <span class="lpc-activity-count">{{ agent.count }}</span>
            </div>
          </div>
          <div v-else class="lpc-empty">Waiting for events...</div>
        </div>

        <!-- Right Column: Top Tools -->
        <div class="lpc-tools">
          <div class="lpc-tools__header">
            <span class="lpc-section-title">Top Tools</span>
          </div>
          <div class="lpc-tools__rows" v-if="toolDistribution.length > 0">
            <div
              v-for="(tool, i) in toolDistribution"
              :key="tool.name"
              class="lpc-tool-row"
            >
              <span class="lpc-tool-name">{{ tool.name }}</span>
              <div class="lpc-tool-bar-bg">
                <div
                  class="lpc-tool-bar-fill"
                  :style="{ width: toolBarWidth(tool.count) + '%', backgroundColor: toolBarColors[i] }"
                ></div>
              </div>
              <span class="lpc-tool-count">{{ tool.count }}</span>
            </div>
          </div>
          <div v-else class="lpc-empty">No tool data</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, toRef } from 'vue';
import type { HookEvent, TimeRange } from '../types';
import { useChartData } from '../composables/useChartData';
import { useMetrics } from '../composables/useMetrics';
import { useEventColors } from '../composables/useEventColors';

const props = defineProps<{
  events: HookEvent[];
  selectedAgentId?: string | null;
}>();

const emit = defineEmits<{
  updateUniqueApps: [appNames: string[]];
  updateAllApps: [appNames: string[]];
  updateTimeRange: [timeRange: TimeRange];
  selectAgent: [agentId: string];
}>();

const timeRanges: TimeRange[] = ['1m', '3m', '5m', '10m'];
const MAX_ACTIVITY_ROWS = 6;

const panelCollapsed = ref(false);

const {
  timeRange,
  dataPoints,
  addEvent,
  setTimeRange,
  cleanup: cleanupChartData,
  clearData,
  uniqueAgentCount,
  uniqueAgentIdsInWindow,
  allUniqueAgentIds,
} = useChartData();

const eventsRef = toRef(props, 'events');
const {
  toolDistribution,
  toolSuccessRate,
  agentDurations,
  eventsPerMinute,
  errorRate,
  sessionDuration,
  modelDistribution,
} = useMetrics(eventsRef);

const { getHexColorForSession } = useEventColors();

const processedEventIds = new Set<string>();
const now = ref(Date.now());
let tickInterval: number | null = null;

// Tick every second to update relative times and sparkline
onMounted(() => {
  tickInterval = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  cleanupChartData();
  if (tickInterval) clearInterval(tickInterval);
});

// Watch and emit
watch(uniqueAgentIdsInWindow, (ids) => emit('updateUniqueApps', ids), { immediate: true });
watch(allUniqueAgentIds, (ids) => emit('updateAllApps', ids), { immediate: true });
watch(timeRange, (range) => emit('updateTimeRange', range), { immediate: true });

const totalEventCount = computed(() => dataPoints.value.reduce((s, dp) => s + dp.count, 0));

// ---- Stats Bar: Health ----
const healthStatus = computed<'green' | 'yellow' | 'red'>(() => {
  const er = errorRate.value;
  if (er > 15) return 'red';

  // Check for agents in error state
  const hasErrorAgents = props.events.some(e => e.agent_status === 'error');
  if (hasErrorAgents) return 'red';

  if (er >= 5) return 'yellow';

  // Check for idle agents (no event in last 30s)
  const cutoff = now.value - 30000;
  const agentLastSeen: Record<string, number> = {};
  props.events.forEach(e => {
    if (!e.timestamp) return;
    const key = `${e.source_app}:${e.session_id.slice(0, 8)}`;
    agentLastSeen[key] = Math.max(agentLastSeen[key] || 0, e.timestamp);
  });
  const agentKeys = Object.keys(agentLastSeen);
  if (agentKeys.length > 0) {
    const someIdle = agentKeys.some(k => agentLastSeen[k] < cutoff);
    if (someIdle) return 'yellow';
  }

  return 'green';
});

const healthDotClass = computed(() => `lpc-health-dot--${healthStatus.value}`);

// ---- Stats Bar: Primary Model ----
const primaryModelName = computed(() => {
  if (modelDistribution.value.length === 0) return '';
  return modelDistribution.value[0].name;
});

// ---- Stats Bar: Success Rate Color ----
const successRateColorClass = computed(() => {
  const rate = toolSuccessRate.value;
  if (rate >= 90) return 'lpc-color--green';
  if (rate >= 70) return 'lpc-color--yellow';
  return 'lpc-color--red';
});

// ---- Top Tools ----
const toolBarColors = ['var(--theme-primary, #3b82f6)', 'var(--accent-success, #22c55e)', 'var(--accent-warning, #eab308)'];

const toolBarWidth = (count: number) => {
  const max = toolDistribution.value.length > 0 ? toolDistribution.value[0].count : 1;
  return Math.max((count / max) * 100, 4);
};

// ---- Agent Activity (enhanced) ----
const agentFailureMap = computed(() => {
  const map: Record<string, boolean> = {};
  agentDurations.value.forEach(a => {
    map[a.id] = a.hasFailure;
  });
  return map;
});

const agentDurationMap = computed(() => {
  const map: Record<string, number> = {};
  agentDurations.value.forEach(a => {
    map[a.id] = a.durationMs;
  });
  return map;
});

const agentActivityEnhanced = computed(() => {
  const sessionCounts: Record<string, number> = {};
  dataPoints.value.forEach(dp => {
    for (const [sid, count] of Object.entries(dp.sessions || {})) {
      sessionCounts[sid] = (sessionCounts[sid] || 0) + count;
    }
  });

  // Build agent name lookup from events
  const agentNameMap: Record<string, string> = {};
  props.events.forEach(e => {
    const key = `${e.source_app}:${(e.agent_id || e.session_id || '').slice(0, 8)}`;
    if (!agentNameMap[key]) {
      agentNameMap[key] = e.display_name || e.agent_name || (!e.agent_id ? 'Orchestrator' : key);
    }
  });

  const sorted = Object.entries(sessionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ACTIVITY_ROWS);

  const max = sorted.length > 0 ? sorted[0][1] : 1;

  return sorted.map(([sid, count]) => ({
    id: sid,
    label: agentNameMap[sid] || sid,
    color: getHexColorForSession(sid),
    count,
    pct: Math.max((count / max) * 100, 4),
    hasFailure: agentFailureMap.value[sid] || false,
    durationLabel: formatDuration(agentDurationMap.value[sid] || 0)
  }));
});

// ---- Session Summary ----
const formattedSessionDuration = computed(() => formatDuration(sessionDuration.value));

// ---- Helpers ----
function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Event processing
const processNewEvents = () => {
  const currentEvents = props.events;
  currentEvents.forEach(event => {
    const eventKey = `${event.id}-${event.timestamp}`;
    if (!processedEventIds.has(eventKey)) {
      processedEventIds.add(eventKey);
      if (event.hook_event_type !== 'refresh' && event.hook_event_type !== 'initial') {
        addEvent(event);
      }
    }
  });

  // Clean up old IDs
  const currentIds = new Set(currentEvents.map(e => `${e.id}-${e.timestamp}`));
  processedEventIds.forEach(id => {
    if (!currentIds.has(id)) processedEventIds.delete(id);
  });
};

watch(() => props.events, (newEvents) => {
  if (newEvents.length === 0) {
    clearData();
    processedEventIds.clear();
    return;
  }
  dataPoints.value = [];
  processedEventIds.clear();
  processNewEvents();
}, { deep: true });
</script>

<style scoped>
.lpc-root {
  background: var(--theme-bg-primary);
  border-bottom: 1px solid var(--theme-border-primary);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/* ---- Stats Bar ---- */
.lpc-stats-bar {
  display: flex;
  align-items: center;
  gap: 0;
  height: 40px;
  padding: 0 16px;
  background: var(--theme-bg-secondary);
  border-radius: 6px;
  margin: 8px 12px 0;
  flex-shrink: 0;
}

.lpc-stat {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  white-space: nowrap;
}

.lpc-stat--divider {
  border-left: 1px solid var(--theme-border-secondary, var(--theme-border-primary));
}

.lpc-stat--right {
  margin-left: auto;
}

.lpc-stat__value {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-text-primary);
  font-family: var(--font-mono, 'SF Mono', 'JetBrains Mono', ui-monospace, monospace);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.lpc-stat__label {
  font-size: 12px;
  font-weight: 400;
  color: var(--theme-text-quaternary);
  line-height: 1;
}

/* Health dot */
.lpc-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.lpc-health-dot--green {
  background-color: var(--accent-success, #22c55e);
  box-shadow: 0 0 6px var(--accent-success, #22c55e);
}

.lpc-health-dot--yellow {
  background-color: var(--accent-warning, #eab308);
  box-shadow: 0 0 6px var(--accent-warning, #eab308);
}

.lpc-health-dot--red {
  background-color: var(--accent-error, #ef4444);
  box-shadow: 0 0 6px var(--accent-error, #ef4444);
}

/* Color classes for success rate */
.lpc-color--green {
  color: var(--accent-success, #22c55e);
}

.lpc-color--yellow {
  color: var(--accent-warning, #eab308);
}

.lpc-color--red {
  color: var(--accent-error, #ef4444);
}

/* ---- Collapsible Panel ---- */
.lpc-panel {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease;
  max-height: 300px;
  opacity: 1;
  padding: 8px 12px 0;
}

.lpc-panel--collapsed {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.lpc-panel__content {
  display: flex;
  gap: 12px;
}

/* ---- Section Title ---- */
.lpc-section-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ---- Agent Activity (left column) ---- */
.lpc-activity {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-primary);
}

.lpc-activity__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.lpc-activity__rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.lpc-activity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 18px;
  padding: 0 2px;
}

.lpc-activity-row--clickable {
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.15s ease;
}

.lpc-activity-row--clickable:hover {
  background: var(--theme-hover-bg);
}

.lpc-activity-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

.lpc-failure-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--accent-error, #ef4444);
  border: 1px solid var(--theme-bg-secondary);
}

.lpc-activity-name {
  font-size: 10px;
  font-family: var(--font-mono, 'SF Mono', 'JetBrains Mono', ui-monospace, monospace);
  color: var(--theme-text-tertiary);
  width: 72px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lpc-activity-bar-bg {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--theme-bg-tertiary);
  overflow: hidden;
}

.lpc-activity-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.lpc-activity-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono, 'SF Mono', 'JetBrains Mono', ui-monospace, monospace);
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

/* ---- Top Tools (right column) ---- */
.lpc-tools {
  flex: 0.6;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-primary);
}

.lpc-tools__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lpc-tools__rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.lpc-tool-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 18px;
}

.lpc-tool-name {
  font-size: 10px;
  font-family: var(--font-mono, 'SF Mono', 'JetBrains Mono', ui-monospace, monospace);
  color: var(--theme-text-tertiary);
  width: 56px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lpc-tool-bar-bg {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--theme-bg-tertiary);
  overflow: hidden;
}

.lpc-tool-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.lpc-tool-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono, 'SF Mono', 'JetBrains Mono', ui-monospace, monospace);
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

/* ---- Time Range Buttons ---- */
.lpc-range {
  display: flex;
  gap: 2px;
}

.lpc-range-btn {
  background: none;
  border: none;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-quaternary);
  cursor: pointer;
  border-radius: 3px;
  transition: color 0.15s ease, background-color 0.15s ease;
  font-family: inherit;
}

.lpc-range-btn:hover {
  color: var(--theme-text-secondary);
  background: var(--theme-hover-bg);
}

.lpc-range-btn--active {
  color: var(--theme-text-primary);
  background: var(--theme-bg-tertiary);
}

/* ---- Collapse Toggle ---- */
.lpc-collapse-toggle {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  background: none;
  border: none;
  color: var(--theme-text-quaternary);
  cursor: pointer;
  margin-left: 8px;
}

.lpc-collapse-toggle:hover {
  color: var(--theme-text-secondary);
}

.lpc-chevron {
  transition: transform 0.3s ease;
}

.lpc-chevron--collapsed {
  transform: rotate(180deg);
}

/* ---- Empty state ---- */
.lpc-empty {
  font-size: 10px;
  color: var(--theme-text-quaternary);
  padding: 2px 0;
}
</style>
