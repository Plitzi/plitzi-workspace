import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../createServer';
import { unusedPort } from '../unusedPort';
import { DEFAULT_ROBOTS_TXT } from './robotsTxt';

import type { OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';

/** A space's /robots.txt: its own, or one that lets crawlers read everything — never its page for an unknown address. */

let server: SSRServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const serve = async (settings: Record<string, unknown>): Promise<string> => {
  const port = await unusedPort();
  const offlineData = { schema: { elements: {}, flat: {}, settings }, style: {} } as unknown as OfflineDataRaw;
  server = createServer({
    port,
    devMode: true,
    adapters: { ...createJsonAdapters({ offlineData }), authenticate: () => Promise.resolve(undefined) }
  });
  await server.listen(port, '127.0.0.1');
  const base = `http://127.0.0.1:${String(port)}`;
  await vi.waitFor(async () => {
    expect((await fetch(`${base}/robots.txt`)).status).toBeLessThan(500);
  });

  return base;
};

describe('a space’s /robots.txt', () => {
  it('is the space’s own, as plain text', async () => {
    const base = await serve({ customCss: '', robotsTxt: 'User-agent: *\nDisallow: /overlay' });
    const answer = await fetch(`${base}/robots.txt`);

    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-type')).toContain('text/plain');
    expect(await answer.text()).toBe('User-agent: *\nDisallow: /overlay\n');
  });

  it('lets crawlers read everything when the space says nothing', async () => {
    const base = await serve({ customCss: '' });

    expect(await (await fetch(`${base}/robots.txt`)).text()).toBe(DEFAULT_ROBOTS_TXT);
  });
});
