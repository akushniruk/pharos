// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;
  agent_id?: string;
  agent_type?: string;
  display_name?: string;
  agent_name?: string;
  description?: string;
  parent_agent_id?: string;
  agent_status?: 'active' | 'idle' | 'error' | 'stopped';

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
  agent_ids: string[];
  agent_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response' | 'agent_registry' | string;
  data: any;
}

export interface AgentRegistryEntry {
  id: string
  source_app: string
  session_id: string
  agent_id?: string
  display_name?: string
  agent_type?: string
  model_name?: string
  parent_id?: string
  team_name?: string
  lifecycle_status: 'active' | 'idle' | 'completed' | 'errored'
  first_seen_at: number
  last_seen_at: number
  event_count: number
}

export type TimeRange = '1m' | '3m' | '5m' | '10m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  toolEvents?: Record<string, number>; // "EventType:ToolName" -> count (e.g., "PreToolUse:Bash" -> 3)
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}

// Metro Map / Agent Graph types
export interface AgentNode {
  id: string;
  source_app: string;
  session_id: string;
  agent_id?: string;
  agent_type?: string;
  model_name?: string;
  display_name: string;
  agent_status: 'active' | 'idle' | 'error' | 'stopped';
  first_seen: number;
  last_seen: number;
  event_count: number;
  task_summary?: string;
  tool_counts?: Record<string, number>;
  inferred_role?: string;
}

export interface AgentEdge {
  source: string;
  target: string;
  type: 'spawned';
}

export interface AgentGraphData {
  agents: AgentNode[];
  edges: AgentEdge[];
}

export interface SessionSummary {
  session_id: string;
  source_app: string;
  started_at: number;
  last_event_at: number;
  event_count: number;
  agent_count: number;
  agents: string[];
}