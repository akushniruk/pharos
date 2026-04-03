import { ref, computed } from 'vue';

const selectedAgentId = ref<string | null>(null);
const selectedEdge = ref<{ source: string; target: string } | null>(null);

export function useAgentSelection() {
  const selectAgent = (agentId: string) => {
    if (selectedAgentId.value === agentId) {
      selectedAgentId.value = null;
    } else {
      selectedAgentId.value = agentId;
      selectedEdge.value = null;
    }
  };

  const selectEdgeBetween = (source: string, target: string) => {
    selectedEdge.value = { source, target };
    selectedAgentId.value = null;
  };

  const clearSelection = () => {
    selectedAgentId.value = null;
    selectedEdge.value = null;
  };

  const isAgentSelected = (agentId: string) =>
    selectedAgentId.value === agentId ||
    selectedEdge.value?.source === agentId ||
    selectedEdge.value?.target === agentId;

  return {
    selectedAgentId: computed(() => selectedAgentId.value),
    selectedEdge: computed(() => selectedEdge.value),
    selectAgent,
    selectEdgeBetween,
    clearSelection,
    isAgentSelected,
  };
}
