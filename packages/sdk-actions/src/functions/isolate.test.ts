import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../engine/module';
import { ASKS_ENOUGH, runner, SIGNING_SECRET, sourceOf, spaceWith } from './tests/isolateSpace';
import { createSigning } from '../engine/runtime/signing';

describe('preparing a space’s functions', () => {
  const module = createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner }
  });

  it('builds, reads and keeps what the bundle declared', async () => {
    const prepared = await module.prepareFunctions(sourceOf('return 1;', { hosts: ['api.example.com'] }));

    expect(prepared.ok).toBe(true);
    expect(prepared.ok && prepared.functions.manifest).toEqual({
      hosts: ['api.example.com'],
      tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, limits: ASKS_ENOUGH }],
      routes: []
    });
    expect(prepared.ok && prepared.functions.bundle.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reads a bundle that logs as it loads', async () => {
    const prepared = await module.prepareFunctions(sourceOf('return 1;', { extra: 'console.log("loading");' }));

    expect(prepared.ok).toBe(true);
  });

  it('refuses a namespace the platform uses, and says why', async () => {
    const prepared = await module.prepareFunctions({
      'index.ts':
        'export default { tasks: [{ namespace: "kv", action: "get", title: "Mine", params: {}, run: () => 1 }] };'
    });

    expect(prepared.ok).toBe(false);
    expect(!prepared.ok && prepared.problems[0]?.message).toContain('Namespace "kv" is reserved');
  });

  it('refuses a bundle with no default export', async () => {
    const prepared = await module.prepareFunctions({ 'index.ts': 'export const tasks = [];' });

    expect(!prepared.ok && prepared.problems[0]?.message).toContain('its definition by default');
  });

  it('is refused on a server with no runner', async () => {
    const bare = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });

    expect(await bare.prepareFunctions(sourceOf('return 1;'))).toEqual({
      ok: false,
      problems: [{ message: 'This server runs no space functions' }]
    });
  });
});

describe('a space’s task, run in an isolate', () => {
  it('runs with the run’s params and knows who asked, never their session', async () => {
    const space = await spaceWith(sourceOf('return { params, user: ctx.user, spaceId: ctx.spaceId };'));
    const { value } = await space.run({ name: 'Ada' });

    expect(value).toEqual({
      params: { name: 'Ada' },
      user: { id: 7, username: 'ana', email: 'ana@example.com', verified: true, permissions: [], roles: [] },
      spaceId: 3
    });
  });

  it('is offered in the space’s catalog, and not in the deployment’s', async () => {
    const space = await spaceWith(sourceOf('return 1;'));

    expect((await space.module.registryFor(3)).get('probe.run')?.title).toBe('Probe');
    expect(space.module.registry.get('probe.run')).toBeUndefined();
  });

  it('keeps things in the space’s store', async () => {
    const space = await spaceWith(
      sourceOf('await ctx.kv.set("visits", (await ctx.kv.get("visits") ?? 0) + 1); return ctx.kv.get("visits");')
    );
    await space.run();

    expect((await space.run()).value).toBe(2);
    expect(await space.module.kv(3).get('visits')).toBe(2);
  });

  it('fetches a declared host with a credential written in, and never holds its value', async () => {
    const secret = 'sk-live-sandbox-0123';
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(
        Response.json({ authorised: new Headers(init?.headers).get('authorization') === `Bearer ${secret}` })
      )
    );
    const space = await spaceWith(
      sourceOf(
        `const response = await ctx.fetch('https://api.example.com/charges', {
          credential: 'stripe', headers: { authorization: 'Bearer {{ credential.apiKey }}' }
        });
        return { status: response.status, body: await response.json(), type: response.headers.get('content-type') };`,
        { hosts: ['api.example.com'] }
      ),
      { fetchImpl, credential: { apiKey: secret } }
    );
    const result = await space.run();

    expect(result.value).toEqual({ status: 200, body: { authorised: true }, type: 'application/json' });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('cannot reach a host it did not declare', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    const undeclared = await spaceWith(sourceOf('return (await ctx.fetch("https://evil.example.com/")).status;'), {
      fetchImpl
    });

    expect((await undeclared.run()).error).toContain('not among the hosts');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('changes a value without losing a writer that got there first', async () => {
    const space = await spaceWith(
      sourceOf(`
        await Promise.all(Array.from({ length: 10 }, () =>
          ctx.kv.change('tally', current => ({ n: (current?.n ?? 0) + 1 }), 60)));
        const untouched = await ctx.kv.change('tally', () => undefined);
        return { tally: await ctx.kv.get('tally'), untouched: untouched === undefined };`)
    );

    expect((await space.run()).value).toEqual({ tally: { n: 10 }, untouched: true });
  });

  it('changes one entry of a list without losing a writer — and never brings back one taken out', async () => {
    const space = await spaceWith(
      sourceOf(`
        await ctx.kv.listPut('queue', { id: 'a', score: 0, value: { votes: 0 } });
        const vote = current => current ? { score: current.value.votes + 1, value: { votes: current.value.votes + 1 } } : undefined;
        await Promise.all(Array.from({ length: 5 }, () => ctx.kv.listChange('queue', 'a', vote)));
        const after = await ctx.kv.listRange('queue');
        await ctx.kv.listRemove('queue', 'a');
        const gone = await ctx.kv.listChange('queue', 'a', vote);
        return { after, gone: gone === undefined, left: await ctx.kv.listRange('queue') };`)
    );

    expect((await space.run()).value).toEqual({
      after: [{ id: 'a', score: 5, value: { votes: 5 } }],
      gone: true,
      left: []
    });
  });

  it('counts a rate limit, and leaves what to answer past it to the code', async () => {
    const space = await spaceWith(
      sourceOf(`
        const tries = [];
        for (let i = 0; i < 3; i++) { tries.push((await ctx.rateLimit('open', { most: 2, perSeconds: 60 })).allowed); }
        return tries;`)
    );

    expect((await space.run()).value).toEqual([true, true, false]);
  });

  it('refuses past a rate limit with the words the code gave it, when it gave some', async () => {
    const space = await spaceWith(
      sourceOf(`
        for (let i = 0; i < 3; i++) { await ctx.rateLimit('make', { most: 2, perSeconds: 60, refuse: 'Wait a minute' }); }
        return 'never';`)
    );

    expect((await space.run()).refusal).toBe('Wait a minute');
  });

  it('signs with the space’s own key, which the code never holds', async () => {
    const space = await spaceWith(
      sourceOf(`
        const signature = await ctx.sign('owner:board');
        return { signature, holds: await ctx.verify('owner:board', signature), other: await ctx.verify('owner:else', signature) };`)
    );
    const { value } = await space.run();
    const { signature, holds, other } = value as { signature: string; holds: boolean; other: boolean };

    expect({ holds, other }).toEqual({ holds: true, other: false });
    expect(
      await createSigning(SIGNING_SECRET)({ spaceId: 3, environment: 'main' }).verify('owner:board', signature)
    ).toBe(true);
  });

  it('is refused signing on a server given no signing secret', async () => {
    const space = await spaceWith(sourceOf('return await ctx.sign("x");'), { unsigned: true });

    expect((await space.run()).error).toContain('signs nothing');
  });

  it('refuses with a reason the caller reads, and keeps whatever else it threw to the run', async () => {
    const extra = 'import { ActionRefusal } from "@plitzi/sdk-runtime";';
    const refused = await spaceWith(
      sourceOf('throw new ActionRefusal("That is not this board’s password");', { extra })
    );
    const broken = await spaceWith(sourceOf('throw new Error("select * from boards where secret = 42");'));

    expect((await refused.run()).refusal).toBe('That is not this board’s password');
    expect((await broken.run()).refusal).toBeUndefined();
  });

  it('logs onto its step, one line per call, as the run records it', async () => {
    const space = await spaceWith(
      sourceOf('ctx.log("checking", { n: 1 }, new Error("late")); console.warn("from the console"); return 1;')
    );

    expect((await space.run()).logs).toEqual(['checking {"n":1} Error: late', 'from the console']);
  });
});

describe('what an invocation spends', () => {
  it('is reported however it ended, for metering and the budget', async () => {
    const onUsage = vi.fn();
    const space = await spaceWith(
      sourceOf('await ctx.kv.get("a"); const s = Date.now(); while (Date.now() - s < 20) {} return 1;'),
      { onUsage }
    );
    await space.run();

    expect(onUsage).toHaveBeenCalledWith({
      spaceId: 3,
      environment: 'main',
      task: 'probe.run',
      ok: true,
      usage: { cpuMs: expect.any(Number) as number, wallMs: expect.any(Number) as number, calls: 1 },
      // Its size's memory: what its compute is billed by.
      memoryMb: 32
    });
    const [[{ usage }]] = onUsage.mock.calls as [[{ usage: { cpuMs: number } }]];
    expect(usage.cpuMs).toBeGreaterThanOrEqual(15);
  });

  // The plan's compute for the period spent: a paywall, said as the limit it is — never retried as a busy minute.
  it('is stopped at its plan’s compute for the period, said as that limit', async () => {
    const space = await spaceWith(sourceOf('return 1;'), {
      admit: () =>
        Promise.resolve({ limit: 'quota' as const, message: 'This space used its 2,000,000 small-seconds this month' })
    });

    const result = await space.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('used its 2,000,000 small-seconds this month');
  });

  it('is refused before it starts when the deployment says the space is over its budget', async () => {
    const onUsage = vi.fn();
    const space = await spaceWith(sourceOf('return 1;'), {
      admit: () =>
        Promise.resolve({
          limit: 'cpuBudget' as const,
          message: 'This account’s functions used their CPU for this minute'
        }),
      onUsage
    });

    expect((await space.run()).error).toContain('used their CPU for this minute');
    expect(onUsage).not.toHaveBeenCalled();
  });
});
