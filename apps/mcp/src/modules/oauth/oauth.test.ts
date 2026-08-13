import { createHash, randomBytes } from 'node:crypto';
import { createServer as createHttpProbe } from 'node:http';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../createServer';
import { createOAuthGuardStage } from '../../stages/oauth';

import type { BaseContext } from '@plitzi/sdk-server/kernel';
import type {
  OAuthAdapters,
  OAuthStore,
  SSRAdapters,
  SSRRequest,
  SSRResponseHelpers,
  SSRServer
} from '@plitzi/sdk-shared';

// The stage under test falls through when the bearer checks out, so it never writes a response; anything reaching
// this is a bug the test must not hide.
const unusedResponse = new Proxy(
  {},
  {
    get: (_target, property) => {
      throw new Error(`The guard wrote to the response (${String(property)}) when it should have fallen through`);
    }
  }
);

const capturingResponse = (): SSRResponseHelpers => {
  const headers: Record<string, string | string[]> = {};

  return {
    status: 0,
    headers,
    setHeader: (name, value) => {
      headers[name] = value;
    },
    setStatus: () => undefined,
    send: () => undefined,
    write: () => undefined,
    end: () => undefined
  };
};

/** The whole grant, driven exactly as a remote host drives it: register, open the consent screen, sign in, choose
 *  what to grant, redeem the code, refresh. Anything a host would hit as a dead end fails here first. */

const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

// The issuer is left to derive from the request, as a deployment that owns its sub-domain does, so the ephemeral
// port this binds to is also what the metadata documents must advertise.
let BASE = '';

// A platform-issued space token, the credential the builder and the CLI already hold: it never went through the
// grant, so the resource adapters are the only thing that can recognise it.
const PLATFORM_TOKEN = 'platform-space-token';

const credentialOf = (req: SSRRequest): string =>
  String(req.headers['x-access-token'] ?? req.headers.authorization ?? '').replace(/^Bearer\s+/iu, '');

const adapters = {
  getOfflineData: () => Promise.resolve(undefined),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
  getGrant: (req: SSRRequest) =>
    Promise.resolve(
      credentialOf(req) === PLATFORM_TOKEN ? { spaceId: 1, scope: 'agent' as const, canWrite: true } : undefined
    )
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

// What a guest connection grants here: a target that reaches nothing anyone owns, which is the only kind that may
// be handed out without an identity.
const GUEST_TARGET = { value: 'widgets-only', label: 'Widgets only', description: 'No access to any space.' };

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
    const probe = createHttpProbe();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

beforeAll(async () => {
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}`;
  server = createServer(
    { httpVersion: 1, adapters },
    { oauth: { adapters: oauthAdapters(), guest: { target: GUEST_TARGET } } }
  );
  server.listen(port, '127.0.0.1');
});

afterAll(() => server.close());

const verifier = (): string => randomBytes(32).toString('base64url');

const challengeFor = (value: string): string => createHash('sha256').update(value).digest('base64url');

// The name is a parameter because identical metadata is now one registration: a test that needs a genuinely
// different client has to ask to be registered as a different one.
const registerClient = async (clientName = 'Claude'): Promise<string> => {
  const response = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: clientName, redirect_uris: [REDIRECT_URI] })
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
  // `resource` names the origin WITH its trailing slash, which is the form a client sends back in the `resource`
  // parameter (it parses the URL first, and an empty path renders as `/`) — Claude was observed asking for
  // exactly that. It is still no help to a bare-origin connector; see protectedResourceMetadata for why.
  it('publishes the protected-resource document a host asks for first', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ resource: `${BASE}/`, authorization_servers: [BASE] });
  });

  // A host compares `resource` against the URL the user typed, path and all, so the document asked for under a
  // path must describe THAT url — a dedicated MCP server answers JSON-RPC on every path, so both are real.
  it('answers under the resource path RFC 9728 allows, naming that path as the resource', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ resource: `${BASE}/mcp`, authorization_servers: [BASE] });
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

  // A host only asks for a refresh token when the server says it grants them, and this is where it looks.
  it('advertises offline_access while refresh grants are issued', async () => {
    const response = await fetch(`${BASE}/.well-known/oauth-authorization-server`);
    const metadata = (await response.json()) as { scopes_supported: string[]; grant_types_supported: string[] };

    expect(metadata.scopes_supported).toContain('offline_access');
    expect(metadata.grant_types_supported).toContain('refresh_token');
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

  // A host that registers on every connection — Claude's DCR does, twice per attempt, once per backend instance —
  // must not walk away with two different ids for the same client, and must not leave a record behind each time.
  it('hands back one registration for identical metadata, however often it is asked', async () => {
    const body = JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT_URI] });
    const register = async (): Promise<{ client_id: string; client_id_issued_at: number }> =>
      (await (
        await fetch(`${BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      ).json()) as { client_id: string; client_id_issued_at: number };

    // Sequential, which is what a host actually does (Claude's two instances register about a second apart). Two
    // registrations that truly overlap are last-writer-wins on the fingerprint and both records stay usable, so the
    // race costs an extra record and nothing else.
    const first = await register();
    const second = await register();

    expect(second.client_id).toBe(first.client_id);
    expect(second.client_id_issued_at).toBe(first.client_id_issued_at);
    // Different client, different registration: the redirect target a code is bound to still cannot be borrowed.
    expect(await registerClient('Someone else')).not.toBe(first.client_id);
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
    // Opaque on purpose: what the host receives is this server's handle for the grant, never the credential the
    // consumer minted — that one is usually good against more of the platform than this endpoint.
    expect(granted.access_token).toBeTruthy();
    expect(granted.access_token).not.toContain('token-42');
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
    const other = await registerClient('Another app');
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

/** A deployment that configured no guest connection. Its own server, because whether the button exists is decided
 *  once when the server is built. */
describe('MCP OAuth without a guest connection', () => {
  let strictServer: SSRServer;
  let strictBase = '';

  beforeAll(async () => {
    const port = await freePort();
    strictBase = `http://127.0.0.1:${port}`;
    strictServer = createServer({ httpVersion: 1, adapters }, { oauth: { adapters: oauthAdapters() } });
    strictServer.listen(port, '127.0.0.1');
  });

  afterAll(() => strictServer.close());

  beforeEach(() => {
    store = memoryStore();
  });

  it('offers no guest button, and refuses a request that submits one anyway', async () => {
    const response = await fetch(`${strictBase}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT_URI] })
    });
    const { client_id: clientId } = (await response.json()) as { client_id: string };
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challengeFor(verifier()),
      code_challenge_method: 'S256'
    });
    const consent = await fetch(`${strictBase}/authorize?${params.toString()}`);
    const html = await consent.text();

    expect(html).not.toContain('name="guest"');

    const forced = await fetch(`${strictBase}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...hiddenValues(html), guest: '1' }).toString(),
      redirect: 'manual'
    });

    // Back to the sign-in form with an error, not a redirect carrying a code.
    expect(forced.status).toBe(200);
    expect(forced.headers.get('location')).toBeNull();
    expect(await forced.text()).toContain('did not match an account');
  });
});

/** The protected-resource side. A host runs its OAuth flow off the 401 and nothing else: served the public surface
 *  instead, it never learns the server takes credentials, and the grant a user completes has nowhere to land — the
 *  flow succeeds and the connector still reports that authorization failed. */
describe('MCP endpoint under OAuth', () => {
  const initialize = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }
  });

  const callMcp = (token?: string): Promise<Response> =>
    fetch(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: initialize
    });

  const bearerFromGrant = async (): Promise<string> => {
    const secret = verifier();
    const clientId = await registerClient();
    const redirect = await grantCode(clientId, challengeFor(secret));
    const granted = (await (
      await exchange({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: redirect.searchParams.get('code') ?? '',
        code_verifier: secret
      })
    ).json()) as { access_token: string };

    return granted.access_token;
  };

  beforeEach(() => {
    store = memoryStore();
  });

  it('challenges an unauthenticated call with a 401 that names the resource metadata', async () => {
    const response = await callMcp();
    const challenge = response.headers.get('www-authenticate') ?? '';

    expect(response.status).toBe(401);
    expect(challenge.startsWith('Bearer ')).toBe(true);
    expect(challenge).toContain(`resource_metadata="${BASE}/.well-known/oauth-protected-resource"`);
    expect(challenge).toContain('error="invalid_token"');
    expect(challenge).toContain('scope="plitzi"');
    // A host running in a browser must be allowed to read the header, not just receive it.
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-expose-headers')).toContain('WWW-Authenticate');
  });

  it('serves the endpoint once the bearer from the grant is presented', async () => {
    const response = await callMcp(await bearerFromGrant());

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"result"');
  });

  it('challenges a bearer it never issued, so a host refreshes instead of running as a guest', async () => {
    const response = await callMcp('made-up-token');

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('accepts a token the resource adapters vouch for, which is how the builder and the CLI connect', async () => {
    const response = await callMcp(PLATFORM_TOKEN);

    expect(response.status).toBe(200);
  });

  // The bearer is a handle; the credential behind it is what the deployment's adapters read. Without the swap the
  // grant would authorise a request that then resolves to no space at all. Driven through the stage itself because
  // the swap happens before anything downstream is reached, and the handshake never asks for a space.
  it('hands the request on carrying the credential the grant issued, not the handle', async () => {
    const bearer = await bearerFromGrant();
    const req = {
      method: 'POST',
      path: '/',
      headers: { authorization: `Bearer ${bearer}` },
      query: {},
      ctx: {}
    } as unknown as SSRRequest;

    const answered = await createOAuthGuardStage({ adapters: oauthAdapters() })({
      req,
      res: unusedResponse,
      config: { adapters }
    } as unknown as BaseContext);

    expect(answered).toBe(false);
    expect(credentialOf(req)).toMatch(/^token-42/u);
  });

  // A 401 on its own cannot tell a missing header from a bearer the store lost, and a host never reports more than
  // "authorization failed" — so the reason has to be on the server's own log line or nobody can diagnose it.
  it('names on the request why it challenged', async () => {
    const challengeFor = async (headers: Record<string, string>, oauth: OAuthAdapters): Promise<string | undefined> => {
      const ctx = {
        req: { method: 'POST', path: '/', headers, query: {}, ctx: {} },
        res: capturingResponse(),
        config: { adapters }
      } as unknown as BaseContext;

      expect(await createOAuthGuardStage({ adapters: oauth })(ctx)).toBe(true);

      return ctx.operation;
    };

    const brokenStore: OAuthStore = {
      put: () => undefined,
      get: () => {
        throw new Error('Redis is unavailable');
      },
      drop: () => undefined
    };

    expect(await challengeFor({}, oauthAdapters())).toBe('oauth-challenge:no-credential');
    expect(await challengeFor({ authorization: 'Bearer made-up' }, oauthAdapters())).toBe(
      'oauth-challenge:unknown-credential'
    );
    // The one an operator has to act on rather than the user: refused all the same, but not because of the token.
    expect(await challengeFor({ authorization: 'Bearer anything' }, { ...oauthAdapters(), store: brokenStore })).toBe(
      'oauth-challenge:store-unreachable'
    );
  });

  // A connector that was already connected when this server upgraded holds a bearer whose record predates the
  // split, and it must keep working: back then the bearer was the credential, so it stands in for itself.
  it('keeps a bearer recorded before the credential was separated from it', async () => {
    // Deliberately not a token the adapters can vouch for: the record is the only thing standing behind it, so the
    // fallback is what this asserts and nothing else can carry the test.
    const legacyBearer = 'legacy-opaque-bearer';
    await store.put(
      `oauth:access:${legacyBearer}`,
      JSON.stringify({ clientId: 'old-client', user: { id: '7', label: 'ada' }, target: { value: '42', label: '' } }),
      60
    );

    const req = {
      method: 'POST',
      path: '/',
      headers: { authorization: `Bearer ${legacyBearer}` },
      query: {},
      ctx: {}
    } as unknown as SSRRequest;

    const answered = await createOAuthGuardStage({ adapters: oauthAdapters() })({
      req,
      res: unusedResponse,
      config: { adapters }
    } as unknown as BaseContext);

    expect(answered).toBe(false);
    expect(credentialOf(req)).toBe(legacyBearer);
  });

  it('connects a guest, so a host that needs no space never has to ask for an account', async () => {
    const secret = verifier();
    const clientId = await registerClient();
    const consent = await fetch(authorizeUrl(clientId, challengeFor(secret)));
    const html = await consent.text();

    // The button is a submit that skips validation: the credential inputs are `required`, and a guest fills neither.
    expect(html).toContain('name="guest"');
    expect(html).toContain('formnovalidate');
    expect(html).toContain('Continue without an account');

    const done = await postForm({ ...hiddenValues(html), guest: '1' });
    const redirect = new URL(done.headers.get('location') ?? '');
    const granted = (await (
      await exchange({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: redirect.searchParams.get('code') ?? '',
        code_verifier: secret
      })
    ).json()) as { access_token: string };

    expect(done.status).toBe(302);
    expect(redirect.searchParams.get('error')).toBeNull();
    expect((await callMcp(granted.access_token)).status).toBe(200);
  });

  it('leaves the CORS preflight answering, since a challenge on it tells a host nothing', async () => {
    const response = await fetch(BASE, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});
