export function getAgentColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  PreToolUse:         { label: 'Tool',   color: 'var(--bg-elevated)' },
  PostToolUse:        { label: 'Done',   color: 'var(--green-dim)' },
  PostToolUseFailure: { label: 'Failed', color: 'var(--red-dim)' },
  UserPromptSubmit:   { label: 'Prompt', color: 'var(--blue-dim)' },
  AssistantResponse:  { label: 'Resp',   color: 'var(--purple-dim)' },
  SubagentStart:      { label: 'Spawn',  color: 'var(--yellow-dim)' },
  SubagentStop:       { label: 'Done',   color: 'var(--green-dim)' },
  SessionStart:       { label: 'Start',  color: 'var(--green-dim)' },
  SessionEnd:         { label: 'End',    color: 'var(--green-dim)' },
  SessionTitleChanged:{ label: 'Title',  color: 'var(--blue-dim)' },
};

const TYPE_TEXT_COLOR: Record<string, string> = {
  PreToolUse: 'var(--text-tertiary)',
  PostToolUse: 'var(--green)',
  PostToolUseFailure: 'var(--red)',
  UserPromptSubmit: 'var(--accent)',
  AssistantResponse: 'var(--purple)',
  SubagentStart: 'var(--yellow)',
  SubagentStop: 'var(--green)',
  SessionStart: 'var(--green)',
  SessionEnd: 'var(--green)',
  SessionTitleChanged: 'var(--accent)',
};

export function getEventTypeLabel(type: string): string {
  return TYPE_CONFIG[type]?.label || type;
}

export function getEventTypeBgColor(type: string): string {
  return TYPE_CONFIG[type]?.color || 'var(--bg-elevated)';
}

export function getEventTypeTextColor(type: string): string {
  return TYPE_TEXT_COLOR[type] || 'var(--text-tertiary)';
}
