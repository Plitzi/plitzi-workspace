import { describe, expect, it, vi } from 'vitest';

import { defineFunctions } from '../../functions/contract';
import { createActionsModule } from '../index';
import { DEFAULT_LIMITS, resolveLimits } from './limits';
import { buildEntry, callTrigger, lookups, node, request } from './tests/runAction';

import type { FunctionTask } from '../../functions/contract';

describe('resolveLimits', () => {
  it('gives a space what its plan sells, up to the deployment’s ceiling and never past it', () => {
    const deployment = { maxRequests: 200, timeoutMs: 30_000 };

    expect(resolveLimits(deployment, {}, { maxRequests: 150 }).maxRequests).toBe(150);
    expect(resolveLimits(deployment, {}, { maxRequests: 500 }).maxRequests).toBe(200);
    // Unset by the plan, the deployment's.
    expect(resolveLimits(deployment, {}, {}).timeoutMs).toBe(30_000);
  });
  it('lets a document tighten what the plan gave, never widen it', () => {
    const deployment = { maxRequests: 200 };

    expect(resolveLimits(deployment, { maxRequests: 10 }, { maxRequests: 150 }).maxRequests).toBe(10);
    expect(resolveLimits(deployment, { maxRequests: 180 }, { maxRequests: 150 }).maxRequests).toBe(150);
  });
  it('reads a plan’s 0 as no word, like a document’s', () => {
    expect(resolveLimits({}, {}, { maxNodes: 0 }).maxNodes).toBe(DEFAULT_LIMITS.maxNodes);
  });
});

describe('a space’s plan', () => {
  /** A task that reads three hosts, and says how many it could. */
  const sweep: FunctionTask<Record<string, never>> = {
    namespace: 'test',
    action: 'sweep',
    title: 'Sweep',
    params: {},
    run: async (_params, context) => {
      const read = await Promise.all(
        ['a', 'b', 'c'].map(source =>
          context.fetch(`https://${source}.example/feed`).then(
            () => true,
            () => false
          )
        )
      );

      return { read: read.filter(Boolean).length };
    }
  };
  const entry = buildEntry({
    nodes: {
      start: callTrigger({}, 'sweep'),
      sweep: node('sweep', { action: 'test.sweep', afterNode: 'out' }),
      out: node('out', { action: 'flow.output', params: { values: '{"read": {{ sweep.read }}}' } })
    }
  });
  const moduleWith = (limitsFor: (spaceId: number) => Promise<{ maxRequests: number } | undefined>) =>
    createActionsModule({
      lookups,
      functions: {
        native: [defineFunctions({ allow: { hosts: ['a.example', 'b.example', 'c.example'] }, tasks: [sweep] })]
      },
      limits: { maxRequests: 3 },
      limitsFor,
      fetchImpl: () => Promise.resolve(new Response('ok'))
    });

  it('bounds each run of that space, and only that space', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { runAction } = moduleWith(spaceId => Promise.resolve(spaceId === 1 ? { maxRequests: 1 } : undefined));

    expect((await runAction(request(entry, { spaceId: 1 }))).output).toEqual({ read: 1 });
    expect((await runAction(request(entry, { spaceId: 2 }))).output).toEqual({ read: 3 });
    vi.restoreAllMocks();
  });
  it('is what the transports hold a run’s slot for', async () => {
    const actions = moduleWith(() => Promise.resolve({ maxRequests: 2 }));

    expect((await actions.limitsFor(1, entry.document)).maxRequests).toBe(2);
    expect((await actions.limitsFor(1, { ...entry.document, limits: { maxRequests: 1 } })).maxRequests).toBe(1);
  });
});
