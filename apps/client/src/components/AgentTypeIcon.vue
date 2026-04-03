<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="agent-type-icon"
  >
    <!-- Builder / Editor: wrench -->
    <template v-if="normalizedType === 'builder' || normalizedType === 'editor'">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </template>

    <!-- Code-reviewer / Explorer: magnifying glass -->
    <template v-else-if="normalizedType === 'code-reviewer' || normalizedType === 'explorer'">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </template>

    <!-- Orchestrator: crown/star -->
    <template v-else-if="normalizedType === 'orchestrator'">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </template>

    <!-- Runner: terminal/command -->
    <template v-else-if="normalizedType === 'runner'">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </template>

    <!-- Developer: code brackets -->
    <template v-else-if="normalizedType === 'developer'">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </template>

    <!-- Scout: compass -->
    <template v-else-if="normalizedType === 'scout-report-suggest' || normalizedType === 'scout'">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </template>

    <!-- Default: circle -->
    <template v-else>
      <circle cx="12" cy="12" r="10" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  type: string;
  size?: number;
}>(), {
  size: 16,
});

const normalizedType = computed(() => {
  return (props.type || '').toLowerCase().trim();
});
</script>

<style scoped>
.agent-type-icon {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}
</style>
