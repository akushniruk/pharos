import { ref, watch } from 'vue'
import type { HookEvent } from '../types'

export interface NotificationConfig {
  enabled: boolean
  sound: boolean
  browserNotifications: boolean
  events: Record<string, boolean>
}

const STORAGE_KEY = 'pharos-notification-config'

const defaultConfig: NotificationConfig = {
  enabled: true,
  sound: true,
  browserNotifications: true,
  events: {
    Stop: true,
    SubagentStop: true,
    Notification: true,
    PermissionRequest: true,
    PostToolUseFailure: true,
    SessionEnd: true,
    SubagentStart: false,
    PreToolUse: false,
    PostToolUse: false,
    SessionStart: false,
    UserPromptSubmit: false,
    PreCompact: false,
  }
}

export function useNotifications() {
  const config = ref<NotificationConfig>(loadConfig())
  const permission = ref<NotificationPermission>('default')

  function loadConfig(): NotificationConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...defaultConfig,
          ...parsed,
          events: { ...defaultConfig.events, ...(parsed.events || {}) }
        }
      }
      return { ...defaultConfig, events: { ...defaultConfig.events } }
    } catch {
      return { ...defaultConfig, events: { ...defaultConfig.events } }
    }
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
  }

  async function requestPermission() {
    if ('Notification' in window) {
      permission.value = await Notification.requestPermission()
    }
  }

  function shouldNotify(event: HookEvent): boolean {
    if (!config.value.enabled) return false
    return config.value.events[event.hook_event_type] ?? false
  }

  function getNotificationMessage(event: HookEvent): { title: string; body: string } {
    const agent = event.display_name || event.agent_name ||
      `${event.source_app}:${(event.session_id || '').slice(0, 8)}`
    const tool = event.payload?.tool_name || ''

    switch (event.hook_event_type) {
      case 'Stop':
        return { title: 'Agent Finished', body: `${agent} has completed its work` }
      case 'SubagentStop':
        return { title: 'Sub-agent Stopped', body: `${agent} sub-agent has finished` }
      case 'Notification':
        return { title: 'Agent Notification', body: event.payload?.message || `${agent} sent a notification` }
      case 'PermissionRequest':
        return { title: 'Permission Needed', body: `${agent} is requesting permission for ${tool}` }
      case 'PostToolUseFailure':
        return { title: 'Tool Failed', body: `${agent}: ${tool} failed` }
      case 'SessionEnd':
        return { title: 'Session Ended', body: `${agent} session has ended` }
      case 'SubagentStart':
        return { title: 'Agent Spawned', body: `${agent} spawned a new sub-agent` }
      default:
        return { title: 'Pharos', body: `${agent}: ${event.hook_event_type}` }
    }
  }

  function sendBrowserNotification(event: HookEvent) {
    if (!config.value.browserNotifications) return
    if (permission.value !== 'granted') return
    const { title, body } = getNotificationMessage(event)
    new Notification(title, { body, icon: '/favicon.ico', tag: `pharos-${event.id}` })
  }

  let audioCtx: AudioContext | null = null
  function playSound() {
    if (!config.value.sound) return
    try {
      if (!audioCtx) audioCtx = new AudioContext()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 800
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
      osc.stop(audioCtx.currentTime + 0.3)
    } catch {
      /* ignore audio errors */
    }
  }

  function notify(event: HookEvent) {
    if (!shouldNotify(event)) return
    sendBrowserNotification(event)
    playSound()
  }

  watch(config, saveConfig, { deep: true })

  if (typeof window !== 'undefined' && 'Notification' in window) {
    permission.value = Notification.permission
  }

  return { config, permission, requestPermission, notify, getNotificationMessage }
}
