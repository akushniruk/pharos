<template>
  <div
    class="simple-event-row"
    @click="emit('detail', event)"
    role="button"
    tabindex="0"
    @keydown.enter="emit('detail', event)"
  >
    <!-- Timestamp -->
    <span class="simple-event-row__time">{{ formatTime(event.timestamp) }}</span>

    <!-- Agent color dot + name -->
    <span class="simple-event-row__agent">
      <span
        class="simple-event-row__dot"
        :style="{ backgroundColor: agentHexColor }"
      ></span>
      <span class="simple-event-row__agent-name" :title="fullAgentId">{{ shortAgentName }}</span>
    </span>

    <!-- Plain English description -->
    <span class="simple-event-row__desc">{{ description }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HookEvent } from '../types';
import { getAgentColor } from '../composables/useEventColors';
import { describeEvent } from '../utils/describeEvent';

const props = defineProps<{
  event: HookEvent;
}>();

const emit = defineEmits<{
  detail: [event: HookEvent];
}>();

const formatTime = (ts?: number): string => {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fullAgentId = computed(() => {
  const sid = props.event.agent_id
    ? props.event.agent_id.slice(0, 8)
    : props.event.session_id.slice(0, 8);
  return `${props.event.source_app}:${sid}`;
});

const shortAgentName = computed(() => {
  // 1. Explicit display name (user-set or from registry)
  if (props.event.display_name) return props.event.display_name;
  if (props.event.agent_name) return props.event.agent_name;

  // 2. Subagent: show type from payload (e.g. "Explore", "Builder")
  const agentType = props.event.payload?.agent_type || props.event.agent_type;
  if (props.event.agent_id && agentType) return agentType;

  // 3. Main agent: show project name
  return props.event.source_app;
});

const agentHexColor = computed(() => getAgentColor(fullAgentId.value));

const description = computed(() => describeEvent(props.event));
</script>

<style scoped>
.simple-event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.1s ease;
  border-bottom: 1px solid var(--theme-border-primary);
  min-height: 32px;
}

.simple-event-row:hover {
  background-color: var(--theme-hover-bg);
}

.simple-event-row:focus-visible {
  outline: 1px solid var(--theme-border-tertiary);
  outline-offset: -1px;
}

.simple-event-row__time {
  font-size: 11px;
  font-family: var(--font-mono, ui-monospace, monospace);
  color: var(--theme-text-quaternary);
  flex-shrink: 0;
  min-width: 60px;
}

.simple-event-row__agent {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  min-width: 80px;
  max-width: 140px;
}

.simple-event-row__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.simple-event-row__agent-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.simple-event-row__desc {
  font-size: 12px;
  color: var(--theme-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
</style>
