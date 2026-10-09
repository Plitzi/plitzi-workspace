import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createIsolateRunner, PBKDF2_MAX_ITERATIONS } from './isolate';
import { createActionsModule } from '../../actions';
import { createSigning } from '../../actions/runtime/signing';
import { functionsInHand } from '../space';

import type { IsolateRunner } from './isolate';
import type { FunctionsConfig } from '../config';
import type { FunctionLimits, SpaceFunctions } from '../protocol';
import type { ActionEntry, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

const runner = createIsolateRunner({ concurrency: 4 });

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

const entryFor = (action: string, params: Record<string, unknown> = {}): ActionEntry => ({
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'probe' }),
      probe: node('probe', { action, params, afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ probe|json_encode }}}' } })
    }
  }
});

const USER: SSRUser = {
  token: 'session-token-never-for-functions',
  id: 7,
  username: 'ana',
  email: 'ana@example.com',
  verified: true,
  permissions: [],
  roles: []
};

const SIGNING_SECRET = 'the-deployment-signing-secret-32c';

/** A space whose `functions/index.ts` declares one task, `probe.run`, running `body` with `(params, ctx)`. */
interface SourceOptions {
  hosts?: string[];
  extra?: string;
  /** What the task asks for itself: an invocation's CPU is the task's to ask, the space's limits only cap it. */
  asks?: { cpuMs?: number };
}

/**
 * Room for a runner slower than a laptop: the 100 ms a task gets by default is a third spent on one here. A test that
 * stops a run on its CPU caps it with the space's `limits`, which this never overrides.
 */
const ASKS_ENOUGH = { cpuMs: 1000 };

const sourceOf = (body: string, { hosts = [], extra = '', asks = ASKS_ENOUGH }: SourceOptions = {}) => ({
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-server/functions';
${extra}
export default defineFunctions({
  allow: { hosts: ${JSON.stringify(hosts)} },
  tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, limits: ${JSON.stringify(asks)}, run: async (params, ctx) => { ${body} } }]
});`
});

type Space = {
  run: (
    params?: Record<string, unknown>
  ) => Promise<{ status: string; value: unknown; error: string; refusal: string | undefined; logs: string[] }>;
  module: ReturnType<typeof createActionsModule>;
};

const spaceWith = async (
  source: Record<string, string>,
  {
    fetchImpl,
    credential,
    limits,
    admit,
    onUsage,
    unsigned
  }: {
    fetchImpl?: typeof fetch;
    credential?: Record<string, string>;
    limits?: Partial<FunctionLimits>;
    admit?: FunctionsConfig['admit'];
    onUsage?: FunctionsConfig['onUsage'];
    /** A server that was given no signing secret. */
    unsigned?: boolean;
  } = {}
): Promise<Space> => {
  const probe = createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner }
  });
  const prepared = await probe.prepareFunctions(source);
  if (!prepared.ok) {
    throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
  }

  const functions: SpaceFunctions = { ...functionsInHand(prepared.functions), ...(limits ? { limits } : {}) };
  const module = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: () => Promise.resolve(credential),
      getFunctions: () => Promise.resolve(functions)
    },
    functions: { runner, ...(admit ? { admit } : {}), ...(onUsage ? { onUsage } : {}) },
    ...(unsigned ? {} : { signingSecret: SIGNING_SECRET }),
    ...(fetchImpl ? { fetchImpl } : {})
  });

  return {
    module,
    run: async (params = {}) => {
      const result = await module.runAction({
        entry: entryFor('probe.run', params),
        input: {},
        callerId: 'user:7',
        user: USER,
        spaceId: 3,
        environment: 'main',
        trigger: 'call',
        runId: `run-${String(Math.random())}`
      });
      const failed = result.trace.find(step => step.status === 'failed');

      return {
        status: result.status,
        logs: result.steps.find(step => step.id === 'probe')?.logs ?? [],
        value: result.output.value,
        refusal: result.error,
        error:
          failed && typeof failed.result === 'object' && failed.result && 'error' in failed.result
            ? String(failed.result.error)
            : ''
      };
    }
  };
};

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

    expect(!prepared.ok && prepared.problems[0]?.message).toContain('exports its definition by default');
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
    const extra = 'import { ActionRefusal } from "@plitzi/sdk-server/functions";';
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

describe('an invocation’s limits', () => {
  it('stops code that spins, by CPU time, after an await too', async () => {
    const space = await spaceWith(sourceOf('await Promise.resolve(); while (true) {}'), { limits: { cpuMs: 50 } });
    const started = Date.now();
    const result = await space.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ms of CPU');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // The runner derives outside the isolate's clock: what it took is the run's all the same.
  it('stops a run whose PBKDF2 derivations take more CPU than it may', async () => {
    const space = await spaceWith(
      sourceOf(`
        const encode = text => new TextEncoder().encode(text);
        const password = await crypto.subtle.importKey('raw', encode('pw'), 'PBKDF2', false, ['deriveBits']);
        const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-512', salt: encode('salt'), iterations: ${String(PBKDF2_MAX_ITERATIONS)} };
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        return 'derived';`),
      { limits: { cpuMs: 20 } }
    );
    const result = await space.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ms of CPU');
  });

  it('stops code that takes more memory than it may, and the next one runs', async () => {
    // Chunks the size of the whole limit: it is crossed in an allocation or two. The task asks for the CPU ceiling —
    // left at the default 100 ms, the collector's fight near the limit spent it first on a busy CI runner.
    const hog = await spaceWith(
      sourceOf('const keep = []; while (true) { keep.push(new Array(2e6).fill(Math.random())); }', {
        asks: { cpuMs: 2000 }
      }),
      { limits: { memoryMb: 16 } }
    );
    const next = await spaceWith(sourceOf('return "fine";'));

    expect((await hog.run()).error).toContain('MB of memory');
    expect((await next.run()).value).toBe('fine');
  });

  it('stops code that calls the platform more than it may', async () => {
    const space = await spaceWith(sourceOf('for (let i = 0; i < 10; i++) { await ctx.kv.get("k"); } return 1;'), {
      limits: { calls: 3 }
    });

    expect((await space.run()).error).toContain('calls to the platform');
  });

  it('refuses an answer larger than it may be', async () => {
    const space = await spaceWith(sourceOf('return "x".repeat(5000);'), { limits: { outputBytes: 1000 } });

    expect((await space.run()).error).toContain('bytes it may');
  });

  it('reports the code’s own error as the step’s', async () => {
    const space = await spaceWith(sourceOf('throw new Error("no feed today");'));

    expect((await space.run()).error).toBe('no feed today');
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
      task: 'probe.run',
      ok: true,
      usage: { cpuMs: expect.any(Number) as number, wallMs: expect.any(Number) as number, calls: 1 }
    });
    const [[{ usage }]] = onUsage.mock.calls as [[{ usage: { cpuMs: number } }]];
    expect(usage.cpuMs).toBeGreaterThanOrEqual(15);
  });

  it('is refused before it starts when the deployment says the space is over its budget', async () => {
    const onUsage = vi.fn();
    const space = await spaceWith(sourceOf('return 1;'), {
      admit: () => Promise.resolve('This account’s functions used their CPU for this minute'),
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
