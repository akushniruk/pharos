import { describe, expect, it } from 'vitest';

import {
  applyStreamMessage,
  memoryBrainActionEvents,
  memoryBrainStatus,
  resolveApiHost,
  setMemoryBrainActionEvents,
  setMemoryBrainStatus,
} from './ws';

describe('resolveApiHost', () => {
  it('falls back to loopback for packaged tauri hosts', () => {
    expect(resolveApiHost('tauri.localhost')).toBe('127.0.0.1');
    expect(resolveApiHost('asset.localhost')).toBe('127.0.0.1');
  });

  it('keeps browser hosts for normal web development', () => {
    expect(resolveApiHost('localhost')).toBe('localhost');
    expect(resolveApiHost('192.168.1.10')).toBe('192.168.1.10');
  });

  it('defaults to loopback when no hostname is available', () => {
    expect(resolveApiHost(undefined)).toBe('127.0.0.1');
    expect(resolveApiHost('')).toBe('127.0.0.1');
  });

  it('normalizes ipv6 localhost addresses to ipv4 loopback', () => {
    expect(resolveApiHost('::1')).toBe('127.0.0.1');
    expect(resolveApiHost('[::1]')).toBe('127.0.0.1');
  });
});

describe('memory brain stream messages', () => {
  it('stores integration status payloads', () => {
    setMemoryBrainStatus(null);
    applyStreamMessage({
      type: 'memory_brain_status',
      data: {
        state: 'healthy',
        connectivity: 'online',
        status_source: 'health_endpoint',
        helper: { enabled: true, model: 'gemma4:e2b' },
        sinks: { jsonl: 'ok', vault: 'ok', postgres: 'ok', neo4j: 'ok' },
        activity: { recent_writes_count: 3 },
        observed_mcp_activity: true,
        updated_at: 1711234567000,
      },
    });

    expect(memoryBrainStatus()?.state).toBe('healthy');
    expect(memoryBrainStatus()?.helper.model).toBe('gemma4:e2b');
  });

  it('appends memory brain action events', () => {
    setMemoryBrainActionEvents([]);
    applyStreamMessage({
      type: 'memory_brain_action',
      data: { action: 'repair_graph', ok: true, at: 1711234567000 },
    });

    expect(memoryBrainActionEvents()).toHaveLength(1);
    expect(memoryBrainActionEvents()[0].action).toBe('repair_graph');
    expect(memoryBrainActionEvents()[0].ok).toBe(true);
  });

  it('does not append repair_graph failures when integration is disabled', () => {
    setMemoryBrainActionEvents([]);
    applyStreamMessage({
      type: 'memory_brain_action',
      data: {
        action: 'repair_graph',
        ok: false,
        error: 'memory-brain integration disabled',
      },
    });
    expect(memoryBrainActionEvents()).toHaveLength(0);
  });

  it('prunes repair_graph disabled failures when status reports disabled', () => {
    setMemoryBrainActionEvents([
      {
        action: 'repair_graph',
        ok: false,
        error: 'memory-brain integration disabled',
      },
    ]);
    applyStreamMessage({
      type: 'memory_brain_status',
      data: {
        state: 'disabled',
        connectivity: 'offline',
        status_source: 'config',
        helper: { enabled: false, model: 'n/a' },
        sinks: { jsonl: 'unknown', vault: 'unknown', postgres: 'unknown', neo4j: 'unknown' },
        activity: { recent_writes_count: 0 },
        observed_mcp_activity: false,
        updated_at: 1711234567000,
      },
    });
    expect(memoryBrainActionEvents()).toHaveLength(0);
  });
});
