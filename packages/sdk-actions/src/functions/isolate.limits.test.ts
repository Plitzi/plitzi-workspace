import { describe, expect, it } from 'vitest';

import { sourceOf, spaceWith } from './tests/isolateSpace';

/**
 * What the engine decides of an invocation's limits before a runner is asked: what the space's plan allows. How a runner
 * holds them is `@plitzi/sdk-runtime`'s own suite (`runner/isolate.limits.test.ts`).
 */
describe('an invocation’s limits', () => {
  // A plan's memory is the largest size it includes: a task asking for more is told so before it runs, never run
  // quietly smaller.
  it('refuses a task a size its plan does not include, before it runs', async () => {
    const large = await spaceWith(sourceOf('return "ran";', { asks: { cpuMs: 1000, size: 'large' } }), {
      limits: { memoryMb: 128 }
    });

    const result = await large.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('asks to be large (256 MB of memory), and its space’s plan allows up to medium');
  });
});
