<template>
  <div v-if="selectedAgents.length > 0" class="aslc-root">
    <div class="aslc-lanes">
      <AgentSwimLane
        v-for="agent in selectedAgents"
        :key="agent"
        :agent-name="agent"
        :events="events"
        :time-range="timeRange"
        @close="removeAgent(agent)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HookEvent, TimeRange } from '../types';
import AgentSwimLane from './AgentSwimLane.vue';

const props = defineProps<{
  selectedAgents: string[];
  events: HookEvent[];
  timeRange: TimeRange;
}>();

const emit = defineEmits<{
  'update:selectedAgents': [agents: string[]];
}>();

function removeAgent(agent: string) {
  const updated = props.selectedAgents.filter(a => a !== agent);
  emit('update:selectedAgents', updated);
}
</script>

<style scoped>
.aslc-root {
  width: 100%;
  animation: aslcSlideIn 0.2s ease;
}

@keyframes aslcSlideIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.aslc-lanes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
</style>
