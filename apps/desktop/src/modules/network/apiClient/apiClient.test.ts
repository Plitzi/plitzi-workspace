import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from './apiClient';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clientWith = (fetcher: typeof fetch) => createApiClient({ baseUrl: 'https://api.test', fetcher });

describe('the desktop API client', () => {
  it('presents the session as a bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { ok: 1 }));
    await clientWith(fetcher as unknown as typeof fetch).request({ path: '/spaces', token: 'tok' });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('sends no credentials at all when it has none', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await clientWith(fetcher as unknown as typeof fetch).request({ path: '/auth/session' });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('builds the query string from what it was given, dropping what it was not', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await clientWith(fetcher as unknown as typeof fetch).request({
      path: '/spaces',
      query: { scope: 'owner', workspaceId: undefined }
    });

    expect((fetcher.mock.calls[0] as [string])[0]).toBe('https://api.test/spaces?scope=owner');
  });

  /**
   * A desktop app is offline as a matter of course. "The request never reached anyone" has to be a value the UI
   * can render, not an exception every call site has to remember to catch.
   */
  it('answers an unreachable server rather than throwing', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await clientWith(fetcher as unknown as typeof fetch).request({ path: '/spaces' });

    expect(result).toEqual({ ok: false, status: 0, reason: 'unreachable' });
  });

  it('carries the reason a 401 came with, which is what tells sessions apart', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(401, { reason: 'expired' }));
    const result = await clientWith(fetcher as unknown as typeof fetch).request({ path: '/auth/session' });

    expect(result).toEqual({ ok: false, status: 401, reason: 'expired', error: undefined });
  });

  it('survives a proxy that answers in HTML', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    const result = await clientWith(fetcher as unknown as typeof fetch).request({ path: '/spaces' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  it('reads a 204 as success with nothing in it', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await clientWith(fetcher as unknown as typeof fetch).request({ path: '/x', method: 'DELETE' });

    expect(result).toEqual({ ok: true, status: 204, data: undefined });
  });
});
