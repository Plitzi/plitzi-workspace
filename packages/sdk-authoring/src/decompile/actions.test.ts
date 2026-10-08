import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { actionSpecFromEntry, actionToSource } from './actions';
import { defineAction } from '../schema';

import type { ActionSpec } from '../schema';
import type { ActionEntry } from '@plitzi/sdk-shared';

const quote: ActionSpec = {
  id: 'quote',
  name: 'Quote',
  trigger: { type: 'call', access: 'public', input: { city: { type: 'text', required: true } } },
  steps: [{ id: 'rate', task: 'example.rate' }]
};

/** Every way in and every field a declaration has, at once. */
const everything: ActionSpec = {
  id: 'board-sync',
  name: 'Sync a board',
  description: 'Keeps a board in step with its copy elsewhere.',
  trigger: [
    {
      type: 'call',
      access: { mode: 'role', permissions: ['boardEdit', 'boardShare'] },
      input: { board: { type: 'text', required: true, label: 'Board' } }
    },
    {
      type: 'webhook',
      access: 'public',
      input: { board: { type: 'text', required: true, label: 'Board' } },
      verify: { credential: 'hook', header: 'x-hub', algorithm: 'sha1', timestampHeader: 'x-at', toleranceSeconds: 300 }
    },
    { id: 'nightly', type: 'schedule', cron: '0 3 * * *', timezone: 'Europe/Madrid', enabled: false },
    { type: 'render', access: 'session', cacheSeconds: 60 },
    { type: 'custom', access: 'public', name: 'mqtt' },
    { id: 'timeout', type: 'later', input: { board: { type: 'text', required: true, label: 'Board' } } }
  ],
  steps: [
    { id: 'board', task: 'kv.get', params: { key: 'board:{{ input.board }}' } },
    { id: 'sent', task: 'http.request', params: { url: 'https://example.com' }, credential: 'remote' },
    {
      id: 'noted',
      task: 'kv.set',
      params: { key: 'synced', value: '{{ sent.status }}' },
      when: { combinator: 'and', rules: [{ field: 'sent.status', operator: '=', value: '200' }] },
      enabled: false
    }
  ],
  onFailure: [{ id: 'undone', task: 'kv.delete', params: { key: 'board:{{ input.board }}' } }],
  output: '{ "board": {{ board }} }',
  limits: { timeoutMs: 2000 }
};

const read = (entry: ActionEntry): ActionSpec => {
  const reading = actionSpecFromEntry(entry);
  if (!reading.ok) {
    throw new Error(reading.reason);
  }

  return reading.spec;
};

describe('reading an action back into its declaration', () => {
  it('gives back the declaration that wrote it, with what defineAction fills in left out', () => {
    expect(read(defineAction(quote))).toEqual(quote);
  });

  it('reads every way in and every field a declaration has', () => {
    expect(read(defineAction(everything))).toEqual(everything);
  });

  it('reads an input the builder spaced out, and ignores the output it derives on save', () => {
    const entry = defineAction(quote);
    const start = entry.document.nodes.start;
    const builder: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        output: { total: { type: 'number' } },
        nodes: {
          ...entry.document.nodes,
          start: {
            ...start,
            params: { ...start.params, input: JSON.stringify({ city: { type: 'text', required: true } }, null, 2) }
          }
        }
      }
    };

    expect(read(builder)).toEqual(quote);
  });

  it('says why a flow the builder wrote has no code form, and never approximates one', () => {
    const entry = defineAction(quote);
    const titled: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: { ...entry.document.nodes, rate: { ...entry.document.nodes.rate, title: 'Look the rate up' } }
      }
    };
    const branched: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: { ...entry.document.nodes, stray: { ...entry.document.nodes.rate, id: 'stray', beforeNode: 'start' } }
      }
    };

    expect(actionSpecFromEntry(titled)).toEqual({
      ok: false,
      reason: 'the step "rate" is titled "Look the rate up", and code titles a step by its task'
    });
    expect(actionSpecFromEntry(branched)).toEqual({
      ok: false,
      reason: 'written as code it would not be the same document'
    });
  });
});

describe('an action written out as code', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), 'action-source-'));

  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('is a module whose export authors the same document', async () => {
    const { exportName, source } = actionToSource(read(defineAction(everything)), {
      packageName: join(here, '..', 'index.ts')
    });
    writeFileSync(join(scratch, 'board-sync.ts'), source);

    const module = (await import(join(scratch, 'board-sync.ts'))) as Record<string, unknown>;

    expect(exportName).toBe('boardSyncAction');
    expect(module[exportName]).toEqual(defineAction(everything));
  });
});
