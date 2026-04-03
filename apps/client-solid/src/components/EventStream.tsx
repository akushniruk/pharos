import { For, Show, createSignal, createMemo, createEffect } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { bars_3BottomLeft, queueList, signal, pauseCircle, funnel } from 'solid-heroicons/solid';
import {
  filteredEvents,
  selectedProjectFocusSnapshot,
  selectedProjectSnapshot,
  selectAgent,
  selectSession,
} from '../lib/store';
import { getEventTypeLabel, getEventTypeBgColor, getEventTypeTextColor } from '../lib/colors';
import SearchBar, { searchQuery } from './SearchBar';
import EventRow from './EventRow';
import { connectionState, hasStreamData } from '../lib/ws';

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
  const focus = createMemo(() => selectedProjectFocusSnapshot());
  const project = createMemo(() => selectedProjectSnapshot());

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

  const tabStyle = (active: boolean) => [
    'font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
    'transition:background 0.15s,color 0.15s;',
    active
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:transparent;color:var(--text-dim);',
  ].join('');

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
    let evts = filteredEvents().filter(e => !hidden.has(e.hook_event_type));

    if (query) {
      try {
        const re = new RegExp(query, 'i');
        evts = evts.filter(e =>
          re.test(e.hook_event_type) ||
          re.test(e.source_app) ||
          re.test(e.display_name || '') ||
          re.test(e.agent_name || '') ||
          re.test(e.payload?.tool_name || '') ||
          re.test(JSON.stringify(e.payload))
        );
      } catch { /* invalid regex */ }
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

  return (
    <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
      {/* Toolbar */}
      <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <button style={tabStyle(!detailed())} onClick={switchToSimple}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={queueList} style="width:12px;height:12px;" /> Simple
          </span>
        </button>
        <button style={tabStyle(detailed())} onClick={switchToDetailed}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={bars_3BottomLeft} style="width:12px;height:12px;" /> Detailed
          </span>
        </button>

        <SearchBar />

        <button
          style={tabStyle(showFilters())}
          onClick={() => setShowFilters(f => !f)}
          title="Toggle event type filters"
        >
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={funnel} style="width:12px;height:12px;" /> Filter
          </span>
        </button>

        <button
          onClick={() => setStick(s => !s)}
          title={stick() ? 'Pause auto-scroll' : 'Resume auto-scroll'}
          style={[
            'margin-left:auto;font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
            'transition:background 0.15s,color 0.15s;',
            stick()
              ? 'background:var(--bg-elevated);color:var(--accent);'
              : 'background:transparent;color:var(--text-dim);',
          ].join('')}
        >
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={stick() ? signal : pauseCircle} style="width:12px;height:12px;" />
            {stick() ? 'Live' : 'Paused'}
          </span>
        </button>
      </div>

      <Show when={focus()}>
        {(currentFocus) => (
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
            <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);padding-right:4px;">
              Current focus
            </span>
            <span style="font-size:10px;color:var(--text-dim);padding-right:6px;">
              {currentFocus().scopeLabel}
            </span>
            <button
              onClick={() => {
                if (currentFocus().sessionId) {
                  selectSession(currentFocus().sessionId);
                }
              }}
              style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;"
            >
              Session {currentFocus().sessionLabel ?? 'n/a'}
            </button>
            <Show when={currentFocus().agentId}>
              <button
                onClick={() => {
                  if (currentFocus().agentId) {
                    selectAgent(currentFocus().agentId);
                  }
                }}
                style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;"
              >
                Agent {currentFocus().agentLabel ?? 'n/a'}
              </button>
            </Show>
            <span style="font-size:10px;color:var(--text-primary);">
              Now: {currentFocus().headline}
            </span>
            <span style="font-size:10px;color:var(--text-dim);">
              Context: {currentFocus().subheadline}
            </span>
            <button
              onClick={() => selectSession(null)}
              style="font-size:10px;padding:4px 8px;border-radius:9999px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-dim);cursor:pointer;margin-left:auto;"
            >
              Show all events
            </button>
          </div>
        )}
      </Show>

      {/* Filter chips */}
      <Show when={showFilters()}>
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
          <For each={EVENT_TYPES}>
            {(type) => {
              const count = () => typeCounts().get(type) || 0;
              const hidden = () => hiddenTypes().has(type);
              return (
                <button
                  onClick={() => toggleType(type)}
                  style={[
                    'font-size:10px;font-weight:500;padding:3px 8px;border-radius:4px;cursor:pointer;border:none;',
                    'transition:opacity 0.15s;display:flex;align-items:center;gap:4px;',
                    hidden()
                      ? 'opacity:0.35;background:var(--bg-elevated);color:var(--text-dim);'
                      : `opacity:1;background:${getEventTypeBgColor(type)};color:${getEventTypeTextColor(type)};`,
                  ].join('')}
                >
                  {getEventTypeLabel(type)}
                  <span style="font-size:9px;opacity:0.7;">{count()}</span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Event list */}
      <div ref={containerRef} style="flex:1;overflow-y:auto;">
        <For each={displayEvents()}>
          {(e) => <EventRow event={e} detailed={detailed()} />}
        </For>
        <Show when={displayEvents().length === 0}>
          <div style="display:flex;align-items:center;justify-content:center;padding:48px 24px;min-height:220px;">
            <div style="max-width:420px;padding:18px 20px;border:1px solid var(--border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);text-align:center;">
              <p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
                {emptyState()?.title}
              </p>
              <p style="font-size:12px;line-height:1.5;color:var(--text-dim);">
                {emptyState()?.body}
              </p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
