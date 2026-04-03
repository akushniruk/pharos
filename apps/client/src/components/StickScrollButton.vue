<template>
  <button
    @click="$emit('toggle')"
    :class="['ssb-root', { 'ssb-root--active': stickToBottom }]"
    :title="stickToBottom ? 'Disable auto-scroll' : 'Enable auto-scroll'"
  >
    <svg
      class="ssb-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  stickToBottom: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<style scoped>
.ssb-root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #1a1a1e;
  color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.ssb-root:hover {
  color: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.12);
}

.ssb-root--active {
  background: #fbbf24;
  color: #111113;
  border-color: #fbbf24;
}

.ssb-root--active:hover {
  background: #e6b83a;
  color: #111113;
  border-color: #e6b83a;
}

.ssb-icon {
  width: 14px;
  height: 14px;
}
</style>
