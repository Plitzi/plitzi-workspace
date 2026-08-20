import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionRunRequest, ActionTask } from '../types';
import type { ActionDocument, ActionEntry, ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

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

/** The `call` trigger step, whose params are now where access and the input contract live. */
const callTrigger = (params: Record<string, unknown> = {}, afterNode = 'compute') =>
  node('start', {
    type: 'trigger',
    action: 'call',
    params: { access: 'public', input: '{"amount":{"type":"number","required":true}}', ...params },
    afterNode
  });

const buildEntry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'quote',
  document: {
    name: 'Quote',
    enabled: true,
    output: { total: { type: 'number' } },
    nodes: {
      start: callTrigger(),
      compute: node('compute', {
        action: 'flow.output',
        afterNode: '',
        params: { values: '{"total": {{ input.amount }}, "leaked": "internal"}' }
      })
    },
    ...overrides
  }
});

const request = (entry: ActionEntry, overrides: Partial<ActionRunRequest> = {}): ActionRunRequest => ({
  entry,
  input: { amount: 42 },
  spaceId: 1,
  environment: 'main',
  trigger: 'call',
  runId: 'run-1',
  ...overrides
});

const lookups = { getAction: () => Promise.resolve(undefined) };

const user = (permissions: string[]): SSRUser => ({
  token: 'secret-token',
  id: 7,
  username: 'ana',
  email: 'ana@example.com',
  verified: true,
  permissions,
  roles: []
});

describe('runAction', () => {
  it('answers exactly what the output step named', async () => {
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(buildEntry()));

    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ total: 42, leaked: 'internal' });
    expect(result.trace).toHaveLength(1);
  });

  // The property that matters: the flow scope holds every step's raw result, and none of it reaches the caller
  // unless the output step names it.
  it('leaves everything the output step did not name on the server', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'fetchish'),
        fetchish: node('fetchish', {
          action: 'transform.json',
          afterNode: 'out',
          params: { value: '{"public":"ok","internalToken":"tok_live_should_not_travel"}' }
        }),
        out: node('out', { action: 'flow.output', params: { values: '{"ok": "{{ fetchish.value.public }}"}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(entry));

    expect(result.output).toEqual({ ok: 'ok' });
    expect(JSON.stringify(result.output)).not.toContain('tok_live_should_not_travel');
  });

  it('refuses a trigger the document does not declare', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { trigger: 'webhook' }))).rejects.toMatchObject({
      reason: 'forbidden'
    });
  });

  it('refuses a disabled action', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry({ enabled: false })))).rejects.toMatchObject({ reason: 'disabled' });
  });

  it('refuses a run whose lineage already names the action', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { lineage: ['quote'] }))).rejects.toMatchObject({
      reason: 'recursion'
    });
  });

  it('refuses missing required input', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { input: {} }))).rejects.toMatchObject({ reason: 'invalid_input' });
  });

  it('requires the declared permissions', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({ access: 'role', permissions: 'space.write' }),
        compute: node('compute', { action: 'flow.output', params: { values: '{"total": 1}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'forbidden' });
    await expect(runAction(request(entry, { user: user(['space.read']) }))).rejects.toMatchObject({
      reason: 'forbidden'
    });

    const granted = await runAction(request(entry, { user: user(['space.write']) }));
    expect(granted.status).toBe('completed');
  });

  it('skips a step whose `when` does not match, and keeps walking', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'skipped'),
        skipped: node('skipped', {
          action: 'flow.fail',
          afterNode: 'compute',
          params: { message: 'never' },
          when: { combinator: 'and', rules: [{ field: 'input.amount', operator: '=', value: 0 }] } as never
        }),
        compute: node('compute', { action: 'flow.output', params: { values: '{"total": 1}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(entry));

    expect(result.trace.map(entryNode => entryNode.status)).toEqual(['skipped', 'success']);
    expect(result.output).toEqual({ total: 1 });
  });

  it('ends the run at a failed step instead of carrying on', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'boom'),
        boom: node('boom', { action: 'flow.fail', afterNode: 'compute', params: { message: 'nope' } }),
        compute: node('compute', { action: 'flow.output', params: { values: '{"total": 99}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(entry));

    expect(result.status).toBe('failed');
    expect(result.output).toEqual({});
  });

  it('refuses a client-side step that wandered into a server flow', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'clientStep'),
        clientStep: node('clientStep', { type: 'globalCallback', action: 'setState' })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'failed' });
  });

  it('does not let a step read a credential out of the flow scope', async () => {
    const secret = 'sk-live-01234567890';
    const echo: ActionTask<{ value: string }> = {
      namespace: 'test',
      action: 'echo',
      title: 'Echo',
      params: { value: { type: 'text' } },
      run: ({ value }) => ({ sent: value })
    };
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'call'),
        call: node('call', { action: 'test.echo', params: { value: '{{ credential.stripe.apiKey }}' } })
      }
    });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve({ apiKey: secret }) },
      tasks: [echo]
    });

    const result = await runAction(request(entry));

    // The token resolves to nothing because credentials are not ambient: a task asks for one by name and gets it
    // inside its OWN execution. Otherwise any step — `flow.output` included — could hand a secret to the browser.
    expect(JSON.stringify(result.trace)).not.toContain(secret);
  });

  it('redacts a secret a task returned, wherever it ended up', async () => {
    const secret = 'sk-live-01234567890';
    const leaky: ActionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'leak',
      title: 'Leak',
      params: {},
      // A task legitimately holding a credential can still put it somewhere it should not be — in a header it
      // built, or in an error a provider echoed back. Redaction is keyed on the VALUE for exactly that reason.
      run: async (_params, ctx) => ({ echoed: (await ctx.credential('stripe'))?.apiKey })
    };
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'call'),
        call: node('call', { action: 'test.leak' })
      }
    });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve({ apiKey: secret }) },
      tasks: [leaky]
    });

    const result = await runAction(request(entry));

    expect(JSON.stringify(result.trace)).not.toContain(secret);
    expect(JSON.stringify(result.trace)).toContain('«redacted»');
  });

  /** No list is resolved up front any more, so the failure lands where the credential was asked for. What must
   *  not happen is the step going out unauthenticated and reporting whatever the provider says about it. */
  it('fails the run at the step that names a credential this space has not got', async () => {
    const fetchImpl = vi.fn();
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'call'),
        call: node('call', {
          action: 'http.request',
          params: { url: 'https://api.example.com', method: 'GET', credential: 'stripe' }
        })
      }
    });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve(undefined) },
      fetchImpl: fetchImpl
    });

    const result = await runAction(request(entry));

    expect(result.status).toBe('failed');
    expect(JSON.stringify(result.trace)).toContain('stripe');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a custom task that shadows a built-in namespace', () => {
    const shadow = { namespace: 'flow', action: 'delay', title: 'Nope', params: {}, run: () => ({}) };

    expect(() => createActionsModule({ lookups, tasks: [shadow as unknown as ActionTask<never>] })).toThrow(/reserved/);
  });
});

describe('run records', () => {
  const recordsOf = async (entry: ReturnType<typeof buildEntry>, extra: Record<string, unknown> = {}) => {
    const records: Record<string, unknown>[] = [];
    const { runAction } = createActionsModule({
      lookups,
      onRun: record => {
        records.push(record);
      },
      ...extra
    });

    try {
      await runAction(request(entry));
    } catch {
      // A refusal is not a run; the assertions below are about what was recorded either way.
    }

    return records;
  };

  it('records a run that happened, with the shape of what it did', async () => {
    const [record] = await recordsOf(buildEntry());

    expect(record).toMatchObject({
      actionId: 'quote',
      trigger: 'call',
      status: 'completed',
      spaceId: 1,
      nodes: [{ action: 'flow.output', status: 'success' }]
    });
    expect(record.durationMs).toEqual(expect.any(Number));
  });

  it('records a failed run, and says where it stopped', async () => {
    const failing = buildEntry({
      nodes: {
        start: callTrigger({}, 'boom'),
        boom: node('boom', { action: 'flow.fail', params: { message: 'nope' } })
      }
    });

    const [record] = await recordsOf(failing);

    expect(record).toMatchObject({ status: 'failed', error: 'nope' });
  });

  // A refusal is not a run. Recording one would bury the real entries under whatever a client retries.
  it('records nothing for a run that was refused before it started', async () => {
    expect(await recordsOf(buildEntry({ enabled: false }))).toEqual([]);
  });

  it('never lets a failing recorder fail the run', async () => {
    const { runAction } = createActionsModule({
      lookups,
      onRun: () => {
        throw new Error('log store is down');
      }
    });

    const result = await runAction(request(buildEntry()));

    expect(result.status).toBe('completed');
  });
});
