import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createIsolateRunner } from './isolate';
import { createActionsModule } from '../../actions';

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

/** A space whose `functions/index.ts` declares one task, `probe.run`, running `body` with `(params, ctx)`. */
const sourceOf = (body: string, { hosts = [] as string[], extra = '' } = {}) => ({
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-server/functions';
${extra}
export default defineFunctions({
  allow: { hosts: ${JSON.stringify(hosts)} },
  tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, run: async (params, ctx) => { ${body} } }]
});`
});

type Space = {
  run: (params?: Record<string, unknown>) => Promise<{ status: string; value: unknown; error: string; logs: string[] }>;
  module: ReturnType<typeof createActionsModule>;
};

const spaceWith = async (
  source: Record<string, string>,
  {
    fetchImpl,
    credential,
    limits,
    admit,
    onUsage
  }: {
    fetchImpl?: typeof fetch;
    credential?: Record<string, string>;
    limits?: Partial<FunctionLimits>;
    admit?: FunctionsConfig['admit'];
    onUsage?: FunctionsConfig['onUsage'];
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

  const functions: SpaceFunctions = { ...prepared.functions, ...(limits ? { limits } : {}) };
  const module = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: () => Promise.resolve(credential),
      getFunctions: () => Promise.resolve(functions)
    },
    functions: { runner, ...(admit ? { admit } : {}), ...(onUsage ? { onUsage } : {}) },
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
      tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {} }],
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

  it('stops code that takes more memory than it may, and the next one runs', async () => {
    const hog = await spaceWith(
      sourceOf('const keep = []; while (true) { keep.push(new Array(1e5).fill(Math.random())); }'),
      {
        limits: { memoryMb: 16, cpuMs: 5000 }
      }
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
