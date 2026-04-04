/** Event from the daemon WebSocket stream */
export interface HookEvent {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  timestamp: number;
  agent_id?: string;
  agent_type?: string;
  model_name?: string;
  display_name?: string;
  agent_name?: string;
}

export type ActivityTone = 'active' | 'blocked' | 'attention' | 'idle' | 'done';

/** Agent from the registry endpoint */
export interface AgentEntry {
  id: string;
  source_app: string;
  session_id: string;
  agent_id?: string;
  display_name: string;
  agent_type?: string;
  model_name?: string;
  parent_id?: string;
  team_name?: string;
  lifecycle_status: string;
  first_seen_at: number;
  last_seen_at: number;
  event_count: number;
}

/** Project derived from events */
export interface Project {
  name: string;
  iconUrl?: string;
  runtimeLabels: string[];
  sessions: SessionInfo[];
  summary?: string;
  summaryDetail?: string;
  eventCount: number;
  agentCount: number;
  activeSessionCount: number;
  lastEventAt: number;
  isActive: boolean;
}

/** Session within a project */
export interface SessionInfo {
  sessionId: string;
  label: string;
  runtimeLabel?: string;
  summary?: string;
  summaryDetail?: string;
  statusLabel?: string;
  statusTone?: ActivityTone;
  statusDetail?: string;
  currentProgress?: string;
  currentProgressDetail?: string;
  currentAction?: string;
  currentActionDetail?: string;
  nextAction?: string;
  nextActionDetail?: string;
  eventCount: number;
  agents: AgentInfo[];
  activeAgentCount: number;
  lastEventAt: number;
  isActive: boolean;
}

/** Agent within a session */
export interface AgentInfo {
  agentId: string | null;
  displayName: string;
  avatarUrl?: string;
  runtimeLabel?: string;
  assignment?: string;
  assignmentDetail?: string;
  statusLabel?: string;
  statusTone?: ActivityTone;
  statusDetail?: string;
  currentProgress?: string;
  currentProgressDetail?: string;
  currentAction?: string;
  currentActionDetail?: string;
  nextAction?: string;
  nextActionDetail?: string;
  agentType?: string;
  modelName?: string;
  eventCount: number;
  lastEventAt: number;
  isActive: boolean;
  parentId?: string;
}

/** Lightweight viewed-state snapshot for the selected scope */
export interface ViewedChangesSnapshot {
  scopeKey: string;
  scopeLabel: string;
  scopeDetail: string;
  headline: string;
  body: string;
  lastViewedAt: number | null;
  latestEventAt: number;
  unreadCount: number;
  hasUnreadChanges: boolean;
  items: RecentChangeItem[];
}

/** Navigation state */
export type View =
  | { page: 'projects' }
  | { page: 'project'; projectName: string }
  | { page: 'project'; projectName: string; sessionId: string };
