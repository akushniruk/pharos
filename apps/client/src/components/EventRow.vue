<template>
  <div>
    <!-- HITL Question Section -->
    <div
      v-if="event.humanInTheLoop && (event.humanInTheLoopStatus?.status === 'pending' || hasSubmittedResponse)"
      class="hitl-card"
      :class="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded' ? 'hitl-card--responded' : 'hitl-card--pending'"
      @click.stop
    >
      <!-- Question Header -->
      <div class="hitl-header">
        <div class="hitl-header__top">
          <div class="hitl-header__label-group">
            <h3 class="hitl-header__title">
              {{ hitlTypeLabel }}
            </h3>
            <span v-if="permissionType" class="hitl-permission-type">
              {{ permissionType }}
            </span>
          </div>
          <span v-if="!hasSubmittedResponse && event.humanInTheLoopStatus?.status !== 'responded'" class="hitl-waiting">
            Waiting for response...
          </span>
        </div>
        <div class="hitl-header__meta">
          <span class="event-row__color-dot" :style="{ backgroundColor: appHexColor }"></span>
          <span class="hitl-meta__agent" :title="fullSessionTooltip">
            {{ resolvedAgentName }}
          </span>
          <span v-if="agentTypeLabel" class="hitl-meta__agent-type">{{ agentTypeLabel }}</span>
          <span class="hitl-meta__time">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>
      </div>

      <!-- Question Text -->
      <div class="hitl-question">
        <p class="hitl-question__text">
          {{ event.humanInTheLoop.question }}
        </p>
      </div>

      <!-- Inline Response Display (Optimistic UI) -->
      <div v-if="localResponse || (event.humanInTheLoopStatus?.status === 'responded' && event.humanInTheLoopStatus.response)" class="hitl-response-display">
        <div class="hitl-response-display__header">
          <strong>Response submitted</strong>
        </div>
        <div v-if="(localResponse?.response || event.humanInTheLoopStatus?.response?.response)" class="hitl-response-display__body">
          {{ localResponse?.response || event.humanInTheLoopStatus?.response?.response }}
        </div>
        <div v-if="(localResponse?.permission !== undefined || event.humanInTheLoopStatus?.response?.permission !== undefined)" class="hitl-response-display__body">
          {{ (localResponse?.permission ?? event.humanInTheLoopStatus?.response?.permission) ? 'Approved' : 'Denied' }}
        </div>
        <div v-if="(localResponse?.choice || event.humanInTheLoopStatus?.response?.choice)" class="hitl-response-display__body">
          {{ localResponse?.choice || event.humanInTheLoopStatus?.response?.choice }}
        </div>
      </div>

      <!-- Response UI -->
      <div v-if="event.humanInTheLoop.type === 'question'" class="hitl-form">
        <textarea
          v-model="responseText"
          class="hitl-textarea"
          rows="3"
          placeholder="Type your response here..."
          @click.stop
        ></textarea>
        <div class="hitl-form__actions">
          <button
            @click.stop="submitResponse"
            :disabled="!responseText.trim() || isSubmitting || hasSubmittedResponse"
            class="hitl-btn hitl-btn--submit"
          >
            {{ isSubmitting ? 'Sending...' : 'Submit' }}
          </button>
        </div>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'permission'" class="hitl-form__actions">
        <div v-if="hasSubmittedResponse || event.humanInTheLoopStatus?.status === 'responded'" class="hitl-responded-label">
          Responded
        </div>
        <button
          @click.stop="submitPermission(false)"
          :disabled="isSubmitting || hasSubmittedResponse"
          class="hitl-btn hitl-btn--deny"
          :class="{ 'hitl-btn--disabled': hasSubmittedResponse }"
        >
          {{ isSubmitting ? '...' : 'Deny' }}
        </button>
        <button
          @click.stop="submitPermission(true)"
          :disabled="isSubmitting || hasSubmittedResponse"
          class="hitl-btn hitl-btn--approve"
          :class="{ 'hitl-btn--disabled': hasSubmittedResponse }"
        >
          {{ isSubmitting ? '...' : 'Approve' }}
        </button>
      </div>

      <div v-else-if="event.humanInTheLoop.type === 'choice'" class="hitl-form__actions hitl-form__actions--wrap">
        <button
          v-for="choice in event.humanInTheLoop.choices"
          :key="choice"
          @click.stop="submitChoice(choice)"
          :disabled="isSubmitting || hasSubmittedResponse"
          class="hitl-btn hitl-btn--choice"
        >
          {{ isSubmitting ? '...' : choice }}
        </button>
      </div>
    </div>

    <!-- Standard Event Row -->
    <div
      v-if="!event.humanInTheLoop"
      class="event-row"
      :class="[
        isExpanded ? 'event-row--expanded' : '',
        (rowIndex ?? 0) % 2 === 0 ? 'event-row--even' : 'event-row--odd'
      ]"
      @click="toggleExpanded"
    >
      <!-- Agent color accent -->
      <div class="event-row__accent" :style="{ backgroundColor: appHexColor }"></div>

      <div class="event-row__content">
        <!-- Mobile Layout -->
        <div class="hidden mobile:block mb-1">
          <div class="flex items-center justify-between mb-0.5">
            <div class="flex items-center gap-1.5" :title="fullSessionTooltip">
              <span class="event-row__color-dot" :style="{ backgroundColor: appHexColor }"></span>
              <span class="event-row__agent-name">{{ resolvedAgentName }}</span>
              <span v-if="agentTypeLabel" class="event-row__agent-type">{{ agentTypeLabel }}</span>
            </div>
            <span class="event-row__time font-mono-tight">
              {{ formatTime(event.timestamp) }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="event-row__type">{{ eventTypeLabel }}</span>
            <span v-if="toolName" class="event-row__tool font-mono-tight">{{ toolName }}</span>
            <span v-if="event.model_name" class="event-row__model font-mono-tight" :title="`Model: ${event.model_name}`">
              {{ formatModelName(event.model_name) }}
            </span>
          </div>
        </div>

        <!-- Desktop Layout - single dense row -->
        <div class="mobile:hidden">
          <div class="flex items-center gap-2 min-w-0">
            <span class="event-row__time font-mono-tight shrink-0">
              {{ formatTime(event.timestamp) }}
            </span>
            <span class="event-row__color-dot shrink-0" :style="{ backgroundColor: appHexColor }"></span>
            <span class="event-row__agent-name shrink-0" :title="fullSessionTooltip">{{ resolvedAgentName }}</span>
            <span v-if="agentTypeLabel" class="event-row__agent-type shrink-0">{{ agentTypeLabel }}</span>
            <span class="event-row__separator shrink-0">&mdash;</span>
            <span class="event-row__type shrink-0">{{ eventTypeLabel }}</span>
            <span v-if="toolName" class="event-row__tool font-mono-tight shrink-0">{{ toolName }}</span>
            <span v-if="event.model_name" class="event-row__model font-mono-tight shrink-0" :title="`Model: ${event.model_name}`">
              {{ formatModelName(event.model_name) }}
            </span>

            <!-- Inline summary or tool detail -->
            <span v-if="toolInfo" class="event-row__detail truncate">
              <span v-if="toolInfo.detail" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
            </span>
            <span v-if="event.summary" class="event-row__detail truncate" :class="{ 'ml-1': toolInfo }">
              {{ event.summary }}
            </span>
          </div>
        </div>

        <!-- Mobile tool/summary info -->
        <div class="hidden mobile:block mt-0.5" v-if="toolInfo || event.summary">
          <div v-if="toolInfo" class="event-row__detail-mobile">
            <span class="event-row__tool-label font-mono-tight">{{ toolInfo.tool }}</span>
            <span v-if="toolInfo.detail" class="event-row__detail" :class="{ 'italic': event.hook_event_type === 'UserPromptSubmit' }">{{ toolInfo.detail }}</span>
          </div>
          <div v-if="event.summary && !toolInfo" class="event-row__detail">
            {{ event.summary }}
          </div>
        </div>

        <!-- Expanded content -->
        <div v-if="isExpanded" class="event-row__expanded">
          <!-- Payload -->
          <div>
            <div class="event-row__section-header">
              <h4 class="event-row__section-title">Details</h4>
              <div class="flex items-center gap-2">
                <button
                  @click.stop="showRawPayload = !showRawPayload"
                  class="event-row__copy-btn"
                >
                  {{ showRawPayload ? 'Simple' : 'Raw JSON' }}
                </button>
                <button
                  @click.stop="copyPayload"
                  class="event-row__copy-btn"
                >
                  {{ copyButtonText }}
                </button>
              </div>
            </div>
            <pre class="event-row__code font-mono-tight">{{ showRawPayload ? formattedPayload : simplifiedPayload }}</pre>
          </div>

          <!-- Chat transcript button -->
          <div v-if="event.chat && event.chat.length > 0" class="event-row__chat-link">
            <button
              @click.stop="!isMobile && (showChatModal = true)"
              :class="[
                'event-row__transcript-btn',
                isMobile ? 'event-row__transcript-btn--disabled' : ''
              ]"
              :disabled="isMobile"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              <span>
                {{ isMobile ? 'Not available on mobile' : `View transcript (${event.chat.length})` }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Modal -->
    <ChatTranscriptModal
      v-if="event.chat && event.chat.length > 0"
      :is-open="showChatModal"
      :chat="event.chat"
      @close="showChatModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent, HumanInTheLoopResponse } from '../types';
import { useMediaQuery } from '../composables/useMediaQuery';
// useEventEmojis removed — using text labels
import ChatTranscriptModal from './ChatTranscriptModal.vue';
import { API_BASE_URL } from '../config';

// emoji system removed — using text labels

const props = defineProps<{
  event: HookEvent;
  gradientClass: string;
  colorClass: string;
  appGradientClass: string;
  appColorClass: string;
  appHexColor: string;
  rowIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'response-submitted', response: HumanInTheLoopResponse): void;
}>();

// Existing refs
const isExpanded = ref(false);
const showRawPayload = ref(false);
const showChatModal = ref(false);
const copyButtonText = ref('Copy');

// New refs for HITL
const responseText = ref('');
const isSubmitting = ref(false);
const hasSubmittedResponse = ref(false);
const localResponse = ref<HumanInTheLoopResponse | null>(null); // Optimistic UI

// Media query for responsive design
const { isMobile } = useMediaQuery();

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const sessionIdShort = computed(() => {
  return props.event.session_id.slice(0, 8);
});

// Resolve the display name for the agent using priority:
// 1. display_name  2. agent_name  3. capitalize(agent_type)  4. source_app:session_id[0:8]
const resolvedAgentName = computed(() => {
  if (props.event.display_name) return props.event.display_name;
  if (props.event.agent_name) return props.event.agent_name;
  if (props.event.agent_type) {
    return props.event.agent_type.charAt(0).toUpperCase() + props.event.agent_type.slice(1);
  }
  return `${props.event.source_app}:${sessionIdShort.value}`;
});

// Full session ID for tooltip
const fullSessionTooltip = computed(() => {
  const base = `${props.event.source_app}:${props.event.session_id}`;
  if (props.event.agent_id) return `${base} (agent: ${props.event.agent_id})`;
  return base;
});

const agentTypeLabel = computed(() => {
  // Only show the sublabel when we have a resolved name that differs from agent_type
  // (avoids showing "Builder builder" redundancy)
  if (!props.event.agent_type) return null;
  const capitalized = props.event.agent_type.charAt(0).toUpperCase() + props.event.agent_type.slice(1);
  if (resolvedAgentName.value === capitalized) return null;
  return props.event.agent_type;
});

// Legacy computed properties removed (emoji system replaced with text labels)

// Human-readable event type labels
const eventTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    'PreToolUse': 'Using tool',
    'PostToolUse': 'Tool done',
    'PostToolUseFailure': 'Tool failed',
    'PermissionRequest': 'Needs permission',
    'Notification': 'Notification',
    'Stop': 'Stopping',
    'SubagentStart': 'Spawned agent',
    'SubagentStop': 'Agent finished',
    'PreCompact': 'Compacting context',
    'UserPromptSubmit': 'User prompt',
    'SessionStart': 'Session started',
    'SessionEnd': 'Session ended',
    'AssistantResponse': 'Assistant',
    'SessionTitleChanged': 'Title changed',
  };
  return labels[props.event.hook_event_type] || props.event.hook_event_type;
});

// Simplified payload: show key info, not raw JSON
const simplifiedPayload = computed(() => {
  const p = props.event.payload;
  const lines: string[] = [];

  if (p.tool_name) lines.push(`Tool: ${p.tool_name}`);
  if (p.tool_input?.command) lines.push(`Command: ${p.tool_input.command.slice(0, 120)}`);
  if (p.tool_input?.file_path) lines.push(`File: ${p.tool_input.file_path}`);
  if (p.tool_input?.pattern) lines.push(`Pattern: ${p.tool_input.pattern}`);
  if (p.tool_input?.content) lines.push(`Content: ${p.tool_input.content.slice(0, 80)}...`);
  if (p.tool_input?.old_string) lines.push(`Find: ${p.tool_input.old_string.slice(0, 60)}...`);
  if (p.tool_input?.new_string) lines.push(`Replace: ${p.tool_input.new_string.slice(0, 60)}...`);
  if (p.prompt) lines.push(`Prompt: "${p.prompt.slice(0, 120)}${p.prompt.length > 120 ? '...' : ''}"`);
  if (p.text && !p.tool_name) lines.push(`${p.text.slice(0, 200)}${p.text.length > 200 ? '...' : ''}`);
  if (p.title && !p.tool_name) lines.push(`Title: ${p.title}`);
  if (p.error) lines.push(`Error: ${typeof p.error === 'string' ? p.error.slice(0, 120) : JSON.stringify(p.error).slice(0, 120)}`);
  if (p.description) lines.push(`Description: ${p.description.slice(0, 120)}`);
  if (p.name) lines.push(`Name: ${p.name}`);
  if (p.source) lines.push(`Source: ${p.source}`);
  if (p.reason) lines.push(`Reason: ${p.reason}`);

  return lines.length > 0 ? lines.join('\n') : JSON.stringify(p, null, 2);
});

const formattedPayload = computed(() => {
  return JSON.stringify(props.event.payload, null, 2);
});

const toolName = computed(() => {
  const eventType = props.event.hook_event_type;
  const toolEvents = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest'];
  if (toolEvents.includes(eventType) && props.event.payload?.tool_name) {
    return props.event.payload.tool_name;
  }
  return null;
});

// toolEmoji removed (replaced with text labels)

const toolInfo = computed(() => {
  const payload = props.event.payload;

  // Handle UserPromptSubmit events
  if (props.event.hook_event_type === 'UserPromptSubmit' && payload.prompt) {
    return {
      tool: 'Prompt:',
      detail: `"${payload.prompt.slice(0, 100)}${payload.prompt.length > 100 ? '...' : ''}"`
    };
  }

  // Handle PreCompact events
  if (props.event.hook_event_type === 'PreCompact') {
    const trigger = payload.trigger || 'unknown';
    return {
      tool: 'Compaction:',
      detail: trigger === 'manual' ? 'Manual compaction' : 'Auto-compaction (full context)'
    };
  }

  // Handle SessionStart events
  if (props.event.hook_event_type === 'SessionStart') {
    const source = payload.source || 'unknown';
    const sourceLabels: Record<string, string> = {
      'startup': 'New session',
      'resume': 'Resuming session',
      'clear': 'Fresh session'
    };
    return {
      tool: 'Session:',
      detail: sourceLabels[source] || source
    };
  }

  // Handle tool-based events
  if (payload.tool_name) {
    const info: { tool: string; detail?: string } = { tool: payload.tool_name };

    if (payload.tool_input) {
      const input = payload.tool_input;
      if (input.command) {
        info.detail = input.command.slice(0, 120) + (input.command.length > 120 ? '...' : '');
      } else if (input.file_path) {
        info.detail = input.file_path.split('/').pop();
      } else if (input.pattern) {
        info.detail = input.pattern;
      } else if (input.url) {
        // WebFetch
        info.detail = input.url.slice(0, 60) + (input.url.length > 60 ? '...' : '');
      } else if (input.query) {
        // WebSearch
        info.detail = `"${input.query.slice(0, 50)}${input.query.length > 50 ? '...' : ''}"`;
      } else if (input.notebook_path) {
        // NotebookEdit
        info.detail = input.notebook_path.split('/').pop();
      } else if (input.recipient) {
        // SendMessage
        info.detail = `-> ${input.recipient}${input.summary ? ': ' + input.summary : ''}`;
      } else if (input.subject) {
        // TaskCreate
        info.detail = input.subject;
      } else if (input.taskId) {
        // TaskGet, TaskUpdate
        info.detail = `#${input.taskId}${input.status ? ' -> ' + input.status : ''}`;
      } else if (input.description && input.subagent_type) {
        // Task (launch agent)
        info.detail = `${input.subagent_type}: ${input.description}`;
      } else if (input.task_id) {
        // TaskOutput, TaskStop
        info.detail = `task: ${input.task_id}`;
      } else if (input.team_name) {
        // TeamCreate
        info.detail = input.team_name;
      } else if (input.skill) {
        // Skill
        info.detail = input.skill;
      }
    }

    return info;
  }

  return null;
});

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// Format model name for display (e.g., "claude-haiku-4-5-20251001" -> "haiku-4-5")
const formatModelName = (name: string | null | undefined): string => {
  if (!name) return '';

  // Extract model family and version
  // "claude-haiku-4-5-20251001" -> "haiku-4-5"
  // "claude-sonnet-4-5-20250929" -> "sonnet-4-5"
  const parts = name.split('-');
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return name;
};

const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPayload.value);
    copyButtonText.value = 'Copied';
    setTimeout(() => {
      copyButtonText.value = 'Copy';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyButtonText.value = 'Failed';
    setTimeout(() => {
      copyButtonText.value = 'Copy';
    }, 2000);
  }
};

// New computed properties for HITL
// hitlTypeEmoji removed (replaced with text labels)

const hitlTypeLabel = computed(() => {
  if (!props.event.humanInTheLoop) return '';
  const labelMap = {
    question: 'Agent Question',
    permission: 'Permission Request',
    choice: 'Choice Required'
  };
  return labelMap[props.event.humanInTheLoop.type] || 'Question';
});

const permissionType = computed(() => {
  return props.event.payload?.permission_type || null;
});

// Methods for HITL responses
const submitResponse = async () => {
  if (!responseText.value.trim() || !props.event.id) return;

  const response: HumanInTheLoopResponse = {
    response: responseText.value.trim(),
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  const savedText = responseText.value;
  responseText.value = '';
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit response');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting response:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    responseText.value = savedText;
    alert('Failed to submit response. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitPermission = async (approved: boolean) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    permission: approved,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit permission');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting permission:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit permission. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

const submitChoice = async (choice: string) => {
  if (!props.event.id) return;

  const response: HumanInTheLoopResponse = {
    choice,
    hookEvent: props.event,
    respondedAt: Date.now()
  };

  // Optimistic UI: Show response immediately
  localResponse.value = response;
  hasSubmittedResponse.value = true;
  isSubmitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/events/${props.event.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });

    if (!res.ok) throw new Error('Failed to submit choice');

    emit('response-submitted', response);
  } catch (error) {
    console.error('Error submitting choice:', error);
    // Rollback optimistic update
    localResponse.value = null;
    hasSubmittedResponse.value = false;
    alert('Failed to submit choice. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* ==========================================
   Event Row - Log viewer aesthetic
   ========================================== */

.event-row {
  position: relative;
  padding: 6px 12px 6px 14px;
  cursor: pointer;
  transition: background-color 0.08s ease;
  border-bottom: 1px solid var(--theme-border-primary);
}

.event-row--even {
  background-color: var(--theme-bg-secondary);
}

.event-row--odd {
  background-color: color-mix(in srgb, var(--theme-bg-secondary) 97%, var(--theme-bg-tertiary));
}

.event-row:hover {
  background-color: var(--theme-hover-bg);
}

.event-row--expanded {
  background-color: var(--theme-bg-primary);
}

.event-row--expanded:hover {
  background-color: var(--theme-bg-primary);
}

/* 2px left accent bar */
.event-row__accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
}

.event-row__content {
  margin-left: 4px;
}

/* Timestamp */
.event-row__time {
  font-size: 11px;
  color: var(--theme-text-quaternary);
  font-variant-numeric: tabular-nums;
}

/* Agent color dot */
.event-row__color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Agent resolved name (bold) */
.event-row__agent-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-primary);
  cursor: default;
}

/* Separator dash between agent name and event type */
.event-row__separator {
  font-size: 11px;
  color: var(--theme-text-quaternary);
}

/* Agent ID (legacy, kept for HITL) */
.event-row__agent {
  font-size: 11px;
  font-weight: 500;
}

/* Agent type label (shown for subagents) */
.event-row__agent-type {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-quaternary);
  padding: 0 3px;
  background-color: var(--theme-bg-tertiary);
  border-radius: 2px;
  border: 1px solid var(--theme-border-primary);
}

/* Event type label */
.event-row__type {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-text-tertiary);
}

/* Tool name */
.event-row__tool {
  font-size: 11px;
  color: var(--theme-text-secondary);
  padding: 0 4px;
  background-color: var(--theme-bg-tertiary);
  border-radius: 3px;
}

/* Model name */
.event-row__model {
  font-size: 10px;
  color: var(--theme-text-quaternary);
}

/* Summary / detail text */
.event-row__detail {
  font-size: 11px;
  color: var(--theme-text-quaternary);
  min-width: 0;
}

.event-row__detail-mobile {
  font-size: 11px;
  color: var(--theme-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.event-row__tool-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--theme-primary);
  flex-shrink: 0;
}

/* ==========================================
   Expanded State
   ========================================== */

.event-row__expanded {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--theme-border-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: expand-in 0.15s ease-out;
}

@keyframes expand-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.event-row__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.event-row__section-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-text-quaternary);
}

.event-row__copy-btn {
  font-size: 11px;
  color: var(--theme-text-tertiary);
  background: none;
  border: 1px solid var(--theme-border-primary);
  border-radius: 4px;
  padding: 1px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.event-row__copy-btn:hover {
  color: var(--theme-text-primary);
  border-color: var(--theme-border-secondary);
  background-color: var(--theme-bg-tertiary);
}

/* Code block */
.event-row__code {
  font-size: 11px;
  line-height: 1.5;
  color: var(--theme-text-secondary);
  background-color: var(--theme-bg-tertiary);
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-primary);
  overflow-x: auto;
  max-height: 224px;
  overflow-y: auto;
}

/* Chat transcript link */
.event-row__chat-link {
  display: flex;
  justify-content: flex-end;
}

.event-row__transcript-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--theme-text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.12s ease;
}

.event-row__transcript-btn:hover {
  color: var(--theme-text-primary);
}

.event-row__transcript-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==========================================
   HITL Card
   ========================================== */

.hitl-card {
  margin: 4px 0;
  padding: 12px 14px;
  border-left: 2px solid;
  background-color: var(--theme-bg-primary);
  border-bottom: 1px solid var(--theme-border-primary);
}

.hitl-card--pending {
  border-left-color: #fbbf24;
}

.hitl-card--responded {
  border-left-color: var(--theme-accent-success);
}

/* HITL Header */
.hitl-header {
  margin-bottom: 10px;
}

.hitl-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.hitl-header__label-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hitl-header__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.hitl-permission-type {
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, monospace;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--theme-border-secondary);
  color: var(--theme-text-secondary);
  background-color: var(--theme-bg-tertiary);
}

.hitl-waiting {
  font-size: 11px;
  color: var(--theme-text-quaternary);
}

.hitl-header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hitl-meta__agent {
  font-size: 11px;
  font-weight: 500;
}

.hitl-meta__time {
  font-size: 11px;
  color: var(--theme-text-quaternary);
}

.hitl-meta__agent-type {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-quaternary);
  padding: 0 3px;
  background-color: var(--theme-bg-tertiary);
  border-radius: 2px;
  border: 1px solid var(--theme-border-primary);
}

/* HITL Question block */
.hitl-question {
  padding: 8px 10px;
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 4px;
  margin-bottom: 10px;
}

.hitl-question__text {
  font-size: 13px;
  color: var(--theme-text-primary);
  line-height: 1.5;
}

/* HITL Response display */
.hitl-response-display {
  padding: 8px 10px;
  background-color: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-accent-success);
  border-left: 2px solid var(--theme-accent-success);
  border-radius: 4px;
  margin-bottom: 10px;
}

.hitl-response-display__header {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-accent-success);
  margin-bottom: 4px;
}

.hitl-response-display__body {
  font-size: 13px;
  color: var(--theme-text-primary);
}

/* HITL Form elements */
.hitl-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hitl-textarea {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--theme-text-primary);
  background-color: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-secondary);
  border-radius: 4px;
  resize: none;
  outline: none;
  font-family: inherit;
  transition: border-color 0.12s ease;
}

.hitl-textarea:focus {
  border-color: var(--theme-border-tertiary);
}

.hitl-textarea::placeholder {
  color: var(--theme-text-quaternary);
}

.hitl-form__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

.hitl-form__actions--wrap {
  flex-wrap: wrap;
}

/* HITL Buttons */
.hitl-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 5px 14px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
}

.hitl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hitl-btn--submit {
  background-color: #fbbf24;
  color: #0a0a0b;
  border-color: #d97706;
}

.hitl-btn--submit:hover:not(:disabled) {
  background-color: #fcd34d;
}

.hitl-btn--approve {
  background-color: var(--theme-accent-success);
  color: #fff;
}

.hitl-btn--approve:hover:not(:disabled) {
  opacity: 0.9;
}

.hitl-btn--deny {
  background-color: transparent;
  color: var(--theme-accent-error);
  border-color: var(--theme-accent-error);
}

.hitl-btn--deny:hover:not(:disabled) {
  background-color: var(--theme-accent-error);
  color: #fff;
}

.hitl-btn--choice {
  background-color: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  border-color: var(--theme-border-secondary);
}

.hitl-btn--choice:hover:not(:disabled) {
  border-color: var(--theme-border-tertiary);
  color: var(--theme-text-primary);
}

.hitl-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hitl-responded-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-accent-success);
  margin-right: auto;
}
</style>
