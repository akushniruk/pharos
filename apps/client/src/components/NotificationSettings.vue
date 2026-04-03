<template>
  <Teleport to="body">
    <Transition name="ns-fade">
      <div v-if="isOpen" class="ns-backdrop" @click="close">
        <div class="ns-modal" @click.stop>
          <div class="ns-header">
            <span class="ns-title">Notifications</span>
            <button @click="close" class="ns-close">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M1 1l10 10M11 1l-10 10" />
              </svg>
            </button>
          </div>

          <div class="ns-body">
            <!-- Master toggle -->
            <div class="ns-row ns-row--master">
              <label class="ns-toggle-label">
                <input type="checkbox" v-model="config.enabled" class="ns-checkbox" />
                <span class="ns-toggle-text">Enable notifications</span>
              </label>
            </div>

            <div v-if="config.enabled" class="ns-sections">
              <!-- Browser notifications -->
              <div class="ns-row">
                <label class="ns-toggle-label">
                  <input type="checkbox" v-model="config.browserNotifications" class="ns-checkbox" />
                  <span class="ns-toggle-text">Browser notifications</span>
                </label>
                <button
                  v-if="config.browserNotifications && permission !== 'granted'"
                  @click="requestPermission"
                  class="ns-btn-small"
                >
                  {{ permission === 'denied' ? 'Blocked by browser' : 'Grant permission' }}
                </button>
                <span v-if="config.browserNotifications && permission === 'granted'" class="ns-granted">
                  Granted
                </span>
              </div>

              <!-- Sound toggle -->
              <div class="ns-row">
                <label class="ns-toggle-label">
                  <input type="checkbox" v-model="config.sound" class="ns-checkbox" />
                  <span class="ns-toggle-text">Sound</span>
                </label>
              </div>

              <!-- Divider -->
              <div class="ns-divider"></div>

              <!-- Event categories -->
              <div class="ns-category">
                <span class="ns-category-title">Important</span>
                <div class="ns-event-list">
                  <label v-for="evt in importantEvents" :key="evt" class="ns-toggle-label">
                    <input type="checkbox" v-model="config.events[evt]" class="ns-checkbox" />
                    <span class="ns-toggle-text">{{ eventLabels[evt] || evt }}</span>
                  </label>
                </div>
              </div>

              <div class="ns-category">
                <span class="ns-category-title">Informational</span>
                <div class="ns-event-list">
                  <label v-for="evt in informationalEvents" :key="evt" class="ns-toggle-label">
                    <input type="checkbox" v-model="config.events[evt]" class="ns-checkbox" />
                    <span class="ns-toggle-text">{{ eventLabels[evt] || evt }}</span>
                  </label>
                </div>
              </div>

              <div class="ns-category">
                <span class="ns-category-title">Verbose</span>
                <div class="ns-event-list">
                  <label v-for="evt in verboseEvents" :key="evt" class="ns-toggle-label">
                    <input type="checkbox" v-model="config.events[evt]" class="ns-checkbox" />
                    <span class="ns-toggle-text">{{ eventLabels[evt] || evt }}</span>
                  </label>
                </div>
              </div>

              <!-- Divider -->
              <div class="ns-divider"></div>

              <!-- Test button -->
              <div class="ns-row">
                <button @click="handleTestNotification" class="ns-btn-test">
                  Test Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotifications } from '../composables/useNotifications'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { config, permission, requestPermission, getNotificationMessage } = useNotifications()

const importantEvents = ['Stop', 'SubagentStop', 'PermissionRequest', 'PostToolUseFailure']
const informationalEvents = ['Notification', 'SessionEnd', 'SubagentStart', 'SessionStart']
const verboseEvents = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'PreCompact']

const eventLabels: Record<string, string> = {
  Stop: 'Agent Stop',
  SubagentStop: 'Sub-agent Stop',
  PermissionRequest: 'Permission Request',
  PostToolUseFailure: 'Tool Failure',
  Notification: 'Notification',
  SessionEnd: 'Session End',
  SubagentStart: 'Sub-agent Start',
  SessionStart: 'Session Start',
  PreToolUse: 'Pre Tool Use',
  PostToolUse: 'Post Tool Use',
  UserPromptSubmit: 'User Prompt Submit',
  PreCompact: 'Pre Compact',
}

function handleTestNotification() {
  const testEvent = {
    source_app: 'pharos',
    session_id: 'test-1234',
    hook_event_type: 'Stop',
    payload: {},
    display_name: 'Test Agent',
  }
  // Force notify regardless of config for test
  const { title, body } = getNotificationMessage(testEvent)
  if (config.value.browserNotifications && permission.value === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'pharos-test' })
  }
  if (config.value.sound) {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* ignore */ }
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.ns-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.ns-modal {
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 8px;
  width: 380px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px var(--theme-shadow-lg);
}

.ns-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--theme-border-primary);
}

.ns-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.ns-close {
  background: none;
  border: none;
  color: var(--theme-text-quaternary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.ns-close:hover {
  color: var(--theme-text-secondary);
  background: var(--theme-hover-bg);
}

.ns-body {
  padding: 12px 16px;
  overflow-y: auto;
  max-height: calc(80vh - 50px);
}

.ns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}

.ns-row--master {
  padding-bottom: 8px;
}

.ns-toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.ns-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--theme-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.ns-toggle-text {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.ns-granted {
  font-size: 11px;
  color: var(--theme-accent-success);
}

.ns-btn-small {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-primary);
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ns-btn-small:hover {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
}

.ns-divider {
  height: 1px;
  background: var(--theme-border-primary);
  margin: 8px 0;
}

.ns-sections {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ns-category {
  padding: 4px 0;
}

.ns-category-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-text-quaternary);
  display: block;
  margin-bottom: 4px;
}

.ns-event-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 4px;
}

.ns-btn-test {
  font-size: 11px;
  padding: 5px 12px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-primary);
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ns-btn-test:hover {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
}

.ns-fade-enter-active {
  transition: opacity 0.15s ease;
}

.ns-fade-leave-active {
  transition: opacity 0.1s ease;
}

.ns-fade-enter-from,
.ns-fade-leave-to {
  opacity: 0;
}
</style>
