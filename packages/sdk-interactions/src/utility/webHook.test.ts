import { afterEach, describe, expect, it, vi } from 'vitest';

import webHook from './webHook';

const invalidateQueriesForWrite = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@plitzi/sdk-shared/queries', () => ({ invalidateQueriesForWrite }));

const send = (method: string, status = 200) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve({}) }))
  );

  return webHook.callback?.({
    url: 'https://api.test/cart/items',
    method,
    body: {},
    authorizationToken: '',
    credentials: 'same-origin'
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateQueriesForWrite.mockClear();
});

describe('webHook', () => {
  it('a write that succeeded invalidates the cached requests on its origin', async () => {
    await send('post');

    expect(invalidateQueriesForWrite).toHaveBeenCalledWith('https://api.test/cart/items');
  });

  it('a read invalidates nothing', async () => {
    await send('get');
    await send('head');

    expect(invalidateQueriesForWrite).not.toHaveBeenCalled();
  });

  it('a refused write invalidates nothing', async () => {
    await send('delete', 403);

    expect(invalidateQueriesForWrite).not.toHaveBeenCalled();
  });
});
