import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUEUED_CALLS_PATH, deliverCall } from './deliverCall';

type Asked = { url: string; init: RequestInit | undefined };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** `fetch` answering each request in turn from `answers`, and remembering what it was asked. */
const answering = (...answers: (Response | Error)[]) => {
  const asked: Asked[] = [];
  const queue = [...answers];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      asked.push({ url, init });
      const next = queue.shift();
      if (!next) {
        return Promise.reject(new Error(`nothing to answer ${url}`));
      }

      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    })
  );

  return asked;
};

const call = { actionId: 'book', input: { seats: 2 } };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('delivering a call', () => {
  it('answers as the worker answered, when one did', async () => {
    const asked = answering(json(200, { runId: 'r1', status: 'completed', output: { ok: true } }));
    const onQueued = vi.fn();

    const delivered = await deliverCall({ endpoint: '/_action', call, signal: new AbortController().signal, onQueued });

    expect(delivered).toEqual({ status: 200, payload: { runId: 'r1', status: 'completed', output: { ok: true } } });
    expect(asked.map(each => each.url)).toEqual(['/_action']);
    expect(onQueued).not.toHaveBeenCalled();
  });

  // No worker behind the proxy: the page server keeps it, under a key of its own, and the page reads it once it ran.
  it('hands a call no worker answered to the page server, and waits for it to have run', async () => {
    const asked = answering(
      json(503, { error: 'no upstream' }),
      json(202, { status: 'queued', jobId: 'call:3:abc', ticket: 't-1' }),
      json(200, { status: 'queued', jobId: 'call:3:abc', attempts: 0 }),
      json(200, { status: 'completed', jobId: 'call:3:abc', runId: 'r2', output: { booked: 2 } })
    );
    const onQueued = vi.fn();

    const delivering = deliverCall({ endpoint: '/_action', call, signal: new AbortController().signal, onQueued });
    await vi.advanceTimersByTimeAsync(10_000);
    const delivered = await delivering;

    expect(delivered).toMatchObject({ status: 200, payload: { status: 'completed', output: { booked: 2 } } });
    expect(onQueued).toHaveBeenCalledTimes(1);
    expect(asked.map(each => each.url)).toEqual([
      '/_action',
      QUEUED_CALLS_PATH,
      `${QUEUED_CALLS_PATH}/call%3A3%3Aabc`,
      `${QUEUED_CALLS_PATH}/call%3A3%3Aabc`
    ]);
    const sent = asked[1]?.init?.body;
    const kept: unknown = typeof sent === 'string' ? JSON.parse(sent) : undefined;
    expect(kept).toMatchObject({
      actionId: 'book',
      idempotencyKey: expect.stringMatching(/^kept-[0-9a-f]{32}$/) as string
    });
    expect(asked[2]?.init?.headers).toEqual({ 'x-plitzi-ticket': 't-1' });
  });

  it('waits the same for a call the worker kept, its runner away', async () => {
    answering(
      json(202, { status: 'queued', jobId: 'call:3:def', ticket: 't-2' }),
      new Error('the page server restarting'),
      json(200, { status: 'failed', jobId: 'call:3:def', runId: 'r3', output: {}, error: 'No more seats' })
    );

    const delivering = deliverCall({
      endpoint: '/_action',
      call,
      signal: new AbortController().signal,
      onQueued: () => undefined
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await delivering).toMatchObject({ status: 200, payload: { status: 'failed', error: 'No more seats' } });
  });

  // A deployment that keeps no calls has nothing to add: the call failed as it would have.
  it('says the call went unanswered when nothing could keep it either', async () => {
    const down = new Error('connection refused');
    answering(down, json(404, { error: 'This server keeps no calls for later' }));

    const delivered = await deliverCall({
      endpoint: '/_action',
      call,
      signal: new AbortController().signal,
      onQueued: () => undefined
    });

    expect(delivered).toHaveProperty('unreachable');
  });
});
