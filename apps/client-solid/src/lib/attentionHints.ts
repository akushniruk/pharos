/** Parse daemon detail like "No progress … after Using ApplyPatch" for log row targeting. */
export function extractToolNameFromAttentionDetail(detail: string): string | null {
  const using = detail.match(/\busing\s+([A-Za-z][\w-]*)\b/i);
  if (using) return using[1];
  if (/\bapplypatch\b/i.test(detail)) return 'ApplyPatch';
  return null;
}

/** Action hints for attention/blocked banners — driven by daemon status text, not hidden client state. */
export function buildAttentionSuggestions(
  detail: string,
  tone: 'attention' | 'blocked',
): string[] {
  const d = detail.toLowerCase();
  const lines: string[] = [];

  if (tone === 'blocked') {
    lines.push(
      'Open your AI client and answer any pending prompt, permission, or multiple-choice question.',
    );
  }

  if (d.includes('applypatch') || d.includes('apply_patch') || d.includes('patch')) {
    lines.push(
      'In your editor, confirm the patch landed (no conflict markers) and save if the tool expects it.',
    );
  }

  if (
    d.includes('no progress')
    || d.includes('stalled')
    || d.includes('quiet')
    || /\bafter\b/.test(d)
  ) {
    lines.push(
      'Focus that session in your AI tool: check it is still running, or send a short nudge to resume.',
    );
  }

  if (d.includes('failure') || d.includes('error') || d.includes('failed')) {
    lines.push(
      'Scroll to the latest tool or assistant rows below, read the error payload, fix the cause, then retry.',
    );
  }

  const fallbacks = [
    'Use “Show log” to select this session, then read upward from the bottom of the timeline.',
    'The newest relevant log row for this issue is highlighted on the left; click “Solved” to clear the banner and highlight until the daemon reports new activity or a different status.',
  ];

  for (const line of fallbacks) {
    if (!lines.includes(line)) lines.push(line);
  }

  return lines.slice(0, 5);
}
