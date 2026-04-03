<template>
  <div class="asl-root">
    <div class="asl-header">
      <div class="asl-header-left">
        <span class="asl-agent-id">
          <span
            class="asl-app"
            :style="{ borderColor: getHexColorForApp(appName) }"
          >{{ appName }}</span><span
            class="asl-session"
            :style="{ borderColor: getHexColorForSession(sessionId) }"
          >{{ sessionId }}</span>
        </span>
        <span
          v-if="modelName"
          class="asl-badge"
          :title="`Model: ${modelName}`"
        >{{ formatModelName(modelName) }}</span>
        <span class="asl-inline-stat">events: <strong>{{ totalEventCount }}</strong></span>
        <span class="asl-inline-stat">tools: <strong>{{ toolCallCount }}</strong></span>
        <span class="asl-inline-stat">avg: <strong>{{ formatGap(agentEventTimingMetrics.avgGap) }}</strong></span>
      </div>
      <button @click="emit('close')" class="asl-close" title="Remove this swim lane">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </div>
    <div ref="chartContainer" class="asl-chart">
      <canvas
        ref="canvas"
        class="asl-canvas"
        :style="{ height: chartHeight + 'px' }"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        role="img"
        :aria-label="chartAriaLabel"
      ></canvas>
      <div
        v-if="tooltip.visible"
        class="asl-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        {{ tooltip.text }}
      </div>
      <div
        v-if="!hasData"
        class="asl-empty"
      >
        <p>Waiting for events...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { HookEvent, TimeRange, ChartConfig } from '../types';
import { useAgentChartData } from '../composables/useAgentChartData';
import { createChartRenderer, type ChartDimensions } from '../utils/chartRenderer';
import { useEventColors } from '../composables/useEventColors';

const props = defineProps<{
  agentName: string; // Format: "app:session" (e.g., "claude-code:a1b2c3d4")
  events: HookEvent[];
  timeRange: TimeRange;
}>();

const emit = defineEmits<{
  close: [];
}>();

const canvas = ref<HTMLCanvasElement>();
const chartContainer = ref<HTMLDivElement>();
const chartHeight = 80;

// Format gap time in ms to readable string (e.g., "125ms" or "1.2s")
const formatGap = (gapMs: number): string => {
  if (gapMs === 0) return '—';
  if (gapMs < 1000) {
    return `${Math.round(gapMs)}ms`;
  }
  return `${(gapMs / 1000).toFixed(1)}s`;
};

// Extract app name and session ID from agent ID for display
const appName = computed(() => props.agentName.split(':')[0]);
const sessionId = computed(() => props.agentName.split(':')[1]);

// Get model name from most recent event for this agent
const modelName = computed(() => {
  const [targetApp, targetSession] = props.agentName.split(':');
  const agentEvents = props.events
    .filter(e => e.source_app === targetApp && e.session_id.slice(0, 8) === targetSession)
    .filter(e => e.model_name); // Only events with model_name

  if (agentEvents.length === 0) return null;

  // Get most recent event's model name
  const mostRecent = agentEvents[agentEvents.length - 1];
  return mostRecent.model_name;
});

// Format model name for display (e.g., "claude-haiku-4-5-20251001" -> "haiku-4-5")
const formatModelName = (name: string | null | undefined): string => {
  if (!name) return '';

  // Extract model family and version
  // "claude-haiku-4-5-20251001" -> "haiku-4-5"
  // "claude-sonnet-4-5-20250929" -> "sonnet-4-5"
  const parts = name.split('-');
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return name;
};

const {
  dataPoints,
  addEvent,
  getChartData,
  setTimeRange,
  cleanup: cleanupChartData,
  eventTimingMetrics: agentEventTimingMetrics
} = useAgentChartData(props.agentName);

let renderer: ReturnType<typeof createChartRenderer> | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame: number | null = null;
let renderLoopFrame: number | null = null;
const processedEventIds = new Set<string>();

const { getHexColorForApp, getHexColorForSession } = useEventColors();

const hasData = computed(() => dataPoints.value.some(dp => dp.count > 0));

const totalEventCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
});

const toolCallCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => {
    return sum + (dp.eventTypes?.['PreToolUse'] || 0);
  }, 0);
});

const chartAriaLabel = computed(() => {
  const [app, session] = props.agentName.split(':');
  return `Activity chart for ${app} (session: ${session}) showing ${totalEventCount.value} events`;
});

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  text: ''
});

const getThemeColor = (property: string): string => {
  const style = getComputedStyle(document.documentElement);
  const color = style.getPropertyValue(`--theme-${property}`).trim();
  return color || '#3B82F6';
};

const getActiveConfig = (): ChartConfig => {
  return {
    maxDataPoints: 60,
    animationDuration: 300,
    barWidth: 3,
    barGap: 1,
    colors: {
      primary: getThemeColor('primary'),
      glow: getThemeColor('primary-light'),
      axis: getThemeColor('border-primary'),
      text: getThemeColor('text-tertiary')
    }
  };
};

const getDimensions = (): ChartDimensions => {
  const width = chartContainer.value?.offsetWidth || 800;
  return {
    width,
    height: chartHeight,
    padding: {
      top: 7,
      right: 7,
      bottom: 20,
      left: 7
    }
  };
};

const render = () => {
  if (!renderer || !canvas.value) return;

  const data = getChartData();
  const maxValue = Math.max(...data.map(d => d.count), 1);

  renderer.clear();
  renderer.drawBackground();
  renderer.drawAxes(maxValue);
  renderer.drawTimeLabels(props.timeRange);

  // Build a single stacked area series from the chart data for this agent
  const stackedData = [{
    sessionId: props.agentName,
    color: getHexColorForSession(sessionId.value),
    values: data.map(d => d.count)
  }];
  renderer.updateTargetHeights(stackedData, maxValue);
  renderer.tickAnimation();
  renderer.drawStackedAreas(stackedData);
};

const animateNewEvent = (x: number, y: number) => {
  let radius = 0;
  let opacity = 0.8;

  const animate = () => {
    if (!renderer) return;

    render();
    renderer.drawPulseEffect(x, y, radius, opacity);

    radius += 2;
    opacity -= 0.02;

    if (opacity > 0) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = null;
    }
  };

  animate();
};

const handleResize = () => {
  if (!renderer || !canvas.value) return;

  const dimensions = getDimensions();
  renderer.resize(dimensions);
  render();
};

const processNewEvents = () => {
  const currentEvents = props.events;
  const newEventsToProcess: HookEvent[] = [];

  // Find events that haven't been processed yet
  currentEvents.forEach(event => {
    const eventKey = `${event.id}-${event.timestamp}`;
    if (!processedEventIds.has(eventKey)) {
      processedEventIds.add(eventKey);
      newEventsToProcess.push(event);
    }
  });

  // Parse agent ID to get app and session
  const [targetApp, targetSession] = props.agentName.split(':');

  // Process new events (filter by agent ID: app:session)
  newEventsToProcess.forEach(event => {
    if (
      event.hook_event_type !== 'refresh' &&
      event.hook_event_type !== 'initial' &&
      event.source_app === targetApp &&
      event.session_id.slice(0, 8) === targetSession
    ) {
      addEvent(event);

      // Trigger pulse animation for new event
      if (renderer && canvas.value) {
        const chartArea = getDimensions();
        const x = chartArea.width - chartArea.padding.right - 10;
        const y = chartArea.height / 2;
        animateNewEvent(x, y);
      }
    }
  });

  // Clean up old event IDs to prevent memory leak
  const currentEventIds = new Set(currentEvents.map(e => `${e.id}-${e.timestamp}`));
  processedEventIds.forEach(id => {
    if (!currentEventIds.has(id)) {
      processedEventIds.delete(id);
    }
  });

  render();
};

// Watch for new events - immediate: true ensures we process existing events on mount
watch(() => props.events, processNewEvents, { deep: true, immediate: true });

// Watch for time range changes - update internal timeRange and trigger reaggregation
watch(() => props.timeRange, (newRange) => {
  setTimeRange(newRange);
  render();
}, { immediate: true });

const handleMouseMove = (event: MouseEvent) => {
  if (!canvas.value || !chartContainer.value) return;

  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const data = getChartData();
  const dimensions = getDimensions();
  const chartArea = {
    x: dimensions.padding.left,
    y: dimensions.padding.top,
    width: dimensions.width - dimensions.padding.left - dimensions.padding.right,
    height: dimensions.height - dimensions.padding.top - dimensions.padding.bottom
  };

  const barWidth = chartArea.width / data.length;
  const barIndex = Math.floor((x - chartArea.x) / barWidth);

  if (barIndex >= 0 && barIndex < data.length && y >= chartArea.y && y <= chartArea.y + chartArea.height) {
    const point = data[barIndex];
    if (point.count > 0) {
      const eventTypesText = Object.entries(point.eventTypes || {})
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

      tooltip.value = {
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 30,
        text: `${point.count} events${eventTypesText ? ` (${eventTypesText})` : ''}`
      };
      return;
    }
  }

  tooltip.value.visible = false;
};

const handleMouseLeave = () => {
  tooltip.value.visible = false;
};

// Watch for theme changes
const themeObserver = new MutationObserver(() => {
  if (renderer) {
    render();
  }
});

onMounted(() => {
  if (!canvas.value || !chartContainer.value) return;

  const dimensions = getDimensions();
  const config = getActiveConfig();

  renderer = createChartRenderer(canvas.value, dimensions, config);

  // Set up resize observer
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(chartContainer.value);

  // Observe theme changes
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Initial render
  render();

  // Start optimized render loop with FPS limiting
  let lastRenderTime = 0;
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;

  const renderLoop = (currentTime: number) => {
    const deltaTime = currentTime - lastRenderTime;

    if (deltaTime >= frameInterval) {
      render();
      lastRenderTime = currentTime - (deltaTime % frameInterval);
    }

    renderLoopFrame = requestAnimationFrame(renderLoop);
  };
  renderLoopFrame = requestAnimationFrame(renderLoop);
});

onUnmounted(() => {
  cleanupChartData();

  if (renderer) {
    renderer.stopAnimation();
  }

  if (resizeObserver && chartContainer.value) {
    resizeObserver.disconnect();
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  if (renderLoopFrame) {
    cancelAnimationFrame(renderLoopFrame);
  }

  themeObserver.disconnect();
});
</script>

<style scoped>
.asl-root {
  width: 100%;
  background: #111113;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.asl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.asl-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.asl-agent-id {
  display: inline-flex;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 11px;
  line-height: 1;
}

.asl-app {
  padding: 3px 6px;
  border-radius: 3px 0 0 3px;
  border: 1px solid;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.04);
  font-weight: 600;
}

.asl-session {
  padding: 3px 6px;
  border-radius: 0 3px 3px 0;
  border: 1px solid;
  border-left: none;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.02);
  font-weight: 400;
}

.asl-badge {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  font-weight: 500;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.asl-inline-stat {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
  white-space: nowrap;
}

.asl-inline-stat strong {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.asl-close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.2);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.asl-close:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
}

.asl-chart {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #0c0c0e;
  border-radius: 0 0 5px 5px;
}

.asl-canvas {
  width: 100%;
  cursor: crosshair;
  display: block;
}

.asl-tooltip {
  position: absolute;
  background: #1a1a1e;
  color: rgba(255, 255, 255, 0.85);
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 11px;
  pointer-events: none;
  z-index: 10;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.asl-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.asl-empty p {
  color: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  font-weight: 500;
}
</style>
