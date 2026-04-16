export function simpleEventKindLabel(type: string): string {
  switch (type) {
    case 'UserPromptSubmit':
      return 'You';
    case 'AssistantResponse':
      return 'Reply';
    case 'PreToolUse':
      return 'Doing';
    case 'PostToolUse':
      return 'Done';
    case 'PostToolUseFailure':
      return 'Failed';
    case 'SubagentStart':
      return 'Delegated';
    case 'SubagentStop':
      return 'Completed';
    default:
      return 'Update';
  }
}

/** Trust signal: observed vs managed acquisition; unknown or absent values yield no label */
export function formatAcquisitionModeLabel(mode?: string | null): string | undefined {
  if (typeof mode !== 'string') return undefined;
  const normalized = mode
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;

  const first = normalized.split(' ')[0];
  if (!first || first === 'unknown') return undefined;

  if (first === 'observed') return 'Observed';
  if (first === 'managed') return 'Managed';

  return undefined;
}

export function formatRuntimeLabel(label?: string | null): string | undefined {
  if (typeof label !== 'string') return undefined;
  const normalized = label.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!normalized) return undefined;

  if (normalized.includes('claude')) return 'Claude';
  if (normalized.includes('codex')) return 'Codex';
  if (normalized.includes('gemini')) return 'Gemini';
  if (normalized.includes('cursor')) return 'Cursor';
  if (normalized.includes('gemma')) return 'Gemma';
  if (normalized.includes('ollama')) return 'Ollama';

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
