import { describe, expect, it } from 'vitest';

import { createScheduleRunner } from './schedule';
import { createActionsModule } from '../index';

import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const scheduled = (cron: string, enabled = true): ActionEntry => ({
  id: 'digest',
  document: {
    name: 'Digest',
    enabled,
    access: { mode: 'public' },
    triggers: [{ type: 'schedule', cron }],
    input: {},
    nodes: {
      start: node('start', { type: 'trigger', action: 'schedule', afterNode: 'out' }),
      out: node('out', { action: 'flow.output', params: { values: '{"ok": true}' } })
    }
  }
});

const runnerFor = (entries: ActionEntry[]) => {
  const lookups = { getAction: () => Promise.resolve(undefined), listActions: () => Promise.resolve(entries) };
  const module = createActionsModule({ lookups });

  return createScheduleRunner(lookups, module);
};

const at = (iso: string) => new Date(iso);

describe('createScheduleRunner', () => {
  it('runs what this minute asks for, and nothing else', async () => {
    const runner = runnerFor([scheduled('30 10 * * *')]);

    const due = await runner.tick({ spaceId: 1, at: at('2026-08-20T10:30:00Z') });
    expect(due.ran.map(entry => entry.actionId)).toEqual(['digest']);

    const quiet = await runner.tick({ spaceId: 1, at: at('2026-08-20T10:31:00Z') });
    expect(quiet.ran).toEqual([]);
  });

  it('leaves a disabled action alone', async () => {
    const runner = runnerFor([scheduled('* * * * *', false)]);

    expect((await runner.tick({ spaceId: 1, at: at('2026-08-20T10:30:00Z') })).ran).toEqual([]);
  });

  // Two replicas racing the same minute, or a leader lock handed over mid-tick: the minute is the key, so one run
  // happens between them rather than one each.
  it('runs one run for a minute however many times it is ticked', async () => {
    const lookups = {
      getAction: () => Promise.resolve(undefined),
      listActions: () => Promise.resolve([scheduled('* * * * *')])
    };
    const module = createActionsModule({ lookups });
    const runner = createScheduleRunner(lookups, module);
    const minute = at('2026-08-20T10:30:00Z');

    const [first, second] = await Promise.all([
      runner.tick({ spaceId: 1, at: minute }),
      runner.tick({ spaceId: 1, at: minute })
    ]);

    const runs = first.ran.length + second.ran.length;
    const duplicates = [...first.skipped, ...second.skipped].filter(entry => entry.reason === 'duplicate');
    expect(runs).toBe(1);
    expect(duplicates).toHaveLength(1);
  });
});
