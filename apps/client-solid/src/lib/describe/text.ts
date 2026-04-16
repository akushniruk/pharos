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

function tryParseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function firstNonEmptyString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

/** Resolves Cursor `CallMcpTool` input: camelCase vs snake_case keys and nested `arguments` (object or JSON string). */
export function extractMcpToolCall(toolInput: Record<string, unknown>): {
  server?: string;
  toolName?: string;
} {
  let server = firstNonEmptyString(toolInput, [
    'server',
    'mcp_server',
    'mcpServer',
    'mcp_server_id',
  ]);
  let toolName = firstNonEmptyString(toolInput, [
    'toolName',
    'tool_name',
    'name',
    'tool',
    'toolId',
    'tool_id',
  ]);

  const nested = tryParseJsonObject(toolInput.arguments);
  if (nested) {
    if (!server) {
      server = firstNonEmptyString(nested, ['server', 'mcp_server', 'mcpServer', 'mcp_server_id']);
    }
    if (!toolName) {
      toolName = firstNonEmptyString(nested, ['toolName', 'tool_name', 'name', 'tool', 'toolId', 'tool_id']);
    }
  }

  return {
    server: server || undefined,
    toolName: toolName || undefined,
  };
}

export function describeMemoryOperation(toolName?: string): string | null {
  if (!toolName) return null;
  const normalized = toolName.trim().toLowerCase();
  const map: Record<string, string> = {
    memory_project_context: 'Read project context',
    memory_store_summary: 'Store summary',
    memory_add: 'Store entry',
    memory_search: 'Search memory',
    memory_recent: 'Read recent memory',
    memory_today_summary: 'Read today summary',
    memory_daily_summary: 'Read daily summary',
    memory_brain_health: 'Check brain health',
    memory_graph_overview: 'Read graph overview',
  };
  return map[normalized] || null;
}
