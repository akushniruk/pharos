import { describe, expect, it } from 'vitest';
import {
  buildAttentionSuggestions,
  extractToolNameFromAttentionDetail,
} from './attentionHints';

describe('extractToolNameFromAttentionDetail', () => {
  it('reads tool after “Using”', () => {
    expect(
      extractToolNameFromAttentionDetail('No progress for 1d after Using ApplyPatch'),
    ).toBe('ApplyPatch');
  });
});

describe('buildAttentionSuggestions', () => {
  it('includes blocked guidance for blocked tone', () => {
    const lines = buildAttentionSuggestions('Waiting', 'blocked');
    expect(lines.some((l) => l.toLowerCase().includes('pending'))).toBe(true);
  });

  it('matches patch-related detail', () => {
    const lines = buildAttentionSuggestions('No progress after Using ApplyPatch', 'attention');
    expect(lines.some((l) => l.toLowerCase().includes('patch'))).toBe(true);
  });
});
