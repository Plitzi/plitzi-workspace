import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { debugCookieName } from '@plitzi/sdk-shared/devTools';

import { offlineDataOf } from './testing/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';

import type { SSRServer } from '@plitzi/sdk-shared';

/**
 * Which React a page loads: the development build for the page that draws the dev tools — what the visitor chose with
 * shift+F12, within what the deployment allows — and the production one otherwise.
 */

const PORT = 39353;
const HOST = `127.0.0.1:${String(PORT)}`;

let server: SSRServer;

const vendorOf = async (cookie?: string): Promise<string | undefined> => {
  const html = await (await fetch(`http://${HOST}/`, cookie ? { headers: { cookie } } : {})).text();

  return /"react": "\/sdk-assets\/(plitzi-sdk-(?:dev-)?vendor\.js)/.exec(html)?.[1];
};

beforeAll(async () => {
  server = createServer({
    port: PORT,
    debugMode: true,
    adapters: createJsonAdapters({ offlineData: offlineDataOf() })
  });
  server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`http://${HOST}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('the React a page loads', () => {
  it('is the development build while the dev tools are drawn', async () => {
    expect(await vendorOf()).toBe('plitzi-sdk-dev-vendor.js');
  });

  // A browser that already fetched a module — a modulepreload counts — ignores an import map after it, and every bare
  // `import "react"` of the SDK then fails: a page that never hydrates, on Chrome before 133.
  it('is mapped before anything loads a module', async () => {
    const html = await (await fetch(`http://${HOST}/`)).text();
    const map = html.indexOf('<script type="importmap">');
    const firstModule = Math.min(
      ...['<link rel="modulepreload"', '<script type="module"'].map(tag => html.indexOf(tag)).filter(at => at >= 0)
    );

    expect(map).toBeGreaterThan(-1);
    expect(map).toBeLessThan(firstModule);
  });

  // Authorized, and turned off by the visitor: the page is a production page, React included.
  it('is the production build once the visitor turned the dev tools off', async () => {
    expect(await vendorOf(`${debugCookieName(HOST)}=false`)).toBe('plitzi-sdk-vendor.js');
  });
});
