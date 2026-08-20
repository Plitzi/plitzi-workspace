import { describe, expect, it } from 'vitest';

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

const buildEntry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'quote',
  document: {
    name: 'Quote',
    enabled: true,
    access: { mode: 'public' },
    triggers: [{ type: 'call' }],
    input: { amount: { type: 'number', required: true } },
    output: { total: { type: 'number' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', afterNode: 'compute' }),
      compute: node('compute', {
        action: 'flow.return',
        afterNode: '',
        params: { values: '{"total": "{{ input.amount }}", "leaked": "internal"}' }
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
  it('runs the flow and returns only declared output', async () => {
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(buildEntry()));

    expect(result.status).toBe('completed');
    // `leaked` was produced by the step but nobody declared it, so it does not leave the server.
    expect(result.output).toEqual({ total: 42 });
    expect(result.trace).toHaveLength(1);
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
    const entry = buildEntry({ access: { mode: 'role', permissions: ['space.write'] } });
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
        start: node('start', { type: 'trigger', action: 'call', afterNode: 'skipped' }),
        skipped: node('skipped', {
          action: 'flow.fail',
          afterNode: 'compute',
          params: { message: 'never' },
          when: { combinator: 'and', rules: [{ field: 'input.amount', operator: '=', value: 0 }] } as never
        }),
        compute: node('compute', { action: 'flow.return', params: { values: '{"total": 1}' } })
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
        start: node('start', { type: 'trigger', action: 'call', afterNode: 'boom' }),
        boom: node('boom', { action: 'flow.fail', afterNode: 'compute', params: { message: 'nope' } }),
        compute: node('compute', { action: 'flow.return', params: { values: '{"total": 99}' } })
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
        start: node('start', { type: 'trigger', action: 'call', afterNode: 'clientStep' }),
        clientStep: node('clientStep', { type: 'globalCallback', action: 'setState' })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'failed' });
  });

  it('redacts resolved credential values out of the trace', async () => {
    const secret = 'sk-live-01234567890';
    const echo: ActionTask<{ value: string }> = {
      namespace: 'test',
      action: 'echo',
      title: 'Echo',
      params: { value: { type: 'text' } },
      run: ({ value }) => ({ sent: value })
    };
    const entry = buildEntry({
      credentials: ['stripe'],
      nodes: {
        start: node('start', { type: 'trigger', action: 'call', afterNode: 'call' }),
        call: node('call', { action: 'test.echo', params: { value: '{{ credential.stripe.apiKey }}' } })
      }
    });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve({ apiKey: secret }) },
      tasks: [echo]
    });

    const result = await runAction(request(entry));

    expect(JSON.stringify(result.trace)).not.toContain(secret);
    expect(JSON.stringify(result.trace)).toContain('«redacted»');
  });

  it('fails closed when a declared credential is missing', async () => {
    const entry = buildEntry({ credentials: ['stripe'] });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve(undefined) }
    });

    await expect(runAction(request(entry))).rejects.toThrow(/stripe/);
  });

  it('refuses a custom task that shadows a built-in namespace', () => {
    const shadow = { namespace: 'flow', action: 'delay', title: 'Nope', params: {}, run: () => ({}) };

    expect(() => createActionsModule({ lookups, tasks: [shadow as unknown as ActionTask<never>] })).toThrow(/reserved/);
  });
});
