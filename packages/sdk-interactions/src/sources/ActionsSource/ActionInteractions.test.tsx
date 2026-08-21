import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionInteractions from './ActionInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

const endpoint = vi.hoisted<{ value: string | undefined }>(() => ({ value: '/_action' }));

vi.mock('@plitzi/sdk-shared/store', () => ({ useCommonStore: () => [endpoint.value] }));

const warning = vi.hoisted(() => vi.fn());
const info = vi.hoisted(() => vi.fn());
const success = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/sdk-shared/devTools/utils/PlitziConsole', () => ({ pConsole: { warning, info, success } }));

type RunCallback = (
  params: Record<string, unknown>,
  context?: { elementRef?: string }
) => Promise<Record<string, unknown>>;

const interactionTrigger = vi.fn();

const mount = () => {
  let registered: Record<string, InteractionCallback> = {};
  const interactions = {
    interactionsManager: { interactionTrigger },
    useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
      registered = callbacks ?? {};
    }
  } as unknown as InteractionsContextValue;

  render(
    <InteractionsContext value={interactions}>
      <ActionInteractions />
    </InteractionsContext>
  );

  return {
    run: registered.runServerAction.callback as unknown as RunCallback,
    cancel: registered.cancelServerAction.callback as unknown as RunCallback
  };
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(payload) }) as Response;

describe('ActionInteractions', () => {
  beforeEach(() => {
    endpoint.value = '/_action';
    warning.mockClear();
    info.mockClear();
    success.mockClear();
    interactionTrigger.mockClear();
  });

  it('posts the action by name and answers its output', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { runId: 'r1', status: 'completed', output: { total: 9 } }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await mount().run({ actionId: 'quote', input: '{"amount": 3}', mode: 'await' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { body: string }];
    expect(url).toBe('/_action');
    expect(JSON.parse(init.body)).toEqual({ actionId: 'quote', input: { amount: 3 } });
    expect(result).toEqual({ status: 'completed', runId: 'r1', output: { total: 9 } });
  });

  /** A param carrying twig is resolved before the callback runs, and the resolver hands back the result's own
   *  type — so an input with a binding in it arrives as an OBJECT. Taking only the string posted `{}`, which is
   *  every real input: the ones with no token are the exception, not the rule. */
  it('posts an input the flow engine already resolved into an object', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { runId: 'r2', status: 'completed', output: {} })));
    vi.stubGlobal('fetch', fetchMock);

    await mount().run({ actionId: 'quote', input: { city: 'Berlin', weightKg: 2 }, mode: 'await' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { body: string }];
    expect(JSON.parse(init.body)).toEqual({ actionId: 'quote', input: { city: 'Berlin', weightKg: 2 } });
  });

  it('does not wait for a detached run, and keeps it alive across a navigation', async () => {
    let settle: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          settle = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    // Resolves while the request is still in flight — that is the whole difference between the two modes.
    const result = await mount().run({ actionId: 'send-email', input: '{}', mode: 'detached' });

    expect(result).toMatchObject({ accepted: true });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.keepalive).toBe(true);

    settle(jsonResponse(200, {}));
  });

  it('reports a detached run back to the element that launched it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, { runId: 'r9', status: 'completed', output: { sent: true } })))
    );

    await mount().run({ actionId: 'send-email', input: '{}', mode: 'detached' }, { elementRef: 'button1' });
    // The step already returned; the report lands when the server answers, which is the whole point of onFlowEnd.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(interactionTrigger).toHaveBeenCalledWith(
      'button1',
      'onFlowEnd',
      expect.objectContaining({ actionId: 'send-email', runId: 'r9', status: 'completed' })
    );
  });

  // A detached run is invisible by construction: the flow returned and the page moved on. Without a log entry the
  // only honest answer to "did anything happen?" is a network tab.
  it('shows a detached run in the dev-tools log, as it starts and when it lands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, { runId: 'r1', status: 'completed', output: {} })))
    );

    await mount().run({ actionId: 'send-email', input: '{}', mode: 'detached' }, { elementRef: 'button1' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(info).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('reports a refused detached run as an error, with the server’s reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(409, { error: 'already running', reason: 'duplicate' })))
    );

    await mount().run({ actionId: 'send-email', input: '{}', mode: 'detached' }, { elementRef: 'button1' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(interactionTrigger).toHaveBeenCalledWith(
      'button1',
      'onFlowError',
      expect.objectContaining({ reason: 'duplicate' })
    );
  });

  it('names the server’s reason when a run is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(409, { error: 'already running', reason: 'duplicate' })))
    );

    const result = await mount().run({ actionId: 'quote', input: '{}', mode: 'await' });

    expect(result).toMatchObject({ status: 'failed', reason: 'duplicate' });
    expect(warning).toHaveBeenCalled();
  });

  it('cancels a run by id, and reads the server’s answer', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) } as Response)
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await mount().cancel({ runId: 'run-7' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/_action/run/run-7');
    expect(init.method).toBe('DELETE');
    expect(result).toEqual({ cancelled: true });
  });

  it('reports a run it was not allowed to cancel as not cancelled', async () => {
    // The server answers 404 for a run that is not there AND for one that is not yours: telling them apart would
    // be an oracle for which run ids are live.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response))
    );

    expect(await mount().cancel({ runId: 'someone-elses' })).toEqual({ cancelled: false });
  });

  /** A server that is down is not a server that refused: the fetch REJECTS rather than answering. Reported the
   *  same way all the same — the flow carries on with a result it can bind, and the element that fired the step
   *  hears about it — because to a page the two are one event: the run did not happen. */
  it('reports a server it could not reach as a failed run, not as a thrown step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch')))
    );

    const result = await mount().run({ actionId: 'quote', input: '{}', mode: 'await' }, { elementRef: 'button1' });

    expect(result).toMatchObject({ status: 'failed', reason: 'failed', output: {} });
    expect(warning).toHaveBeenCalled();
    expect(interactionTrigger).toHaveBeenCalledWith(
      'button1',
      'onFlowError',
      expect.objectContaining({ actionId: 'quote', reason: 'failed' })
    );
  });

  it('reports a stream it could not open the same way', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch')))
    );

    const result = await mount().run({ actionId: 'quote', input: '{}', mode: 'stream' }, { elementRef: 'button1' });

    expect(result).toMatchObject({ status: 'failed', reason: 'failed' });
    expect(interactionTrigger).toHaveBeenCalledWith(
      'button1',
      'onFlowError',
      expect.objectContaining({ reason: 'failed' })
    );
  });

  it('answers a cancellation it could not deliver as not cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch')))
    );

    expect(await mount().cancel({ runId: 'run-7' })).toEqual({ cancelled: false });
  });

  it('stays inert, and says so once, when the page has no server tier', async () => {
    endpoint.value = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await mount().run({ actionId: 'quote', input: '{}', mode: 'await' });

    expect(result).toMatchObject({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
