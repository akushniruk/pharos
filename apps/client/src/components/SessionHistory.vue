<template>
  <div class="sh-root">
    <!-- Split layout: session list on left, replay view on right -->
    <div class="sh-layout" :class="{ 'sh-layout--split': selectedSessionId !== null }">

      <!-- Session List Panel -->
      <div class="sh-list-panel">
        <div class="sh-list-header">
          <span class="sh-list-title">Sessions</span>
          <span class="sh-list-count">{{ sessions.length }} total</span>
        </div>

        <div class="sh-list-scroll">
          <div
            v-if="sessions.length === 0"
            class="sh-list-empty"
          >
            No sessions recorded yet.
          </div>

          <div
            v-for="session in sortedSessions"
            :key="session.session_id"
            class="sh-session-row"
            :class="{
              'sh-session-row--selected': selectedSessionId === session.session_id,
              'sh-session-row--active': isActiveSession(session)
            }"
            @click="selectSession(session.session_id)"
          >
            <div class="sh-session-row-top">
              <div class="sh-session-meta">
                <span class="sh-session-source">{{ session.source_app }}</span>
                <span class="sh-session-id">{{ session.session_id.slice(0, 8) }}</span>
                <span v-if="isActiveSession(session)" class="sh-badge sh-badge--active">live</span>
              </div>
              <div class="sh-session-badges">
                <span class="sh-badge sh-badge--agents" title="Agent count">
                  {{ session.agent_count }} agent{{ session.agent_count !== 1 ? 's' : '' }}
                </span>
                <span class="sh-badge sh-badge--events" title="Event count">
                  {{ session.event_count }} events
                </span>
              </div>
            </div>
            <div class="sh-session-row-bottom">
              <span class="sh-session-time">{{ formatDate(session.started_at) }}</span>
              <span class="sh-session-duration">{{ formatDuration(session.started_at, session.last_event_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Replay Panel (shown when session selected) -->
      <div v-if="selectedSessionId !== null" class="sh-replay-panel">

        <!-- Replay Header -->
        <div class="sh-replay-header">
          <div class="sh-replay-title">
            <span class="sh-replay-label">Replay</span>
            <span class="sh-replay-session-id">{{ selectedSessionId.slice(0, 8) }}</span>
          </div>
          <button class="sh-close-btn" title="Close replay" @click="closeReplay">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M1 1l8 8M9 1l-8 8" />
            </svg>
          </button>
        </div>

        <!-- Loading state -->
        <div v-if="isLoadingEvents" class="sh-replay-loading">
          <div class="sh-spinner"></div>
          <span>Loading session events...</span>
        </div>

        <!-- Replay controls (shown when events loaded) -->
        <template v-else>
          <!-- Playback Controls Bar -->
          <div class="sh-controls-bar">
            <div class="sh-controls-left">
              <!-- Reset -->
              <button
                class="sh-ctrl-btn"
                title="Reset to start"
                @click="resetPlayback"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 7a6 6 0 1 0 2-4.5"/>
                  <path d="M1 2.5V7h4.5"/>
                </svg>
              </button>

              <!-- Play / Pause -->
              <button
                class="sh-ctrl-btn sh-ctrl-btn--play"
                :title="isPlaying ? 'Pause' : 'Play'"
                @click="togglePlayback"
              >
                <!-- Pause icon -->
                <svg v-if="isPlaying" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="2" y="2" width="3.5" height="10" rx="1"/>
                  <rect x="8.5" y="2" width="3.5" height="10" rx="1"/>
                </svg>
                <!-- Play icon -->
                <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M3 2l9 5-9 5V2z"/>
                </svg>
              </button>
            </div>

            <!-- Speed selector -->
            <div class="sh-speed-group">
              <span class="sh-speed-label">Speed</span>
              <div class="sh-speed-options">
                <button
                  v-for="speed in playbackSpeeds"
                  :key="speed"
                  class="sh-speed-btn"
                  :class="{ 'sh-speed-btn--active': playbackSpeed === speed }"
                  @click="setSpeed(speed)"
                >{{ speed }}x</button>
              </div>
            </div>

            <!-- Status text -->
            <div class="sh-replay-status">
              <span v-if="sessionEvents.length > 0">
                Replaying: {{ currentEventIndex }}/{{ sessionEvents.length }} events
              </span>
              <span v-else class="sh-replay-status--empty">No events in this session</span>
            </div>
          </div>

          <!-- Timeline Scrubber -->
          <div class="sh-timeline-bar" v-if="sessionEvents.length > 0">
            <span class="sh-timeline-label">{{ formatTimestamp(sessionEvents[0]?.timestamp ?? 0) }}</span>
            <div class="sh-timeline-track" @click="scrubTimeline" ref="timelineTrack">
              <div class="sh-timeline-fill" :style="{ width: progressPercent + '%' }"></div>
              <div
                class="sh-timeline-thumb"
                :style="{ left: progressPercent + '%' }"
                @mousedown="startDrag"
              ></div>
            </div>
            <span class="sh-timeline-label">{{ formatTimestamp(sessionEvents[sessionEvents.length - 1]?.timestamp ?? 0) }}</span>
          </div>

          <!-- Events Preview List -->
          <div class="sh-events-preview" v-if="sessionEvents.length > 0">
            <div class="sh-events-preview-header">
              <span>Event Log</span>
              <span class="sh-events-count">{{ sessionEvents.length }} events</span>
            </div>
            <div class="sh-events-scroll">
              <div
                v-for="(event, index) in sessionEvents"
                :key="index"
                class="sh-event-row"
                :class="{
                  'sh-event-row--past': index < currentEventIndex,
                  'sh-event-row--current': index === currentEventIndex - 1
                }"
              >
                <span class="sh-event-index">{{ index + 1 }}</span>
                <span class="sh-event-type">{{ event.hook_event_type }}</span>
                <span class="sh-event-agent">{{ event.source_app }}:{{ event.session_id?.slice(0, 8) }}</span>
                <span class="sh-event-time">{{ formatTimestamp(event.timestamp ?? 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else class="sh-replay-empty">
            No events found for this session.
          </div>
        </template>
      </div>

      <!-- No session selected placeholder -->
      <div v-else-if="sessions.length > 0" class="sh-no-selection">
        <div class="sh-no-selection-inner">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <circle cx="16" cy="16" r="12"/>
            <path d="M12 16l8 0M16 12v8"/>
          </svg>
          <p>Select a session to replay</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import type { HookEvent, SessionSummary } from '../types';
import { API_BASE_URL } from '../config';

const props = defineProps<{
  sessions: SessionSummary[];
}>();

const emit = defineEmits<{
  'select-session': [sessionId: string];
  'replay-event': [event: HookEvent];
}>();

// --- State ---
const selectedSessionId = ref<string | null>(null);
const isPlaying = ref<boolean>(false);
const playbackSpeed = ref<number>(1);
const currentEventIndex = ref<number>(0);
const sessionEvents = ref<HookEvent[]>([]);
const isLoadingEvents = ref<boolean>(false);
const timelineTrack = ref<HTMLDivElement>();

const playbackSpeeds = [1, 2, 5] as const;

let playbackTimer: ReturnType<typeof setTimeout> | null = null;
let isDragging = false;

// --- Computed ---
const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => b.started_at - a.started_at);
});

const progressPercent = computed(() => {
  if (sessionEvents.value.length === 0) return 0;
  return (currentEventIndex.value / sessionEvents.value.length) * 100;
});

// --- Helpers ---
const isActiveSession = (session: SessionSummary): boolean => {
  // Consider a session "active/live" if its last event was within the last 30 seconds
  const thirtySecondsAgo = Date.now() - 30_000;
  return session.last_event_at > thirtySecondsAgo;
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (startTs: number, endTs: number): string => {
  const ms = endTs - startTs;
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remainS = s % 60;
  return `${m}m ${remainS}s`;
};

const formatTimestamp = (ts: number): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// --- Session selection & event loading ---
const selectSession = async (sessionId: string) => {
  if (selectedSessionId.value === sessionId) return;

  stopPlayback();
  selectedSessionId.value = sessionId;
  currentEventIndex.value = 0;
  sessionEvents.value = [];
  isLoadingEvents.value = true;

  emit('select-session', sessionId);

  try {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      sessionEvents.value = Array.isArray(data) ? data : (data.events ?? []);
    } else {
      console.error('Failed to load session events:', response.status);
    }
  } catch (err) {
    console.error('Error loading session events:', err);
  } finally {
    isLoadingEvents.value = false;
  }
};

const closeReplay = () => {
  stopPlayback();
  selectedSessionId.value = null;
  sessionEvents.value = [];
  currentEventIndex.value = 0;
};

// --- Playback controls ---
const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback();
  } else {
    startPlayback();
  }
};

const startPlayback = () => {
  if (currentEventIndex.value >= sessionEvents.value.length) {
    currentEventIndex.value = 0;
  }
  isPlaying.value = true;
  scheduleNextEvent();
};

const stopPlayback = () => {
  isPlaying.value = false;
  if (playbackTimer !== null) {
    clearTimeout(playbackTimer);
    playbackTimer = null;
  }
};

const scheduleNextEvent = () => {
  if (!isPlaying.value) return;
  if (currentEventIndex.value >= sessionEvents.value.length) {
    stopPlayback();
    return;
  }

  const current = sessionEvents.value[currentEventIndex.value];
  const next = sessionEvents.value[currentEventIndex.value + 1];

  // Emit the current event
  emit('replay-event', current);
  currentEventIndex.value++;

  if (!next) {
    stopPlayback();
    return;
  }

  // Calculate delay between events, scaled by playback speed
  const currentTs = current.timestamp ?? 0;
  const nextTs = next.timestamp ?? 0;
  const rawDelay = Math.max(0, nextTs - currentTs);
  const delay = rawDelay / playbackSpeed.value;

  // Cap delay to at most 3 seconds to keep things moving
  const cappedDelay = Math.min(delay, 3000);

  playbackTimer = setTimeout(scheduleNextEvent, cappedDelay || 100);
};

const resetPlayback = () => {
  stopPlayback();
  currentEventIndex.value = 0;
};

const setSpeed = (speed: number) => {
  playbackSpeed.value = speed;
  // If currently playing, restart scheduling with new speed
  if (isPlaying.value) {
    stopPlayback();
    startPlayback();
  }
};

// --- Timeline scrubbing ---
const scrubTimeline = (event: MouseEvent) => {
  if (!timelineTrack.value || sessionEvents.value.length === 0) return;
  const rect = timelineTrack.value.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const newIndex = Math.round(pct * sessionEvents.value.length);
  currentEventIndex.value = newIndex;
};

const startDrag = (event: MouseEvent) => {
  isDragging = true;
  event.preventDefault();

  const onMove = (e: MouseEvent) => {
    if (!isDragging || !timelineTrack.value) return;
    const rect = timelineTrack.value.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    currentEventIndex.value = Math.round(pct * sessionEvents.value.length);
  };

  const onUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

// --- Cleanup ---
onUnmounted(() => {
  stopPlayback();
});
</script>

<style scoped>
.sh-root {
  height: 100%;
  overflow: hidden;
  background: #0d0d0f;
}

/* ---- Layout ---- */
.sh-layout {
  display: flex;
  height: 100%;
}

.sh-layout--split .sh-list-panel {
  width: 280px;
  min-width: 220px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

/* ---- Session List Panel ---- */
.sh-list-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.sh-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sh-list-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
}

.sh-list-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
}

.sh-list-scroll {
  overflow-y: auto;
  flex: 1;
}

.sh-list-scroll::-webkit-scrollbar {
  width: 4px;
}

.sh-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sh-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.sh-list-empty {
  padding: 24px 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
}

/* ---- Session Row ---- */
.sh-session-row {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.12s ease;
}

.sh-session-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.sh-session-row--selected {
  background: rgba(251, 191, 36, 0.07);
  border-left: 2px solid rgba(251, 191, 36, 0.5);
}

.sh-session-row--active {
  border-left: 2px solid rgba(72, 199, 142, 0.6);
}

.sh-session-row--active.sh-session-row--selected {
  border-left-color: rgba(251, 191, 36, 0.5);
}

.sh-session-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.sh-session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sh-session-source {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.sh-session-id {
  font-size: 10px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

.sh-session-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.sh-session-row-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sh-session-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.sh-session-duration {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  font-family: monospace;
}

/* ---- Badges ---- */
.sh-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

.sh-badge--active {
  background: rgba(72, 199, 142, 0.15);
  color: rgba(72, 199, 142, 0.9);
  border: 1px solid rgba(72, 199, 142, 0.3);
}

.sh-badge--agents {
  background: rgba(100, 150, 255, 0.1);
  color: rgba(100, 150, 255, 0.8);
  border: 1px solid rgba(100, 150, 255, 0.2);
}

.sh-badge--events {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ---- Replay Panel ---- */
.sh-replay-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sh-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sh-replay-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sh-replay-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
}

.sh-replay-session-id {
  font-size: 11px;
  font-family: monospace;
  color: rgba(251, 191, 36, 0.7);
}

.sh-close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.12s ease, background 0.12s ease;
}

.sh-close-btn:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
}

/* ---- Loading ---- */
.sh-replay-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.sh-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(251, 191, 36, 0.7);
  border-radius: 50%;
  animation: sh-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes sh-spin {
  to { transform: rotate(360deg); }
}

/* ---- Playback Controls ---- */
.sh-controls-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.sh-controls-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sh-ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.sh-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

.sh-ctrl-btn--play {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.3);
  color: rgba(251, 191, 36, 0.9);
}

.sh-ctrl-btn--play:hover {
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.5);
  color: rgba(251, 191, 36, 1);
}

/* ---- Speed Controls ---- */
.sh-speed-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sh-speed-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: lowercase;
}

.sh-speed-options {
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  overflow: hidden;
}

.sh-speed-btn {
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.sh-speed-btn:last-child {
  border-right: none;
}

.sh-speed-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
}

.sh-speed-btn--active {
  background: rgba(251, 191, 36, 0.12);
  color: rgba(251, 191, 36, 0.9);
}

/* ---- Status Text ---- */
.sh-replay-status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.sh-replay-status--empty {
  color: rgba(255, 255, 255, 0.2);
}

/* ---- Timeline Scrubber ---- */
.sh-timeline-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.sh-timeline-label {
  font-size: 10px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.25);
  white-space: nowrap;
  flex-shrink: 0;
}

.sh-timeline-track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
}

.sh-timeline-track:hover {
  background: rgba(255, 255, 255, 0.09);
}

.sh-timeline-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(251, 191, 36, 0.5);
  border-radius: 3px;
  pointer-events: none;
  transition: width 0.1s linear;
}

.sh-timeline-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(251, 191, 36, 0.9);
  border: 2px solid rgba(251, 191, 36, 0.3);
  cursor: grab;
  transition: left 0.1s linear;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
}

.sh-timeline-thumb:active {
  cursor: grabbing;
}

/* ---- Events Preview ---- */
.sh-events-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sh-events-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.sh-events-count {
  color: rgba(255, 255, 255, 0.2);
}

.sh-events-scroll {
  flex: 1;
  overflow-y: auto;
}

.sh-events-scroll::-webkit-scrollbar {
  width: 4px;
}

.sh-events-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sh-events-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.sh-event-row {
  display: grid;
  grid-template-columns: 36px 1fr 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  font-size: 11px;
  transition: background 0.08s ease;
}

.sh-event-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.sh-event-row--past {
  opacity: 0.45;
}

.sh-event-row--current {
  opacity: 1;
  background: rgba(251, 191, 36, 0.05);
  border-left: 2px solid rgba(251, 191, 36, 0.5);
}

.sh-event-index {
  font-family: monospace;
  color: rgba(255, 255, 255, 0.2);
  text-align: right;
}

.sh-event-type {
  color: rgba(255, 255, 255, 0.65);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sh-event-agent {
  font-family: monospace;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sh-event-time {
  font-family: monospace;
  color: rgba(255, 255, 255, 0.2);
  white-space: nowrap;
  font-size: 10px;
}

/* ---- Empty / No selection states ---- */
.sh-replay-empty {
  padding: 24px 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
}

.sh-no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sh-no-selection-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.25);
  font-size: 13px;
}

.sh-no-selection-inner p {
  margin: 0;
}
</style>
