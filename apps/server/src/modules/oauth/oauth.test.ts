import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMCPServer } from '../../core/server/mcpServer';

import type { OAuthAdapters, OAuthStore, SSRAdapters, SSRServer } from '@plitzi/sdk-shared';

/** The whole grant, driven exactly as a remote host drives it: register, open the consent screen, sign in, choose
 *  what to grant, redeem the code, refresh. Anything a host would hit as a dead end fails here first. */

const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

// The issuer is left to derive from the request, as a deployment that owns its sub-domain does, so the ephemeral
// port this binds to is also what the metadata documents must advertise.
let BASE = '';

const adapters = {
  getOfflineData: () => Promise.resolve(undefined),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
} as unknown as SSRAdapters;

const memoryStore = (): OAuthStore => {
  const entries = new Map<string, string>();

  return {
    put: (key, value) => {
      entries.set(key, value);
    },
    get: key => entries.get(key),
    drop: key => {
      entries.delete(key);
    }
  };
};

let issued = 0;
let store = memoryStore();

// The server binds its store once, so the adapters delegate to whatever `store` currently is — that is what lets
// a test start from an empty one without restarting the server.
const delegatingStore: OAuthStore = {
  put: (key, value, ttlSeconds) => store.put(key, value, ttlSeconds),
  get: key => store.get(key),
  drop: key => store.drop(key)
};

const oauthAdapters = (): OAuthAdapters => ({
  authenticate: ({ username, password }) =>
    Promise.resolve(username === 'ada@example.com' && password === 'secret' ? { id: '7', label: username } : undefined),
  grantTargets: () =>
    Promise.resolve([
      { value: '42', label: 'Marketing site' },
      { value: 'widgets-only', label: 'Widgets only' }
    ]),
  issueToken: (_user, target) => {
    issued += 1;

    return Promise.resolve(target.value === 'denied' ? undefined : { token: `token-${target.value}-${issued}` });
  },
  store: delegatingStore
});

let server: SSRServer;

// An ephemeral port, claimed by probing one with a throwaway listener: the SSRServer takes the port to bind, and
// a fixed one makes the suite fail on whatever else is already holding it.
const freePort = (): Promise<number> =>
  new Promise(resolve => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

beforeAll(async () => {
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}`;
  server = createMCPServer({ httpVersion: 1, adapters, oauth: { adapters: oauthAdapters() } });
  server.listen(port, '127.0.0.1');
});

afterAll(() => server.close());

const verifier = (): string => randomBytes(32).toString('base64url');

const challengeFor = (value: string): string => createHash('sha256').update(value).digest('base64url');

const registerClient = async (): Promise<string> => {
  const response = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT_URI] })
  });
  const body = (await response.json()) as { client_id: string };

  return body.client_id;
};

const authorizeUrl = (clientId: string, challenge: string, state = 'xyz'): string => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });

  return `${BASE}/authorize?${params.toString()}`;
};

// The form is the API here: a host's user submits it, so the test reads back exactly what the browser would post.
const hiddenValues = (html: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const [, name, value] of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/gu)) {
    values[name] = value;
  }

  return values;
};

const postForm = (fields: Record<string, string>): Promise<Response> =>
  fetch(`${BASE}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual'
  });

/** Register → consent → grant, returning the code the host would receive. */
const grantCode = async (clientId: string, challenge: string, target = '42'): Promise<URL> => {
  const consent = await fetch(authorizeUrl(clientId, challenge));
  const credentials = hiddenValues(await consent.text());

  const grant = await postForm({ ...credentials, username: 'ada@example.com', password: 'secret' });
  const chosen = hiddenValues(await grant.text());

  const done = await postForm({ ...chosen, target });

  return new URL(done.headers.get('location') ?? '');
};

const exchange = (fields: Record<string, string>): Promise<Response> =>
  fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString()
  });

describe('MCP OAuth discovery', () => {
  it('publishes the protected-resource document a host asks for first', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ resource: BASE, authorization_servers: [BASE] });
  });

  it('answers the same document under the resource path RFC 9728 allows', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
  });

  // TLS is terminated by the dev gateway / k8s ingress and the hop to this server is plain HTTP, so the issuer can
  // only come out as https if the proxy says so. An http:// issuer is one a remote host is entitled to reject, and
  // every URL in both documents is built from it.
  it('publishes an https issuer when the proxy in front terminated TLS', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-authorization-server`, {
      headers: { 'x-forwarded-proto': 'https' }
    });
    const metadata = (await response.json()) as { issuer: string; token_endpoint: string };

    expect(metadata.issuer.startsWith('https://')).toBe(true);
    expect(metadata.token_endpoint.startsWith('https://')).toBe(true);
  });

  it('advertises only PKCE-S256 with a public client, which is all a desktop host can do', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-authorization-server`);

    expect(await response.json()).toMatchObject({
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/token`,
      registration_endpoint: `${BASE}/register`,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none']
    });
  });
});

describe('MCP OAuth client registration', () => {
  it('registers a client and hands back an id bound to its redirect URI', async () => {
    const response = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT_URI] })
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ client_name: 'Claude', redirect_uris: [REDIRECT_URI] });
  });

  it('refuses a redirect URI the user cannot be sent to safely', async () => {
    const response = await fetch(`${BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Sketchy', redirect_uris: ['http://evil.example.com/cb'] })
    });

    expect(response.status).toBe(400);
  });
});

describe('MCP OAuth authorization', () => {
  beforeEach(() => {
    store = memoryStore();
  });

  it('walks a host from consent to a redeemable code', async () => {
    const secret = verifier();
    const clientId = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(secret));

    expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
    expect(redirect.searchParams.get('state')).toBe('xyz');

    const response = await exchange({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: redirect.searchParams.get('code') ?? '',
      code_verifier: secret,
      redirect_uri: REDIRECT_URI
    });

    const granted = (await response.json()) as { token_type: string; access_token: string };

    expect(response.status).toBe(200);
    expect(granted.token_type).toBe('Bearer');
    expect(granted.access_token).toContain('token-42');
  });

  it('re-shows the form on a wrong password instead of failing the flow', async () => {
    const clientId = await registerClient();
    const consent = await fetch(authorizeUrl(clientId, challengeFor(verifier())));
    const response = await postForm({
      ...hiddenValues(await consent.text()),
      username: 'ada@example.com',
      password: 'wrong'
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('did not match an account');
    expect(html).toContain('name="password"');
  });

  it('will not start a flow for a client it never registered', async () => {
    const response = await fetch(authorizeUrl('made-up', challengeFor(verifier())));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Unknown client');
  });

  it('refuses to redirect anywhere the client did not register, rather than bounce the user on', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'https://attacker.example.com/cb',
      code_challenge: challengeFor(verifier()),
      code_challenge_method: 'S256'
    });
    const response = await fetch(`${BASE}/authorize?${params.toString()}`, { redirect: 'manual' });

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it('reports a missing PKCE challenge back to the client', async () => {
    const clientId = await registerClient();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state: 'xyz'
    });
    const response = await fetch(`${BASE}/authorize?${params.toString()}`, { redirect: 'manual' });
    const location = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(302);
    expect(location.searchParams.get('error')).toBe('invalid_request');
    expect(location.searchParams.get('state')).toBe('xyz');
  });
});

describe('MCP OAuth token exchange', () => {
  beforeEach(() => {
    store = memoryStore();
  });

  it('rejects a code redeemed with the wrong verifier — the whole point of PKCE', async () => {
    const clientId = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(verifier()));

    const response = await exchange({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: redirect.searchParams.get('code') ?? '',
      code_verifier: verifier()
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('burns a code on first use, so a leaked redirect cannot be replayed', async () => {
    const secret = verifier();
    const clientId = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(secret));
    const params = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: redirect.searchParams.get('code') ?? '',
      code_verifier: secret
    };

    expect((await exchange(params)).status).toBe(200);
    expect((await exchange(params)).status).toBe(400);
  });

  it('rejects a code presented by a different client', async () => {
    const secret = verifier();
    const clientId = await registerClient();
    const other = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(secret));

    const response = await exchange({
      grant_type: 'authorization_code',
      client_id: other,
      code: redirect.searchParams.get('code') ?? '',
      code_verifier: secret
    });

    expect(response.status).toBe(400);
  });

  it('mints a fresh bearer on refresh and rotates the refresh token', async () => {
    const secret = verifier();
    const clientId = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(secret));
    const first = (await (
      await exchange({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: redirect.searchParams.get('code') ?? '',
        code_verifier: secret
      })
    ).json()) as { access_token: string; refresh_token: string };

    const refreshed = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token
    });
    const second = (await refreshed.json()) as { access_token: string; refresh_token: string };

    expect(refreshed.status).toBe(200);
    expect(second.access_token).not.toBe(first.access_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);

    const replay = await exchange({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: first.refresh_token
    });

    expect(replay.status).toBe(400);
  });

  it('names an unsupported grant instead of failing opaquely', async () => {
    const response = await exchange({ grant_type: 'password', username: 'ada', password: 'secret' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'unsupported_grant_type' });
  });
});

describe('MCP OAuth alongside the MCP endpoint', () => {
  it('leaves the JSON-RPC endpoint answering at the root', async () => {
    const response = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }
      })
    });

    expect(response.status).toBe(200);
  });
});
