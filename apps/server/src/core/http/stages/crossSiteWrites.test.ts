import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../../adapters/jsonAdapters';
import { createServer } from '../../createServer';
import { unusedPort } from '../../unusedPort';

import type { SSRContext, Stage } from '../types';
import type { OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';

/**
 * A write another site caused, refused by the page server whoever is signed in — or nobody: a tool with no sessions
 * that holds credentials of its own acts for whoever reaches it.
 *
 * Over real HTTP, through the pipeline a deployment gets: a data stage of the deployment's stands for every write after
 * the guard (actions, `/fn/` routes, a runtime's endpoints), and the adapter-only sign-in for the flows before it.
 */

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;

const offlineData = { schema: { elements: {} }, style: {} } as unknown as OfflineDataRaw;

const writes = vi.fn();
const writeStage: Stage<SSRContext> = ctx => {
  if (ctx.req.path !== '/x/op') {
    return false;
  }

  writes();
  ctx.res.setStatus(200);
  ctx.res.send('done');

  return true;
};

let server: SSRServer;

const send = (path: string, headers: Record<string, string>, method = 'POST') =>
  fetch(`${base}${path}`, { method, headers: { 'content-type': 'text/plain', ...headers } });

beforeAll(async () => {
  server = createServer(
    {
      port: PORT,
      devMode: true,
      crossSiteWrites: { origins: ['https://app.example.test'], paths: path => path === '/x/form' },
      adapters: { ...createJsonAdapters({ offlineData }), authenticate: () => Promise.resolve(undefined) }
    },
    {
      data: [
        writeStage,
        ctx => {
          if (ctx.req.path !== '/x/form') {
            return false;
          }

          ctx.res.setStatus(200);
          ctx.res.send('taken');

          return true;
        }
      ]
    }
  );
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await send('/x/op', {})).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('core/http/stages/crossSiteWrites', () => {
  it('refuses a write a browser says another site caused, with no cookie at all, and says how to allow it', async () => {
    writes.mockClear();
    const res = await send('/x/op', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.reason).toBe('foreign');
    expect(body.error).toContain('crossSiteWrites.origins');
    expect(writes).not.toHaveBeenCalled();
  });

  it('refuses one from a foreign Origin when the browser sends no Fetch Metadata', async () => {
    expect((await send('/x/op', { origin: 'https://evil.test' })).status).toBe(403);
    expect((await send('/x/op', { origin: 'null' })).status).toBe(403);
  });

  it('passes this site’s own pages, scripts and webhooks, and anything carrying Authorization', async () => {
    expect((await send('/x/op', { 'sec-fetch-site': 'same-origin', origin: base })).status).toBe(200);
    expect((await send('/x/op', { 'sec-fetch-site': 'same-site', origin: 'https://other.127.0.0.1' })).status).toBe(
      200
    );
    expect((await send('/x/op', { origin: base })).status).toBe(200);
    expect((await send('/x/op', {})).status).toBe(200);
    expect(
      (await send('/x/op', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test', authorization: 'Bearer x' }))
        .status
    ).toBe(200);
  });

  it('passes what never changes anything, from anywhere', async () => {
    expect((await send('/x/op', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' }, 'GET')).status).toBe(
      200
    );
  });

  it('passes the origins and the paths the server names', async () => {
    expect((await send('/x/op', { 'sec-fetch-site': 'cross-site', origin: 'https://app.example.test' })).status).toBe(
      200
    );
    expect((await send('/x/form', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' })).status).toBe(200);
  });

  it('refuses another site signing the visitor in or out through the page server', async () => {
    const foreign = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' };

    expect((await send('/auth/login', foreign)).status).toBe(403);
    expect((await send('/auth/logout', foreign)).status).toBe(403);
    expect((await send('/auth/login', {})).status).toBe(401);
  });
});
