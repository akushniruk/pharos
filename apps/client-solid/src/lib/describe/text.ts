export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function extractCommand(toolInput: Record<string, unknown>): string | null {
  const candidate = toolInput?.cmd ?? toolInput?.command;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  if (Array.isArray(candidate)) {
    const parts = candidate
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  return null;
}

export function extractFileTarget(toolInput: Record<string, unknown>): string | null {
  const candidate = toolInput?.file_path ?? toolInput?.path ?? toolInput?.file;
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  return candidate.split('/').slice(-3).join('/');
}

export function extractPatchedFile(patch: string): string | null {
  const match = patch.match(/\*\*\* (?:Add|Update|Delete) File: (.+)/);
  if (!match) {
    return null;
  }
  return match[1].split('/').slice(-3).join('/');
}

export function extractContentPreview(content: unknown): string | null {
  if (typeof content !== 'string') {
    return null;
  }
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || null;
}

export function basename(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

export function composeRuntimeDetail(
  runtime: string | undefined,
  detail?: string | null,
): string | undefined {
  const trimmedDetail = detail?.trim();
  if (runtime && trimmedDetail) {
    return `${runtime} runtime · ${trimmedDetail}`;
  }
  if (runtime) {
    return `${runtime} runtime`;
  }
  return trimmedDetail || undefined;
}

export function friendlyToolName(toolName: string): string {
  const map: Record<string, string> = {
    readfile: 'file read',
    read: 'file read',
    edit: 'file edit',
    write: 'file write',
    shell: 'terminal command',
    exec_command: 'terminal command',
    grep: 'search',
    glob: 'file search',
    todowrite: 'plan update',
    agent: 'helper delegation',
    subagent: 'helper delegation',
  };
  const normalized = toolName.trim().toLowerCase();
  return map[normalized] || toolName;
}
