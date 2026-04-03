import { computed, type Ref } from 'vue'
import type { HookEvent } from '../types'

// Helper to shorten model names
function shortenModelName(name: string): string {
  if (name.includes('opus')) return 'Opus'
  if (name.includes('sonnet')) return 'Sonnet'
  if (name.includes('haiku')) return 'Haiku'
  // Strip common prefixes
  return name.replace(/^claude-/, '').replace(/-\d{8}$/, '').slice(0, 15)
}

export function useMetrics(events: Ref<HookEvent[]>) {
  // Tool success rate: PostToolUse / (PostToolUse + PostToolUseFailure) * 100
  const toolSuccessRate = computed(() => {
    const success = events.value.filter(e => e.hook_event_type === 'PostToolUse').length
    const failure = events.value.filter(e => e.hook_event_type === 'PostToolUseFailure').length
    const total = success + failure
    return total > 0 ? Math.round((success / total) * 100) : 100
  })

  // Tool distribution: top 3 tools by usage count
  const toolDistribution = computed(() => {
    const counts: Record<string, number> = {}
    events.value
      .filter(e => e.hook_event_type === 'PreToolUse' || e.hook_event_type === 'PostToolUse')
      .forEach(e => {
        const name = e.payload?.tool_name || 'Unknown'
        counts[name] = (counts[name] || 0) + 1
      })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))
  })

  // Total unique tools used
  const totalToolCount = computed(() => {
    const tools = new Set<string>()
    events.value
      .filter(e => e.hook_event_type === 'PreToolUse' || e.hook_event_type === 'PostToolUse')
      .forEach(e => {
        const name = e.payload?.tool_name
        if (name) tools.add(name)
      })
    return tools.size
  })

  // Per-agent durations (first event to last event)
  // Uses source_app:session_id(first 8 chars) as agent key per CLAUDE.md
  const agentDurations = computed(() => {
    const agentTimes: Record<string, { first: number; last: number; hasFailure: boolean }> = {}
    events.value.forEach(e => {
      if (!e.timestamp) return
      const key = `${e.source_app}:${e.session_id.slice(0, 8)}`
      if (!agentTimes[key]) {
        agentTimes[key] = { first: e.timestamp, last: e.timestamp, hasFailure: false }
      } else {
        agentTimes[key].first = Math.min(agentTimes[key].first, e.timestamp)
        agentTimes[key].last = Math.max(agentTimes[key].last, e.timestamp)
      }
      if (e.hook_event_type === 'PostToolUseFailure') {
        agentTimes[key].hasFailure = true
      }
    })
    return Object.entries(agentTimes).map(([id, times]) => ({
      id,
      durationMs: times.last - times.first,
      hasFailure: times.hasFailure
    }))
  })

  // Events per minute
  const eventsPerMinute = computed(() => {
    const validEvents = events.value.filter(e => e.timestamp && e.timestamp > 0)
    if (validEvents.length === 0) return 0
    if (validEvents.length === 1) return 1
    const sorted = validEvents
      .map(e => e.timestamp!)
      .sort((a, b) => a - b)
    const spanMs = sorted[sorted.length - 1] - sorted[0]
    if (spanMs <= 0) return validEvents.length // all same timestamp = burst
    const spanMinutes = spanMs / 60000
    if (spanMinutes < 0.1) return validEvents.length // less than 6 seconds, just show count
    return Math.round(validEvents.length / spanMinutes)
  })

  // Error rate: failures / total tool events
  const errorRate = computed(() => {
    const toolEvents = events.value.filter(
      e => e.hook_event_type === 'PostToolUse' || e.hook_event_type === 'PostToolUseFailure'
    ).length
    const failures = events.value.filter(e => e.hook_event_type === 'PostToolUseFailure').length
    return toolEvents > 0 ? Math.round((failures / toolEvents) * 100) : 0
  })

  // Model distribution: group by model_name, compute count + %
  const modelDistribution = computed(() => {
    const counts: Record<string, number> = {}
    events.value.forEach(e => {
      const model = e.model_name || 'unknown'
      if (model && model !== 'unknown') {
        counts[model] = (counts[model] || 0) + 1
      }
    })
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name: shortenModelName(name),
        fullName: name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
  })

  // Rough cost estimate based on model + event count
  const estimatedCost = computed(() => {
    const costPerEvent: Record<string, number> = {
      'opus': 0.05,
      'sonnet': 0.01,
      'haiku': 0.002,
    }
    let total = 0
    events.value.forEach(e => {
      const model = (e.model_name || '').toLowerCase()
      for (const [key, cost] of Object.entries(costPerEvent)) {
        if (model.includes(key)) { total += cost; break }
      }
    })
    return total
  })

  // Context pressure: count PreCompact events
  const contextPressureCount = computed(() => {
    return events.value.filter(e => e.hook_event_type === 'PreCompact').length
  })

  // Tool success detail (richer than just rate)
  const toolSuccessDetail = computed(() => {
    const succeeded = events.value.filter(e => e.hook_event_type === 'PostToolUse').length
    const failed = events.value.filter(e => e.hook_event_type === 'PostToolUseFailure').length
    return { succeeded, failed, total: succeeded + failed }
  })

  // Session duration in ms (first event to last event across all agents)
  const sessionDuration = computed(() => {
    let first = Infinity
    let last = 0
    events.value.forEach(e => {
      if (!e.timestamp) return
      if (e.timestamp < first) first = e.timestamp
      if (e.timestamp > last) last = e.timestamp
    })
    return last > 0 && first < Infinity ? last - first : 0
  })

  return {
    toolSuccessRate,
    toolDistribution,
    totalToolCount,
    agentDurations,
    eventsPerMinute,
    errorRate,
    sessionDuration,
    modelDistribution,
    estimatedCost,
    contextPressureCount,
    toolSuccessDetail
  }
}
