<template>
  <Teleport to="body">
    <Transition name="ctm-fade">
      <div v-if="isOpen" class="ctm-backdrop" @click="close">
        <div
          class="ctm-modal"
          @click.stop
        >
          <!-- Header -->
          <div class="ctm-header">
            <div class="ctm-header-top">
              <h2 class="ctm-title">Chat Transcript</h2>
              <button @click="close" class="ctm-close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path d="M1 1l12 12M13 1l-12 12" />
                </svg>
              </button>
            </div>

            <!-- Search and Filters -->
            <div class="ctm-controls">
              <div class="ctm-search-row">
                <div class="ctm-search-field">
                  <svg class="ctm-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="6" cy="6" r="4.5" />
                    <path d="M9.5 9.5L13 13" stroke-linecap="round" />
                  </svg>
                  <input
                    v-model="searchQuery"
                    @keyup.enter="executeSearch"
                    type="text"
                    placeholder="Search transcript..."
                    class="ctm-search-input"
                  >
                </div>
                <button @click="executeSearch" class="ctm-btn ctm-btn--primary">Search</button>
                <button @click="copyAllMessages" class="ctm-btn ctm-btn--secondary">{{ copyAllButtonText }}</button>
              </div>

              <!-- Filters -->
              <div class="ctm-filters">
                <button
                  v-for="filter in filters"
                  :key="filter.type"
                  @click="toggleFilter(filter.type)"
                  :class="['ctm-filter-btn', { 'ctm-filter-btn--active': activeFilters.includes(filter.type) }]"
                >
                  {{ filter.label }}
                </button>

                <button
                  v-if="searchQuery || activeSearchQuery || activeFilters.length > 0"
                  @click="clearSearch"
                  class="ctm-filter-clear"
                >
                  Clear all
                </button>
              </div>

              <!-- Results Count -->
              <div v-if="activeSearchQuery || activeFilters.length > 0" class="ctm-results">
                Showing {{ filteredChat.length }} of {{ chat.length }} messages
                <span v-if="activeSearchQuery" class="ctm-results-query">
                  matching "{{ activeSearchQuery }}"
                </span>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="ctm-content">
            <ChatTranscript :chat="filteredChat" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ChatTranscript from './ChatTranscript.vue';

const props = defineProps<{
  isOpen: boolean;
  chat: any[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const searchQuery = ref('');
const activeSearchQuery = ref('');
const activeFilters = ref<string[]>([]);
const copyAllButtonText = ref('Copy All');

const filters = [
  // Message types
  { type: 'user', label: 'User' },
  { type: 'assistant', label: 'Assistant' },
  { type: 'system', label: 'System' },

  // Tool actions
  { type: 'tool_use', label: 'Tool Use' },
  { type: 'tool_result', label: 'Tool Result' },

  // Specific tools
  { type: 'Read', label: 'Read' },
  { type: 'Write', label: 'Write' },
  { type: 'Edit', label: 'Edit' },
  { type: 'Glob', label: 'Glob' },
];

const toggleFilter = (type: string) => {
  const index = activeFilters.value.indexOf(type);
  if (index > -1) {
    activeFilters.value.splice(index, 1);
  } else {
    activeFilters.value.push(type);
  }
};

const executeSearch = () => {
  activeSearchQuery.value = searchQuery.value;
};

const clearSearch = () => {
  searchQuery.value = '';
  activeSearchQuery.value = '';
  activeFilters.value = [];
};

const close = () => {
  emit('close');
};

const copyAllMessages = async () => {
  try {
    // Copy all chat messages as formatted JSON
    const jsonPayload = JSON.stringify(props.chat, null, 2);
    await navigator.clipboard.writeText(jsonPayload);

    copyAllButtonText.value = 'Copied';
    setTimeout(() => {
      copyAllButtonText.value = 'Copy All';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy all messages:', err);
    copyAllButtonText.value = 'Failed';
    setTimeout(() => {
      copyAllButtonText.value = 'Copy All';
    }, 2000);
  }
};

const matchesSearch = (item: any, query: string): boolean => {
  const lowerQuery = query.toLowerCase().trim();

  // Check direct content (for system messages and simple chat)
  if (typeof item.content === 'string') {
    // Remove ANSI codes before searching
    const cleanContent = item.content.replace(/\u001b\[[0-9;]*m/g, '').toLowerCase();
    if (cleanContent.includes(lowerQuery)) {
      return true;
    }
  }

  // Check role in simple format
  if (item.role && item.role.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  // Check message object (complex format)
  if (item.message) {
    // Check message role
    if (item.message.role && item.message.role.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Check message content
    if (item.message.content) {
      if (typeof item.message.content === 'string' && item.message.content.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Check array content
      if (Array.isArray(item.message.content)) {
        for (const content of item.message.content) {
          if (content.text && content.text.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.name && content.name.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.input && JSON.stringify(content.input).toLowerCase().includes(lowerQuery)) {
            return true;
          }
          if (content.content && typeof content.content === 'string' && content.content.toLowerCase().includes(lowerQuery)) {
            return true;
          }
        }
      }
    }
  }

  // Check type
  if (item.type && item.type.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  // Check parentUuid, uuid, sessionId
  if (item.uuid && item.uuid.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  if (item.sessionId && item.sessionId.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  // Check toolUseResult
  if (item.toolUseResult) {
    if (JSON.stringify(item.toolUseResult).toLowerCase().includes(lowerQuery)) {
      return true;
    }
  }

  return false;
};

const matchesFilters = (item: any): boolean => {
  if (activeFilters.value.length === 0) return true;

  // Check message type
  if (item.type && activeFilters.value.includes(item.type)) {
    return true;
  }

  // Check role (simple format)
  if (item.role && activeFilters.value.includes(item.role)) {
    return true;
  }

  // Check for system messages with hook types
  if (item.type === 'system' && item.content) {
    // Extract hook type from system content (e.g., "PreToolUse:Read")
    const hookMatch = item.content.match(/([A-Za-z]+):/)?.[1];
    if (hookMatch && activeFilters.value.includes(hookMatch)) {
      return true;
    }
    // Also check if content contains "Running"
    if (item.content.includes('Running') && activeFilters.value.includes('Running')) {
      return true;
    }
    // Check for specific tool names in system messages
    const toolNames = ['Read', 'Write', 'Edit', 'Glob'];
    for (const tool of toolNames) {
      if (item.content.includes(tool) && activeFilters.value.includes(tool)) {
        return true;
      }
    }
  }

  // Check for command messages
  if (item.message?.content && typeof item.message.content === 'string') {
    if (item.message.content.includes('<command-') && activeFilters.value.includes('command')) {
      return true;
    }
  }

  // Check for meta messages
  if (item.isMeta && activeFilters.value.includes('meta')) {
    return true;
  }

  // Check for tool use in content
  if (item.message?.content && Array.isArray(item.message.content)) {
    for (const content of item.message.content) {
      if (content.type === 'tool_use') {
        if (activeFilters.value.includes('tool_use')) {
          return true;
        }
        // Check for specific tool names
        if (content.name && activeFilters.value.includes(content.name)) {
          return true;
        }
      }
      if (content.type === 'tool_result' && activeFilters.value.includes('tool_result')) {
        return true;
      }
    }
  }

  return false;
};

const filteredChat = computed(() => {
  if (!activeSearchQuery.value && activeFilters.value.length === 0) {
    return props.chat;
  }

  return props.chat.filter(item => {
    const matchesQueryCondition = !activeSearchQuery.value || matchesSearch(item, activeSearchQuery.value);
    const matchesFilterCondition = matchesFilters(item);
    return matchesQueryCondition && matchesFilterCondition;
  });
});

// Handle ESC key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Reset search when modal closes
watch(() => props.isOpen, (newVal) => {
  if (!newVal) {
    clearSearch();
  }
});
</script>

<style scoped>
.ctm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.ctm-modal {
  background: #111113;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 85vw;
  height: 85vh;
  max-width: 1100px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
}

.ctm-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px 20px;
}

.ctm-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.ctm-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
}

.ctm-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.ctm-close:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
}

.ctm-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ctm-search-row {
  display: flex;
  gap: 6px;
}

.ctm-search-field {
  position: relative;
  flex: 1;
}

.ctm-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.2);
  pointer-events: none;
}

.ctm-search-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  padding: 7px 12px 7px 32px;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.ctm-search-input:focus {
  border-color: rgba(251, 191, 36, 0.4);
}

.ctm-search-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.ctm-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: inherit;
}

.ctm-btn--primary {
  background: #fbbf24;
  color: #111113;
}

.ctm-btn--primary:hover {
  background: #e6b83a;
}

.ctm-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ctm-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.ctm-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ctm-filter-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}

.ctm-filter-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.65);
}

.ctm-filter-btn--active {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.25);
  color: #fbbf24;
}

.ctm-filter-clear {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.15s ease;
  font-family: inherit;
}

.ctm-filter-clear:hover {
  color: rgba(255, 255, 255, 0.5);
}

.ctm-results {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.ctm-results-query {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  margin-left: 4px;
}

.ctm-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
}

.ctm-fade-enter-active {
  transition: opacity 0.15s ease;
}

.ctm-fade-leave-active {
  transition: opacity 0.1s ease;
}

.ctm-fade-enter-from,
.ctm-fade-leave-to {
  opacity: 0;
}
</style>
