import type { Accessor } from 'solid-js';
import { Icon } from 'solid-heroicons';
import { listBullet, share } from 'solid-heroicons/solid';

type ViewMode = 'logs' | 'graph';

interface ViewModeTabsProps {
  /** Accessor keeps tab chrome in sync with shell state (plain values can desync in edge cases). */
  viewMode: Accessor<ViewMode>;
  onChange: (mode: ViewMode) => void;
}

export default function ViewModeTabs(props: ViewModeTabsProps) {
  return (
    <div class="pill-tabs event-stream-view-tabs">
      <button
        class="pill-tab event-stream-tab"
        classList={{ 'is-active': props.viewMode() === 'logs' }}
        type="button"
        onClick={() => props.onChange('logs')}
        aria-label="Switch to logs view"
      >
        <span class="event-stream-tab-content">
          <Icon path={listBullet} class="event-stream-tab-icon" /> Logs
        </span>
      </button>
      <button
        class="pill-tab event-stream-tab"
        classList={{ 'is-active': props.viewMode() === 'graph' }}
        type="button"
        onClick={() => props.onChange('graph')}
        aria-label="Switch to graph view"
      >
        <span class="event-stream-tab-content">
          <Icon path={share} class="event-stream-tab-icon" /> Graph
        </span>
      </button>
    </div>
  );
}
