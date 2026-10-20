import { describe, expect, it, vi } from 'vitest';

import { tasksOf } from '../../functions/tests/tasksOf';
import { createActionsModule } from '../index';
import { buildEntry, callTrigger, disabledEntry, lookups, node, request } from './tests/runAction';

import type { FunctionTask } from '../../functions/contract';
import type { ActionRunRecord } from '../types';

describe('runAction', () => {
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
    const echo: FunctionTask<{ value: string }> = {
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
      functions: tasksOf(echo)
    });

    const result = await runAction(request(entry));

    // The token resolves to nothing because credentials are not ambient: a task asks for one by name and gets it
    // inside its OWN execution. Otherwise any step — `flow.output` included — could hand a secret to the browser.
    expect(JSON.stringify(result.trace)).not.toContain(secret);
  });
  it('redacts a secret a task returned, wherever it ended up', async () => {
    const secret = 'sk-live-01234567890';
    // A task legitimately holding a credential can still put it somewhere it should not be — a provider that echoes
    // the header it was sent, or an error quoting it. Redaction is keyed on the VALUE for exactly that reason.
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ echoed: new Headers(init?.headers).get('authorization') })))
    );
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'call'),
        call: node('call', {
          action: 'http.request',
          params: {
            url: 'https://api.example.com/charges',
            credential: 'stripe',
            headers: '{"authorization": "Bearer {{ credential.apiKey }}"}'
          }
        })
      }
    });
    const { runAction } = createActionsModule({
      lookups: { ...lookups, getCredential: () => Promise.resolve({ apiKey: secret }) },
      fetchImpl
    });

    const result = await runAction(request(entry));

    expect(fetchImpl).toHaveBeenCalled();
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

    expect(() =>
      createActionsModule({ lookups, functions: tasksOf(shadow as unknown as FunctionTask<never>) })
    ).toThrow(/reserved/);
  });
});
describe('run records', () => {
  const recordsOf = async (entry: ReturnType<typeof buildEntry>, extra: Record<string, unknown> = {}) => {
    const records: ActionRunRecord[] = [];
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
      steps: [{ action: 'flow.output', status: 'success', phase: 'flow' }]
    });
    expect(record.startedAt).toEqual(expect.any(Number));
    expect(record.durationMs).toEqual(expect.any(Number));
  });

  it('records what the run was given, answered and read', async () => {
    const [record] = await recordsOf(buildEntry());

    expect(record.input).toEqual({ amount: 42 });
    expect(record.output).toMatchObject({ total: 42 });
    expect(record.trace.map(entry => [entry.node.id, entry.status])).toEqual([['compute', 'success']]);
  });

  /**
   * A step's result is redacted as it lands, against the credentials resolved SO FAR. A value an early step echoed and
   * a later step resolved as a credential would slip through that — so the record is redacted again, whole.
   */
  it('redacts a credential out of the record, even one resolved after the step that echoed it', async () => {
    const secret = 'sk-live-late-0123456789';
    const echo: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'echo',
      title: 'Echo',
      params: {},
      // Echoes the value before anything in the run has resolved it as a credential — a provider answering with it.
      run: () => Promise.resolve({ echoed: secret })
    };
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'first'),
        first: node('first', { action: 'test.echo', afterNode: 'second' }),
        // Resolves the credential — the moment the run first learns the value is a secret.
        second: node('second', {
          action: 'http.request',
          params: { url: 'https://api.example.com/ping', credential: 'stripe', headers: '{}' }
        })
      }
    });

    const [record] = await recordsOf(entry, {
      lookups: { ...lookups, getCredential: () => Promise.resolve({ apiKey: secret }) },
      functions: tasksOf(echo),
      fetchImpl: () => Promise.resolve(new Response('{}'))
    });

    expect(JSON.stringify(record)).not.toContain(secret);
    expect(JSON.stringify(record.trace)).toContain('«redacted»');
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
    expect(record.steps).toEqual([
      expect.objectContaining({ id: 'boom', action: 'flow.fail', status: 'failed', phase: 'flow', error: 'nope' })
    ]);
  });

  // A refusal is not a run. Recording one would bury the real entries under whatever a client retries.
  it('records nothing for a run that was refused before it started', async () => {
    expect(await recordsOf(disabledEntry())).toEqual([]);
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
