import { describe, expect, it } from 'vitest';

import { resolveApiHost } from './ws';

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
