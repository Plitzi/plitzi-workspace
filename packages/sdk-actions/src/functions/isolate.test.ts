import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createIsolateRunner, PBKDF2_MAX_ITERATIONS } from '@plitzi/sdk-runtime/runner';

import { createActionsModule } from '../engine/module';
import { ASKS_ENOUGH, runner, SIGNING_SECRET, sourceOf, spaceWith } from './tests/isolateSpace';
import { createSigning } from '../engine/runtime/signing';

import type { IsolateRunner } from '@plitzi/sdk-runtime/runner';

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

  it('cannot reach a host it did not declare, nor the network without ctx', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    const undeclared = await spaceWith(sourceOf('return (await ctx.fetch("https://evil.example.com/")).status;'), {
      fetchImpl
    });
    const global = await spaceWith(sourceOf('return (await fetch("https://api.example.com/")).status;'), { fetchImpl });

    expect((await undeclared.run()).error).toContain('not among the hosts');
    expect((await global.run()).error).toContain('through ctx.fetch');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('has the web’s APIs and none of Node’s', async () => {
    const space = await spaceWith(
      sourceOf(`
        const bytes = new TextEncoder().encode('héllo €');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
        const signature = await crypto.subtle.sign('HMAC', key, bytes);
        const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
        await new Promise(resolve => setTimeout(resolve, 5));
        const url = new URL('/a?b=1', 'https://x.example.com');
        const response = Response.json({ ok: true }, { status: 201 });
        return {
          text: new TextDecoder().decode(bytes),
          digest: hex(digest),
          hmac: hex(signature),
          verified: await crypto.subtle.verify('HMAC', key, signature, bytes),
          uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(crypto.randomUUID()),
          url: url.searchParams.get('b') + url.host,
          clone: structuredClone({ a: [1] }),
          response: [response.status, await response.json()],
          base64: atob(btoa('ok')),
          node: [typeof process, typeof globalThis.require, typeof Buffer]
        };`)
    );
    const data = Buffer.from('héllo €');

    expect((await space.run()).value).toEqual({
      text: 'héllo €',
      digest: createHash('sha256').update(data).digest('hex'),
      hmac: createHmac('sha256', 'k').update(data).digest('hex'),
      verified: true,
      uuid: true,
      url: '1x.example.com',
      clone: { a: [1] },
      response: [201, { ok: true }],
      base64: 'ok',
      node: ['undefined', 'undefined', 'undefined']
    });
  });

  it('derives from a password with PBKDF2, as bits or as an HMAC key', async () => {
    const space = await spaceWith(
      sourceOf(`
        const encode = text => new TextEncoder().encode(text);
        const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
        const password = await crypto.subtle.importKey('raw', encode('hunter2'), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
        const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations: 1000 };
        const signing = await crypto.subtle.deriveKey(pbkdf2, password, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
        return {
          bits: hex(await crypto.subtle.deriveBits(pbkdf2, password, 256)),
          signed: hex(await crypto.subtle.sign('HMAC', signing, encode('board')))
        };`)
    );
    const derived = pbkdf2Sync('hunter2', 'salt', 1000, 32, 'sha256');

    expect((await space.run()).value).toEqual({
      bits: derived.toString('hex'),
      signed: createHmac('sha256', derived).update('board').digest('hex')
    });
  });

  it('refuses a key used for what it was not imported for, and a derivation past the runner’s bounds', async () => {
    const attempt = (body: string) =>
      spaceWith(
        sourceOf(`
          const encode = text => new TextEncoder().encode(text);
          const pbkdf2 = iterations => ({ name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations });
          try { ${body} } catch (error) { return error.name + ': ' + error.message; }`)
      ).then(space => space.run());
    const password = 'await crypto.subtle.importKey("raw", encode("pw"), "PBKDF2", false, ["deriveBits"])';
    const hmac =
      'await crypto.subtle.importKey("raw", encode("k"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])';

    expect((await attempt(`await crypto.subtle.deriveBits(pbkdf2(1000), ${hmac}, 256);`)).value).toBe(
      'InvalidAccessError: deriveBits takes a PBKDF2 key, from crypto.subtle.importKey'
    );
    expect((await attempt(`await crypto.subtle.sign('HMAC', ${hmac}, encode('x'));`)).value).toBe(
      'InvalidAccessError: The key was not imported for sign'
    );
    expect(
      (await attempt('await crypto.subtle.importKey("raw", encode("pw"), "PBKDF2", true, ["deriveBits"]);')).value
    ).toBe('SyntaxError: A PBKDF2 key is never extractable');
    expect(
      (await attempt(`await crypto.subtle.deriveBits(pbkdf2(${String(PBKDF2_MAX_ITERATIONS + 1)}), ${password}, 256);`))
        .value
    ).toBe(`OperationError: PBKDF2 iterations is a whole number from 1 to ${String(PBKDF2_MAX_ITERATIONS)}`);
    expect((await attempt(`await crypto.subtle.deriveBits(pbkdf2(1000), ${password}, 12);`)).value).toBe(
      'OperationError: A PBKDF2 length is a multiple of 8 bits'
    );
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

  it('starts every invocation from nothing', async () => {
    const space = await spaceWith(
      sourceOf('globalThis.count = (globalThis.count ?? 0) + 1; return globalThis.count;', {
        extra: 'globalThis.loaded = (globalThis.loaded ?? 0) + 1;'
      })
    );
    await space.run();

    expect((await space.run()).value).toBe(1);
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

describe('what a runner keeps', () => {
  const invocationOf = (): Parameters<typeof runner.invoke>[0]['invocation'] => ({
    kind: 'task',
    name: 'probe.run',
    params: {},
    context: { spaceId: 1, environment: 'main', runId: 'r', trigger: 'call', callerId: 'x' }
  });
  const LIMITS = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 100_000, calls: 10 };
  const codeOf = (value: string, padding: number) =>
    `export default { tasks: [{ namespace: 'probe', action: 'run', run: () => '${value}' }] };\n// ${'x'.repeat(padding)}`;

  it('asks for a bundle’s code only when it does not keep it, and lets the oldest go past its bytes', async () => {
    const small = createIsolateRunner({ cacheBytes: 3000 });
    const loadA = vi.fn(() => Promise.resolve(codeOf('a', 1500)));
    const loadB = vi.fn(() => Promise.resolve(codeOf('b', 1500)));
    const run = (id: string, load: () => Promise<string>) =>
      small.invoke({
        bundle: { id, load },
        invocation: invocationOf(),
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });

    expect(await run('a', loadA)).toBe('a');
    expect(await run('a', loadA)).toBe('a');
    expect(loadA).toHaveBeenCalledTimes(1);

    expect(await run('b', loadB)).toBe('b');
    expect(await run('a', loadA)).toBe('a');
    expect(loadA).toHaveBeenCalledTimes(2);
  });

  // What warming leaves done, rather than how long the first invocation then takes: a timing beside a cold runner lost
  // whenever the machine ran every package's tests at once.
  it('is ready before its first invocation once warmed', async () => {
    const { default: ivm } = await import('isolated-vm');
    const firstInvocation = (fresh: IsolateRunner) =>
      fresh.invoke({
        bundle: { id: 'first', load: () => Promise.resolve(codeOf('w', 0)) },
        invocation: invocationOf(),
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });
    const warmed = createIsolateRunner();
    await warmed.warm();
    const createSnapshot = vi.spyOn(ivm.Isolate, 'createSnapshot');

    try {
      await firstInvocation(warmed);

      expect(createSnapshot).not.toHaveBeenCalled();

      // …which a runner nobody warmed builds on its first invocation, on the visitor's time.
      await firstInvocation(createIsolateRunner());

      expect(createSnapshot).toHaveBeenCalledTimes(1);
    } finally {
      createSnapshot.mockRestore();
    }
  });
});
