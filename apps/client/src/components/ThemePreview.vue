<template>
  <div class="tp-root">
    <div class="tp-header">
      <span class="tp-title">Preview</span>
      <button @click="$emit('apply')" class="tp-apply">Apply</button>
    </div>

    <!-- Preview Window -->
    <div class="tp-preview">
      <!-- Mini header simulation -->
      <div
        class="tp-sim-header"
        :style="{
          backgroundColor: theme.colors?.bgPrimary || '#111113',
          borderColor: theme.colors?.borderPrimary || 'rgba(255,255,255,0.06)'
        }"
      >
        <span
          class="tp-sim-title"
          :style="{ color: theme.colors?.textPrimary || '#ffffff' }"
        >{{ theme.displayName || 'Theme' }}</span>
        <div class="tp-sim-status">
          <div
            class="tp-dot"
            :style="{ backgroundColor: theme.colors?.accentSuccess || '#10b981' }"
          ></div>
          <span
            class="tp-sim-label"
            :style="{ color: theme.colors?.textTertiary || 'rgba(255,255,255,0.35)' }"
          >Connected</span>
        </div>
      </div>

      <!-- Content area simulation -->
      <div
        class="tp-sim-content"
        :style="{ backgroundColor: theme.colors?.bgSecondary || '#0c0c0e' }"
      >
        <!-- Simulated event card -->
        <div
          class="tp-sim-card"
          :style="{
            backgroundColor: theme.colors?.bgPrimary || '#111113',
            borderColor: theme.colors?.borderPrimary || 'rgba(255,255,255,0.06)'
          }"
        >
          <div class="tp-sim-card-row">
            <span
              class="tp-sim-badge"
              :style="{
                backgroundColor: (theme.colors?.primary || '#fbbf24') + '18',
                color: theme.colors?.primary || '#fbbf24',
                borderColor: (theme.colors?.primary || '#fbbf24') + '30'
              }"
            >demo-app</span>
            <span
              class="tp-sim-session"
              :style="{
                color: theme.colors?.textSecondary || 'rgba(255,255,255,0.6)',
                borderColor: theme.colors?.borderSecondary || 'rgba(255,255,255,0.08)'
              }"
            >abc123</span>
            <span
              class="tp-sim-event"
              :style="{
                backgroundColor: (theme.colors?.accentInfo || '#3b82f6') + '18',
                color: theme.colors?.accentInfo || '#3b82f6'
              }"
            >PreToolUse</span>
          </div>
          <div class="tp-sim-card-detail">
            <span :style="{ color: theme.colors?.textSecondary || 'rgba(255,255,255,0.6)' }">Bash</span>
            <span
              class="tp-sim-cmd"
              :style="{ color: theme.colors?.textTertiary || 'rgba(255,255,255,0.35)' }"
            >ls -la</span>
          </div>
        </div>

        <!-- Color palette -->
        <div class="tp-palette">
          <div
            v-for="(color, key) in displayColors"
            :key="key"
            class="tp-color"
            :style="{ backgroundColor: color, borderColor: theme.colors?.borderPrimary || 'rgba(255,255,255,0.06)' }"
            :title="`${formatColorLabel(key)}: ${color}`"
          ></div>
        </div>

        <!-- Status row -->
        <div class="tp-status-row">
          <div class="tp-statuses">
            <span class="tp-status-item">
              <span class="tp-dot" :style="{ backgroundColor: theme.colors?.accentSuccess || '#10b981' }"></span>
              <span :style="{ color: theme.colors?.textSecondary || 'rgba(255,255,255,0.6)' }">Success</span>
            </span>
            <span class="tp-status-item">
              <span class="tp-dot" :style="{ backgroundColor: theme.colors?.accentWarning || '#f59e0b' }"></span>
              <span :style="{ color: theme.colors?.textSecondary || 'rgba(255,255,255,0.6)' }">Warning</span>
            </span>
            <span class="tp-status-item">
              <span class="tp-dot" :style="{ backgroundColor: theme.colors?.accentError || '#ef4444' }"></span>
              <span :style="{ color: theme.colors?.textSecondary || 'rgba(255,255,255,0.6)' }">Error</span>
            </span>
          </div>
          <span :style="{ color: theme.colors?.textTertiary || 'rgba(255,255,255,0.35)' }">156 events</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CustomTheme, CreateThemeFormData } from '../types/theme';

interface Props {
  theme: CustomTheme | CreateThemeFormData;
}

const props = defineProps<Props>();

defineEmits<{
  apply: [];
}>();

// Extract only the visible colors for the palette display
const displayColors = computed(() => {
  const colors = props.theme.colors;
  if (!colors) return {};

  return {
    primary: colors.primary,
    bgPrimary: colors.bgPrimary,
    bgSecondary: colors.bgSecondary,
    bgTertiary: colors.bgTertiary,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    accentSuccess: colors.accentSuccess,
    accentError: colors.accentError
  };
});

const formatColorLabel = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// hover handlers removed (CSS handles hover states now)
</script>

<style scoped>
.tp-root {
  background: #18181b;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.tp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tp-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.tp-apply {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  background: #fbbf24;
  color: #111113;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
  font-family: inherit;
}

.tp-apply:hover {
  background: #e6b83a;
}

.tp-preview {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.tp-sim-header {
  padding: 10px 14px;
  border-bottom: 1px solid;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-sim-title {
  font-size: 12px;
  font-weight: 600;
}

.tp-sim-status {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tp-sim-label {
  font-size: 11px;
}

.tp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tp-sim-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tp-sim-card {
  padding: 10px 12px;
  border-radius: 5px;
  border: 1px solid;
}

.tp-sim-card-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.tp-sim-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid;
}

.tp-sim-session {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.tp-sim-event {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 3px;
}

.tp-sim-card-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.tp-sim-cmd {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
}

.tp-palette {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.tp-color {
  height: 20px;
  border-radius: 3px;
  border: 1px solid;
}

.tp-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.tp-statuses {
  display: flex;
  gap: 12px;
}

.tp-status-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}
</style>
