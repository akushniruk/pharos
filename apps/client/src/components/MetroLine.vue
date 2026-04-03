<template>
  <g>
    <!-- Main edge path -->
    <path
      :d="path"
      :stroke="data?.color || '#6b7280'"
      :stroke-width="3"
      :stroke-dasharray="data?.status === 'stopped' ? '6 4' : 'none'"
      fill="none"
      :class="['metro-line__path', { 'metro-line__path--active': data?.status === 'active' }]"
      :style="{ cursor: 'pointer', '--line-color': data?.color || '#6b7280' } as any"
      @click="onEdgeClick"
    />

    <!-- Invisible wider path for easier click targeting -->
    <path
      :d="path"
      stroke="transparent"
      :stroke-width="12"
      fill="none"
      style="cursor: pointer"
      @click="onEdgeClick"
    />

    <!-- Animated dot traveling along the path -->
    <circle
      v-if="data?.animated && data?.status === 'active'"
      r="3"
      :fill="data?.color || '#6b7280'"
      class="metro-line__dot"
    >
      <animateMotion
        :path="path"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getBezierPath } from '@vue-flow/core'
import type { EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps & {
  data?: {
    color: string
    animated: boolean
    status: 'active' | 'stopped'
  }
}>()

const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
  return edgePath
})

const onEdgeClick = () => {
  // Edge click is handled by VueFlow's onEdgeClick event at the parent level
}
</script>

<style scoped>
.metro-line__path {
  transition: stroke 0.2s ease, stroke-dasharray 0.2s ease;
}

.metro-line__path:hover {
  stroke-width: 4;
  filter: brightness(1.2);
}

.metro-line__path--active {
  filter: drop-shadow(0 0 3px var(--line-color, #6b7280));
}

.metro-line__dot {
  filter: drop-shadow(0 0 3px currentColor);
}
</style>
