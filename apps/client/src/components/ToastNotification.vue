<template>
  <Transition name="toast">
    <div
      v-if="isVisible"
      class="tn-root"
      :style="{ bottom: `${16 + (index * 56)}px` }"
    >
      <div
        class="tn-stripe"
        :style="{ backgroundColor: stripeColor }"
      ></div>
      <div class="tn-body">
        <span class="tn-text">
          <template v-if="toastType === 'spawn'">
            <span class="tn-agent">{{ agentName }}</span> spawned
          </template>
          <template v-else-if="toastType === 'stop'">
            <span class="tn-agent">{{ agentName }}</span> stopped
          </template>
          <template v-else-if="toastType === 'error'">
            <span class="tn-agent">{{ agentName }}</span> error<span v-if="message">: {{ message }}</span>
          </template>
          <template v-else-if="toastType === 'hitl'">
            <span class="tn-agent">{{ agentName }}</span> needs input
            <a v-if="eventLink" class="tn-link" @click.stop="$emit('navigate', eventLink)">View</a>
          </template>
          <template v-else>
            New agent <span class="tn-agent">{{ agentName }}</span> joined
          </template>
        </span>
        <button
          @click="dismiss"
          class="tn-dismiss"
          aria-label="Dismiss notification"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

export type ToastType = 'spawn' | 'stop' | 'error' | 'hitl' | 'default';

const props = withDefaults(defineProps<{
  agentName: string;
  agentColor: string;
  index: number;
  duration?: number;
  type?: ToastType;
  message?: string;
  eventLink?: string | number;
}>(), {
  type: 'default',
});

const emit = defineEmits<{
  dismiss: [];
  navigate: [link: string | number];
}>();

const toastType = computed(() => props.type);

// Border color per toast type; falls back to agentColor for 'default'
const stripeColor = computed(() => {
  const colorMap: Record<ToastType, string> = {
    spawn: '#22C55E',   // green
    stop: '#71717A',    // gray
    error: '#EF4444',   // red
    hitl: '#F97316',    // orange
    default: props.agentColor,
  };
  return colorMap[toastType.value] || props.agentColor;
});

// Auto-dismiss durations per type (0 = manual dismiss only)
const autoDismissMs = computed(() => {
  if (props.duration !== undefined) return props.duration;
  const durationMap: Record<ToastType, number> = {
    spawn: 5000,
    stop: 3000,
    error: 0,     // requires manual dismiss
    hitl: 0,      // requires manual dismiss
    default: 4000,
  };
  return durationMap[toastType.value] ?? 4000;
});

const isVisible = ref(false);
let dismissTimer: number | null = null;

const dismiss = () => {
  isVisible.value = false;
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  // Wait for animation to complete before emitting
  setTimeout(() => {
    emit('dismiss');
  }, 300);
};

onMounted(() => {
  // Show toast with slight delay for animation
  requestAnimationFrame(() => {
    isVisible.value = true;
  });

  // Auto-dismiss if duration > 0
  const ms = autoDismissMs.value;
  if (ms > 0) {
    dismissTimer = window.setTimeout(() => {
      dismiss();
    }, ms);
  }
});

onUnmounted(() => {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
  }
});
</script>

<style scoped>
.tn-root {
  position: fixed;
  right: 16px;
  z-index: 50;
  display: flex;
  align-items: stretch;
  background: var(--theme-bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--theme-border-secondary);
  box-shadow: 0 4px 24px var(--theme-shadow), 0 0 8px rgba(251, 191, 36, 0.06);
  overflow: hidden;
  min-width: 220px;
  max-width: 360px;
  backdrop-filter: blur(8px);
}

.tn-stripe {
  width: 3px;
  flex-shrink: 0;
}

.tn-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.tn-text {
  font-size: 12px;
  color: var(--theme-text-secondary);
  font-weight: 400;
  white-space: nowrap;
}

.tn-agent {
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: var(--theme-text-primary);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--theme-hover-bg);
  border-radius: 3px;
}

.tn-link {
  color: var(--theme-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  margin-left: 4px;
  font-weight: 500;
  transition: color 0.15s ease;
}

.tn-link:hover {
  color: var(--theme-primary-hover);
}

.tn-dismiss {
  background: none;
  border: none;
  color: var(--theme-text-quaternary);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.tn-dismiss:hover {
  color: var(--theme-text-secondary);
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
