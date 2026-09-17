import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryCache } from '@plitzi/sdk-shared/queries';

import webHook from './webHook';

const invalidateAfterWrite = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@plitzi/sdk-shared/queries', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/queries')>()),
  invalidateAfterWrite
}));

const fetchMock = vi.fn();

const send = (params: Record<string, unknown>, status = 200) => {
  fetchMock.mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve({ at: fetchMock.mock.calls.length })
  });

  return (webHook.callback as (values: Record<string, unknown>) => Promise<{ response: unknown }>)({
    url: 'https://api.test/cart/items',
    method: 'get',
    body: {},
    authorizationToken: '',
    credentials: 'same-origin',
    ...params
  });
};

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  await queryCache.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateAfterWrite.mockClear();
});

describe('webHook', () => {
  it('is declared from its spec, params and all', () => {
    expect(webHook).toMatchObject({ action: 'webHook', type: 'utility' });
    expect(Object.keys(webHook.params as object)).toEqual(
      expect.arrayContaining(['url', 'method', 'cache', 'staleTime', 'invalidateQueries', 'invalidateElements'])
    );
  });

  it('refreshes what a successful write asked for, the site it wrote to by default', async () => {
    await send({ method: 'post' });
    expect(invalidateAfterWrite).toHaveBeenLastCalledWith({
      mode: undefined,
      fallback: 'origin',
      elements: undefined,
      url: 'https://api.test/cart/items'
    });

    await send({ method: 'delete', invalidateQueries: 'elements', invalidateElements: ['cart'] });
    expect(invalidateAfterWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'elements', elements: ['cart'] })
    );
  });

  it('a read or a refused write refreshes nothing', async () => {
    await send({ method: 'get' });
    await send({ method: 'head' });
    await send({ method: 'delete' }, 403);

    expect(invalidateAfterWrite).not.toHaveBeenCalled();
  });

  it('sends a head without a body', async () => {
    await send({ method: 'head', body: { a: '1' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('asks every time for an uncached read', async () => {
    await send({});
    await send({});

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves a cached read from the query cache while it is fresh', async () => {
    const first = await send({ cache: true, staleTime: 60 });
    const second = await send({ cache: true, staleTime: '60' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first).toEqual({ response: { status: 200, data: { at: 1 } } });
  });

  it('does not keep a refused read', async () => {
    await send({ cache: true }, 500);
    await send({ cache: true }, 500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
