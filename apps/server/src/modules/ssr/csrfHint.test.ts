import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { csrfHintFor } from './csrfHint';
import { offlineDataOf } from './tests/offlineData';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';

import type { SSRPageServerConfig, SSRServer } from '../../types';

/**
 * A page of a space trusted to carry its visitors' sessions to the deployment's own APIs is told which APIs ask for the
 * CSRF token, and which cookie holds it — so its writes there echo it. Any other page is told nothing.
 */

const API = 'https://api.example.test';

const configWith = (visitorCredentials: NonNullable<SSRPageServerConfig['rsc']>['visitorCredentials']) =>
  ({ rsc: { visitorCredentials } }) as SSRPageServerConfig;

const space = { spaceId: 1, environment: 'main' as const };

describe('csrfHintFor', () => {
  it('names each API and the cookie it keeps the token in', async () => {
    const hint = await csrfHintFor(configWith({ origins: [API], csrfPath: '/auth/csrf' }), space);

    expect(JSON.parse(hint ?? '{}')).toEqual({
      apis: [{ origin: API, cookie: 'plitzi_session_csrf' }],
      path: '/auth/csrf'
    });
  });

  // A customer's space on a platform that serves its own beside them: its visitors' sessions are not its to carry.
  it('tells a space not trusted with its visitors’ sessions nothing', async () => {
    const config = configWith({ origins: [API], csrfPath: '/auth/csrf', spaces: ({ spaceId }) => spaceId === 2 });

    expect(await csrfHintFor(config, space)).toBeUndefined();
  });

  it('tells nothing where the deployment names no place to hand a token out', async () => {
    expect(await csrfHintFor(configWith({ origins: [API] }), space)).toBeUndefined();
    expect(await csrfHintFor({} as SSRPageServerConfig, space)).toBeUndefined();
  });
});

const PORT = await unusedPort();
const base = `http://127.0.0.1:${String(PORT)}`;
let server: SSRServer;

beforeAll(async () => {
  const offlineData = offlineDataOf();
  server = createServer({
    port: PORT,
    devMode: true,
    rsc: { visitorCredentials: { origins: [API], csrfPath: '/auth/csrf' } },
    adapters: { ...createJsonAdapters({ offlineData }), getOfflineData: () => Promise.resolve(offlineData) }
  });
  await server.listen(PORT, '127.0.0.1');

  await vi.waitFor(async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('a page’s CSRF hint', () => {
  it('is a meta tag in its head, the hint escaped as an attribute', async () => {
    const html = await (await fetch(`${base}/`)).text();
    const content = /<meta name="plitzi-csrf" content="([^"]+)" \/>/.exec(html)?.[1] ?? '';

    expect(content.replaceAll('&#34;', '"')).toBe(
      JSON.stringify({ apis: [{ origin: API, cookie: 'plitzi_session_csrf' }], path: '/auth/csrf' })
    );
  });
});
