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
  lifecycle_status: string;
  first_seen_at: number;
  last_seen_at: number;
  event_count: number;
}

/** Project derived from events */
export interface Project {
  name: string;
  runtimeLabels: string[];
  sessions: SessionInfo[];
  summary?: string;
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
  currentAction?: string;
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
  runtimeLabel?: string;
  assignment?: string;
  currentAction?: string;
  agentType?: string;
  modelName?: string;
  eventCount: number;
  lastEventAt: number;
  isActive: boolean;
  parentId?: string;
}

/** Navigation state */
export type View =
  | { page: 'projects' }
  | { page: 'project'; projectName: string }
  | { page: 'project'; projectName: string; sessionId: string };
