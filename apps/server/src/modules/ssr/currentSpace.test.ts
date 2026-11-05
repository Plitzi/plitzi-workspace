import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { offlineDataOf } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';

import type { SSRServer } from '../../types';
import type { SSRMeterDecision, SSRMeterEvent, SSRSpaceDeployment } from '@plitzi/sdk-kernel/types';

/**
 * `/_plitzi/space.json` over real HTTP: the space as it is now, for a page that renders it itself — the same document a
 * page drawn here fetches, with the decision about this visit beside it. The space is the one the request resolves
 * to: here, the host's; in the second server, one a credential chose (`renderGrant`), as a published site asks.
 */

const unstyled = offlineDataOf();
// Styled: a space with no rules has no stylesheet to link or to carry.
const offlineData = { ...unstyled, style: { ...unstyled.style, cache: '.hero{color:red}' } };
type Answer = { space: { style: { cache: string; cacheHref?: string } }; visit: Record<string, boolean> };

const start = async (adapters: Parameters<typeof createServer>[0]['adapters']) => {
  const port = await unusedPort();
  const server = createServer({ port, devMode: true, adapters });
  await server.listen(port, '127.0.0.1');
  const base = `http://127.0.0.1:${String(port)}`;
  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });

  return { server, base };
};

describe('the space as it is now, for the host’s own pages', () => {
  let server: SSRServer;
  let base: string;
  const meter = vi.fn<(event: SSRMeterEvent) => Promise<SSRMeterDecision>>(() =>
    Promise.resolve({ badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' } })
  );

  beforeAll(async () => {
    ({ server, base } = await start({ ...createJsonAdapters({ offlineData }), meter }));
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers the document a drawn page fetches, its stylesheet linked, and the visit beside it', async () => {
    const response = await fetch(`${base}/_plitzi/space.json`);
    const body = (await response.json()) as Answer;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(body.space.style.cache).toBe('');
    expect(body.space.style.cacheHref).toMatch(/^\/_plitzi\/style\/[\w-]+\.css$/);
    expect(body.visit).toEqual({
      badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' }
    });
  });

  it('counts each load as a visit, and answers one asked again unchanged with a 304', async () => {
    meter.mockClear();
    const first = await fetch(`${base}/_plitzi/space.json`);
    const etag = first.headers.get('etag') ?? '';
    const again = await fetch(`${base}/_plitzi/space.json`, { headers: { 'if-none-match': etag } });

    expect(etag).toMatch(/^"[\w-]+\.[\w-]+"$/);
    expect(again.status).toBe(304);
    expect(meter).toHaveBeenCalledTimes(2);
    expect(meter.mock.calls[0][0]).toMatchObject({ kind: 'page_view', spaceId: 1, environment: 'main' });
  });

  it('answers no other origin: a page of another reads it with the space’s credential', async () => {
    const response = await fetch(`${base}/_plitzi/space.json`, { headers: { origin: 'https://elsewhere.example' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('lets a page of another origin ask with its credential — the request after it is what is checked', async () => {
    const response = await fetch(`${base}/_plitzi/space.json`, {
      method: 'OPTIONS',
      headers: { origin: 'https://acme.com', 'access-control-request-headers': 'authorization' }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://acme.com');
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization');
  });

  it('carries the stylesheet to a page that asks, and serves no other environment than the host’s', async () => {
    const carried = (await (await fetch(`${base}/_plitzi/space.json?style=carried`)).json()) as Answer;
    const other = await fetch(`${base}/_plitzi/space.json?environment=production`);

    expect(carried.space.style.cache).toBe('.hero{color:red}');
    expect(carried.space.style.cacheHref).toBeUndefined();
    expect(other.status).toBe(400);
    expect(((await other.json()) as { error: string }).error).toMatch(
      /serves the main environment .* render credential/
    );
  });

  it('holds back a visit the deployment holds back, in its words', async () => {
    meter.mockResolvedValueOnce({ unavailable: 'This site is paused.' });
    const response = await fetch(`${base}/_plitzi/space.json`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'This site is paused.', reason: 'unavailable' });
  });
});

describe('the space as it is now, for a page that asked with its credential', () => {
  let server: SSRServer;
  let base: string;

  beforeAll(async () => {
    const json = createJsonAdapters({ offlineData });
    // What `renderGrant` resolves a credentialed request to: the space it names, and the origins it was granted for.
    const getSpaceDeployment = (): Promise<SSRSpaceDeployment> =>
      Promise.resolve({ spaceId: 1, environment: 'main', revision: 0, grantOrigins: ['https://acme.com'] });
    ({ server, base } = await start({
      ...json,
      getSpaceDeployment,
      meter: () =>
        Promise.resolve({
          degrade: true,
          badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' }
        })
    }));
  });

  afterAll(async () => {
    await server.close();
  });

  it('is answered to the page’s origin, its stylesheet carried, and the visit says the space is over its quota', async () => {
    const response = await fetch(`${base}/_plitzi/space.json`, { headers: { origin: 'https://acme.com' } });
    const body = (await response.json()) as Answer;

    expect(response.headers.get('access-control-allow-origin')).toBe('https://acme.com');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    // Linked, it would be asked for of this host by a page of another, and answered with the host's own space.
    expect(body.space.style.cacheHref).toBeUndefined();
    expect(body.space.style.cache).toBe('.hero{color:red}');
    expect(body.visit).toEqual({
      overQuota: true,
      badge: { madeWith: 'https://plitzi.test', report: 'https://plitzi.test/report-abuse' }
    });
  });
});
