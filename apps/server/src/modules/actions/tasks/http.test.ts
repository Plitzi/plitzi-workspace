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

/** A REAL `Response`, not a shape that resembles one: the run's fetch reads headers and streams the body to hold
 *  it to the size budget, so a stand-in without either would be testing a path production never takes. */
const ok = () => Promise.resolve(new Response('{"ok":true}', { status: 200 }));

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

  /** Long before a timeout would notice: a backend answering a gigabyte quickly is how one flow takes a process
   *  down, and every other ceiling here is about how LONG a run may take rather than how much it may hold. */
  it('refuses an answer larger than the byte budget, declared or not', async () => {
    const declared = vi.fn(() =>
      Promise.resolve(new Response('x'.repeat(64), { status: 200, headers: { 'content-length': '64' } }))
    );
    const target = entry({ url: 'https://api.example.com/items', method: 'GET' });
    target.document.limits = { maxResponseBytes: 32 };

    // Refused like every other ceiling in this module — the step budget, the request budget — rather than as a
    // step that merely failed: the run is over capacity, and the caller is told exactly that.
    await expect(run(target, declared)).rejects.toThrow(/byte budget/);

    // The same ceiling for a chunked answer that declares nothing, which is the one a cap on `Content-Length`
    // alone would wave through.
    const chunked = vi.fn(() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start: controller => {
              controller.enqueue(new TextEncoder().encode('x'.repeat(64)));
              controller.close();
            }
          }),
          { status: 200 }
        )
      )
    );

    await expect(run(target, chunked)).rejects.toThrow(/byte budget/);
  });

  it('refuses a request aimed inside the cluster', async () => {
    const fetchMock = vi.fn(ok);

    // The endpoint runs from a trusted network position, so an authored URL is a request issued from inside it.
    const result = await run(entry({ url: 'http://169.254.169.254/latest/meta-data/', method: 'GET' }), fetchMock);

    expect(result.status).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
