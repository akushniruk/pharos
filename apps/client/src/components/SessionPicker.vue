<template>
  <div class="session-picker" ref="pickerRef">
    <!-- Trigger button -->
    <button
      class="session-picker__trigger"
      @click="isOpen = !isOpen"
      :title="currentSession ? `Session ${currentSession.session_id.slice(0, 8)}` : 'Select session'"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="session-picker__icon">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
      <span class="session-picker__label">
        <template v-if="currentSession">
          {{ currentSession.session_id.slice(0, 8) }}
          <span class="session-picker__time">{{ formatTime(currentSession.started_at) }}</span>
        </template>
        <template v-else>
          No session
        </template>
      </span>
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        class="session-picker__chevron"
        :class="{ 'session-picker__chevron--open': isOpen }"
      >
        <path d="M2.5 3.75l2.5 2.5 2.5-2.5" />
      </svg>
    </button>

    <!-- Dropdown panel -->
    <Transition name="picker-dropdown">
      <div v-if="isOpen" class="session-picker__dropdown">
        <div v-if="sessions.length === 0" class="session-picker__empty">
          No sessions available
        </div>

        <template v-for="(group, dateLabel) in groupedSessions" :key="dateLabel">
          <div class="session-picker__date-header">{{ dateLabel }}</div>
          <button
            v-for="session in group"
            :key="session.session_id"
            class="session-picker__item"
            :class="{ 'session-picker__item--active': session.session_id === currentSessionId }"
            @click="handleSelect(session.session_id)"
          >
            <div class="session-picker__item-main">
              <span class="session-picker__item-time">{{ formatTime(session.started_at) }}</span>
              <span class="session-picker__item-agents">
                {{ session.agent_count }} agent{{ session.agent_count !== 1 ? 's' : '' }}
              </span>
            </div>
            <div class="session-picker__item-meta">
              <span class="session-picker__item-events">{{ session.event_count }} events</span>
              <span class="session-picker__item-duration">{{ formatDuration(session.started_at, session.last_event_at) }}</span>
            </div>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { SessionSummary } from '../types';

const props = defineProps<{
  sessions: SessionSummary[];
  currentSessionId: string | null;
}>();

const emit = defineEmits<{
  select: [sessionId: string];
}>();

const isOpen = ref(false);
const pickerRef = ref<HTMLElement | null>(null);

const currentSession = computed(() =>
  props.sessions.find(s => s.session_id === props.currentSessionId) || null
);

// Group sessions by date
const groupedSessions = computed(() => {
  const groups: Record<string, SessionSummary[]> = {};

  const sorted = [...props.sessions].sort((a, b) => b.started_at - a.started_at);

  for (const session of sorted) {
    const dateLabel = formatDateLabel(session.started_at);
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(session);
  }

  return groups;
});

function formatDateLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startTs: number, endTs: number): string {
  const diffMs = endTs - startTs;
  if (diffMs < 0) return '--';
  const totalSeconds = Math.floor(diffMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function handleSelect(sessionId: string) {
  emit('select', sessionId);
  isOpen.value = false;
}

// Close on outside click
function handleClickOutside(event: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true);
});
</script>

<style scoped>
.session-picker {
  position: relative;
}

/* Trigger button */
.session-picker__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--theme-text-secondary);
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.session-picker__trigger:hover {
  color: var(--theme-text-primary);
  border-color: var(--theme-border-secondary);
  background-color: var(--theme-bg-quaternary);
}

.session-picker__icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.session-picker__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.session-picker__time {
  color: var(--theme-text-quaternary);
  font-size: 11px;
}

.session-picker__chevron {
  flex-shrink: 0;
  opacity: 0.5;
  transition: transform 0.15s ease;
}

.session-picker__chevron--open {
  transform: rotate(180deg);
}

/* Dropdown */
.session-picker__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  min-width: 260px;
  max-height: 320px;
  overflow-y: auto;
  background-color: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-secondary);
  border-radius: 8px;
  box-shadow: 0 8px 24px -4px var(--theme-shadow-lg);
  padding: 4px;
}

.session-picker__empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--theme-text-quaternary);
}

/* Date group header */
.session-picker__date-header {
  padding: 6px 8px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-text-quaternary);
}

/* Session item */
.session-picker__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  text-align: left;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.session-picker__item:hover {
  background-color: var(--theme-hover-bg);
}

.session-picker__item--active {
  background-color: var(--theme-primary-light);
}

.session-picker__item--active:hover {
  background-color: var(--theme-primary-light);
}

.session-picker__item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-picker__item-time {
  font-size: 13px;
  font-weight: 500;
  color: var(--theme-text-primary);
  font-variant-numeric: tabular-nums;
}

.session-picker__item-agents {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-primary);
  background-color: var(--theme-primary-light);
  padding: 1px 6px;
  border-radius: 10px;
}

.session-picker__item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-picker__item-events {
  font-size: 11px;
  color: var(--theme-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.session-picker__item-duration {
  font-size: 11px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
}

/* Dropdown transition */
.picker-dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.picker-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.picker-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
