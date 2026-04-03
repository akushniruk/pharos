import { describe, expect, it } from 'vitest';

import { describeEvent, describeEventDetail } from './describe';
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
});
