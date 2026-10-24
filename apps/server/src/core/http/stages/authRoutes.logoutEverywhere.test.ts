import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { createServer } from '../../createServer';
import { unusedPort } from '../../unusedPort';

import type { OfflineDataRaw, SessionScope, SSRRequest, SSRServer } from '@plitzi/sdk-shared';

/**
 * A page signing its person out on every device, through the page server: `site`, the sessions signed in on its host —
 * a space's visitor ending theirs there; `all`, every one of the account. Over real HTTP, through the pipeline a
 * deployment gets.
 */

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

const endSessions = vi.fn<(req: SSRRequest, scope: SessionScope) => Promise<boolean>>(req =>
  Promise.resolve(req.headers.cookie?.includes('test_session=') === true)
);

let server: SSRServer;

const send = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/auth/logout-everywhere`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

beforeAll(async () => {
  server = createServer({
    port: PORT,
    devMode: true,
    authCookie: { name: 'test_session' },
    adapters: { ...createJsonAdapters({ offlineData }), endSessions }
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await send({})).status).toBe(400);
  });
});

afterAll(async () => {
  await server.close();
});

describe('signing out everywhere, through the page server', () => {
  it('ends the sessions the scope names, and clears this browser’s', async () => {
    const res = await send({ scope: 'site' }, { cookie: 'test_session=abc' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scope: 'site', ended: true });
    expect(endSessions.mock.calls.at(-1)?.[1]).toBe('site');
    expect(res.headers.getSetCookie().some(cookie => /^test_session=;/u.test(cookie))).toBe(true);
  });

  it('refuses a scope it was not told, and says nobody was signed in', async () => {
    const unsaid = await send({}, { cookie: 'test_session=abc' });
    expect(unsaid.status).toBe(400);
    expect(await unsaid.json()).toMatchObject({ reason: 'invalid' });

    const nobody = await send({ scope: 'all' });
    expect(nobody.status).toBe(401);
    expect(await nobody.json()).toMatchObject({ reason: 'missing' });
  });

  it('refuses another site signing the visitor out', async () => {
    const res = await send(
      { scope: 'all' },
      { cookie: 'test_session=abc', 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' }
    );

    expect(res.status).toBe(403);
  });
});
