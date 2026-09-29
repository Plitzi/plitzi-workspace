import { describe, expect, it, vi } from 'vitest';

import { defineFunctions } from './contract';
import { createActionsModule } from '../actions';

import type { FunctionContext, FunctionTask } from './contract';
import type { ActionEntry, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

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
    credential
  }: { hosts?: string[]; fetchImpl?: typeof fetch; credential?: Record<string, string> } = {}
) => {
  const probe: FunctionTask<Record<string, never>> = {
    namespace: 'probe',
    action: 'run',
    title: 'Probe',
    params: {},
    run: (_params, ctx) => run(ctx)
  };
  const module = createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined), getCredential: () => Promise.resolve(credential) },
    functions: { native: [defineFunctions({ allow: { hosts }, tasks: [probe] })] },
    ...(fetchImpl ? { fetchImpl } : {})
  });
  const result = await module.runAction({
    entry: entryFor('probe.run'),
    input: {},
    callerId: 'user:7',
    user: USER,
    spaceId: 3,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
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
