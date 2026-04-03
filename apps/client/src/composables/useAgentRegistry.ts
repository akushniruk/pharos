import { ref, computed } from 'vue'
import type { AgentRegistryEntry } from '../types'
import { API_BASE_URL } from '../config'

const registry = ref<AgentRegistryEntry[]>([])

export function useAgentRegistry() {
  // Fetch initial registry from API
  async function fetchRegistry(sessionId?: string) {
    const url = sessionId
      ? `${API_BASE_URL}/api/agents?session_id=${sessionId}`
      : `${API_BASE_URL}/api/agents`
    const res = await fetch(url)
    if (res.ok) {
      registry.value = await res.json()
    }
  }

  // Handle WebSocket agent_registry message
  function handleRegistryUpdate(entries: AgentRegistryEntry[]) {
    registry.value = entries
  }

  // Group agents by team
  const agentsByTeam = computed(() => {
    const teams: Record<string, AgentRegistryEntry[]> = {}
    for (const agent of registry.value) {
      const team = agent.team_name || 'default'
      if (!teams[team]) teams[team] = []
      teams[team].push(agent)
    }
    return teams
  })

  // Get children of an agent
  function getChildren(parentId: string): AgentRegistryEntry[] {
    return registry.value.filter(a => a.parent_id === parentId)
  }

  // Find agent by ID
  function findAgent(id: string): AgentRegistryEntry | undefined {
    return registry.value.find(a => a.id === id)
  }

  return { registry, fetchRegistry, handleRegistryUpdate, agentsByTeam, getChildren, findAgent }
}
