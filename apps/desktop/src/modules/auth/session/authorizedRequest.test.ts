import { describe, expect, it, vi } from 'vitest';

import { authorizedRequest } from './authorizedRequest';

import type { ApiResult } from '@pmodules/network';

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, status: 200, data });
const unauthorized = <T>(): ApiResult<T> => ({ ok: false, status: 401, reason: 'revoked' });
const failed = <T>(status: number): ApiResult<T> => ({ ok: false, status, error: 'boom' });

const deps = <T>(overrides: Partial<Parameters<typeof authorizedRequest<T>>[0]> = {}) => ({
  send: vi.fn(() => Promise.resolve(ok('spaces' as unknown as T))),
  token: vi.fn(() => Promise.resolve<string | undefined>('access')),
  renew: vi.fn(() => Promise.resolve<string | undefined>('renewed')),
  endSession: vi.fn(() => Promise.resolve()),
  ...overrides
});

describe('a request that carries the session', () => {
  it('sends the credential and hands the answer back untouched', async () => {
    const options = deps<string>();

    const result = await authorizedRequest(options);

    expect(result).toEqual(ok('spaces'));
    expect(options.send).toHaveBeenCalledExactlyOnceWith('access');
    expect(options.renew).not.toHaveBeenCalled();
  });

  /**
   * The failure that has to end somewhere. Everything below this line is about a session the server has stopped
   * accepting while this window still believes in it — which its own clock cannot notice, ever.
   */
  it('renews on a 401 and sends it again, because the likeliest cause is a session that died early', async () => {
    const send = vi
      .fn<(token: string) => Promise<ApiResult<string>>>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok('spaces'));
    const options = deps<string>({ send });

    const result = await authorizedRequest(options);

    expect(result).toEqual(ok('spaces'));
    expect(send.mock.calls.map(call => call[0])).toEqual(['access', 'renewed']);
    expect(options.endSession).not.toHaveBeenCalled();
  });

  it('ends the session when the renewal is refused, so the window is not stuck on an error', async () => {
    const options = deps<string>({
      send: vi.fn(() => Promise.resolve(unauthorized<string>())),
      renew: vi.fn(() => Promise.resolve(undefined))
    });

    const result = await authorizedRequest(options);

    expect(result.status).toBe(401);
    expect(options.endSession).toHaveBeenCalledOnce();
  });

  /** A refresh token can be alive and the session it mints still be refused — a key rotated, an account disabled. */
  it('ends the session when a renewed credential is refused too', async () => {
    const options = deps<string>({ send: vi.fn(() => Promise.resolve(unauthorized<string>())) });

    await authorizedRequest(options);

    expect(options.send).toHaveBeenCalledTimes(2);
    expect(options.endSession).toHaveBeenCalledOnce();
  });

  // Answering the same refusal with the same question. Once is a recovery; twice is a loop.
  it('renews once and no more', async () => {
    const options = deps<string>({ send: vi.fn(() => Promise.resolve(unauthorized<string>())) });

    await authorizedRequest(options);

    expect(options.renew).toHaveBeenCalledOnce();
  });

  /**
   * A desktop app is offline as a matter of course, and a server can be having a bad minute. Neither says anything
   * about the credential — signing somebody out for a closed laptop lid is the worst answer available.
   */
  it.each([
    ['a server error', 500],
    ['a request that never arrived', 0],
    ['a refusal about permission rather than identity', 403]
  ])('leaves %s alone', async (_label, status) => {
    const options = deps<string>({ send: vi.fn(() => Promise.resolve(failed<string>(status))) });

    const result = await authorizedRequest(options);

    expect(result.status).toBe(status);
    expect(options.renew).not.toHaveBeenCalled();
    expect(options.endSession).not.toHaveBeenCalled();
  });

  it('makes no request when there is no session, and answers in the words the server would have used', async () => {
    const options = deps<string>({ token: vi.fn(() => Promise.resolve(undefined)) });

    const result = await authorizedRequest(options);

    expect(result).toEqual({ ok: false, status: 401, reason: 'missing' });
    expect(options.send).not.toHaveBeenCalled();
  });
});
