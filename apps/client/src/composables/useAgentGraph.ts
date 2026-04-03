import { ref, computed, watch, type Ref } from 'vue';
import type { HookEvent, AgentNode, AgentEdge, AgentGraphData, SessionSummary } from '../types';
import { API_BASE_URL } from '../config';

// Idle threshold: 30 seconds with no events
const IDLE_THRESHOLD_MS = 30_000;

function makeAgentKey(source_app: string, session_id: string, agent_id?: string): string {
  const suffix = agent_id ? agent_id.slice(0, 8) : session_id.slice(0, 8);
  return `${source_app}:${suffix}`;
}

/**
 * Extract a human-friendly name from a SubagentStart event payload.
 * Claude Code Agent tool sends: name, description, subagent_type
 * e.g. name="frontend-builder", description="Implement Task 4: Metro components"
 */
function extractSpawnName(payload: Record<string, any>): string | null {
  // 1. Explicit name from Agent tool call (e.g. "frontend-builder" → "Frontend Builder")
  if (payload.name && typeof payload.name === 'string') {
    return payload.name
      .split(/[-_]/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  // 2. subagent_type if more specific than generic "builder"
  if (payload.subagent_type && typeof payload.subagent_type === 'string') {
    return payload.subagent_type
      .split(/[-_:]/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  // 3. Short description (first few words)
  if (payload.description && typeof payload.description === 'string') {
    const desc = payload.description;
    // Extract role-like prefix: "Implement Task 4: Metro components" → "Metro Components"
    const colonPart = desc.split(':').pop()?.trim();
    if (colonPart && colonPart.length < 40) {
      return colonPart;
    }
    // Fallback: first 3 words
    return desc.split(/\s+/).slice(0, 3).join(' ');
  }
  return null;
}

/** Pretty-print agent_type: "code-reviewer" → "Code Reviewer" */
function prettifyType(agentType: string): string {
  return agentType
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Infer a role label from accumulated tool usage counts */
function inferRoleFromTools(toolCounts: Record<string, number>): string | null {
  const total = Object.values(toolCounts).reduce((a, b) => a + b, 0);
  if (total < 3) return null; // not enough data

  const readTools = (toolCounts['Read'] || 0) + (toolCounts['Grep'] || 0) + (toolCounts['Glob'] || 0);
  const writeTools = (toolCounts['Edit'] || 0) + (toolCounts['Write'] || 0) + (toolCounts['MultiEdit'] || 0);
  const bashCount = toolCounts['Bash'] || 0;
  const agentTools = (toolCounts['Agent'] || 0) + (toolCounts['Task'] || 0) + (toolCounts['TeamCreate'] || 0);

  if (agentTools > 0 && agentTools >= total * 0.2) return 'Orchestrator';
  if (readTools > total * 0.6) return 'Explorer';
  if (writeTools > total * 0.5) return 'Editor';
  if (bashCount > total * 0.5) return 'Runner';
  if (readTools > 0 && writeTools > 0) return 'Developer';
  return null;
}

export function useAgentGraph(events: Ref<HookEvent[]>) {
  const agents = ref<Map<string, AgentNode>>(new Map());
  const edges = ref<AgentEdge[]>([]);
  const sessions = ref<SessionSummary[]>([]);
  const isLoading = ref(false);

  function rebuildGraph(eventList: HookEvent[]) {
    const agentMap = new Map<string, AgentNode>();
    const edgeSet = new Map<string, AgentEdge>();
    // Track spawn names extracted from SubagentStart payloads (childKey → name)
    const spawnNames = new Map<string, string>();
    // Track tool usage per agent key
    const toolCountsMap = new Map<string, Record<string, number>>();
    // Track first user prompt per agent key
    const taskSummaryMap = new Map<string, string>();

    // First pass: extract spawn names from SubagentStart events
    for (const event of eventList) {
      if (event.hook_event_type === 'SubagentStart' && event.agent_id && event.payload) {
        const childKey = makeAgentKey(event.source_app, event.session_id, event.agent_id);
        // Check top-level fields first (forwarded by send_event.py)
        if (event.agent_name) {
          spawnNames.set(childKey, event.agent_name);
        } else if (event.description) {
          const desc = event.description.split(/[.\n]/)[0].slice(0, 40);
          spawnNames.set(childKey, desc);
        } else {
          const spawnName = extractSpawnName(event.payload);
          if (spawnName) {
            spawnNames.set(childKey, spawnName);
          }
        }
      }
    }

    // Second pass: build agents and edges
    for (const event of eventList) {
      const key = makeAgentKey(event.source_app, event.session_id, event.agent_id);
      const now = event.timestamp || Date.now();

      let agent = agentMap.get(key);
      if (!agent) {
        // Name resolution priority (initial pass):
        // 1. display_name (user-set via UI rename)
        // 2. agent_name (explicit from hook --agent-name flag)
        // 3. Spawn name (extracted from SubagentStart payload: name, subagent_type, description)
        // 4. agent_type prettified (e.g. "code-reviewer" → "Code Reviewer")
        // 5. Fallback: "Agent" for subagents, "Session" for main
        // Post-processing upgrades (applied after all events are processed):
        // 6. inferred_role from tool usage patterns (upgrades "Session"/"Agent" fallbacks)
        // 7. "Orchestrator" if agent has spawned children (upgrades "Session" fallback)
        const agentType = event.agent_type || '';

        let displayName: string;
        if (event.display_name) {
          displayName = event.display_name;
        } else if (event.agent_name) {
          displayName = event.agent_name;
        } else if (spawnNames.has(key)) {
          displayName = spawnNames.get(key)!;
        } else if (agentType) {
          displayName = prettifyType(agentType);
        } else {
          displayName = event.agent_id ? 'Agent' : 'Session';
        }

        agent = {
          id: key,
          source_app: event.source_app,
          session_id: event.session_id,
          agent_id: event.agent_id,
          agent_type: event.agent_type,
          model_name: event.model_name,
          display_name: displayName,
          agent_status: 'active',
          first_seen: now,
          last_seen: now,
          event_count: 0,
        };
        agentMap.set(key, agent);
      }

      // Update agent state
      agent.last_seen = Math.max(agent.last_seen, now);
      agent.event_count += 1;
      if (event.model_name) {
        agent.model_name = event.model_name;
      }

      // Track tool usage for PreToolUse / PostToolUse events
      if (
        (event.hook_event_type === 'PreToolUse' || event.hook_event_type === 'PostToolUse') &&
        event.payload?.tool_name
      ) {
        if (!toolCountsMap.has(key)) {
          toolCountsMap.set(key, {});
        }
        const counts = toolCountsMap.get(key)!;
        const toolName = event.payload.tool_name as string;
        counts[toolName] = (counts[toolName] || 0) + 1;
      }

      // Track first user prompt per agent for task_summary
      if (event.hook_event_type === 'UserPromptSubmit' && !taskSummaryMap.has(key)) {
        const promptText =
          (event.payload?.prompt as string) ||
          (event.payload?.content as string) ||
          event.summary ||
          '';
        if (promptText) {
          const sanitized = promptText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          const snippet = sanitized.length > 40 ? sanitized.slice(0, 40) + '...' : sanitized;
          taskSummaryMap.set(key, snippet);
        }
      }

      // Detect stopped agents (only subagents can be stopped, not the main session)
      if (
        event.hook_event_type === 'SubagentStop' ||
        event.hook_event_type === 'SessionEnd' ||
        event.hook_event_type === 'Stop'
      ) {
        // Only mark as stopped if this is a subagent (has agent_id)
        // The main orchestrator session should always stay active
        if (event.agent_id) {
          agent.agent_status = 'stopped';
        }
      }

      // Build edges from SubagentStart events
      // SubagentStart fires on the PARENT session, agent_id = the child's ID
      if (event.hook_event_type === 'SubagentStart' && event.agent_id) {
        const parentKey = makeAgentKey(event.source_app, event.session_id);
        const childKey = makeAgentKey(event.source_app, event.session_id, event.agent_id);
        const edgeKey = `${parentKey}->${childKey}`;

        if (!edgeSet.has(edgeKey) && parentKey !== childKey) {
          edgeSet.set(edgeKey, {
            source: parentKey,
            target: childKey,
            type: 'spawned',
          });

          // Mark parent as "Orchestrator" when it spawns children
          const parentAgent = agentMap.get(parentKey);
          if (parentAgent && parentAgent.display_name === 'Session') {
            parentAgent.display_name = 'Orchestrator';
          }
        }
      }
    }

    // Detect idle agents (no events for 30s)
    const now = Date.now();
    for (const agent of agentMap.values()) {
      if (agent.agent_status !== 'stopped' && now - agent.last_seen > IDLE_THRESHOLD_MS) {
        agent.agent_status = 'idle';
      }
    }

    // Collect orchestrator keys: agents that have spawned children (are sources of edges)
    const orchestratorKeys = new Set<string>();
    for (const edge of edgeSet.values()) {
      orchestratorKeys.add(edge.source);
    }

    // Orchestrators must always be active — override idle/stopped status
    for (const orchKey of orchestratorKeys) {
      const orchAgent = agentMap.get(orchKey);
      if (orchAgent && (orchAgent.agent_status === 'idle' || orchAgent.agent_status === 'stopped')) {
        orchAgent.agent_status = 'active';
      }
    }

    // Post-processing: apply tool_counts, inferred_role, task_summary to agents
    // and upgrade generic names using inferred_role
    for (const agent of agentMap.values()) {
      const tc = toolCountsMap.get(agent.id);
      if (tc) {
        agent.tool_counts = tc;
        const role = inferRoleFromTools(tc);
        if (role) {
          agent.inferred_role = role;
          // Upgrade generic fallback names with inferred role
          if (agent.display_name === 'Session' || agent.display_name === 'Agent') {
            agent.display_name = role;
          }
        }
      }
      const summary = taskSummaryMap.get(agent.id);
      if (summary) {
        agent.task_summary = summary;
      }
    }

    // Deduplicate display names: add letter suffixes (A, B, C...) only when
    // two or more agents share the same resolved display_name.
    const nameGroups = new Map<string, AgentNode[]>();
    for (const agent of agentMap.values()) {
      const name = agent.display_name;
      if (!nameGroups.has(name)) nameGroups.set(name, []);
      nameGroups.get(name)!.push(agent);
    }
    for (const [name, dupes] of nameGroups) {
      if (dupes.length > 1) {
        // Sort by first_seen so lettering is stable
        dupes.sort((a, b) => a.first_seen - b.first_seen);
        dupes.forEach((agent, i) => {
          agent.display_name = `${name} ${String.fromCharCode(65 + i)}`;
        });
      }
    }

    agents.value = agentMap;
    edges.value = Array.from(edgeSet.values());
  }

  // Watch events and rebuild the graph reactively
  watch(
    events,
    (newEvents) => {
      rebuildGraph(newEvents);
    },
    { deep: true, immediate: true }
  );

  const graphData = computed<AgentGraphData>(() => ({
    agents: Array.from(agents.value.values()),
    edges: edges.value,
  }));

  const agentCount = computed(() => agents.value.size);

  const activeAgentCount = computed(
    () => Array.from(agents.value.values()).filter((a) => a.agent_status === 'active').length
  );

  // API: Rename an agent
  async function renameAgent(
    source_app: string,
    session_id: string,
    agent_id: string | undefined,
    display_name: string
  ): Promise<void> {
    const body: Record<string, string> = { source_app, session_id, display_name };
    if (agent_id) {
      body.agent_id = agent_id;
    }

    const response = await fetch(`${API_BASE_URL}/agents/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to rename agent: ${response.statusText}`);
    }

    // Update local state
    const key = makeAgentKey(source_app, session_id, agent_id);
    const agent = agents.value.get(key);
    if (agent) {
      agent.display_name = display_name;
    }
  }

  // API: Fetch sessions list
  async function fetchSessions(): Promise<SessionSummary[]> {
    isLoading.value = true;
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data: SessionSummary[] = await response.json();
      sessions.value = data;
      return data;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    graphData,
    agents,
    edges,
    sessions,
    agentCount,
    activeAgentCount,
    isLoading,
    renameAgent,
    fetchSessions,
    rebuildGraph,
  };
}
