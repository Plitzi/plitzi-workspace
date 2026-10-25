import { describe, expect, it, vi } from 'vitest';

import { defineFunctions } from './contract';
import { actionLookupsOf } from '../../core/configSeam';
import { createActionsModule } from '../actions';

import type { FunctionContext, FunctionTask } from './contract';
import type { ActionLookups, ActionRealtime } from '../actions/types';
import type { ActionEntry, ActionLookupsConfig, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

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

const entryFor = (action: string): ActionEntry => ({
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'probe' }),
      probe: node('probe', { action, afterNode: 'ret' }),
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
  permissions: ['spaceUpdate'],
  roles: ['editor']
};

/** Runs one task of a space's functions through a real actions module, and answers what it returned. */
const runProbe = async (
  run: (ctx: FunctionContext) => unknown,
  {
    hosts = [],
    fetchImpl,
    credential,
    getData,
    getVisitor,
    realtime
  }: {
    hosts?: string[];
    fetchImpl?: typeof fetch;
    credential?: Record<string, string>;
    getData?: ActionLookups['getData'];
    getVisitor?: ActionLookupsConfig['getVisitor'];
    realtime?: ActionRealtime;
  } = {}
) => {
  const probe: FunctionTask<Record<string, never>> = {
    namespace: 'probe',
    action: 'run',
    title: 'Probe',
    params: {},
    run: (_params, ctx) => run(ctx)
  };
  const module = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: () => Promise.resolve(credential),
      ...(getData ? { getData } : {}),
      // Through the seam a deployment's lookup goes through: what it answers, filtered as code would read it.
      ...(getVisitor
        ? { getVisitor: actionLookupsOf({ getAction: () => Promise.resolve(undefined), getVisitor }).getVisitor }
        : {})
    },
    functions: { native: [defineFunctions({ allow: { hosts }, tasks: [probe] })] },
    ...(fetchImpl ? { fetchImpl } : {}),
    ...(realtime ? { realtime } : {})
  });
  const result = await module.runAction({
    entry: entryFor('probe.run'),
    input: {},
    callerId: 'user:7',
    user: USER,
    spaceId: 3,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1',
    at: { environment: 'production', revision: 4 }
  });

  return result;
};

describe('a function’s context', () => {
  it('knows who asked, and never holds their session', async () => {
    const result = await runProbe(ctx => ({ user: ctx.user, callerId: ctx.callerId, spaceId: ctx.spaceId }));

    expect(result.output.value).toEqual({
      user: {
        id: 7,
        username: 'ana',
        email: 'ana@example.com',
        verified: true,
        permissions: ['spaceUpdate'],
        roles: ['editor']
      },
      callerId: 'user:7',
      spaceId: 3
    });
    expect(JSON.stringify(result)).not.toContain('session-token-never-for-functions');
  });

  it('fetches only the hosts the space declared', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{"ok":true}')));
    const allowed = await runProbe(async ctx => (await ctx.fetch('https://api.example.com/x')).status, {
      hosts: ['api.example.com'],
      fetchImpl
    });
    const refused = await runProbe(async ctx => (await ctx.fetch('https://other.example.com/x')).status, {
      hosts: ['api.example.com'],
      fetchImpl
    });

    expect(allowed.output.value).toBe(200);
    expect(refused.status).toBe('failed');
    expect(JSON.stringify(refused.trace)).toContain('not among the hosts');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('takes a wildcard for every subdomain, and not the domain itself', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    const sub = await runProbe(async ctx => (await ctx.fetch('https://eu.api.example.com/')).status, {
      hosts: ['*.api.example.com'],
      fetchImpl
    });
    const bare = await runProbe(async ctx => (await ctx.fetch('https://api.example.com/')).status, {
      hosts: ['*.api.example.com'],
      fetchImpl
    });

    expect(sub.output.value).toBe(200);
    expect(bare.status).toBe('failed');
  });

  it('writes a credential into the request where it says so, and the code never sees the value', async () => {
    const secret = 'sk-live-functions-0123';
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(
        new Response(new Headers(init?.headers).get('authorization') === `Bearer ${secret}` ? 'yes' : 'no')
      )
    );
    const result = await runProbe(
      async ctx => {
        const response = await ctx.fetch('https://api.example.com/charges', {
          credential: 'stripe',
          headers: { authorization: 'Bearer {{ credential.apiKey }}' }
        });

        return response.text();
      },
      { hosts: ['api.example.com'], fetchImpl, credential: { apiKey: secret } }
    );

    expect(result.output.value).toBe('yes');
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('keeps the outbound guard even for a declared host', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    const result = await runProbe(async ctx => (await ctx.fetch('http://localhost/admin')).status, {
      hosts: ['localhost'],
      fetchImpl
    });

    expect(result.status).toBe('failed');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('ctx.data', () => {
  const errorOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

  it('reads one file of the space’s data, parsed, as of the run’s version — looked up once per run', async () => {
    const getData = vi.fn(() => Promise.resolve({ 'prices.json': '{"cost": 4}', 'notes.json': '{ nope' }));
    const result = await runProbe(
      async ctx => {
        // The file this test wrote: its shape is known here, and nowhere a type could carry it.
        const first = (await ctx.data('prices.json')) as { cost: number };
        first.cost = 99;

        return {
          again: await ctx.data('prices.json'),
          missing: await ctx.data('/data/prices.json').then(() => 'read', errorOf),
          broken: await ctx.data('notes.json').then(() => 'read', errorOf)
        };
      },
      { getData }
    );

    expect(result.output.value).toEqual({
      again: { cost: 4 },
      missing: expect.stringContaining('"/data/prices.json" is not a file of this space\'s data') as string,
      broken: expect.stringContaining('is not JSON') as string
    });
    expect(getData).toHaveBeenCalledTimes(1);
    expect(getData).toHaveBeenCalledWith(3, { environment: 'production', revision: 4 });
  });

  it('is refused, saying why, on a server that keeps no data', async () => {
    const result = await runProbe(ctx => ctx.data('prices.json').then(() => 'read', errorOf));

    expect(result.output.value).toContain('This server keeps no data for its spaces');
  });
});

describe('ctx.presence', () => {
  /** a project counted a room's listeners by the pages' own heartbeats in kv: the server knows who is connected. */
  it('says who is on a topic of the space’s presence channels, as the server counts them', async () => {
    const presence = vi.fn(() =>
      Promise.resolve({ count: 1, members: [{ from: 'c-1', user: { id: 7, name: 'ana' }, since: 1_000 }] })
    );
    const realtime: ActionRealtime = {
      publish: () => Promise.resolve(),
      grant: () => Promise.resolve('g'),
      revoke: () => Promise.resolve(),
      presence
    };

    const result = await runProbe(ctx => ctx.presence('room:night-drive'), { realtime });

    expect(result.output.value).toEqual({
      count: 1,
      members: [{ from: 'c-1', user: { id: 7, name: 'ana' }, since: 1_000 }]
    });
    expect(presence).toHaveBeenCalledWith({ spaceId: 3, environment: 'main' }, 'room:night-drive');
  });

  it('is refused, saying why, on a server with no channels', async () => {
    const result = await runProbe(ctx =>
      ctx.presence('room:x').then(
        () => 'counted',
        (error: unknown) => (error instanceof Error ? error.message : String(error))
      )
    );

    expect(result.output.value).toContain('no realtime channels');
  });
});

describe('ctx.visitors', () => {
  /** a project kept its own copy of every profile in kv, written from `ctx.user`, to show one person to another. */
  it('reads one person of the space, its public fields alone — an email the deployment answered never reaches code', async () => {
    const getVisitor = vi.fn((_space: number, _environment: string, who: string | number) =>
      Promise.resolve(
        who === 'mika' ? { id: 9, username: 'mika', name: 'Mika', email: 'mika@example.com', roles: ['dj'] } : undefined
      )
    );

    const result = await runProbe(
      async ctx => ({ mika: await ctx.visitors.get('mika'), nobody: await ctx.visitors.get(42) }),
      {
        getVisitor
      }
    );

    expect(result.output.value).toEqual({ mika: { id: 9, username: 'mika', name: 'Mika' } });
    expect(getVisitor).toHaveBeenCalledWith(3, 'main', 42);
  });

  it('is refused, saying why, on a server that tells no visitor apart', async () => {
    const result = await runProbe(ctx =>
      ctx.visitors.get('mika').then(
        () => 'read',
        (error: unknown) => (error instanceof Error ? error.message : String(error))
      )
    );

    expect(result.output.value).toContain('tells no visitor apart');
  });
});
