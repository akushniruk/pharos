/** Format ms timestamp to relative time like "2m ago", "just now" */
export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Format ms timestamp to HH:MM:SS */
export function formatTime(ms: number): string {
  if (!ms) return '--:--:--';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
