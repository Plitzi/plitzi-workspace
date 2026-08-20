import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionInteractions from './ActionInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

const endpoint = vi.hoisted<{ value: string | undefined }>(() => ({ value: '/_action' }));

vi.mock('@plitzi/sdk-shared/store', () => ({ useCommonStore: () => [endpoint.value] }));

const warning = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/sdk-shared/devTools/utils/PlitziConsole', () => ({ pConsole: { warning } }));

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

  return registered.runServerAction.callback as unknown as RunCallback;
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(payload) }) as Response;

describe('ActionInteractions', () => {
  beforeEach(() => {
    endpoint.value = '/_action';
    warning.mockClear();
    interactionTrigger.mockClear();
  });

  it('posts the action by name and answers its output', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { runId: 'r1', status: 'completed', output: { total: 9 } }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await mount()({ actionId: 'quote', input: '{"amount": 3}', mode: 'await' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { body: string }];
    expect(url).toBe('/_action');
    expect(JSON.parse(init.body)).toEqual({ actionId: 'quote', input: { amount: 3 } });
    expect(result).toEqual({ status: 'completed', runId: 'r1', output: { total: 9 } });
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
    const result = await mount()({ actionId: 'send-email', input: '{}', mode: 'detached' });

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

    await mount()({ actionId: 'send-email', input: '{}', mode: 'detached' }, { elementRef: 'button1' });
    // The step already returned; the report lands when the server answers, which is the whole point of onFlowEnd.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(interactionTrigger).toHaveBeenCalledWith(
      'button1',
      'onFlowEnd',
      expect.objectContaining({ actionId: 'send-email', runId: 'r9', status: 'completed' })
    );
  });

  it('reports a refused detached run as an error, with the server’s reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(409, { error: 'already running', reason: 'duplicate' })))
    );

    await mount()({ actionId: 'send-email', input: '{}', mode: 'detached' }, { elementRef: 'button1' });
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

    const result = await mount()({ actionId: 'quote', input: '{}', mode: 'await' });

    expect(result).toMatchObject({ status: 'failed', reason: 'duplicate' });
    expect(warning).toHaveBeenCalled();
  });

  it('stays inert, and says so once, when the page has no server tier', async () => {
    endpoint.value = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await mount()({ actionId: 'quote', input: '{}', mode: 'await' });

    expect(result).toMatchObject({ status: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
