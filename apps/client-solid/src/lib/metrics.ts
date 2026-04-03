import { createMemo, type Accessor } from 'solid-js';
import type { HookEvent } from './types';

export function createMetrics(events: Accessor<HookEvent[]>) {
  const agentCount = createMemo(() => {
    const ids = new Set(events().map(e => e.agent_id || '__main__'));
    return ids.size;
  });

  const primaryModel = createMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events()) {
      const m = e.model_name || e.payload?.model;
      if (m) counts.set(m, (counts.get(m) || 0) + 1);
    }
    let best = ''; let max = 0;
    for (const [k, v] of counts) { if (v > max) { best = k; max = v; } }
    return best.replace('claude-', '');
  });

  const toolSuccessRate = createMemo(() => {
    const ok = events().filter(e => e.hook_event_type === 'PostToolUse').length;
    const fail = events().filter(e => e.hook_event_type === 'PostToolUseFailure').length;
    const total = ok + fail;
    return total > 0 ? Math.round((ok / total) * 100) : 100;
  });

  const eventsPerMinute = createMemo(() => {
    const evts = events();
    if (evts.length < 2) return 0;
    const first = evts[0]?.timestamp || 0;
    const last = evts[evts.length - 1]?.timestamp || 0;
    const minutes = (last - first) / 60000;
    return minutes > 0 ? Math.round(evts.length / minutes) : 0;
  });

  const sessionDuration = createMemo(() => {
    const evts = events();
    if (evts.length === 0) return '0s';
    const first = evts[0]?.timestamp || 0;
    const last = evts[evts.length - 1]?.timestamp || 0;
    const sec = Math.floor((last - first) / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${s}s`;
  });

  const errorRate = createMemo(() => {
    const fail = events().filter(e => e.hook_event_type === 'PostToolUseFailure').length;
    const total = events().filter(e =>
      e.hook_event_type === 'PostToolUse' || e.hook_event_type === 'PostToolUseFailure'
    ).length;
    return total > 0 ? (fail / total) * 100 : 0;
  });

  const healthStatus = createMemo((): 'green' | 'yellow' | 'red' => {
    const rate = errorRate();
    if (rate < 5) return 'green';
    if (rate < 15) return 'yellow';
    return 'red';
  });

  return { agentCount, primaryModel, toolSuccessRate, eventsPerMinute, sessionDuration, errorRate, healthStatus };
}
