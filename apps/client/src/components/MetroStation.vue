<template>
  <div
    class="metro-station"
    :class="{
      'metro-station--active': data.agent_status === 'active',
      'metro-station--selected': data.isSelected
    }"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <!-- Event count badge -->
    <div v-if="data.event_count > 0" class="metro-station__badge">
      {{ data.event_count > 99 ? '99+' : data.event_count }}
    </div>

    <!-- Station circle -->
    <div
      class="metro-station__circle"
      :class="{ 'metro-station__circle--glow': data.agent_status === 'active' }"
      :style="{
        '--station-color': data.color,
        borderColor: data.color,
        boxShadow: data.agent_status === 'active'
          ? `0 0 8px ${data.color}40, 0 0 16px ${data.color}20`
          : 'none'
      } as any"
    >
      <!-- Status LED -->
      <div
        class="metro-station__led"
        :class="[
          `metro-station__led--${data.agent_status}`,
          { 'glow-pulse': data.agent_status === 'active' }
        ]"
      ></div>
    </div>

    <!-- Label -->
    <div class="metro-station__label">
      <span class="metro-station__name" :class="{ 'glow-text': data.agent_status === 'active' }" :style="{ color: data.color }">{{ data.display_name }}</span>
      <span class="metro-station__status" :class="`metro-station__status--${data.agent_status}`">
        {{ data.agent_status === 'active' ? 'Active' : data.agent_status === 'idle' ? 'Idle' : data.agent_status === 'error' ? 'Error' : 'Stopped' }}
        <span v-if="data.event_count" class="metro-station__events">{{ data.event_count }} events</span>
      </span>
    </div>

    <!-- VueFlow handles -->
    <Handle type="target" :position="Position.Top" class="metro-station__handle" />
    <Handle type="source" :position="Position.Bottom" class="metro-station__handle" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    id: string
    display_name: string
    agent_type?: string
    model_name?: string
    agent_status: 'active' | 'idle' | 'error' | 'stopped'
    event_count: number
    color: string
    isSelected: boolean
  }
}>()

const emit = defineEmits<{
  contextmenu: [event: MouseEvent]
}>()
</script>

<style scoped>
.metro-station {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: pointer;
  padding: 4px 8px;
  transition: transform 0.15s ease;
}

.metro-station:hover {
  transform: scale(1.08);
}

.metro-station--selected .metro-station__circle {
  outline: 2px solid var(--theme-primary);
  outline-offset: 2px;
}

/* Event count badge */
.metro-station__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background-color: var(--theme-primary);
  color: #0a0a0b;
  font-size: 9px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  z-index: 2;
  font-variant-numeric: tabular-nums;
}

/* Station circle */
.metro-station__circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid;
  background-color: var(--theme-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: box-shadow 0.3s ease;
}

.metro-station--active .metro-station__circle {
  animation: stationGlowPulse 2s ease-in-out infinite;
}

@keyframes stationGlowPulse {
  0%, 100% {
    filter: brightness(1);
    box-shadow: 0 0 4px 0 color-mix(in srgb, var(--station-color, #fbbf24) 20%, transparent);
  }
  50% {
    filter: brightness(1.2);
    box-shadow: 0 0 16px 4px color-mix(in srgb, var(--station-color, #fbbf24) 50%, transparent);
  }
}

/* Status LED */
.metro-station__led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.metro-station__led--active {
  background-color: var(--theme-accent-success);
  box-shadow: 0 0 4px color-mix(in srgb, var(--theme-accent-success) 50%, transparent);
}

.metro-station__led--idle {
  background-color: var(--theme-accent-warning);
  box-shadow: 0 0 4px color-mix(in srgb, var(--theme-accent-warning) 50%, transparent);
}

.metro-station__led--error {
  background-color: var(--theme-accent-error);
  box-shadow: 0 0 4px color-mix(in srgb, var(--theme-accent-error) 50%, transparent);
}

.metro-station__led--stopped {
  background-color: var(--theme-text-quaternary);
}

/* Label below station */
.metro-station__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 6px;
  max-width: 140px;
}

.metro-station__name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  text-align: center;
  letter-spacing: -0.01em;
}

.metro-station__status {
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  text-align: center;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.metro-station__status--active {
  color: var(--theme-accent-success);
}

.metro-station__status--idle {
  color: var(--theme-accent-warning);
}

.metro-station__status--error {
  color: var(--theme-accent-error);
}

.metro-station__status--stopped {
  color: var(--theme-text-quaternary);
}

.metro-station__events {
  color: var(--theme-text-quaternary);
  font-size: 9px;
  font-weight: 400;
}

/* VueFlow handles - keep small and subtle */
.metro-station__handle {
  width: 6px !important;
  height: 6px !important;
  background-color: var(--theme-border-secondary) !important;
  border: 1px solid var(--theme-border-tertiary) !important;
  min-width: 6px !important;
  min-height: 6px !important;
}

.metro-station__handle:hover {
  background-color: var(--theme-primary) !important;
}
</style>
