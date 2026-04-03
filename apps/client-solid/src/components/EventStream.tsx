import { For, createSignal, createMemo, createEffect } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { bars_3BottomLeft, queueList, signal, pauseCircle } from 'solid-heroicons/solid';
import { filteredEvents } from '../lib/store';
import SearchBar, { searchQuery } from './SearchBar';
import EventRow from './EventRow';

export default function EventStream() {
  const [detailed, setDetailed] = createSignal(false);
  const [stick, setStick] = createSignal(true);
  let containerRef: HTMLDivElement | undefined;

  const tabStyle = (active: boolean) => [
    'font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;border:none;',
    'transition:background 0.15s,color 0.15s;',
    active
      ? 'background:var(--bg-elevated);color:var(--text-primary);'
      : 'background:transparent;color:var(--text-dim);',
  ].join('');

  const displayEvents = createMemo(() => {
    const query = searchQuery();
    let evts = filteredEvents();
    if (!detailed()) {
      evts = evts.filter(
        (event) => !['SessionStart', 'SessionEnd', 'SessionTitleChanged'].includes(event.hook_event_type),
      );
    }
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
      } catch {
        // invalid regex — show all
      }
    }
    return evts.slice(-500).reverse();
  });

  createEffect(() => {
    displayEvents(); // track reactivity
    if (stick() && containerRef) {
      containerRef.scrollTop = 0;
    }
  });

  return (
    <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
      {/* Toolbar */}
      <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <button style={tabStyle(!detailed())} onClick={() => setDetailed(false)}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={queueList} style="width:12px;height:12px;" />
            Simple
          </span>
        </button>
        <button style={tabStyle(detailed())} onClick={() => setDetailed(true)}>
          <span style="display:flex;align-items:center;gap:6px;">
            <Icon path={bars_3BottomLeft} style="width:12px;height:12px;" />
            Detailed
          </span>
        </button>
        <SearchBar />
        <button
          onClick={() => setStick(s => !s)}
          title={stick() ? 'Unpin (auto-scroll off)' : 'Pin (auto-scroll on)'}
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

      {/* Event list */}
      <div
        ref={containerRef}
        style="flex:1;overflow-y:auto;"
      >
        <For each={displayEvents()}>
          {(e) => <EventRow event={e} detailed={detailed()} />}
        </For>
      </div>
    </div>
  );
}
