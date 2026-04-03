<template>
  <div
    class="agent-card"
    :class="{ 'agent-card--selected': selected }"
    @click="emit('select')"
    @contextmenu.prevent="emit('context-menu', $event)"
  >
    <!-- Left indicators: status dot + type icon -->
    <div class="agent-card__indicators">
      <span
        class="agent-card__status-dot"
        :style="statusDotStyle"
      />
      <AgentTypeIcon
        :type="agent.agent_type || agent.inferred_role || ''"
        :size="16"
        class="agent-card__type-icon"
      />
    </div>

    <!-- Center: name + subtitle -->
    <div class="agent-card__info">
      <div class="agent-card__name" :title="agent.display_name">
        {{ agent.display_name }}
      </div>
      <div class="agent-card__subtitle" :title="subtitleText">
        {{ subtitleText }}
      </div>
    </div>

    <!-- Right: lifecycle dot + event count badge + time ago -->
    <div class="agent-card__meta">
      <div class="agent-card__meta-top">
        <span
          v-if="lifecycleStatus"
          class="agent-card__lifecycle-dot"
          :style="{ backgroundColor: lifecycleColor }"
          :title="lifecycleLabel"
        ></span>
        <span class="agent-card__event-badge">
          {{ agent.event_count }}
        </span>
      </div>
      <span class="agent-card__time">
        {{ timeAgo }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AgentTypeIcon from './AgentTypeIcon.vue';
import type { AgentNode } from '../types';
import { useAgentRegistry } from '../composables/useAgentRegistry';
import { getLifecycleColor, getLifecycleLabel } from '../utils/agentHelpers';

const props = defineProps<{
  agent: AgentNode;
  color: string;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
  'context-menu': [event: MouseEvent];
}>();

// Agent registry lifecycle
const { findAgent: findRegistryAgent } = useAgentRegistry();

const lifecycleStatus = computed(() => {
  const entry = findRegistryAgent(props.agent.id)
  return entry?.lifecycle_status || ''
})

const lifecycleColor = computed(() => getLifecycleColor(lifecycleStatus.value))
const lifecycleLabel = computed(() => getLifecycleLabel(lifecycleStatus.value))

const statusColorMap: Record<string, string> = {
  active: 'var(--theme-accent-success)',
  idle: 'var(--theme-accent-warning)',
  error: 'var(--theme-accent-error)',
  stopped: 'var(--theme-text-quaternary)',
};

const statusDotStyle = computed(() => ({
  backgroundColor: statusColorMap[props.agent.agent_status] || statusColorMap.stopped,
  borderColor: props.color,
}));

function sanitizeTaskSummary(text: string): string {
  let cleaned = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned
}

const prettifyType = (type: string | undefined): string => {
  if (!type) return '';
  return type
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const subtitleText = computed(() => {
  const parts: string[] = [];
  const typeStr = prettifyType(props.agent.agent_type || props.agent.inferred_role);
  if (typeStr) parts.push(typeStr);
  if (props.agent.task_summary) parts.push(sanitizeTaskSummary(props.agent.task_summary));
  return parts.join(' \u00b7 ') || '\u2014';
});

const timeAgo = computed(() => {
  const now = Date.now();
  const diff = now - props.agent.last_seen;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
});
</script>

<style scoped>
.agent-card {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background-color 0.12s ease, border-color 0.12s ease;
  user-select: none;
}

.agent-card:hover {
  background-color: var(--theme-hover-bg);
}

.agent-card--selected {
  background-color: var(--theme-hover-bg);
  border-left-color: var(--theme-primary);
}

/* Left indicators */
.agent-card__indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.agent-card__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid;
  flex-shrink: 0;
}

.agent-card__type-icon {
  color: var(--theme-text-tertiary);
}

/* Center info */
.agent-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
}

.agent-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.agent-card__subtitle {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

/* Right meta */
.agent-card__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.agent-card__meta-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-card__lifecycle-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.agent-card__event-badge {
  display: inline-flex;
  align-items: center;
  padding: 0px 6px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: 9999px;
  background-color: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  border: 1px solid var(--theme-border-secondary);
  line-height: 1.6;
}

.agent-card__time {
  font-size: 10px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
