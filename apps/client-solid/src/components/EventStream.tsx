import { For, Show, createSignal, createMemo, createEffect } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { bars_3BottomLeft, queueList, funnel } from 'solid-heroicons/solid';
import {
  filteredEvents,
  selectedProjectFocusSnapshot,
  selectedProjectSnapshot,
  selectedViewedChangesSnapshot,
  acknowledgeSelectedScope,
  selectSession,
} from '../lib/store';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';
import SearchBar, { searchQuery } from './SearchBar';
import EventRow from './EventRow';
import { connectionState, hasStreamData } from '../lib/ws';
import type { HookEvent } from '../lib/types';
import { describeEvent, describeEventDetail, mergeSimpleRowSummary, simpleEventKindLabel } from '../lib/describe';
import { timeAgo } from '../lib/time';
import { API_BASE } from '../lib/ws';

const EVENT_TYPES = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'AssistantResponse',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd', 'SessionTitleChanged',
];

export default function EventStream() {
  const SIMPLE_HIDDEN = new Set(['SessionStart', 'SessionEnd', 'SessionTitleChanged']);
  const [detailed, setDetailed] = createSignal(false);
  const [stick, setStick] = createSignal(true);
  const [showFilters, setShowFilters] = createSignal(false);
  const [hiddenTypes, setHiddenTypes] = createSignal<Set<string>>(new Set(SIMPLE_HIDDEN));
  const [backendMatches, setBackendMatches] = createSignal<HookEvent[] | null>(null);
  const focus = createMemo(() => selectedProjectFocusSnapshot());
  const project = createMemo(() => selectedProjectSnapshot());
  const viewedChanges = createMemo(() => selectedViewedChangesSnapshot());

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
  let containerRef: HTMLDivElement | undefined;

  const toggleType = (type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Count events by type for badges
  const typeCounts = createMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEvents()) {
      counts.set(e.hook_event_type, (counts.get(e.hook_event_type) || 0) + 1);
    }
    return counts;
  });

  const displayEvents = createMemo(() => {
    const query = searchQuery();
    const hidden = hiddenTypes();
    const source = backendMatches() ?? filteredEvents();
    let evts = compactEvents(source.filter(e => !hidden.has(e.hook_event_type)));

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

  const emptyState = createMemo(() => {
    const totalEvents = filteredEvents().length;
    const visibleEvents = displayEvents().length;
    const projectSnapshot = project();
    const query = searchQuery().trim();
    const hidden = hiddenTypes();
    const customFiltersActive = hidden.size > SIMPLE_HIDDEN.size;
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
          : `Project ${projectSnapshot()?.name || 'selection'} has no event rows yet.`,
      };
    }

    if (visibleEvents === 0) {
      if (query) {
        return {
          title: 'No events match your search',
          body: 'Clear the search box or use a broader term.',
        };
      }

      if (customFiltersActive) {
        return {
          title: 'No events match the active type filters',
          body: 'Re-enable one or more event types to reveal rows.',
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
        <button
          class="event-stream-tab"
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
          class="event-stream-tab"
          classList={{ 'is-active': detailed() }}
          type="button"
          onClick={switchToDetailed}
          aria-label="Switch to detailed mode"
        >
          <span class="event-stream-tab-content">
            <Icon path={bars_3BottomLeft} class="event-stream-tab-icon" /> Detailed
          </span>
        </button>

        <SearchBar />

        <button
          class="event-stream-tab event-stream-filter-toggle"
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

      <Show when={focus()}>
        {(currentFocus) => (
          <div class="event-stream-focusbar">
            <span class="event-stream-focus-label">
              Focus
            </span>
            <span class="event-stream-focus-scope">
              {currentFocus().scopeLabel}
            </span>
            <div class="event-stream-focus-actions">
              <Show when={viewedChanges()}>
                {(currentViewed) => (
                  <span
                    class="event-stream-pill"
                    classList={{
                      'is-unread': currentViewed().hasUnreadChanges,
                      'is-uptodate': !currentViewed().hasUnreadChanges,
                    }}
                    title={currentViewed().body}
                  >
                    {currentViewed().hasUnreadChanges
                      ? `${currentViewed().unreadCount} new since viewed`
                      : 'Up to date'}
                  </span>
                )}
              </Show>
              <button
                onClick={acknowledgeSelectedScope}
                type="button"
                class="event-stream-pill-button"
              >
                Mark viewed
              </button>
              <button
                onClick={() => selectSession(null)}
                type="button"
                class="event-stream-pill-button is-muted"
              >
                Show all events
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* Filter chips */}
      <Show when={showFilters()}>
        <div class="event-stream-filterchips">
          <For each={EVENT_TYPES}>
            {(type) => {
              const count = () => typeCounts().get(type) || 0;
              const hidden = () => hiddenTypes().has(type);
              return (
                <button
                  onClick={() => toggleType(type)}
                  aria-pressed={!hidden()}
                  aria-label={`${hidden() ? 'Show' : 'Hide'} ${getEventTypeLabel(type)} events`}
                  type="button"
                  class="event-stream-chip"
                  classList={{ 'is-hidden': hidden() }}
                  style={hidden()
                    ? {}
                    : {
                      background: getEventTypeBgColor(type),
                      color: getEventTypeTextColor(type),
                    }}
                >
                  {getEventTypeLabel(type)}
                  <span class="event-stream-chip-count">{count()}</span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Event list */}
      <div ref={containerRef} class="event-stream-list" aria-live="polite" aria-label="Live event stream">
        <For each={displayEvents()}>
          {(e) => <EventRow event={e} detailed={detailed()} />}
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

function searchableEventText(event: HookEvent): string {
  const payload = event.payload || {};
  const textFields: string[] = [];
  if (typeof payload.prompt === 'string') textFields.push(payload.prompt);
  if (typeof payload.message === 'string') textFields.push(payload.message);
  if (typeof payload.text === 'string') textFields.push(payload.text);
  if (typeof payload.content === 'string') textFields.push(payload.content);
  if (typeof payload.description === 'string') textFields.push(payload.description);
  if (typeof payload.title === 'string') textFields.push(payload.title);
  if (typeof payload.project_name === 'string') textFields.push(payload.project_name);
  if (typeof payload.cwd === 'string') textFields.push(payload.cwd);
  return textFields.join(' ');
}

function searchableDisplayLine(event: HookEvent): string {
  const parts = [
    event.hook_event_type,
    simpleEventKindLabel(event.hook_event_type),
    event.source_app,
    event.session_id,
    event.display_name || '',
    event.agent_name || '',
    event.payload?.runtime_label || '',
    event.payload?.acquisition_mode || '',
    event.payload?.tool_name || '',
    describeEvent(event),
    describeEventDetail(event) || '',
    mergeSimpleRowSummary(event, 160),
    timeAgo(event.timestamp),
    searchableEventText(event),
  ];
  return parts.filter(Boolean).join(' ');
}

function compactEvents(events: HookEvent[]): HookEvent[] {
  const result: HookEvent[] = [];
  for (const event of events) {
    const previous = result[result.length - 1];
    if (!previous) {
      result.push(event);
      continue;
    }
    if (canCollapse(previous, event)) {
      result[result.length - 1] = event;
      continue;
    }
    result.push(event);
  }
  return result;
}

function canCollapse(previous: HookEvent, current: HookEvent): boolean {
  if (previous.hook_event_type !== current.hook_event_type) return false;
  if (previous.session_id !== current.session_id) return false;
  if ((previous.agent_id || '__main__') !== (current.agent_id || '__main__')) return false;
  if ((previous.payload?.tool_name || '') !== (current.payload?.tool_name || '')) return false;
  if (previous.hook_event_type === 'PreToolUse' && previous.payload?.tool_name === 'Agent') return false;

  const previousTimestamp = previous.timestamp || 0;
  const currentTimestamp = current.timestamp || 0;
  if (Math.abs(currentTimestamp - previousTimestamp) > 1500) return false;

  const previousSignature = searchableEventText(previous).slice(0, 120);
  const currentSignature = searchableEventText(current).slice(0, 120);
  return previousSignature === currentSignature;
}
