import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { oauthCallback, oauthFor } from './oauth';
import { createKvStore } from '../actions/runtime/kvStore';
import { createMemoryKv } from '../actions/runtime/memoryKv';
import { namespaceKv } from '../actions/runtime/namespaceKv';
import { createSigning } from '../actions/runtime/signing';

import type { OAuthRun } from './oauth';
import type { FunctionOAuthConnection, SSRUser } from '@plitzi/sdk-shared';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(() => Promise.resolve([{ address: '203.0.113.10', family: 4 }]))
}));

/**
 * `ctx.oauth` against a provider that is only a `fetch`: it publishes OpenID metadata, issues a code for the PKCE
 * challenge it was shown, renews with a refresh token, serves an API to a bearer and revokes. No provider is known by
 * name — the connection is data.
 */

const ISSUER = 'https://id.example.test';
const API = 'https://api.example.test/me';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const provider = () => {
  const tokenRequests: URLSearchParams[] = [];
  const revoked: string[] = [];
  const codes = new Map<string, string>();
  let generation = 1;
  let valid = 'access-1';

  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    switch (url.href) {
      case `${ISSUER}/.well-known/openid-configuration`:
        return Promise.resolve(
          json({
            authorization_endpoint: `${ISSUER}/authorize`,
            token_endpoint: `${ISSUER}/token`,
            revocation_endpoint: `${ISSUER}/revoke`
          })
        );
      case `${ISSUER}/token`: {
        const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
        tokenRequests.push(form);
        if (form.get('client_id') !== 'app-id' || form.get('client_secret') !== 'shh') {
          return Promise.resolve(json({ error: 'invalid_client' }, 401));
        }

        if (form.get('grant_type') === 'authorization_code') {
          const challenge = createHash('sha256')
            .update(form.get('code_verifier') ?? '')
            .digest('base64url');
          if (codes.get(form.get('code') ?? '') !== challenge) {
            return Promise.resolve(
              json({ error: 'invalid_grant', error_description: 'the verifier does not match' }, 400)
            );
          }

          return Promise.resolve(
            json({
              access_token: valid,
              refresh_token: 'refresh-1',
              expires_in: 3600,
              token_type: 'bearer',
              scope: 'read'
            })
          );
        }

        generation += 1;
        valid = `access-${String(generation)}`;

        return Promise.resolve(json({ access_token: valid, expires_in: 3600, token_type: 'Bearer' }));
      }

      case `${ISSUER}/revoke`:
        revoked.push(new URLSearchParams(typeof init?.body === 'string' ? init.body : '').get('token') ?? '');

        return Promise.resolve(new Response(null, { status: 200 }));
      case API: {
        const auth = new Headers(init?.headers).get('authorization');

        return Promise.resolve(auth === `Bearer ${valid}` ? json({ name: 'Ana' }) : json({ error: 'expired' }, 401));
      }

      default:
        return Promise.resolve(new Response('not here', { status: 404 }));
    }
  };

  return {
    // The provider's whole surface, a function a test hands in where the server's own fetch would be.
    fetch: fetchImpl,
    tokenRequests,
    revoked,
    /** The provider showing the consent: a code for the challenge the URL carried. */
    issue: (consent: URL): string => {
      const code = `code-${String(codes.size + 1)}`;
      codes.set(code, consent.searchParams.get('code_challenge') ?? '');

      return code;
    },
    /** The token handed out stops working (the provider rotated it): the API answers 401 until renewed. */
    rotate: () => {
      valid = 'access-rotated';
    }
  };
};

const signing = createSigning('a-deployment-secret-of-32-chars!')({ spaceId: 7, environment: 'main' });
// What `ctx.oauth` reads of a visitor is their id: the rest of a session is not this test's.
const ana = { id: 3, username: 'ana' } as SSRUser;

const CONNECTIONS: Record<string, FunctionOAuthConnection> = {
  calendar: {
    issuer: ISSUER,
    credential: 'calendar-app',
    scopes: ['read', 'offline'],
    authorizeParams: { prompt: 'consent' }
  },
  player: { issuer: ISSUER, credential: 'calendar-app', exposeToken: true }
};

describe('ctx.oauth', () => {
  let upstream: ReturnType<typeof provider>;
  let run: OAuthRun;
  const oauth = (over: Partial<OAuthRun> = {}) => oauthFor({ ...run, ...over }, CONNECTIONS, () => undefined);

  /** Consent given and the visitor back: what the provider and the browser do between `connect` and the callback. */
  const connected = async (owner?: string): Promise<Response> => {
    const { url } = await oauth().connect('calendar', { returnTo: '/settings?tab=apps', ...(owner ? { owner } : {}) });
    const consent = new URL(url);

    return oauthCallback(
      run,
      new URLSearchParams({ state: consent.searchParams.get('state') ?? '', code: upstream.issue(consent) })
    );
  };

  beforeEach(() => {
    upstream = provider();
    run = {
      fetch: upstream.fetch,
      kv: namespaceKv(createKvStore(createMemoryKv()), 7),
      credential: id =>
        Promise.resolve(id === 'calendar-app' ? { clientId: 'app-id', clientSecret: 'shh' } : undefined),
      seal: signing.seal,
      open: signing.open,
      origin: 'https://shop.example.test',
      user: ana,
      signal: new AbortController().signal
    };
  });

  it('sends the visitor to the provider its issuer publishes, with PKCE, a state and what it asked for', async () => {
    const consent = new URL((await oauth().connect('calendar', { returnTo: '/settings' })).url);

    expect(`${consent.origin}${consent.pathname}`).toBe(`${ISSUER}/authorize`);
    expect(Object.fromEntries(consent.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'app-id',
      redirect_uri: 'https://shop.example.test/fn/oauth/callback',
      code_challenge_method: 'S256',
      scope: 'read offline',
      prompt: 'consent'
    });
    expect(consent.searchParams.get('state')).toMatch(/^[\w-]{32}$/);
  });

  it('exchanges the code for the verifier it made, keeps the tokens sealed, and sends the visitor back', async () => {
    const back = await connected();

    expect(back.status).toBe(303);
    expect(back.headers.get('location')).toBe('/settings?tab=apps&oauth=calendar&oauth_result=connected');
    expect(upstream.tokenRequests[0].get('redirect_uri')).toBe('https://shop.example.test/fn/oauth/callback');
    const kept = await run.kv.get('plitzi:oauth:token:calendar:user:3');
    expect(typeof kept).toBe('string');
    expect(String(kept)).not.toContain('access-1');
    expect(await oauth().status('calendar')).toMatchObject({ connected: true, scopes: ['read'] });
  });

  /** A state is spent by the visit that brings it: a replayed callback finds nothing. */
  it('takes a consent once, and answers a callback it never started without sending the visitor anywhere', async () => {
    const { url } = await oauth().connect('calendar', { returnTo: '/settings' });
    const consent = new URL(url);
    const query = new URLSearchParams({
      state: consent.searchParams.get('state') ?? '',
      code: upstream.issue(consent)
    });

    expect((await oauthCallback(run, query)).status).toBe(303);
    const again = await oauthCallback(run, query);
    expect(again.status).toBe(400);
    expect(again.headers.get('location')).toBeNull();
  });

  it('sends the visitor back saying why, when the provider or the exchange refused', async () => {
    const { url } = await oauth().connect('calendar', { returnTo: '/settings' });
    const state = new URL(url).searchParams.get('state') ?? '';
    const denied = await oauthCallback(run, new URLSearchParams({ state, error: 'access_denied' }));
    expect(denied.headers.get('location')).toBe('/settings?oauth=calendar&oauth_error=access_denied');

    const second = new URL((await oauth().connect('calendar', { returnTo: '/settings' })).url);
    const forged = await oauthCallback(
      run,
      new URLSearchParams({ state: second.searchParams.get('state') ?? '', code: 'a-code-for-another-challenge' })
    );
    expect(forged.headers.get('location')).toContain('oauth_error=');
    expect(await oauth().status('calendar')).toEqual({ connected: false });
  });

  it('writes the token into a request to the API, renewing it on a 401 once', async () => {
    await connected();

    expect(await (await oauth().fetch('calendar', API)).json()).toEqual({ name: 'Ana' });
    upstream.rotate();
    const answer = await oauth().fetch('calendar', API);
    expect(answer.status).toBe(200);
    expect(upstream.tokenRequests.at(-1)?.get('grant_type')).toBe('refresh_token');
    expect(upstream.tokenRequests.at(-1)?.get('refresh_token')).toBe('refresh-1');
  });

  it('renews a token about to lapse before it is used', async () => {
    await connected();
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 3_600_000);
    try {
      expect((await oauth().fetch('calendar', API)).status).toBe(200);
      expect(upstream.tokenRequests.map(form => form.get('grant_type'))).toEqual([
        'authorization_code',
        'refresh_token'
      ]);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('keeps each owner apart, and asks for one when nobody signed in', async () => {
    await connected();
    expect(await oauth().status('calendar', { owner: 'space' })).toEqual({ connected: false });

    await connected('profile:luis');
    expect(await oauth().status('calendar', { owner: 'profile:luis' })).toMatchObject({ connected: true });
    await expect(oauth({ user: undefined }).status('calendar')).rejects.toThrow('name its owner');
    await expect(oauth().status('calendar', { owner: '../escape' })).rejects.toThrow('An OAuth owner is');
  });

  it('forgets a connection, revoking it where the provider says', async () => {
    await connected();

    expect(await oauth().disconnect('calendar')).toBe(true);
    expect(upstream.revoked).toEqual(['refresh-1']);
    expect(await oauth().status('calendar')).toEqual({ connected: false });
    expect(await oauth().disconnect('calendar')).toBe(false);
    await expect(oauth().fetch('calendar', API)).rejects.toThrow('Not connected to "calendar"');
  });

  /** An SDK in the page asks for the token itself: only a connection that says so hands it out, never the refresh. */
  it('hands the access token of a connection that exposes it, renewed, and keeps the rest on the server', async () => {
    const { url } = await oauth().connect('player', { returnTo: '/' });
    const consent = new URL(url);
    await oauthCallback(
      run,
      new URLSearchParams({ state: consent.searchParams.get('state') ?? '', code: upstream.issue(consent) })
    );

    const given = await oauth().token('player');
    expect(given).toEqual({
      token: 'access-1',
      type: 'bearer',
      scopes: ['read'],
      expiresAt: expect.any(Number) as unknown
    });
    expect(JSON.stringify(given)).not.toContain('refresh');

    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 3_600_000);
    try {
      expect((await oauth().token('player')).token).toBe('access-2');
    } finally {
      vi.restoreAllMocks();
    }

    await connected();
    await expect(oauth().token('calendar')).rejects.toThrow(
      'OAuth connection "calendar" keeps its token on the server: declare exposeToken: true'
    );
    await expect(oauth().token('player', { owner: 'space' })).rejects.toThrow('Not connected to "player"');
  });

  it('refuses what it cannot do safely, saying what to write instead', async () => {
    await expect(oauth().connect('music', { returnTo: '/' })).rejects.toThrow('this space declares calendar');
    await expect(oauth().connect('calendar', { returnTo: 'https://evil.test/' })).rejects.toThrow(
      'a path of the space'
    );
    await expect(oauth().connect('calendar', { returnTo: '//evil.test/' })).rejects.toThrow('a path of the space');
    await expect(oauth({ origin: undefined }).connect('calendar', { returnTo: '/' })).rejects.toThrow(
      'is made from a visitor'
    );
    await expect(oauth({ seal: undefined, open: undefined }).connect('calendar', { returnTo: '/' })).rejects.toThrow(
      'no signingSecret'
    );
    const refused = oauthFor(run, CONNECTIONS, () => {
      throw new Error('not among the hosts');
    });
    await connected();
    await expect(refused.fetch('calendar', API)).rejects.toThrow('not among the hosts');
  });
});
