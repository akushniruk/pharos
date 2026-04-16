import { For, Show, createSignal } from 'solid-js';
import type { HookEvent } from '../lib/types';
import { formatTime, timeAgo } from '../lib/time';
import {
  describeEvent,
  describeEventDetail,
  formatPayloadScalar,
  formatAcquisitionModeLabel,
  formatRuntimeLabel,
  isPayloadContainer,
  mergeSimpleRowSummary,
  simpleEventKindLabel,
  sortedPayloadEntries,
} from '../lib/describe';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';
import { resolveEventAgentName } from '../lib/agentNaming';
import { describeMemoryOperation, extractMcpToolCall } from '../lib/describe/text';

interface Props {
  event: HookEvent;
  detailed: boolean;
  /** When set, row is visually tied to an open attention/blocked banner for this session. */
  attentionRowTone?: 'attention' | 'blocked';
}

function resolveAgentName(e: HookEvent): string {
  if (e.payload?.producer === 'pharos_ollama_scanner') {
    const models = e.payload?.running_models;
    if (Array.isArray(models)) {
      for (const m of models) {
        if (typeof m === 'string' && m.toLowerCase().includes('gemma')) {
          const compact = m.replace(/:/g, ' ');
          return compact.length > 24 ? `${compact.slice(0, 23)}…` : `Gemma · ${compact}`;
        }
      }
    }
    return 'Ollama';
  }
  if (e.payload?.producer === 'pharos_ollama_probe') {
    const raw = typeof e.payload?.model === 'string' ? e.payload.model.trim() : '';
    if (raw && raw.toLowerCase().includes('gemma')) {
      const compact = raw.replace(/:/g, ' ');
      return compact.length > 24 ? `${compact.slice(0, 23)}…` : `Gemma · ${compact}`;
    }
    return 'Ollama';
  }
  const isMainSessionEvent = !e.agent_id;
  const looksLikeOrchestrationEvent =
    e.hook_event_type === 'SubagentStart'
    || (e.hook_event_type === 'PreToolUse' && e.payload?.tool_name === 'Agent');
  const fallback = isMainSessionEvent
    ? (looksLikeOrchestrationEvent ? 'Orchestrator' : 'Team')
    : 'Agent';
  const resolved = resolveEventAgentName(e, fallback).trim();

  // Keep row identity stable and avoid leaking project names or long task text.
  if (!resolved) return fallback;
  if (resolved.length > 28 || resolved.split(/\s+/).length > 3 || resolved.includes(':')) {
    return fallback;
  }
  return resolved;
}

function resolveRuntimeDisplay(e: HookEvent): string | undefined {
  const runtimeCandidate = e.payload?.runtime_label || e.payload?.runtime_source;
  return formatRuntimeLabel(runtimeCandidate);
}

function resolveAcquisitionModeDisplay(e: HookEvent): string | undefined {
  return formatAcquisitionModeLabel(e.payload?.acquisition_mode);
}

function resolveProjectName(e: HookEvent): string {
  if (typeof e.payload?.project_name === 'string' && e.payload.project_name.trim()) {
    return e.payload.project_name;
  }
  return e.source_app;
}

function resolveSummaryKind(e: HookEvent): string | undefined {
  if (e.hook_event_type === 'SubagentStart') {
    return 'Next action';
  }
  if (e.hook_event_type === 'PreToolUse') {
    if (e.payload?.tool_name === 'Agent') {
      return 'Next action';
    }
    return 'Current progress';
  }
  if (e.hook_event_type === 'UserPromptSubmit') {
    return 'Requested work';
  }
  if (e.hook_event_type === 'AssistantResponse') {
    return 'Update';
  }
  return undefined;
}

function resolveMemorySignalTag(e: HookEvent): string | undefined {
  if (e.hook_event_type !== 'PreToolUse') return undefined;
  const toolName = typeof e.payload?.tool_name === 'string' ? e.payload.tool_name : '';
  if (toolName !== 'CallMcpTool') return undefined;
  const toolInput = e.payload?.tool_input;
  if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) return undefined;
  const { server, toolName: mcpToolName } = extractMcpToolCall(toolInput as Record<string, unknown>);
  const serverLc = (server || '').toLowerCase();
  const memoryServer =
    serverLc === 'ai-memory-brain'
    || serverLc === 'user-ai-memory-brain'
    || serverLc.endsWith('ai-memory-brain')
    || serverLc.includes('librarian');
  if (!memoryServer && !(mcpToolName || '').startsWith('memory_')) return undefined;
  return describeMemoryOperation(mcpToolName) || 'Memory operation';
}

export default function EventRow(props: Props) {
  const [expanded, setExpanded] = createSignal(false);
  const [payloadView, setPayloadView] = createSignal<'parsed' | 'raw'>('parsed');
  const e = () => props.event;
  const isTool = () => e().hook_event_type.includes('Tool');
  const runtimeDisplay = () => resolveRuntimeDisplay(e());
  const acquisitionModeDisplay = () => resolveAcquisitionModeDisplay(e());
  const description = () => describeEvent(e());
  const kindLabel = () =>
    props.detailed
      ? resolveSummaryKind(e())
      : simpleEventKindLabel(e().hook_event_type);
  const descriptionDetail = () => {
    const detail = describeEventDetail(e());
    return detail && detail !== description() ? detail : undefined;
  };
  const simpleSummary = () => mergeSimpleRowSummary(e());
  const payloadJson = () => JSON.stringify(e().payload, null, 2);
  const payloadEntries = () => sortedPayloadEntries((e().payload as Record<string, unknown>) ?? {});
  const memorySignalTag = () => resolveMemorySignalTag(e());

  const copyJson = (ev: MouseEvent) => {
    ev.stopPropagation();
    navigator.clipboard.writeText(payloadJson());
  };

  return (
    <div
      class="event-row-shell"
      classList={{
        'event-row-attention': Boolean(props.attentionRowTone),
        'is-attention': props.attentionRowTone === 'attention',
        'is-blocked': props.attentionRowTone === 'blocked',
      }}
      onClick={() => props.detailed && setExpanded(x => !x)}
      role={props.detailed ? 'button' : undefined}
      tabindex={props.detailed ? 0 : undefined}
      aria-expanded={props.detailed ? expanded() : undefined}
      aria-label={props.detailed ? `Toggle details for ${description()}` : undefined}
      onKeyDown={(ev) => {
        if (!props.detailed) return;
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          setExpanded((x) => !x);
        }
      }}
    >
      {/* Always-visible row */}
      <div
        class="event-row-body"
        classList={{ 'event-row-body-clickable': props.detailed }}
      >
        <div class="event-row-meta">
          <span class="event-row-time">
            {formatTime(e().timestamp)}
          </span>
          <span class="event-row-agent" title={resolveAgentName(e())}>
            {resolveAgentName(e())}
          </span>
          <Show when={runtimeDisplay()}>
            <span class="event-row-runtime">
              {runtimeDisplay()}
            </span>
          </Show>
          <Show when={acquisitionModeDisplay()}>
            <span class="event-row-mode" title="Acquisition mode">
              {acquisitionModeDisplay()}
            </span>
          </Show>
          <Show when={kindLabel()}>
            <span class="event-row-kind">
              {kindLabel()}
            </span>
          </Show>
          <Show when={props.detailed}>
            <span
              class="event-row-type"
              style={{
                background: getEventTypeBgColor(e().hook_event_type),
                color: getEventTypeTextColor(e().hook_event_type),
              }}
            >
              {getEventTypeLabel(e().hook_event_type)}
            </span>
          </Show>
          <Show when={props.detailed && isTool()}>
            <span class="event-row-tool" title={e().payload?.tool_name}>
              {e().payload?.tool_name}
            </span>
          </Show>
          <Show when={props.detailed && memorySignalTag()}>
            <span class="event-row-tool" title={memorySignalTag()}>
              {memorySignalTag()}
            </span>
          </Show>
        </div>
        <div class="event-row-content">
          <div class="event-row-copy">
            <span class="event-row-summary" title={props.detailed ? description() : simpleSummary()}>
              {props.detailed ? description() : simpleSummary()}
            </span>
            <Show when={props.detailed && descriptionDetail()}>
              <span class="event-row-detail" title={descriptionDetail()}>
                {descriptionDetail()}
              </span>
            </Show>
          </div>
          <span class="event-row-context" title={[resolveProjectName(e()), timeAgo(e().timestamp)].join(' · ')}>
            {[resolveProjectName(e()), timeAgo(e().timestamp)].join(' · ')}
          </span>
        </div>
      </div>

      {/* Expanded payload section */}
      <Show when={props.detailed && expanded()}>
        <div class="event-row-expanded" onClick={(ev) => ev.stopPropagation()}>
          <div class="event-row-expanded-header">
            <div class="event-row-payload-tabs" role="tablist" aria-label="Payload view mode">
              <button
                class="event-row-payload-tab"
                classList={{ 'is-active': payloadView() === 'parsed' }}
                role="tab"
                type="button"
                aria-selected={payloadView() === 'parsed'}
                onClick={() => setPayloadView('parsed')}
              >
                Parsed
              </button>
              <button
                class="event-row-payload-tab"
                classList={{ 'is-active': payloadView() === 'raw' }}
                role="tab"
                type="button"
                aria-selected={payloadView() === 'raw'}
                onClick={() => setPayloadView('raw')}
              >
                Raw JSON
              </button>
            </div>
            <button
              onClick={copyJson}
              type="button"
              aria-label="Copy raw event payload as JSON"
              class="event-row-copy-json-btn"
            >
              Copy JSON
            </button>
          </div>

          <Show
            when={payloadView() === 'parsed'}
            fallback={
              <pre class="event-row-raw-json">
                {payloadJson()}
              </pre>
            }
          >
            <Show
              when={payloadEntries().length > 0}
              fallback={<p class="event-row-empty-payload">No payload fields for this event.</p>}
            >
              <div class="event-row-parsed-payload">
                <For each={payloadEntries()}>
                  {(entry) => (
                    <PayloadField label={entry[0]} value={entry[1]} depth={0} />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}

interface PayloadFieldProps {
  label: string;
  value: unknown;
  depth: number;
}

function PayloadField(props: PayloadFieldProps) {
  const nestedEntries = () => {
    if (Array.isArray(props.value)) {
      return props.value.map((item, index) => [`[${index}]`, item] as const);
    }
    if (isPayloadContainer(props.value) && !Array.isArray(props.value)) {
      return sortedPayloadEntries(props.value as Record<string, unknown>);
    }
    return [];
  };
  const hasChildren = () => nestedEntries().length > 0;
  const typeLabel = () => {
    if (Array.isArray(props.value)) return `array(${nestedEntries().length})`;
    if (isPayloadContainer(props.value)) return `object(${nestedEntries().length})`;
    return typeof props.value;
  };

  return (
    <Show
      when={hasChildren()}
      fallback={
        <div class="event-row-payload-leaf">
          <span class="event-row-payload-key">{props.label}</span>
          <span class="event-row-payload-value">{formatPayloadScalar(props.value)}</span>
        </div>
      }
    >
      <details class="event-row-payload-node" open={props.depth <= 0}>
        <summary class="event-row-payload-summary">
          <span class="event-row-payload-key">{props.label}</span>
          <span class="event-row-payload-type">{typeLabel()}</span>
        </summary>
        <div class="event-row-payload-children">
          <For each={nestedEntries()}>
            {(entry) => (
              <PayloadField label={entry[0]} value={entry[1]} depth={props.depth + 1} />
            )}
          </For>
        </div>
      </details>
    </Show>
  );
}
