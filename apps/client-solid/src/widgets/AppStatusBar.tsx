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
  const dotColor = () => {
    if (connectionState() === 'connected') return 'var(--accent)';
    if (connectionState() === 'connecting') return 'var(--yellow)';
    return 'var(--red)';
  };
  const dotGlow = () => {
    if (connectionState() === 'connected')
      return '0 0 6px color-mix(in srgb, var(--accent) 55%, transparent)';
    return 'none';
  };
  const dotAnim = () =>
    connectionState() !== 'connected' ? 'blink 1.5s ease-in-out infinite' : 'none';

  return (
    <div class="app-statusbar">
      <div class="flex items-center gap-1.5">
        <span
          class="inline-block h-[5px] w-[5px] rounded-full"
          style={{
            background: dotColor(),
            'box-shadow': dotGlow(),
            animation: dotAnim(),
          }}
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
