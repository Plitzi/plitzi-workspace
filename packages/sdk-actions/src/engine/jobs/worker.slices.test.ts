import { describe, expect, it } from 'vitest';

import { settle, world } from './tests/jobWorld';

import type { FunctionJobsService } from '../../functions/jobs';

/**
 * A job of the functions asking for a size its plan no longer includes was failed for good, what it had saved with it:
 * a plan raised again could not resume it. Set aside, it waits for its owner to change the size or the plan.
 */
describe('a slice its plan refuses before it starts', () => {
  it('sets its job aside, its attempt given back, saying why and what to do', async () => {
    const test = world(() => ({ ok: true }));
    const why = 'This task asks to be medium (128 MB of memory), and its space’s plan allows up to small (32 MB)';
    const functionJobs: FunctionJobsService = {
      forRun: () => {
        throw new Error('not asked here');
      },
      slice: () => Promise.resolve({ kind: 'setAside', why }),
      announce: () => Promise.resolve()
    };
    await test.job({ id: 'train', target: { kind: 'function', name: 'train' } });

    expect(await test.worker({ functionJobs }).poll()).toBe(1);
    await settle();

    expect(await test.read('train')).toMatchObject({
      status: 'paused',
      attempts: 0,
      error: expect.stringContaining(`Set aside at once: it reached a limit its plan sets`) as string
    });
    expect((await test.read('train')).error).toContain(why);
  });
});
