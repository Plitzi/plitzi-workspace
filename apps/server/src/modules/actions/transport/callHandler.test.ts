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
    compute: node('compute', { action: 'flow.output', params: { values: '{"total": {{ input.amount }}}' } })
  },
  ...overrides
});

const entry = (overrides: Partial<ActionDocument> = {}): ActionEntry => ({
  id: 'quote',
  document: document(overrides)
});

/** A raw response the streaming path can write into, recording the frames a caller would have received. */
const buildRaw = () => {
  const written: string[] = [];
  const raw = {
    headersSent: false,
    statusCode: 200,
    setHeader: () => undefined,
    getHeaders: () => ({}),
    writeHead(status: number) {
      this.statusCode = status;
      this.headersSent = true;

      return undefined;
    },
    write: (chunk: string) => {
      written.push(chunk);

      return undefined;
    },
    end: () => undefined
  };

  return { raw, written };
};

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

/** Records how the handler asked, so the revision it passes can be asserted. */
const asked: { spaceId?: number; actionId?: string; at?: { environment: string; revision: number } }[] = [];

const buildConfig = (action: ActionEntry | undefined, extra: Record<string, unknown> = {}): SSRPageServerConfig =>
  ({
    adapters: {},
    action: {
      lookups: {
        getAction: (spaceId: number, actionId: string, at?: { environment: string; revision: number }) => {
          asked.push({ spaceId, actionId, at });

          return Promise.resolve(action);
        }
      }
    },
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
  options: {
    module?: ActionsModule;
    authoring?: boolean;
    signal?: AbortSignal;
    lineage?: string[];
    headers?: Record<string, string>;
  } = {}
) => {
  const { res, sent } = buildRes();
  const { raw, written } = buildRaw();
  const module = options.module ?? createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
  await handleActionCall({
    req: { ...request(body, options.authoring), headers: options.headers ?? {} },
    res,
    raw: raw,
    config,
    module,
    signal: options.signal ?? new AbortController().signal,
    callerId: 'ip:127.0.0.1',
    lineage: options.lineage ?? []
  });

  return { sent, written, payload: JSON.parse(sent.body || '{}') as Record<string, unknown>, module };
};

describe('handleActionCall', () => {
  // A page and the flows it calls ship together: a page published at revision 1 must call the action as it read
  // when it was published, not whatever the draft says now.
  it('reads the action as of the revision the page was published at', async () => {
    asked.length = 0;

    await call(buildConfig(entry()), { actionId: 'quote', input: { amount: 1 } });

    expect(asked[0]).toMatchObject({ actionId: 'quote', at: { environment: 'production', revision: 1 } });
  });

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

describe('handleActionCall (streaming)', () => {
  // Lowercase, as Node normalizes every inbound header name — reading `Accept` here would pass a test the real
  // request could never satisfy.
  const streaming = { accept: 'text/event-stream' };

  const frames = (written: string[]) =>
    written
      .join('')
      .split('\n\n')
      .filter(Boolean)
      .map(block => {
        const event = /event: (\w+)/.exec(block)?.[1];
        const data = /data: (.*)/.exec(block)?.[1];

        return { event, data: data ? (JSON.parse(data) as Record<string, unknown>) : undefined };
      })
      .filter(frame => frame.event);

  it('reports each step as it settles, then the result', async () => {
    const { written } = await call(
      buildConfig(entry()),
      { actionId: 'quote', input: { amount: 7 } },
      { headers: streaming }
    );

    const sent = frames(written);
    expect(sent.map(frame => frame.event)).toEqual(['node', 'done']);
    expect(sent[1].data).toMatchObject({ status: 'completed', output: { total: 7 } });
  });

  it('tells a hand-rolled EventSource to wait a day before reconnecting', async () => {
    // EventSource reconnects when a stream ENDS, success included — which without this is a run that restarts
    // itself forever. Our own client reads the stream with fetch and never reconnects at all.
    const { written } = await call(
      buildConfig(entry()),
      { actionId: 'quote', input: { amount: 1 } },
      { headers: streaming }
    );

    expect(written.join('')).toContain('retry: 86400000');
  });

  it('sends a failure as a frame, since the status line is long gone', async () => {
    const failing = entry({
      nodes: {
        start: node('start', { type: 'trigger', action: 'call', afterNode: 'boom' }),
        boom: node('boom', { action: 'flow.fail', params: { message: 'nope' } })
      }
    });

    const { written } = await call(
      buildConfig(failing),
      { actionId: 'quote', input: { amount: 1 } },
      { headers: streaming }
    );

    const sent = frames(written);
    expect(sent.at(-1)?.event).toBe('done');
    expect(sent.at(-1)?.data).toMatchObject({ status: 'failed' });
  });

  it('carries what a step emitted while it ran', async () => {
    const emitting = {
      namespace: 'test',
      action: 'progress',
      title: 'Progress',
      params: {},
      run: (_params: Record<string, unknown>, ctx: { emit: (chunk: unknown) => void }) => {
        ctx.emit({ step: 1 });
        ctx.emit({ step: 2 });

        return {};
      }
    };
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      tasks: [emitting]
    });
    const config = buildConfig(
      entry({
        nodes: {
          start: node('start', { type: 'trigger', action: 'call', afterNode: 'p' }),
          p: node('p', { action: 'test.progress' })
        }
      })
    );

    const { written } = await call(config, { actionId: 'quote', input: { amount: 1 } }, { module, headers: streaming });

    const data = frames(written).filter(frame => frame.event === 'data');
    expect(data.map(frame => (frame.data as { chunk: { step: number } }).chunk.step)).toEqual([1, 2]);
  });

  it('answers a refusal with a status code, not a stream', async () => {
    // Nothing has been written yet at that point, so the caller still gets a code it can act on.
    const { sent, written } = await call(
      buildConfig(entry()),
      { actionId: 'quote', input: {} },
      { headers: streaming }
    );

    expect(sent.status).toBe(422);
    expect(written).toEqual([]);
  });
});
