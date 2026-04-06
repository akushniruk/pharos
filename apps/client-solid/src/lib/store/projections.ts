/**
 * Derived memos and snapshot builders built on WebSocket-fed state.
 */
export type { ActivityTone } from './state';
export type { LogsAttentionAlert } from './state';
export {
  projects,
  selectedProjectSnapshot,
  selectedSessionSnapshot,
  logsAttentionAlerts,
  selectedAgentSnapshot,
  sidebarSessionActivityTone,
  buildProjectFocusSnapshot,
  buildRecentChangesSnapshot,
  buildViewedChangesSnapshot,
  selectedAgentDetailSnapshot,
  resolveActivityState,
  resolveConservativeStatusDetail,
  filteredAgents,
  graphAgents,
  deriveRuntimeBridgeCandidates,
  runtimeBridgeCandidates,
  selectedProjectFocusSnapshot,
  selectedRecentChangesSnapshot,
  selectedViewedChangesSnapshot,
  filteredEvents,
} from './state';
