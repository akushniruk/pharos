export function getLifecycleColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--theme-accent-success)'
    case 'idle': return 'var(--theme-text-tertiary)'
    case 'completed': return 'var(--theme-accent-info, #3b82f6)'
    case 'errored': return 'var(--theme-accent-error)'
    default: return 'var(--theme-text-tertiary)'
  }
}

export function getLifecycleLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active'
    case 'idle': return 'Idle'
    case 'completed': return 'Completed'
    case 'errored': return 'Error'
    default: return status
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const remainS = s % 60
  if (m < 60) return `${m}m ${remainS}s`
  const h = Math.floor(m / 60)
  const remainM = m % 60
  return `${h}h ${remainM}m`
}

export function getShortAgentId(sourceApp: string, sessionId: string): string {
  return `${sourceApp}:${sessionId.slice(0, 8)}`
}
