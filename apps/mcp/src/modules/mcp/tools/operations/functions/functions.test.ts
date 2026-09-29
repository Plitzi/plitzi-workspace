import { describe, expect, it, vi } from 'vitest';

import { buildSpace } from '../../../tests/helpers';
import { apply } from '../../apply';
import { tryFunction } from '../../tryFunction';

import type { Space } from '../../../helpers';
import type { Persisters } from '../../../types';
import type { ToolContext } from '../../shared/tool';
import type { ActionRunReport, FunctionsSaveResult } from '@plitzi/sdk-shared';

const withFunctions = (files: Record<string, string> = { 'index.ts': 'export default {};' }): Space => ({
  ...buildSpace(),
  functions: { files, version: 'v1', manifest: { hosts: [], tasks: [], routes: [] }, offer: null }
});

const saving = (answer: FunctionsSaveResult) => {
  const saveFunctions = vi.fn<NonNullable<Persisters['saveFunctions']>>(() => Promise.resolve(answer));
  const schema = vi.fn(() => Promise.resolve());
  const persisters: Persisters = { saveFunctions, schema };

  return { persisters, saveFunctions, schema };
};

const SAVED: FunctionsSaveResult = { ok: true, version: 'v2', manifest: { hosts: [], tasks: [], routes: [] } };

describe('function file ops', () => {
  it('save the files whole, against the version the batch read', async () => {
    const { persisters, saveFunctions } = saving(SAVED);
    const result = await apply(
      {
        operations: [
          { type: 'upsertFunctionFile', path: 'lib/feed.ts', content: 'export const x = 1;' },
          { type: 'deleteFunctionFile', path: 'old.ts' }
        ]
      },
      withFunctions({ 'index.ts': 'export default {};', 'old.ts': '' }),
      persisters
    );

    expect(result).toMatchObject({ applied: true, persisted: true, summary: { created: 1, deleted: 1 } });
    expect(saveFunctions).toHaveBeenCalledWith(
      { 'index.ts': 'export default {};', 'lib/feed.ts': 'export const x = 1;' },
      'v1'
    );
  });

  it('refuse the whole batch where the files are wrong, before anything else is saved', async () => {
    const { persisters, schema } = saving({
      ok: false,
      problems: [{ file: 'index.ts', line: 3, message: '"node:fs" cannot be imported' }]
    });
    const result = await apply(
      {
        operations: [
          { type: 'upsertFunctionFile', path: 'index.ts', content: 'import fs from "node:fs";' },
          { type: 'patchSettings', customCss: 'body { color: red; }' }
        ]
      },
      withFunctions(),
      persisters
    );

    expect(result).toMatchObject({
      applied: false,
      persisted: false,
      errors: [{ path: 'functions/index.ts:3', message: '"node:fs" cannot be imported' }]
    });
    expect(schema).not.toHaveBeenCalled();
  });

  it('say so on a deployment that runs no functions', async () => {
    const result = await apply(
      { operations: [{ type: 'upsertFunctionFile', path: 'index.ts', content: '' }] },
      buildSpace(),
      saving(SAVED).persisters
    );

    expect(result.errors?.[0]?.message).toBe('This deployment runs no space functions');
  });
});

describe('plitzi_try_function', () => {
  const report: ActionRunReport = {
    runId: 'r',
    status: 'completed',
    output: { value: { ok: true } },
    trace: [],
    steps: [
      {
        id: 'task',
        title: 't',
        action: 'feed.read',
        status: 'success',
        phase: 'flow',
        startTime: 10,
        endTime: 14,
        logs: ['hi']
      }
    ]
  };
  const ctx = (tryIt?: ToolContext['tryFunction']): ToolContext => ({
    space: buildSpace(),
    env: 'main',
    persisters: {},
    ...(tryIt ? { tryFunction: tryIt } : {})
  });

  it('answers the value, the logs and the time', async () => {
    const tryIt = vi.fn(() => Promise.resolve(report));

    expect(await tryFunction({ task: 'feed.read', params: { n: 1 } }, ctx(tryIt))).toEqual({
      ran: true,
      status: 'completed',
      value: { ok: true },
      logs: ['hi'],
      ms: 4
    });
    expect(tryIt).toHaveBeenCalledWith('feed.read', { n: 1 });
  });

  it('runs nothing in plan mode', async () => {
    const tryIt = vi.fn(() => Promise.resolve(report));

    expect(await tryFunction({ task: 'feed.read', dryRun: true }, ctx(tryIt))).toMatchObject({ ran: false });
    expect(tryIt).not.toHaveBeenCalled();
  });
});
