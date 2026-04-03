<template>
  <Teleport to="body">
    <div
      v-if="visible && agent"
      ref="menuRef"
      class="context-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @click.stop
    >
      <button class="context-menu__item" @click="handleRename">
        <svg class="context-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        <span>Rename Agent</span>
      </button>

      <button class="context-menu__item" @click="handleFilter">
        <svg class="context-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
        </svg>
        <span>Filter to Agent</span>
      </button>

      <button class="context-menu__item" @click="handleSwimLane">
        <svg class="context-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <span>View in Swim Lane</span>
      </button>

      <button class="context-menu__item" @click="handleCopyId">
        <svg class="context-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
        </svg>
        <span>Copy Agent ID</span>
      </button>

      <div class="context-menu__divider"></div>

      <button class="context-menu__item context-menu__item--danger" @click="handleStop">
        <svg class="context-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
        </svg>
        <span>Stop Agent</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AgentNode } from '../types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  agent: AgentNode | null
}>()

const emit = defineEmits<{
  rename: [agent: AgentNode]
  filter: [agent: AgentNode]
  stop: [agent: AgentNode]
  'swim-lane': [agent: AgentNode]
  'copy-id': [agent: AgentNode]
  close: []
}>()

const menuRef = ref<HTMLDivElement | null>(null)

const handleRename = () => {
  if (props.agent) emit('rename', props.agent)
  emit('close')
}

const handleFilter = () => {
  if (props.agent) emit('filter', props.agent)
  emit('close')
}

const handleStop = () => {
  if (props.agent) emit('stop', props.agent)
  emit('close')
}

const handleSwimLane = () => {
  if (props.agent) emit('swim-lane', props.agent)
  emit('close')
}

const handleCopyId = () => {
  if (props.agent) emit('copy-id', props.agent)
  emit('close')
}

const onClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    // Delay adding listeners so the triggering right-click does not
    // immediately close the menu.
    setTimeout(() => {
      document.addEventListener('click', onClickOutside)
      document.addEventListener('keydown', onKeyDown)
    }, 0)
  } else {
    document.removeEventListener('click', onClickOutside)
    document.removeEventListener('keydown', onKeyDown)
  }
})

onMounted(() => {
  if (props.visible) {
    document.addEventListener('click', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-secondary);
  border-radius: 6px;
  box-shadow: 0 8px 24px var(--theme-shadow-lg), 0 2px 8px var(--theme-shadow);
  animation: context-menu-in 0.1s ease-out;
}

@keyframes context-menu-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-text-secondary);
  text-align: left;
  transition: background-color 0.08s ease, color 0.08s ease;
  font-family: inherit;
}

.context-menu__item:hover {
  background-color: var(--theme-hover-bg);
  color: var(--theme-text-primary);
}

.context-menu__item--danger {
  color: var(--theme-accent-error);
}

.context-menu__item--danger:hover {
  background-color: rgba(199, 84, 80, 0.1);
  color: var(--theme-accent-error);
}

.context-menu__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.context-menu__divider {
  height: 1px;
  margin: 4px 0;
  background-color: var(--theme-border-primary);
}
</style>
