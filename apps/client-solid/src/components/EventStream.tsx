import {
  For,
  Show,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  type Accessor,
} from 'solid-js';
import { Icon } from 'solid-heroicons';
import {
  bars_3BottomLeft,
  queueList,
  funnel,
  exclamationTriangle,
} from 'solid-heroicons/solid';
import {
  filteredEvents,
  logsAttentionAlerts,
  markAttentionSolved,
  selectedProjectFocusSnapshot,
  selectedProjectSnapshot,
  selectSession,
  type LogsAttentionAlert,
} from '../lib/store';
import { extractToolNameFromAttentionDetail } from '../lib/attentionHints';
import { getEventTypeLabel } from '../lib/colors';
import SearchBar, { searchQuery } from './SearchBar';
import EventRow from './EventRow';
import ViewModeTabs from './ViewModeTabs';
import { connectionState, hasStreamData } from '../lib/ws';
import type { HookEvent } from '../lib/types';
import { formatRuntimeLabel } from '../lib/describe';
import { API_BASE } from '../lib/ws';
import {
  attentionEventKey,
  compactEvents,
  EVENT_STREAM_DETAIL_MODE_KEY,
  EVENT_STREAM_EVENT_TYPES,
  searchableDisplayLine,
} from '../widgets/event-stream/streamHelpers';

interface EventStreamProps {
  viewMode: Accessor<'logs' | 'graph'>;
  onViewModeChange: (mode: 'logs' | 'graph') => void;
}

export default function EventStream(props: EventStreamProps) {
  const SIMPLE_HIDDEN = new Set(['SessionStart', 'SessionEnd', 'SessionTitleChanged']);
  const [detailed, setDetailed] = createSignal(false);
  const [stick, setStick] = createSignal(true);
  const [showFilters, setShowFilters] = createSignal(false);
  const [hiddenTypes, setHiddenTypes] = createSignal<Set<string>>(new Set(SIMPLE_HIDDEN));
  const [hiddenRuntimes, setHiddenRuntimes] = createSignal<Set<string>>(new Set());
  const [backendMatches, setBackendMatches] = createSignal<HookEvent[] | null>(null);
  const [copiedAttentionFingerprint, setCopiedAttentionFingerprint] = createSignal<string | null>(
    null,
  );
  let attentionCopyResetTimer: number | undefined;
  const focus = createMemo(() => selectedProjectFocusSnapshot());
  const project = createMemo(() => selectedProjectSnapshot());

  const copyAttentionSummary = async (alert: LogsAttentionAlert) => {
    const proj = project()?.name ?? '';
    const body = [
      `${alert.headline} — ${alert.sessionTitle} (${proj})`,
      alert.detail,
      '',
      'Suggestions:',
      ...alert.suggestions.map((line, index) => `${index + 1}. ${line}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(body);
      setCopiedAttentionFingerprint(alert.fingerprint);
      window.clearTimeout(attentionCopyResetTimer);
      attentionCopyResetTimer = window.setTimeout(() => setCopiedAttentionFingerprint(null), 2000);
    } catch {
      /* clipboard denied or unavailable */
    }
  };

  onCleanup(() => {
    window.clearTimeout(attentionCopyResetTimer);
  });

  const switchToDetailed = () => {
    setDetailed(true);
    // Show all types in detailed mode
    setHiddenTypes(new Set());
  };
  const switchToSimple = () => {
    setDetailed(false);
    // Re-hide lifecycle in simple mode
    setHiddenTypes(new Set(SIMPLE_HIDDEN));
  };
  onMount(() => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(EVENT_STREAM_DETAIL_MODE_KEY);
    if (saved === 'detailed') {
      switchToDetailed();
      return;
    }
    if (saved === 'simple') {
      switchToSimple();
    }
  });
  createEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(EVENT_STREAM_DETAIL_MODE_KEY, detailed() ? 'detailed' : 'simple');
  });
  let containerRef: HTMLDivElement | undefined;

  const toggleType = (type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRuntime = (runtime: string) => {
    setHiddenRuntimes((prev) => {
      const next = new Set(prev);
      if (next.has(runtime)) next.delete(runtime);
      else next.add(runtime);
      return next;
    });
  };

  const runtimeLabelForEvent = (event: HookEvent): string => {
    const candidate = event.payload?.runtime_label || event.payload?.runtime_source;
    return formatRuntimeLabel(candidate) || 'Unknown';
  };

  const runtimeOptions = createMemo(() => {
    const labels = new Set<string>();
    for (const event of filteredEvents()) {
      labels.add(runtimeLabelForEvent(event));
    }
    return Array.from(labels).sort((left, right) => left.localeCompare(right));
  });

  const displayEvents = createMemo(() => {
    const query = searchQuery();
    const hidden = hiddenTypes();
    const hiddenRuntimeSet = hiddenRuntimes();
    const source = backendMatches() ?? filteredEvents();
    let evts = compactEvents(source.filter((event) =>
      !hidden.has(event.hook_event_type)
      && !hiddenRuntimeSet.has(runtimeLabelForEvent(event))));

    if (query) {
      // backend search already narrowed the list; keep lightweight local fallback
      if (!backendMatches()) {
        try {
          const re = new RegExp(query, 'i');
          evts = evts.filter(e => re.test(searchableDisplayLine(e)));
        } catch { /* invalid regex */ }
      }
    }
    return evts.slice(-500).reverse();
  });

  /** One visible row per attention alert: prefer tool named in status detail, else newest row for session. */
  const attentionHighlightByEventKey = createMemo(() => {
    const map = new Map<string, 'attention' | 'blocked'>();
    const events = displayEvents();
    for (const alert of logsAttentionAlerts()) {
      const toolHint = extractToolNameFromAttentionDetail(alert.detail);
      let row: HookEvent | undefined;

      if (toolHint) {
        const hintLower = toolHint.toLowerCase();
        row = events.find((ev) => {
          if (ev.session_id !== alert.sessionId) return false;
          if (!ev.hook_event_type.includes('Tool')) return false;
          const name = ev.payload?.tool_name;
          if (typeof name !== 'string') return false;
          const n = name.toLowerCase();
          return n === hintLower || n.includes(hintLower) || hintLower.includes(n);
        });
      }

      if (!row) {
        row = events.find((ev) => ev.session_id === alert.sessionId);
      }

      if (row) {
        map.set(attentionEventKey(row), alert.tone);
      }
    }
    return map;
  });

  const emptyState = createMemo(() => {
    const totalEvents = filteredEvents().length;
    const visibleEvents = displayEvents().length;
    const projectSnapshot = project();
    const query = searchQuery().trim();
    const hidden = hiddenTypes();
    const customFiltersActive = hidden.size > SIMPLE_HIDDEN.size;
    const runtimeFiltersActive = hiddenRuntimes().size > 0;
    const hasScopedFocus = Boolean(focus()?.hasSessionFocus || focus()?.hasAgentFocus);

    if (connectionState() === 'connecting' && !hasStreamData()) {
      return {
        title: 'Loading live events',
        body: 'Waiting for the first event batch from the daemon.',
      };
    }

    if (connectionState() === 'disconnected' && !hasStreamData()) {
      return {
        title: 'Disconnected',
        body: 'No live event data has arrived yet.',
      };
    }

    if (totalEvents === 0) {
      return {
        title: hasScopedFocus ? 'No events match the current focus' : 'No events captured for this project yet',
        body: hasScopedFocus
          ? 'Clear the selected session or agent to widen the scope.'
          : `Project ${projectSnapshot?.name || 'selection'} has no event rows yet.`,
      };
    }

    if (visibleEvents === 0) {
      if (query) {
        return {
          title: 'No events match your search',
          body: 'Clear the search box or use a broader term.',
        };
      }

      if (customFiltersActive || runtimeFiltersActive) {
        return {
          title: 'No events match the active filters',
          body: 'Re-enable one or more event type/runtime filters to reveal rows.',
        };
      }

      return {
        title: 'No visible events in this view',
        body: 'The current focus only has lifecycle events, or nothing remains after trimming the stream.',
      };
    }

    return null;
  });

  createEffect(() => {
    displayEvents();
    if (stick() && containerRef) containerRef.scrollTop = 0;
  });

  createEffect(() => {
    const query = searchQuery().trim();
    const scope = focus();
    if (!query) {
      setBackendMatches(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          query,
          limit: '2000',
        });
        if (scope?.projectName) params.set('source_app', scope.projectName);
        if (scope?.sessionId) params.set('session_id', scope.sessionId);
        const response = await fetch(`${API_BASE}/api/events/search?${params.toString()}`);
        if (!response.ok) {
          setBackendMatches(null);
          return;
        }
        const rows = (await response.json()) as HookEvent[];
        setBackendMatches(Array.isArray(rows) ? rows : null);
      } catch {
        setBackendMatches(null);
      }
    }, 180);

    return () => clearTimeout(timer);
  });

  return (
    <div class="event-stream-shell">
      {/* Toolbar */}
      <div class="event-stream-toolbar">
        <ViewModeTabs viewMode={props.viewMode} onChange={props.onViewModeChange} />

        <SearchBar />

        <div class="event-stream-toolbar-actions">
          <div class="pill-tabs event-stream-mode-tabs">
          <button
            class="pill-tab event-stream-tab"
            classList={{ 'is-active': !detailed() }}
            type="button"
            onClick={switchToSimple}
            aria-label="Switch to simple mode"
          >
            <span class="event-stream-tab-content">
              <Icon path={queueList} class="event-stream-tab-icon" /> Simple
            </span>
          </button>
          <button
            class="pill-tab event-stream-tab"
            classList={{ 'is-active': detailed() }}
            type="button"
            onClick={switchToDetailed}
            aria-label="Switch to detailed mode"
          >
            <span class="event-stream-tab-content">
              <Icon path={bars_3BottomLeft} class="event-stream-tab-icon" /> Detailed
            </span>
          </button>
        </div>

          <button
            class="pill-tab event-stream-tab event-stream-filter-toggle"
            classList={{ 'is-active': showFilters() }}
            type="button"
            onClick={() => setShowFilters(f => !f)}
            title="Toggle event type filters"
            aria-pressed={showFilters()}
            aria-label="Toggle event type filters"
          >
            <span class="event-stream-tab-content">
              <Icon path={funnel} class="event-stream-tab-icon" /> Filter
            </span>
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <Show when={showFilters()}>
        <div class="event-stream-filterchips">
          <div class="event-stream-filter-row">
            <span class="event-stream-filter-group-label">Types</span>
            <div class="event-stream-filter-chip-wrap">
              <For each={[...EVENT_STREAM_EVENT_TYPES]}>
                {(type) => {
                  const hidden = () => hiddenTypes().has(type);
                  return (
                    <button
                      onClick={() => toggleType(type)}
                      aria-pressed={!hidden()}
                      aria-label={`${hidden() ? 'Show' : 'Hide'} ${getEventTypeLabel(type)} events`}
                      type="button"
                      class="event-stream-chip"
                      classList={{ 'is-hidden': hidden(), 'is-active': !hidden() }}
                    >
                      {getEventTypeLabel(type)}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
          <Show when={runtimeOptions().length > 0}>
            <div class="event-stream-filter-row">
              <span class="event-stream-filter-group-label">Runtimes</span>
              <div class="event-stream-filter-chip-wrap">
                <For each={runtimeOptions()}>
                  {(runtime) => {
                    const hidden = () => hiddenRuntimes().has(runtime);
                    return (
                      <button
                        onClick={() => toggleRuntime(runtime)}
                        aria-pressed={!hidden()}
                        aria-label={`${hidden() ? 'Show' : 'Hide'} ${runtime} events`}
                        type="button"
                        class="event-stream-chip"
                        classList={{ 'is-hidden': hidden(), 'is-active': !hidden() }}
                      >
                        {runtime}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={props.viewMode() === 'logs' && logsAttentionAlerts().length > 0}>
        <div class="event-stream-attention-wrap" role="region" aria-label="Sessions needing attention">
          <For each={logsAttentionAlerts()}>
            {(alert) => (
              <div
                class="event-stream-attention-banner"
                classList={{
                  'is-blocked': alert.tone === 'blocked',
                  'is-attention': alert.tone === 'attention',
                }}
              >
                <div class="event-stream-attention-head">
                  <Icon path={exclamationTriangle} class="event-stream-attention-icon" />
                  <div class="event-stream-attention-copy">
                    <div class="event-stream-attention-title">
                      <span class="event-stream-attention-headline">{alert.headline}</span>
                      <span class="event-stream-attention-session">{alert.sessionTitle}</span>
                      <span class="event-stream-attention-project">{project()?.name}</span>
                    </div>
                    <p class="event-stream-attention-detail">{alert.detail}</p>
                  </div>
                </div>
                <ul class="event-stream-attention-suggestions">
                  <For each={alert.suggestions}>
                    {(line) => <li class="event-stream-attention-suggestion">{line}</li>}
                  </For>
                </ul>
                <div class="event-stream-attention-cta-row">
                  <button
                    type="button"
                    class="event-stream-attention-jump"
                    aria-label="Show log: select this session in the sidebar"
                    onClick={() => selectSession(alert.sessionId)}
                  >
                    Show log
                  </button>
                  <button
                    type="button"
                    class="event-stream-attention-secondary"
                    classList={{
                      'is-copied': copiedAttentionFingerprint() === alert.fingerprint,
                    }}
                    onClick={() => void copyAttentionSummary(alert)}
                  >
                    {copiedAttentionFingerprint() === alert.fingerprint ? 'Copied' : 'Copy summary'}
                  </button>
                  <button
                    type="button"
                    class="event-stream-attention-solved"
                    aria-label="Mark as solved: remove banner and log highlights until status changes"
                    title="Clears this banner and log highlights until the daemon reports new activity or a different status"
                    onClick={() => markAttentionSolved(alert.fingerprint)}
                  >
                    Solved
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Event list */}
      <div ref={containerRef} class="event-stream-list" aria-live="polite" aria-label="Live event stream">
        <For each={displayEvents()}>
          {(e) => (
            <EventRow
              event={e}
              detailed={detailed()}
              attentionRowTone={attentionHighlightByEventKey().get(attentionEventKey(e))}
            />
          )}
        </For>
        <Show when={displayEvents().length === 0}>
          <div class="event-stream-empty-wrap">
            <div class="event-stream-empty-card">
              <p class="event-stream-empty-title">
                {emptyState()?.title}
              </p>
              <p class="event-stream-empty-body">
                {emptyState()?.body}
              </p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
