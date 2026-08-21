import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

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

const entry = (params: Record<string, unknown>): ActionEntry => ({
  id: 'fetcher',
  document: {
    name: 'Fetcher',
    output: { status: { type: 'number' } },
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'call',
        params: { access: 'public', input: '{"id":{"type":"text"}}' },
        afterNode: 'call'
      }),
      call: node('call', { action: 'http.request', afterNode: 'ret', params }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"status": {{ call.status }}}' } })
    }
  }
});

const run = (target: ActionEntry, fetchImpl: typeof fetch, credential?: Record<string, string>) => {
  const { runAction } = createActionsModule({
    lookups: {
      getAction: () => Promise.resolve(undefined),
      getCredential: () => Promise.resolve(credential)
    },
    fetchImpl
  });

  return runAction({
    entry: target,
    input: { id: '42' },
    spaceId: 1,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
  });
};

const ok = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"ok":true}') } as Response);

/** The calls a mock recorded, typed as what `fetch` actually receives. */
const callsOf = (mock: { mock: { calls: unknown[] } }) => mock.mock.calls as unknown as [string, RequestInit][];

describe('http.request', () => {
  it('renders its own params against the flow scope', async () => {
    const fetchMock = vi.fn(ok);

    const result = await run(entry({ url: 'https://api.example.com/items/{{ input.id }}', method: 'GET' }), fetchMock);

    expect(callsOf(fetchMock)[0][0]).toBe('https://api.example.com/items/42');
    expect(result.output).toEqual({ status: 200 });
  });

  it('resolves the credential it names, and only inside this step', async () => {
    const fetchMock = vi.fn(ok);

    await run(
      entry({
        url: 'https://api.example.com/items',
        method: 'GET',
        credential: 'api',
        headers: '{"Authorization": "Bearer {{ credential.token }}"}'
      }),
      fetchMock,
      { token: 's3cr3t-value' }
    );

    // The run's fetch normalizes into a `Headers` instance (it stamps the lineage on every call), so this reads
    // through the same interface rather than treating it as a plain object.
    const [, init] = callsOf(fetchMock)[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer s3cr3t-value');
  });

  /** There is no allow-list to check against any more — the step names what it needs and gets it. What still
   *  cannot happen is a request going out with an empty Authorization header because the credential was not
   *  there: the step fails first, and the provider never sees an unauthenticated call to explain. */
  it('fails the step rather than calling out with a credential this space has not got', async () => {
    const fetchMock = vi.fn(ok);

    const result = await run(
      entry({ url: 'https://api.example.com/items', method: 'GET', credential: 'api' }),
      fetchMock
    );

    expect(result.status).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a request aimed inside the cluster', async () => {
    const fetchMock = vi.fn(ok);

    // The endpoint runs from a trusted network position, so an authored URL is a request issued from inside it.
    const result = await run(entry({ url: 'http://169.254.169.254/latest/meta-data/', method: 'GET' }), fetchMock);

    expect(result.status).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
