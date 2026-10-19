import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';
import { createActionsModule } from '../modules/actions';
import { createIsolateRunner } from '../modules/functions/sandbox/isolate';
import { functionsInHand } from '../modules/functions/space';
import { offlineDataOf } from '../modules/ssr/tests/offlineData';

import type { SpaceFunctions } from '../modules/functions/protocol';
import type { SSRServer } from '@plitzi/sdk-shared';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(() => Promise.resolve([{ address: '203.0.113.10', family: 4 }]))
}));

/**
 * `ctx.oauth` the whole way, through the server a deployment gets: a space's code in the sandbox declares one connection
 * as data, sends the visitor to consent, the platform answers `/fn/oauth/callback` and keeps the tokens sealed, and the
 * code reaches the provider's API without ever holding one. The provider is a `fetch` of the test's — any provider.
 */

const PORT = await unusedPort();
const BASE = `http://127.0.0.1:${String(PORT)}`;
const ISSUER = 'https://id.example.test';

const codes = new Map<string, string>();
// The server's own fetch is the global one: the provider's hosts answered here, everything else as it would be.
const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The provider: OpenID metadata, a token for the verifier its code was issued to, an API for that token. */
const provider = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  if (url.href === `${ISSUER}/.well-known/openid-configuration`) {
    return Promise.resolve(json({ authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token` }));
  }

  if (url.href === `${ISSUER}/token`) {
    const challenge = createHash('sha256')
      .update(form.get('code_verifier') ?? '')
      .digest('base64url');
    const known = codes.get(form.get('code') ?? '') === challenge && form.get('client_secret') === 'shh';

    return Promise.resolve(
      known ? json({ access_token: 'the-access', expires_in: 3600 }) : json({ error: 'invalid_grant' }, 400)
    );
  }

  if (url.href === 'https://api.example.test/me') {
    const auth = new Headers(init?.headers).get('authorization');

    return Promise.resolve(auth === 'Bearer the-access' ? json({ name: 'Ana' }) : json({ error: 'no' }, 401));
  }

  return realFetch(input, init);
};

const SPACE_SOURCE = {
  'index.ts': `export default {
  allow: { hosts: ['api.example.test'] },
  oauth: {
    calendar: { issuer: '${ISSUER}', credential: 'calendar-app', scopes: ['read'] },
    player: { issuer: '${ISSUER}', credential: 'calendar-app', exposeToken: true }
  },
  routes: {
    'GET /connect': async (request, ctx) => {
      const { url } = await ctx.oauth.connect('calendar', { returnTo: '/done', owner: 'space' });
      return new Response(null, { status: 302, headers: { location: url } });
    },
    'GET /me': async (request, ctx) => {
      const answer = await ctx.oauth.fetch('calendar', 'https://api.example.test/me', { owner: 'space' });
      return Response.json({ status: answer.status, body: await answer.json(), connection: await ctx.oauth.status('calendar', { owner: 'space' }) });
    },
    'GET /peek': async (request, ctx) => Response.json({ kept: await ctx.kv.get('plitzi:oauth:token:calendar:space') }),
    'GET /connect-player': async (request, ctx) => {
      const { url } = await ctx.oauth.connect('player', { returnTo: '/', owner: 'space' });
      return new Response(null, { status: 302, headers: { location: url } });
    },
    'GET /token': async (request, ctx) => {
      const name = new URL(request.url).searchParams.get('of');
      try {
        return Response.json(await ctx.oauth.token(name, { owner: 'space' }));
      } catch (error) {
        return Response.json({ refused: error.message }, { status: 403 });
      }
    }
  }
};`
};

let server: SSRServer;

beforeAll(async () => {
  vi.stubGlobal('fetch', provider);
  const runner = createIsolateRunner();
  const prepared = await createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner }
  }).prepareFunctions(SPACE_SOURCE);
  if (!prepared.ok) {
    throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
  }

  const functions: SpaceFunctions = functionsInHand(prepared.functions);
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: offlineDataOf() }),
    action: {
      lookups: {
        getAction: () => Promise.resolve(undefined),
        getFunctions: () => Promise.resolve(functions),
        getCredential: (_spaceId, id) =>
          Promise.resolve(id === 'calendar-app' ? { clientId: 'app-id', clientSecret: 'shh' } : undefined)
      },
      signingSecret: 'a-deployment-secret-of-32-chars!',
      jobs: false
    },
    functions: { runner }
  });
  await server.listen(PORT, '127.0.0.1');
});

afterAll(async () => {
  await server.close();
  vi.unstubAllGlobals();
});

describe('ctx.oauth through the server', () => {
  it('connects, comes back through the platform, and reaches the API with a token the code never holds', async () => {
    const start = await realFetch(`${BASE}/fn/connect`, { redirect: 'manual' });
    expect(start.status).toBe(302);
    const consent = new URL(start.headers.get('location') ?? '');
    expect(consent.searchParams.get('redirect_uri')).toBe(`${BASE}/fn/oauth/callback`);

    const code = 'code-1';
    codes.set(code, consent.searchParams.get('code_challenge') ?? '');
    const back = await realFetch(
      `${BASE}/fn/oauth/callback?${new URLSearchParams({ state: consent.searchParams.get('state') ?? '', code }).toString()}`,
      { redirect: 'manual' }
    );
    expect(back.status).toBe(303);
    expect(back.headers.get('location')).toBe('/done?oauth=calendar&oauth_result=connected');

    expect(await (await realFetch(`${BASE}/fn/me`)).json()).toEqual({
      status: 200,
      body: { name: 'Ana' },
      connection: { connected: true, expiresAt: expect.any(Number) as unknown }
    });
    const { kept } = (await (await realFetch(`${BASE}/fn/peek`)).json()) as { kept: unknown };
    expect(typeof kept).toBe('string');
    expect(String(kept)).not.toContain('the-access');
  });

  it('hands the code the access token of a connection that exposes it, and of no other', async () => {
    const consent = new URL(
      (await realFetch(`${BASE}/fn/connect-player`, { redirect: 'manual' })).headers.get('location') ?? ''
    );
    codes.set('code-2', consent.searchParams.get('code_challenge') ?? '');
    await realFetch(
      `${BASE}/fn/oauth/callback?${new URLSearchParams({ state: consent.searchParams.get('state') ?? '', code: 'code-2' }).toString()}`,
      { redirect: 'manual' }
    );

    expect(await (await realFetch(`${BASE}/fn/token?of=player`)).json()).toEqual({
      token: 'the-access',
      type: 'Bearer',
      expiresAt: expect.any(Number) as unknown
    });
    expect(await (await realFetch(`${BASE}/fn/token?of=calendar`)).json()).toEqual({
      refused: expect.stringContaining('keeps its token on the server') as unknown
    });
  });

  it('answers a visit back with no consent under way, sending the visitor nowhere', async () => {
    const stray = await realFetch(`${BASE}/fn/oauth/callback?state=nobody&code=x`, { redirect: 'manual' });

    expect(stray.status).toBe(400);
    expect(await stray.text()).toContain('expired or was already used');
  });
});
