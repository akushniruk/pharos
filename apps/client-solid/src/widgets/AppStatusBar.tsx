import {
  filteredEvents,
  selectedProject,
  selectedViewedChangesSnapshot,
} from '../lib/store';
import { connectionState, hasStreamData } from '../lib/ws';

function streamStatusLabel(): string {
  if (connectionState() === 'connecting') {
    return hasStreamData() ? 'Reconnecting' : 'Loading live data';
  }

  if (connectionState() === 'connected') {
    return hasStreamData() ? 'Connected' : 'Connected, waiting for first payload';
  }

  return hasStreamData()
    ? 'Disconnected, showing last data'
    : 'Disconnected before any data arrived';
}

export default function AppStatusBar() {
  return (
    <div class="app-statusbar">
      <div style="display:flex;align-items:center;gap:6px">
        <span
          style={[
            'width:6px;height:6px;border-radius:50%;display:inline-block;',
            connectionState() === 'connected'
              ? 'background:var(--green);'
              : connectionState() === 'connecting'
                ? 'background:var(--yellow);animation:blink 1.5s ease-in-out infinite;'
                : 'background:var(--red);animation:blink 1.5s ease-in-out infinite;',
          ].join('')}
        />
        <span>{streamStatusLabel()}</span>
      </div>
      <span>
        {filteredEvents().length} events
        {selectedProject() ? ` · ${selectedProject()}` : ''}
        {selectedViewedChangesSnapshot()?.hasUnreadChanges
          ? ` · ${selectedViewedChangesSnapshot()?.unreadCount} new`
          : ''}
      </span>
    </div>
  );
}
