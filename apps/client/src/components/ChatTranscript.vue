<template>
  <div class="ct-root">
    <div v-for="(item, index) in chatItems" :key="index" class="ct-item">
      <!-- User Message -->
      <div v-if="item.type === 'user' && item.message"
           class="ct-msg ct-msg--user">
        <div class="ct-msg-header">
          <div class="ct-msg-left">
            <span class="ct-role ct-role--user">User</span>
            <div class="ct-msg-body">
              <!-- Handle string content -->
              <p v-if="typeof item.message.content === 'string'"
                 class="ct-text">
                {{ item.message.content.includes('<command-') ? cleanCommandContent(item.message.content) : item.message.content }}
              </p>
              <!-- Handle array content -->
              <div v-else-if="Array.isArray(item.message.content)" class="ct-content-list">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <p v-if="content.type === 'text'" class="ct-text">{{ content.text }}</p>
                  <div v-else-if="content.type === 'tool_result'" class="ct-tool-result">
                    <span class="ct-tool-result-label">Tool Result:</span>
                    <pre class="ct-pre">{{ content.content }}</pre>
                  </div>
                </div>
              </div>
              <div v-if="item.timestamp" class="ct-meta">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <div class="ct-actions">
            <button @click="toggleDetails(index)" class="ct-action-btn">
              {{ isDetailsExpanded(index) ? 'Hide' : 'Details' }}
            </button>
            <button @click="copyMessage(index, item.type || item.role)" class="ct-action-btn">
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <div v-if="isDetailsExpanded(index)" class="ct-details">
          <pre class="ct-pre">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- Assistant Message -->
      <div v-else-if="item.type === 'assistant' && item.message"
           class="ct-msg ct-msg--assistant">
        <div class="ct-msg-header">
          <div class="ct-msg-left">
            <span class="ct-role ct-role--assistant">Assistant</span>
            <div class="ct-msg-body">
              <div v-if="Array.isArray(item.message.content)" class="ct-content-list">
                <div v-for="(content, cIndex) in item.message.content" :key="cIndex">
                  <p v-if="content.type === 'text'" class="ct-text">{{ content.text }}</p>
                  <div v-else-if="content.type === 'tool_use'" class="ct-tool-use">
                    <div class="ct-tool-use-header">
                      <span class="ct-tool-name">{{ content.name }}</span>
                    </div>
                    <pre class="ct-pre">{{ JSON.stringify(content.input, null, 2) }}</pre>
                  </div>
                </div>
              </div>
              <div v-if="item.message.usage" class="ct-meta">
                Tokens: {{ item.message.usage.input_tokens }} in / {{ item.message.usage.output_tokens }} out
              </div>
              <div v-if="item.timestamp" class="ct-meta">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <div class="ct-actions">
            <button @click="toggleDetails(index)" class="ct-action-btn">
              {{ isDetailsExpanded(index) ? 'Hide' : 'Details' }}
            </button>
            <button @click="copyMessage(index, item.type || item.role)" class="ct-action-btn">
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <div v-if="isDetailsExpanded(index)" class="ct-details">
          <pre class="ct-pre">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- System Message -->
      <div v-else-if="item.type === 'system'"
           class="ct-msg ct-msg--system">
        <div class="ct-msg-header">
          <div class="ct-msg-left">
            <span class="ct-role ct-role--system">System</span>
            <div class="ct-msg-body">
              <p class="ct-text">{{ cleanSystemContent(item.content || '') }}</p>
              <div v-if="item.toolUseID" class="ct-meta ct-mono">
                Tool ID: {{ item.toolUseID }}
              </div>
              <div v-if="item.timestamp" class="ct-meta">
                {{ formatTimestamp(item.timestamp) }}
              </div>
            </div>
          </div>
          <div class="ct-actions">
            <button @click="toggleDetails(index)" class="ct-action-btn">
              {{ isDetailsExpanded(index) ? 'Hide' : 'Details' }}
            </button>
            <button @click="copyMessage(index, item.type || item.role)" class="ct-action-btn">
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <div v-if="isDetailsExpanded(index)" class="ct-details">
          <pre class="ct-pre">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>

      <!-- Fallback for simple chat format -->
      <div v-else-if="item.role"
           :class="['ct-msg', item.role === 'user' ? 'ct-msg--user' : 'ct-msg--assistant']">
        <div class="ct-msg-header">
          <div class="ct-msg-left">
            <span :class="['ct-role', item.role === 'user' ? 'ct-role--user' : 'ct-role--assistant']">
              {{ item.role === 'user' ? 'User' : 'Assistant' }}
            </span>
            <div class="ct-msg-body">
              <p class="ct-text">{{ item.content }}</p>
            </div>
          </div>
          <div class="ct-actions">
            <button @click="toggleDetails(index)" class="ct-action-btn">
              {{ isDetailsExpanded(index) ? 'Hide' : 'Details' }}
            </button>
            <button @click="copyMessage(index, item.type || item.role)" class="ct-action-btn">
              {{ getCopyButtonText(index) }}
            </button>
          </div>
        </div>
        <div v-if="isDetailsExpanded(index)" class="ct-details">
          <pre class="ct-pre">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  chat: any[];
}>();

// Track which items have details expanded
const expandedDetails = ref<Set<number>>(new Set());

const toggleDetails = (index: number) => {
  if (expandedDetails.value.has(index)) {
    expandedDetails.value.delete(index);
  } else {
    expandedDetails.value.add(index);
  }
  // Force reactivity
  expandedDetails.value = new Set(expandedDetails.value);
};

const isDetailsExpanded = (index: number) => {
  return expandedDetails.value.has(index);
};

const chatItems = computed(() => {
  // Handle both simple chat format and complex claude-code format
  if (props.chat.length > 0 && props.chat[0].type) {
    // Complex format from chat.json
    return props.chat;
  } else {
    // Simple format with role/content
    return props.chat;
  }
});

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const cleanSystemContent = (content: string) => {
  // Remove ANSI escape codes
  return content.replace(/\u001b\[[0-9;]*m/g, '');
};

const cleanCommandContent = (content: string) => {
  // Remove command tags and clean content
  return content
    .replace(/<command-message>.*?<\/command-message>/gs, '')
    .replace(/<command-name>(.*?)<\/command-name>/gs, '$1')
    .trim();
};

// Track copy button states
const copyButtonStates = ref<Map<number, string>>(new Map());

const getCopyButtonText = (index: number) => {
  return copyButtonStates.value.get(index) || 'Copy';
};

const copyMessage = async (index: number, _type: string) => {
  const item = chatItems.value[index];

  try {
    // Copy the entire JSON payload
    const jsonPayload = JSON.stringify(item, null, 2);
    await navigator.clipboard.writeText(jsonPayload);

    copyButtonStates.value.set(index, 'Copied');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonStates.value.set(index, 'Failed');
    setTimeout(() => {
      copyButtonStates.value.delete(index);
      copyButtonStates.value = new Map(copyButtonStates.value);
    }, 2000);
  }
  // Force reactivity
  copyButtonStates.value = new Map(copyButtonStates.value);
};
</script>

<style scoped>
.ct-root {
  background: #0c0c0e;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px;
  height: 100%;
  overflow-y: auto;
}

.ct-item {
  margin-bottom: 2px;
}

.ct-msg {
  padding: 10px 12px;
  border-radius: 5px;
}

.ct-msg--user {
  background: rgba(255, 255, 255, 0.02);
}

.ct-msg--assistant {
  background: rgba(255, 255, 255, 0.04);
}

.ct-msg--system {
  background: rgba(251, 191, 36, 0.03);
  border-left: 2px solid rgba(251, 191, 36, 0.2);
}

.ct-msg-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.ct-msg-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.ct-role {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ct-role--user {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.ct-role--assistant {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}

.ct-role--system {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

.ct-msg-body {
  flex: 1;
  min-width: 0;
}

.ct-content-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ct-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  margin: 0;
}

.ct-meta {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
  margin-top: 4px;
}

.ct-mono {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.ct-tool-result {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.ct-tool-result-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.ct-tool-use {
  background: rgba(251, 191, 36, 0.04);
  border: 1px solid rgba(251, 191, 36, 0.1);
  border-radius: 4px;
  padding: 8px 10px;
}

.ct-tool-use-header {
  margin-bottom: 6px;
}

.ct-tool-name {
  font-size: 12px;
  font-weight: 600;
  color: #fbbf24;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.ct-pre {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  overflow-x: auto;
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  line-height: 1.4;
}

.ct-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.ct-action-btn {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: inherit;
}

.ct-action-btn:hover {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.ct-details {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
</style>
