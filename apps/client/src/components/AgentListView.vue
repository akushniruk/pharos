<template>
  <div class="agent-list-view">
    <!-- Active group -->
    <div v-if="activeAgents.length > 0" class="agent-list-view__group">
      <button
        class="agent-list-view__group-header"
        @click="activeCollapsed = !activeCollapsed"
      >
        <svg
          class="agent-list-view__chevron"
          :class="{ 'agent-list-view__chevron--collapsed': activeCollapsed }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="obs-section-title">Active</span>
        <span class="agent-list-view__group-count">({{ activeAgents.length }})</span>
      </button>
      <div v-show="!activeCollapsed" class="agent-list-view__group-items">
        <AgentCard
          v-for="agent in activeAgents"
          :key="agent.id"
          :agent="agent"
          :color="getAgentColor(agent)"
          :selected="selectedAgentId === agent.id"
          @select="emit('select-agent', agent.id)"
          @context-menu="(event) => emit('context-menu', { event, agent })"
        />
      </div>
    </div>

    <!-- Idle group -->
    <div v-if="idleAgents.length > 0" class="agent-list-view__group">
      <button
        class="agent-list-view__group-header"
        @click="idleCollapsed = !idleCollapsed"
      >
        <svg
          class="agent-list-view__chevron"
          :class="{ 'agent-list-view__chevron--collapsed': idleCollapsed }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="obs-section-title">Idle</span>
        <span class="agent-list-view__group-count">({{ idleAgents.length }})</span>
      </button>
      <div v-show="!idleCollapsed" class="agent-list-view__group-items">
        <AgentCard
          v-for="agent in idleAgents"
          :key="agent.id"
          :agent="agent"
          :color="getAgentColor(agent)"
          :selected="selectedAgentId === agent.id"
          @select="emit('select-agent', agent.id)"
          @context-menu="(event) => emit('context-menu', { event, agent })"
        />
      </div>
    </div>

    <!-- Error group -->
    <div v-if="errorAgents.length > 0" class="agent-list-view__group">
      <button
        class="agent-list-view__group-header"
        @click="errorCollapsed = !errorCollapsed"
      >
        <svg
          class="agent-list-view__chevron"
          :class="{ 'agent-list-view__chevron--collapsed': errorCollapsed }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="obs-section-title">Error</span>
        <span class="agent-list-view__group-count">({{ errorAgents.length }})</span>
      </button>
      <div v-show="!errorCollapsed" class="agent-list-view__group-items">
        <AgentCard
          v-for="agent in errorAgents"
          :key="agent.id"
          :agent="agent"
          :color="getAgentColor(agent)"
          :selected="selectedAgentId === agent.id"
          @select="emit('select-agent', agent.id)"
          @context-menu="(event) => emit('context-menu', { event, agent })"
        />
      </div>
    </div>

    <!-- Stopped group -->
    <div v-if="stoppedAgents.length > 0" class="agent-list-view__group">
      <button
        class="agent-list-view__group-header"
        @click="stoppedCollapsed = !stoppedCollapsed"
      >
        <svg
          class="agent-list-view__chevron"
          :class="{ 'agent-list-view__chevron--collapsed': stoppedCollapsed }"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span class="obs-section-title">Stopped</span>
        <span class="agent-list-view__group-count">({{ stoppedAgents.length }})</span>
      </button>
      <div v-show="!stoppedCollapsed" class="agent-list-view__group-items">
        <AgentCard
          v-for="agent in stoppedAgents"
          :key="agent.id"
          :agent="agent"
          :color="getAgentColor(agent)"
          :selected="selectedAgentId === agent.id"
          @select="emit('select-agent', agent.id)"
          @context-menu="(event) => emit('context-menu', { event, agent })"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="agents.length === 0" class="agent-list-view__empty">
      <span class="agent-list-view__empty-text">No agents detected</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import AgentCard from './AgentCard.vue';
import { useEventColors } from '../composables/useEventColors';
import type { AgentNode } from '../types';

const props = defineProps<{
  agents: AgentNode[];
  selectedAgentId: string | null;
}>();

const emit = defineEmits<{
  'select-agent': [agentId: string];
  'context-menu': [payload: { event: MouseEvent; agent: AgentNode }];
}>();

const { getHexColorForSession } = useEventColors();

const getAgentColor = (agent: AgentNode): string => {
  return getHexColorForSession(agent.session_id);
};

// Sort helper: descending by event_count
const sortByEventCount = (a: AgentNode, b: AgentNode): number => {
  return b.event_count - a.event_count;
};

// Grouped and sorted agents
const activeAgents = computed(() =>
  props.agents
    .filter((a) => a.agent_status === 'active')
    .sort(sortByEventCount)
);

const idleAgents = computed(() =>
  props.agents
    .filter((a) => a.agent_status === 'idle')
    .sort(sortByEventCount)
);

const errorAgents = computed(() =>
  props.agents
    .filter((a) => a.agent_status === 'error')
    .sort(sortByEventCount)
);

const stoppedAgents = computed(() =>
  props.agents
    .filter((a) => a.agent_status === 'stopped')
    .sort(sortByEventCount)
);

// Collapse state: stopped is collapsed by default
const activeCollapsed = ref(false);
const idleCollapsed = ref(false);
const errorCollapsed = ref(false);
const stoppedCollapsed = ref(true);
</script>

<style scoped>
.agent-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Custom scrollbar styling */
.agent-list-view::-webkit-scrollbar {
  width: 4px;
}

.agent-list-view::-webkit-scrollbar-track {
  background: transparent;
}

.agent-list-view::-webkit-scrollbar-thumb {
  background-color: var(--theme-border-secondary);
  border-radius: 4px;
}

/* Group */
.agent-list-view__group {
  border-bottom: 1px solid var(--theme-border-primary);
}

.agent-list-view__group:last-child {
  border-bottom: none;
}

/* Group header */
.agent-list-view__group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.12s ease;
}

.agent-list-view__group-header:hover {
  background-color: var(--theme-hover-bg);
}

/* Chevron */
.agent-list-view__chevron {
  color: var(--theme-text-quaternary);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.agent-list-view__chevron--collapsed {
  transform: rotate(-90deg);
}

/* Group count */
.agent-list-view__group-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
}

/* Group items container */
.agent-list-view__group-items {
  display: flex;
  flex-direction: column;
}

/* Empty state */
.agent-list-view__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.agent-list-view__empty-text {
  font-size: 12px;
  color: var(--theme-text-quaternary);
}
</style>
