/** Parse daemon detail like "No progress … after Using ApplyPatch" for log row targeting. */
export function extractToolNameFromAttentionDetail(detail: string): string | null {
  const target = extractAttentionTargetFromDetail(detail);
  return target.toolName;
}

export interface AttentionTargetHint {
  toolName: string | null;
  mcpServer: string | null;
  mcpTool: string | null;
}

/** Parse daemon detail for tool, MCP server, and MCP tool hints. */
export function extractAttentionTargetFromDetail(detail: string): AttentionTargetHint {
  const mcp = detail.match(/\bMCP\s+([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/i);
  if (mcp) {
    return {
      toolName: 'CallMcpTool',
      mcpServer: mcp[1],
      mcpTool: mcp[2],
    };
  }

  const memory = detail.match(/\bMemory brain:\s+([A-Za-z0-9 _-]+)/i);
  if (memory) {
    return {
      toolName: 'CallMcpTool',
      mcpServer: 'ai-memory-brain',
      mcpTool: `memory_${memory[1].trim().replace(/\s+/g, '_').toLowerCase()}`,
    };
  }

  const using = detail.match(/\busing\s+([A-Za-z][\w-]*)\b/i);
  if (using) {
    return {
      toolName: using[1],
      mcpServer: null,
      mcpTool: null,
    };
  }
  if (/\bapplypatch\b/i.test(detail)) {
    return {
      toolName: 'ApplyPatch',
      mcpServer: null,
      mcpTool: null,
    };
  }
  return {
    toolName: null,
    mcpServer: null,
    mcpTool: null,
  };
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

  const heuristicStallAttention =
    tone === 'attention'
    && (d.includes('no progress for ') || d.includes('stalled after '));

  if (!heuristicStallAttention && (d.includes('stalled') || d.includes('quiet'))) {
    lines.push(
      'Check whether the session is still running in your AI client, or needs a prompt to continue.',
    );
  }

  if (d.includes('failure') || d.includes('error') || d.includes('failed')) {
    lines.push(
      'Scroll to the latest tool or assistant rows below, read the error payload, fix the cause, then retry.',
    );
  }

  if (d.includes('mcp') || d.includes('memory brain') || d.includes('callmcptool')) {
    lines.push(
      'Open the highlighted MCP tool row and verify server, tool name, and arguments match your intended memory operation.',
    );
  }

  if (lines.length === 0) {
    lines.push('Use “Show log” or “Solved” if nothing here needs action.');
  }

  return lines.slice(0, 4);
}
