<template>
  <aside
    class="metro-sidebar"
    :class="{ 'metro-sidebar--collapsed': collapsed }"
  >
    <!-- Collapsed state: just icons + expand button -->
    <div v-if="collapsed" class="metro-sidebar__collapsed-content">
      <button
        class="metro-sidebar__toggle"
        @click="emit('update:collapsed', false)"
        title="Expand sidebar"
      >
        <svg class="metro-sidebar__toggle-icon metro-sidebar__toggle-icon--collapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <div class="metro-sidebar__collapsed-agents">
        <div
          v-for="agent in activeAgents"
          :key="agent.id"
          class="metro-sidebar__collapsed-dot"
          :class="[
            `metro-sidebar__collapsed-dot--${agent.agent_status}`,
            { 'metro-sidebar__collapsed-dot--lifecycle': getAgentLifecycleStatus(agent) }
          ]"
          :style="getAgentLifecycleStyle(agent)"
          :title="`${agent.display_name}${getAgentLifecycleStatus(agent) ? ' (' + getLifecycleLabel(getAgentLifecycleStatus(agent)) + ')' : ''}`"
          @click="emit('select-agent', agent)"
        ></div>
      </div>
    </div>

    <!-- Expanded state -->
    <div v-else class="metro-sidebar__content">
      <!-- Header: Agents | Active/All | collapse -->
      <div class="metro-sidebar__header">
        <div class="metro-sidebar__header-top">
          <span class="metro-sidebar__session-label glow-text">Agents</span>
          <div class="metro-sidebar__header-right">
            <!-- View mode toggle -->
            <div class="metro-sidebar__toggle-group">
              <button
                class="metro-sidebar__toggle-option"
                :class="{ 'metro-sidebar__toggle-option--active': viewMode === 'list' }"
                @click="viewMode = 'list'"
                title="List view"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              </button>
              <button
                class="metro-sidebar__toggle-option"
                :class="{ 'metro-sidebar__toggle-option--active': viewMode === 'graph' }"
                @click="viewMode = 'graph'"
                title="Graph view"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v4M9.5 14.5 7 17M14.5 14.5 17 17"/></svg>
              </button>
            </div>
            <div v-if="stoppedCount > 0" class="metro-sidebar__toggle-group">
              <button
                class="metro-sidebar__toggle-option"
                :class="{ 'metro-sidebar__toggle-option--active': !showStopped }"
                @click="showStopped = false"
              >Active</button>
              <button
                class="metro-sidebar__toggle-option"
                :class="{ 'metro-sidebar__toggle-option--active': showStopped }"
                @click="showStopped = true"
              >All</button>
            </div>
            <button
              class="metro-sidebar__collapse-btn"
              @click="emit('update:collapsed', true)"
              title="Collapse sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-if="viewMode === 'list'" class="metro-sidebar__list">
        <AgentListView
          :agents="filteredAgents"
          :selected-agent-id="selectedAgentId"
          @select-agent="(id) => {
            const agent = props.graph.agents.find(a => a.id === id);
            if (agent) { selectedAgentId = id; emit('select-agent', agent); }
          }"
          @context-menu="({ event, agent }) => {
            contextMenu.visible = true;
            contextMenu.x = event.clientX;
            contextMenu.y = event.clientY;
            contextMenu.agent = agent;
          }"
        />
      </div>

      <!-- VueFlow canvas (Graph View) -->
      <div v-else class="metro-sidebar__canvas">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes as any"
          :edge-types="edgeTypes"
          :default-viewport="{ zoom: 0.85, x: 0, y: 20 }"
          :min-zoom="0.4"
          :max-zoom="1.5"
          :nodes-draggable="true"
          :pan-on-drag="true"
          :zoom-on-scroll="true"
          :fit-view-on-init="false"
          :prevent-scrolling="true"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @node-context-menu="onNodeContextMenu"
        >
          <template #node-metro-station="stationProps">
            <MetroStation
              :data="stationProps.data"
              @contextmenu="(e: MouseEvent) => onNodeContextMenu({ event: e, node: stationProps } as any)"
            />
          </template>
          <template #edge-metro-line="lineProps">
            <MetroLine v-bind="lineProps" />
          </template>
          <Background :gap="16" :size="0.5" pattern-color="var(--theme-border-primary)" />
          <Controls :show-interactive="false" class="metro-sidebar__controls" />
        </VueFlow>
      </div>

    </div>

    <!-- Context menu -->
    <AgentContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :agent="contextMenu.agent"
      @rename="(agent) => emit('rename-agent', agent)"
      @filter="onFilterAgent"
      @stop="onStopAgent"
      @swim-lane="onSwimLane"
      @copy-id="onCopyId"
      @close="contextMenu.visible = false"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import MetroStation from './MetroStation.vue'
import MetroLine from './MetroLine.vue'
import AgentContextMenu from './AgentContextMenu.vue'
import AgentListView from './AgentListView.vue'
import type { AgentNode, AgentEdge } from '../types'
import { getAgentColor } from '../composables/useEventColors'
import { useAgentRegistry } from '../composables/useAgentRegistry'
import { getLifecycleColor, getLifecycleLabel } from '../utils/agentHelpers'
import type { Node, Edge, NodeMouseEvent } from '@vue-flow/core'

const props = defineProps<{
  graph: { agents: AgentNode[]; edges: AgentEdge[] }
  collapsed: boolean
}>()

const emit = defineEmits<{
  'select-agent': [agent: AgentNode]
  'select-edge': [edge: AgentEdge]
  'rename-agent': [agent: AgentNode]
  'update:collapsed': [collapsed: boolean]
}>()

// Agent registry for lifecycle status
const { findAgent: findRegistryAgent } = useAgentRegistry()

// Look up lifecycle status from registry for a given agent
function getAgentLifecycleStatus(agent: AgentNode): string {
  const entry = findRegistryAgent(agent.id)
  return entry?.lifecycle_status || ''
}

function getAgentLifecycleStyle(agent: AgentNode): Record<string, string> {
  const status = getAgentLifecycleStatus(agent)
  if (!status) return {}
  return { '--lifecycle-color': getLifecycleColor(status) }
}

// Register custom node/edge types
const nodeTypes = {
  'metro-station': markRaw(MetroStation)
}

const edgeTypes = {
  'metro-line': markRaw(MetroLine)
}

// View mode: list (default) or graph
const viewMode = ref<'list' | 'graph'>('list')

// Filter state: show/hide stopped agents
const showStopped = ref(false)

// Computed counts
const stoppedCount = computed(() =>
  props.graph.agents.filter(a => a.agent_status === 'stopped').length
)

// Active agents only (for collapsed sidebar dots)
const activeAgents = computed(() =>
  props.graph.agents.filter(a => a.agent_status === 'active')
)

// Filtered agents: hide stopped unless toggle is on
const filteredAgents = computed(() => {
  if (showStopped.value) return props.graph.agents;
  return props.graph.agents.filter(a => a.agent_status !== 'stopped');
})

// Filtered edges: only show edges where both source and target are visible
const filteredEdges = computed(() => {
  const visibleIds = new Set(filteredAgents.value.map(a => a.id));
  return props.graph.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
})

// Selected state
const selectedAgentId = ref<string | null>(null)

// Context menu state
const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  agent: AgentNode | null
}>({
  visible: false,
  x: 0,
  y: 0,
  agent: null
})

// Use shared stable color map so MetroSidebar and LivePulseChart always agree

// Convert AgentGraph data to VueFlow nodes with auto-layout
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

const { fitView } = useVueFlow()

const computeLayout = () => {
  // Build adjacency: parent -> children[]
  const childrenOf = new Map<string, AgentNode[]>()
  const childIds = new Set<string>()

  filteredEdges.value.forEach(edge => {
    childIds.add(edge.target)
    const parent = edge.source
    if (!childrenOf.has(parent)) {
      childrenOf.set(parent, [])
    }
    const child = filteredAgents.value.find(a => a.id === edge.target)
    if (child) {
      childrenOf.get(parent)!.push(child)
    }
  })

  // Root agents: agents that are not a child of any other agent
  const rootAgents = filteredAgents.value
    .filter(a => !childIds.has(a.id))
    .sort((a, b) => a.first_seen - b.first_seen)

  const newNodes: Node[] = []
  const nodeXSpacing = 160  // horizontal spacing between parent and child columns
  const branchYSpacing = 80 // vertical spacing between sibling nodes
  const rootYSpacing = 100  // vertical spacing between root-level trees

  // Recursive layout: place a node and its children, return the total height consumed
  const placeNode = (agent: AgentNode, x: number, y: number): number => {
    const color = getAgentColor(agent.id)

    newNodes.push({
      id: agent.id,
      type: 'metro-station',
      position: { x, y },
      data: {
        id: agent.id,
        display_name: agent.display_name,
        agent_type: agent.agent_type,
        model_name: agent.model_name,
        agent_status: agent.agent_status,
        event_count: agent.event_count,
        color,
        isSelected: selectedAgentId.value === agent.id
      }
    })

    const children = (childrenOf.get(agent.id) || [])
      .sort((a, b) => a.first_seen - b.first_seen)

    if (children.length === 0) {
      return branchYSpacing
    }

    // Place children in a column to the right, starting at the parent's Y
    let childY = y
    children.forEach(child => {
      const consumed = placeNode(child, x + nodeXSpacing, childY)
      childY += consumed
    })

    // Total height is max of: one slot for this node, or the cumulative child height
    return Math.max(branchYSpacing, childY - y)
  }

  // Place all root agents vertically
  let currentY = 20
  rootAgents.forEach(agent => {
    const consumed = placeNode(agent, 30, currentY)
    currentY += Math.max(consumed, rootYSpacing)
  })

  // Convert edges
  const newEdges: Edge[] = filteredEdges.value.map((edge) => {
    const sourceNode = newNodes.find(n => n.id === edge.source)
    const targetAgent = filteredAgents.value.find(a => a.id === edge.target)

    return {
      id: `e-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'metro-line',
      data: {
        color: sourceNode?.data?.color || '#fbbf24',
        animated: targetAgent?.agent_status === 'active',
        status: targetAgent?.agent_status === 'stopped' ? 'stopped' : 'active'
      }
    }
  })

  nodes.value = newNodes
  edges.value = newEdges

  // fitView after Vue has rendered the new nodes
  nextTick(() => {
    fitView({ padding: 0.15, duration: 200 })
  })
}

// Track previous agent count to detect new agents joining
let prevAgentCount = 0

// Recompute layout when graph or filter changes
watch(
  () => [filteredAgents.value, filteredEdges.value],
  () => {
    const currentCount = filteredAgents.value.length
    computeLayout()
    // Extra fitView when a new agent joins to catch VueFlow async node measurement
    if (currentCount !== prevAgentCount) {
      prevAgentCount = currentCount
      setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 100)
    }
  },
  { deep: true, immediate: true }
)

// Watch selectedAgentId to update node data
watch(selectedAgentId, () => {
  nodes.value = nodes.value.map(node => ({
    ...node,
    data: {
      ...node.data,
      isSelected: selectedAgentId.value === node.id
    }
  }))
})

// Event handlers
const onNodeClick = ({ node }: { node: Node }) => {
  selectedAgentId.value = node.id
  const agent = props.graph.agents.find(a => a.id === node.id)
  if (agent) {
    emit('select-agent', agent)
  }
}

const onEdgeClick = ({ edge }: { edge: Edge }) => {
  const graphEdge = props.graph.edges.find(
    e => `e-${e.source}-${e.target}` === edge.id
  )
  if (graphEdge) {
    emit('select-edge', graphEdge)
  }
}

const onNodeContextMenu = (e: NodeMouseEvent) => {
  e.event.preventDefault()
  const agent = props.graph.agents.find(a => a.id === (e.node.id || e.node.data?.id))
  if (agent) {
    contextMenu.value = {
      visible: true,
      x: (e.event as MouseEvent).clientX,
      y: (e.event as MouseEvent).clientY,
      agent
    }
  }
}

const onFilterAgent = (agent: AgentNode) => {
  selectedAgentId.value = agent.id
  emit('select-agent', agent)
}

const onStopAgent = (agent: AgentNode) => {
  // Handled by parent
  console.log('Stop agent requested:', agent.id)
}

const onSwimLane = (agent: AgentNode) => {
  emit('select-agent', agent)
}

const onCopyId = (agent: AgentNode) => {
  const shortId = `${agent.source_app}:${agent.session_id.slice(0, 8)}`
  navigator.clipboard.writeText(shortId).catch(() => {
    console.error('Failed to copy agent ID')
  })
}
</script>

<style scoped>
.metro-sidebar {
  position: relative;
  width: 320px;
  min-width: 320px;
  height: 100%;
  background-color: var(--theme-bg-secondary);
  border-right: 1px solid var(--theme-border-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, min-width 0.2s ease;
  overflow: hidden;
}

.metro-sidebar--collapsed {
  width: 48px;
  min-width: 48px;
}

/* Expand toggle (inside collapsed state) */
.metro-sidebar__toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--theme-text-tertiary);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  padding: 0;
  margin: 8px auto;
}

.metro-sidebar__toggle:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
  border-color: var(--theme-border-primary);
}

.metro-sidebar__toggle-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.metro-sidebar__toggle-icon--collapsed {
  transform: rotate(180deg);
}

/* Inline collapse button (inside header) */
.metro-sidebar__collapse-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--theme-text-tertiary);
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  padding: 0;
  flex-shrink: 0;
}

.metro-sidebar__collapse-btn:hover {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
  border-color: var(--theme-border-primary);
}

/* Collapsed content */
.metro-sidebar__collapsed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8px;
  gap: 8px;
}

.metro-sidebar__collapsed-agents {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.metro-sidebar__collapsed-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.metro-sidebar__collapsed-dot:hover {
  transform: scale(1.4);
}

.metro-sidebar__collapsed-dot--active {
  background-color: var(--theme-accent-success);
}

.metro-sidebar__collapsed-dot--idle {
  background-color: var(--theme-accent-warning);
}

.metro-sidebar__collapsed-dot--error {
  background-color: var(--theme-accent-error);
}

.metro-sidebar__collapsed-dot--stopped {
  background-color: var(--theme-text-quaternary);
}

.metro-sidebar__collapsed-dot--lifecycle {
  box-shadow: 0 0 0 2px var(--lifecycle-color);
}

/* Expanded content */
.metro-sidebar__content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Header */
.metro-sidebar__header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--theme-border-primary);
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metro-sidebar__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metro-sidebar__header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metro-sidebar__session-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.metro-sidebar__session-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metro-sidebar__counts {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metro-sidebar__count-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--theme-border-primary);
  background-color: var(--theme-bg-tertiary);
}

.metro-sidebar__count-badge--active {
  color: var(--theme-accent-success);
}

.metro-sidebar__count-badge--stopped {
  color: var(--theme-text-quaternary);
}

.metro-sidebar__count-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.metro-sidebar__count-indicator--active {
  background-color: var(--theme-accent-success);
}

.metro-sidebar__count-indicator--stopped {
  background-color: var(--theme-text-quaternary);
}

/* Segmented pill toggle */
.metro-sidebar__toggle-group {
  display: flex;
  border-radius: 6px;
  border: 1px solid var(--theme-border-primary);
  background-color: var(--theme-bg-primary);
  overflow: hidden;
}

.metro-sidebar__toggle-option {
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 500;
  font-family: inherit;
  color: var(--theme-text-quaternary);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.metro-sidebar__toggle-option:hover {
  color: var(--theme-text-secondary);
}

.metro-sidebar__toggle-option--active {
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-tertiary);
}

/* VueFlow canvas */
.metro-sidebar__canvas {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Override VueFlow default styles for dark theme */
.metro-sidebar__canvas :deep(.vue-flow) {
  background-color: var(--theme-bg-primary);
}

.metro-sidebar__canvas :deep(.vue-flow__background) {
  background-color: var(--theme-bg-primary);
}

.metro-sidebar__canvas :deep(.vue-flow__minimap) {
  display: none;
}

.metro-sidebar__controls :deep(.vue-flow__controls-button) {
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  color: var(--theme-text-tertiary);
  fill: var(--theme-text-tertiary);
  width: 22px;
  height: 22px;
}

.metro-sidebar__controls :deep(.vue-flow__controls-button:hover) {
  background-color: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
  fill: var(--theme-text-primary);
}

.metro-sidebar__controls :deep(.vue-flow__controls-button svg) {
  width: 12px;
  height: 12px;
}


.metro-sidebar__spawn-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  background-color: var(--theme-bg-tertiary);
  border: 1px dashed var(--theme-border-secondary);
  border-radius: 4px;
  color: var(--theme-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}

.metro-sidebar__spawn-btn:hover {
  border-color: var(--theme-primary);
  color: #0a0a0b;
  background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 35%), var(--theme-primary);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px rgba(251, 191, 36, 0.3);
  border-style: solid;
}

.metro-sidebar__spawn-icon {
  width: 14px;
  height: 14px;
}
</style>
