import { describe, expect, it, vi } from 'vitest';

import { handleActionCall } from './callHandler';
import { createActionsModule } from '../index';

import type { ActionsModule } from '../index';
import type {
  ActionDocument,
  ActionEntry,
  ElementInteraction,
  SSRPageServerConfig,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

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

const document = (overrides: Partial<ActionDocument> = {}): ActionDocument => ({
  name: 'Quote',
  enabled: true,
  access: { mode: 'public' },
  triggers: [{ type: 'call' }],
  input: { amount: { type: 'number', required: true } },
  output: { total: { type: 'number' } },
  nodes: {
    start: node('start', { type: 'trigger', action: 'call', afterNode: 'compute' }),
    compute: node('compute', { action: 'flow.return', params: { values: '{"total": "{{ input.amount }}"}' } })
  },
  ...overrides
});

const entry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'quote',
  document: document(overrides)
});

const buildRes = () => {
  const sent: { status: number; body: string; headers: Record<string, string | string[]> } = {
    status: 200,
    body: '',
    headers: {}
  };
  const res: SSRResponseHelpers = {
    status: 200,
    headers: {},
    setHeader: (name, value) => {
      sent.headers[name] = value;
    },
    setStatus: code => {
      sent.status = code;
    },
    send: body => {
      sent.body = body;
    },
    write: () => undefined,
    end: () => undefined
  };

  return { res, sent };
};

const buildConfig = (action: ActionEntry | undefined, extra: Record<string, unknown> = {}): SSRPageServerConfig =>
  ({
    adapters: {},
    action: { lookups: { getAction: () => Promise.resolve(action) } },
    ...extra
  }) as unknown as SSRPageServerConfig;

const request = (body: unknown, authoring = false): SSRRequest =>
  ({
    method: 'POST',
    path: '/_action',
    body: JSON.stringify(body),
    query: {},
    headers: {},
    ctx: { spaceDeployment: { spaceId: 3, environment: 'production', revision: 1, authoring } }
  }) as unknown as SSRRequest;

const call = async (
  config: SSRPageServerConfig,
  body: unknown,
  options: { module?: ActionsModule; authoring?: boolean; signal?: AbortSignal; lineage?: string[] } = {}
) => {
  const { res, sent } = buildRes();
  const module = options.module ?? createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
  await handleActionCall({
    req: request(body, options.authoring),
    res,
    config,
    module,
    signal: options.signal ?? new AbortController().signal,
    callerId: 'ip:127.0.0.1',
    lineage: options.lineage ?? []
  });

  return { sent, payload: JSON.parse(sent.body || '{}') as Record<string, unknown>, module };
};

describe('handleActionCall', () => {
  it('runs the named action and answers its declared output', async () => {
    const { sent, payload } = await call(buildConfig(entry()), { actionId: 'quote', input: { amount: 42 } });

    expect(sent.status).toBe(200);
    expect(payload).toMatchObject({ status: 'completed', output: { total: 42 } });
    expect(sent.headers['Cache-Control']).toBe('no-store');
    expect(sent.headers['X-Plitzi-Run-Id']).toEqual(expect.any(String));
  });

  it('withholds the trace from a visitor and hands it to an authoring request', async () => {
    const visitor = await call(buildConfig(entry()), { actionId: 'quote', input: { amount: 1 } });
    expect(visitor.payload.trace).toBeUndefined();

    const author = await call(buildConfig(entry()), { actionId: 'quote', input: { amount: 1 } }, { authoring: true });
    expect(author.payload.trace).toHaveLength(1);
  });

  it('answers 404 for an action this space does not have', async () => {
    const { sent, payload } = await call(buildConfig(undefined), { actionId: 'missing' });

    expect(sent.status).toBe(404);
    expect(payload.reason).toBe('not_found');
  });

  it('answers 422 when a required input is missing', async () => {
    const { sent, payload } = await call(buildConfig(entry()), { actionId: 'quote', input: {} });

    expect(sent.status).toBe(422);
    expect(payload.reason).toBe('invalid_input');
  });

  it('answers 403 when the caller lacks the declared permissions', async () => {
    const config = buildConfig(entry({ access: { mode: 'role', permissions: ['space.write'] } }));

    const { sent, payload } = await call(config, { actionId: 'quote', input: { amount: 1 } });

    expect(sent.status).toBe(403);
    expect(payload.reason).toBe('forbidden');
  });

  it('answers 508 when the lineage already names the action', async () => {
    const { sent, payload } = await call(
      buildConfig(entry()),
      { actionId: 'quote', input: { amount: 1 } },
      { lineage: ['quote'] }
    );

    expect(sent.status).toBe(508);
    expect(payload.reason).toBe('recursion');
  });

  it('refuses a second identical run while the first is still going', async () => {
    // The step parks until the test releases it, so the first run is provably still holding its key when the
    // second arrives — which is the only state single-flight is about.
    let release: () => void = () => undefined;
    const parked = new Promise<void>(resolve => {
      release = resolve;
    });
    const slow = {
      namespace: 'test',
      action: 'hang',
      title: 'Hang',
      params: {},
      run: () => parked.then(() => ({}))
    };
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      tasks: [slow]
    });
    const config = buildConfig(
      entry({
        nodes: {
          start: node('start', { type: 'trigger', action: 'call', afterNode: 'hang' }),
          hang: node('hang', { action: 'test.hang' })
        }
      })
    );
    const body = { actionId: 'quote', input: { amount: 1 } };

    const first = call(config, body, { module });
    await new Promise(resolve => setTimeout(resolve, 0));

    const second = await call(config, body, { module });
    expect(second.sent.status).toBe(409);
    expect(second.payload.reason).toBe('duplicate');

    release();
    await first;
    expect(module.guards.active()).toBe(0);
  });

  it('releases the single-flight key once the run ends', async () => {
    const config = buildConfig(entry());
    const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const body = { actionId: 'quote', input: { amount: 5 } };

    await call(config, body, { module });
    const second = await call(config, body, { module });

    expect(second.sent.status).toBe(200);
    expect(module.guards.active()).toBe(0);
  });

  it('meters one run, before it executes', async () => {
    const meter = vi.fn();
    const config = buildConfig(entry(), { adapters: { meter } });

    await call(config, { actionId: 'quote', input: { amount: 1 } });

    expect(meter).toHaveBeenCalledTimes(1);
    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ kind: 'server_action', cached: false, spaceId: 3 }));
  });

  it('does not meter a run it refused', async () => {
    const meter = vi.fn();
    const config = buildConfig(entry(), { adapters: { meter } });

    await call(config, { actionId: 'quote', input: {} });

    expect(meter).not.toHaveBeenCalled();
  });
});
