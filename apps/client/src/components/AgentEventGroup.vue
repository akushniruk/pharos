<template>
  <div class="agent-group" :class="{ 'agent-group--expanded': expanded }">
    <!-- Header (always visible, clickable) -->
    <div
      class="agent-group__header"
      :style="expanded ? { borderLeftColor: agentColor } : {}"
      @click="expanded = !expanded"
    >
      <span class="agent-group__dot" :style="{ backgroundColor: agentColor }"></span>
      <span class="agent-group__name">{{ agentName }}</span>
      <span class="agent-group__summary">{{ summary }}</span>
      <span class="agent-group__meta">{{ events.length }} events · {{ duration }}</span>
      <span class="agent-group__chevron">{{ expanded ? '\u25BC' : '\u25B6' }}</span>
    </div>
    <!-- Children (collapsible) -->
    <div v-if="expanded" class="agent-group__events">
      <div v-for="event in displayEvents" :key="event.id || event.timestamp" class="agent-group__event">
        <span class="agent-group__time">{{ formatTime(event.timestamp) }}</span>
        <span class="agent-group__desc">{{ describeEvent(event) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent } from '../types';
import { describeEvent } from '../utils/describeEvent';

const props = withDefaults(defineProps<{
  agentKey: string;
  agentName: string;
  agentColor: string;
  events: HookEvent[];
  defaultExpanded?: boolean;
}>(), {
  defaultExpanded: false,
});

const expanded = ref(props.defaultExpanded);

const displayEvents = computed(() => {
  return props.events.filter(e => {
    // Hide PostToolUse — "completed X" is noise in simple view
    if (e.hook_event_type === 'PostToolUse') return false
    return true
  })
})

const formatTime = (ts?: number): string => {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

function generateSummary(events: HookEvent[]): string {
  const toolCounts: Record<string, number> = {};
  for (const event of events) {
    if (event.hook_event_type === 'PostToolUse' && event.payload?.tool_name) {
      const tool = event.payload.tool_name as string;
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    }
  }

  const actions: string[] = [];
  const editCount = (toolCounts['Edit'] || 0) + (toolCounts['Write'] || 0) + (toolCounts['MultiEdit'] || 0);
  const readCount = (toolCounts['Read'] || 0);
  const bashCount = (toolCounts['Bash'] || 0);
  const searchCount = (toolCounts['Grep'] || 0) + (toolCounts['Glob'] || 0);

  if (editCount > 0) actions.push(`edited ${editCount} file${editCount > 1 ? 's' : ''}`);
  if (bashCount > 0) actions.push(`ran ${bashCount} command${bashCount > 1 ? 's' : ''}`);
  if (readCount > 0) actions.push(`read ${readCount} file${readCount > 1 ? 's' : ''}`);
  if (searchCount > 0) actions.push(`searched ${searchCount} pattern${searchCount > 1 ? 's' : ''}`);

  return actions.slice(0, 3).join(', ') || '';
}

const summary = computed(() => generateSummary(props.events));

const duration = computed(() => {
  if (props.events.length < 2) return '';
  const timestamps = props.events
    .map(e => e.timestamp)
    .filter((t): t is number => t != null);
  if (timestamps.length < 2) return '';
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const diffMs = maxTs - minTs;
  if (diffMs < 1000) return '';
  const secs = Math.round(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
});
</script>

<style scoped>
.agent-group {
  margin-bottom: 6px;
}

.agent-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--theme-bg-primary);
  border-radius: 6px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background-color 0.12s ease, border-left-color 0.15s ease;
}

.agent-group__header:hover {
  background: var(--theme-hover-bg);
}

.agent-group--expanded .agent-group__header {
  border-radius: 6px 6px 0 0;
}

.agent-group__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.agent-group__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.agent-group__summary {
  font-size: 11px;
  color: var(--theme-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.agent-group__meta {
  font-size: 10px;
  color: var(--theme-text-quaternary);
  white-space: nowrap;
  flex-shrink: 0;
}

.agent-group__chevron {
  font-size: 9px;
  color: var(--theme-text-quaternary);
  flex-shrink: 0;
  width: 12px;
  text-align: center;
}

.agent-group__events {
  padding-left: 28px;
  background: var(--theme-bg-primary);
  border-radius: 0 0 6px 6px;
  border-left: 3px solid var(--theme-border-secondary);
  padding-bottom: 4px;
}

.agent-group--expanded .agent-group__events {
  border-left-color: inherit;
}

.agent-group__event {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 12px 3px 0;
  border-bottom: 1px solid var(--theme-border-primary);
}

.agent-group__event:last-child {
  border-bottom: none;
}

.agent-group__time {
  font-size: 10px;
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--theme-text-quaternary);
  flex-shrink: 0;
  min-width: 52px;
}

.agent-group__desc {
  font-size: 11px;
  color: var(--theme-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
