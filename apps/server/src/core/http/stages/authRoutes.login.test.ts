import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { loginStage } from './authRoutes';

import type { SSRRequest, SSRResponseHelpers, SSRSession } from '@plitzi/sdk-kernel/types';

const responseSpy = () => {
  const headers: Record<string, string | string[]> = {};

  return {
    res: {
      setHeader: (name: string, value: string | string[]) => {
        headers[name] = value;
      }
    } as unknown as SSRResponseHelpers,
    cookies: () => (headers['Set-Cookie'] as string[] | undefined) ?? []
  };
};

const inSeconds = (offset: number) => Math.floor(Date.now() / 1000) + offset;

const session: SSRSession = {
  token: 'access',
  expiresAt: inSeconds(3600),
  refreshToken: 'renew',
  refreshExpiresAt: inSeconds(86400)
};

describe('the login route', () => {
  const runLogin = async (adapters: Record<string, unknown>, body: string, contentType = 'application/json') => {
    const { res, cookies } = responseSpy();
    const status = { code: 0 };
    // Captured, because a status alone proved nothing about what a caller receives — this route once answered a
    // bodyless 200 and every assertion here still passed.
    const sent: string[] = [];
    const req = {
      hostname: 'app.example.com',
      method: 'POST',
      path: '/auth/login',
      headers: { 'content-type': contentType },
      query: {},
      ctx: {}
    } as unknown as SSRRequest;

    await loginStage({
      config: { adapters },
      raw: Readable.from([Buffer.from(body)]),
      req,
      res: {
        ...res,
        setStatus: (code: number) => (status.code = code),
        send: (payload: string) => sent.push(payload),
        end: vi.fn()
      }
    } as never);

    return { status, cookies, req, body: sent.length ? (JSON.parse(sent[0]) as Record<string, unknown>) : undefined };
  };

  it('hands every posted field to the adapter, because only it knows what it signs people in with', async () => {
    const authenticate = vi.fn().mockResolvedValue(session);
    const { status, cookies, body } = await runLogin(
      { authenticate },
      JSON.stringify({ email: 'ada@example.com', otp: '123456' })
    );

    expect(authenticate).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456' }, expect.anything());
    expect(status.code).toBe(200);
    expect(cookies()).toHaveLength(3);
    // The token, not just the cookies: a caller that is not a browser has nowhere to read those from.
    expect(body).toEqual({ success: true, access_token: 'access', expire_at: session.expiresAt });
  });

  it('writes nothing when the adapter refuses', async () => {
    const { status, cookies, body } = await runLogin(
      { authenticate: vi.fn().mockResolvedValue(undefined) },
      JSON.stringify({ username: 'ada', password: 'wrong' })
    );

    expect(status.code).toBe(401);
    expect(cookies()).toHaveLength(0);
    expect(body).toEqual({ error: 'Invalid credentials', reason: 'invalid' });
  });
});
