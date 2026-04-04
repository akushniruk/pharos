import { describe, expect, it } from 'vitest';

import { describeEvent, describeEventDetail, formatRuntimeLabel } from './describe';
import type { HookEvent } from './types';

describe('describeEvent', () => {
  it('describes command execution in plain language and keeps the command as detail', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: {
        tool_name: 'exec_command',
        tool_input: {
          cmd: 'pnpm build',
          workdir: '/Users/akushniruk/home_projects/pharos/apps/client-solid',
        },
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Running a command in client-solid');
    expect(describeEventDetail(event)).toBe('pnpm build');
  });

  it('adds runtime context to command execution details when available', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: {
        runtime_label: 'claude',
        tool_name: 'exec_command',
        tool_input: {
          cmd: 'pnpm build',
          workdir: '/Users/akushniruk/home_projects/pharos/apps/client-solid',
        },
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Running a command in client-solid');
    expect(describeEventDetail(event)).toBe('Claude runtime · pnpm build');
  });

  it('describes file edits in plain language and keeps the file path as detail', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: {
        tool_name: 'Edit',
        tool_input: {
          file_path: '/Users/akushniruk/home_projects/pharos/apps/client-solid/src/lib/store.ts',
        },
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Editing a file');
    expect(describeEventDetail(event)).toBe('src/lib/store.ts');
  });

  it('describes assistant responses in plain language and keeps the response text as detail', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'AssistantResponse',
      payload: {
        text: 'Updated the sidebar so the summary line now leads with plain language.',
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Shared an update');
    expect(describeEventDetail(event)).toBe('Updated the sidebar so the summary line now leads with plain language.');
  });

  it('adds runtime context to assistant responses when available', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'AssistantResponse',
      payload: {
        runtime_label: 'gemini',
        text: 'Updated the sidebar so the summary line now leads with plain language.',
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Shared an update');
    expect(describeEventDetail(event)).toBe(
      'Gemini runtime · Updated the sidebar so the summary line now leads with plain language.',
    );
  });

  it('formats cursor runtime labels consistently', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'AssistantResponse',
      payload: {
        runtime_label: 'cursor_agent',
        text: 'Streaming transcript updates',
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Shared an update');
    expect(describeEventDetail(event)).toBe('Cursor runtime · Streaming transcript updates');
  });

  it('normalizes cursor runtime aliases to a single display label', () => {
    expect(formatRuntimeLabel('cursor')).toBe('Cursor');
    expect(formatRuntimeLabel('Cursor Agent')).toBe('Cursor');
    expect(formatRuntimeLabel('cursor-runtime')).toBe('Cursor');
    expect(formatRuntimeLabel('cursor_agent')).toBe('Cursor');
  });

  it('describes delegated work as a next action for non-technical readers', () => {
    const event: HookEvent = {
      source_app: 'demo',
      session_id: 'session-1',
      hook_event_type: 'PreToolUse',
      payload: {
        tool_name: 'Agent',
        tool_input: {
          description: 'Verify the build output and report any regressions.',
        },
      },
      timestamp: 1,
    };

    expect(describeEvent(event)).toBe('Handing off work to another agent');
    expect(describeEventDetail(event)).toBe('Verify the build output and report any regressions.');
  });
});
