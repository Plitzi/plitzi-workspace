import { createServer } from 'node:http';

import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMCPServer } from '../../../core/server/mcpServer';

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthAdapters, OAuthStore, SSRAdapters, SSRServer } from '@plitzi/sdk-shared';

/** The OAuth grant as a HOST runs it, through the official client and its auth machinery rather than hand-written
 *  HTTP (that is `modules/oauth/oauth.test.ts`): the challenge is what starts the flow, the resource metadata is
 *  what the client follows to find this server's endpoints, and an expired bearer is refreshed off a second
 *  challenge and the call retried. Claude does exactly this, so a step it would trip over trips here first. */

// Long enough that nothing expires by accident, short enough to be a plain number in the assertions. Time only
// moves when a test moves it (see `advance`), so the expiry case is deterministic and instant.
const ACCESS_TTL_SECONDS = 300;

const CREDENTIALS = { username: 'ada@example.com', password: 'secret' };

const SPACE_TARGET = '42';

const WIDGETS_ONLY_TARGET = 'widgets-only';

// Never opened: the code is read off the redirect this test never follows, the way a host reads it off the callback
// it owns. Loopback because that is what a native client may register (RFC 8252).
const REDIRECT_URI = 'http://127.0.0.1:8765/callback';

let BASE = '';

// No getSpaceId at all: this deployment has nothing that can vouch for a token on its own, so every request that
// gets in does so on the strength of the grant — which is what the widgets-only case must prove.
const publicAdapters = {
  getOfflineData: () => Promise.resolve(undefined),
  getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
} as unknown as SSRAdapters;

type Clock = { store: OAuthStore; advance: (seconds: number) => void };

// A store with real expiry on a clock the test owns. The SDK's own default store forgets nothing, which is exactly
// the case this file exists to cover.
const expiringStore = (): Clock => {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  let now = 0;

  return {
    store: {
      put: (key, value, ttlSeconds) => {
        entries.set(key, { value, expiresAt: now + ttlSeconds });
      },
      get: key => {
        const entry = entries.get(key);
        if (!entry) {
          return undefined;
        }

        if (entry.expiresAt <= now) {
          entries.delete(key);

          return undefined;
        }

        return entry.value;
      },
      drop: key => {
        entries.delete(key);
      }
    },
    advance: seconds => {
      now += seconds;
    }
  };
};

let clock = expiringStore();
let minted = 0;

// The server binds its store once, so the adapters delegate to whichever clock the current test installed.
const delegatingStore: OAuthStore = {
  put: (key, value, ttlSeconds) => clock.store.put(key, value, ttlSeconds),
  get: key => clock.store.get(key),
  drop: key => clock.store.drop(key)
};

// A distinct bearer per mint, so a refreshed connection is provably running on a new one rather than the token it
// started with.
const oauthAdapters: OAuthAdapters = {
  authenticate: ({ username, password }) =>
    Promise.resolve(
      username === CREDENTIALS.username && password === CREDENTIALS.password ? { id: '7', label: username } : undefined
    ),
  grantTargets: () =>
    Promise.resolve([
      { value: SPACE_TARGET, label: 'Marketing site' },
      { value: WIDGETS_ONLY_TARGET, label: 'Widgets only' }
    ]),
  issueToken: () => {
    minted += 1;

    return Promise.resolve({ token: `bearer-${minted}`, expiresInSeconds: ACCESS_TTL_SECONDS });
  },
  store: delegatingStore
};

/** The half of a host this test has to play: it keeps the client registration, the PKCE verifier and the tokens,
 *  and records the URL it was asked to open instead of opening a browser. */
class HostProvider implements OAuthClientProvider {
  authorizationUrl?: URL;
  private registration?: OAuthClientInformationFull;
  private granted?: OAuthTokens;
  private verifier = '';

  get redirectUrl(): string {
    return REDIRECT_URI;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'e2e-host',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'plitzi'
    };
  }

  clientInformation(): OAuthClientInformationFull | undefined {
    return this.registration;
  }

  saveClientInformation(registration: OAuthClientInformationFull): void {
    this.registration = registration;
  }

  tokens(): OAuthTokens | undefined {
    return this.granted;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.granted = tokens;
  }

  redirectToAuthorization(url: URL): void {
    this.authorizationUrl = url;
  }

  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }

  codeVerifier(): string {
    return this.verifier;
  }
}

let provider = new HostProvider();
let server: SSRServer;

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
  server = createMCPServer({
    httpVersion: 1,
    adapters: publicAdapters,
    oauth: { adapters: oauthAdapters }
  });
  server.listen(port, '127.0.0.1');
});

afterAll(() => server.close());

beforeEach(() => {
  clock = expiringStore();
  provider = new HostProvider();
  minted = 0;
});

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

/** The browser the host would open: the consent screen, the sign-in, the choice of what to grant, and the code the
 *  redirect hands back. */
const signIn = async (authorizationUrl: URL, target = SPACE_TARGET): Promise<string> => {
  const consent = await fetch(authorizationUrl);
  const grant = await postForm({ ...hiddenValues(await consent.text()), ...CREDENTIALS });
  const chosen = await postForm({ ...hiddenValues(await grant.text()), target });
  const redirect = new URL(chosen.headers.get('location') ?? '');
  const code = redirect.searchParams.get('code');
  if (!code) {
    throw new Error(`No authorization code in ${redirect.toString()}`);
  }

  return code;
};

const newTransport = (): StreamableHTTPClientTransport =>
  new StreamableHTTPClientTransport(new URL(BASE), { authProvider: provider });

/** Everything a host does between "add this server" and a working session, in the order it does it: connect and be
 *  refused, follow the challenge, sign in, then connect again on the bearer. */
const connectAuthorized = async (target = SPACE_TARGET): Promise<Client> => {
  const first = newTransport();
  await expect(new Client({ name: 'e2e-host', version: '1.0.0' }).connect(first)).rejects.toThrow(UnauthorizedError);
  await first.finishAuth(await signIn(provider.authorizationUrl ?? new URL(BASE), target));

  const client = new Client({ name: 'e2e-host', version: '1.0.0' });
  await client.connect(newTransport());

  return client;
};

describe('MCP connector over OAuth (official client, real grant)', () => {
  it('turns a host that never authorized away with the challenge, and points it at the metadata', async () => {
    const transport = newTransport();

    await expect(new Client({ name: 'e2e-host', version: '1.0.0' }).connect(transport)).rejects.toThrow(
      UnauthorizedError
    );

    // Having followed resource metadata → authorization server metadata, the client is now sitting on OUR consent
    // URL with PKCE in hand: proof the whole discovery chain resolved off the 401 alone.
    const url = provider.authorizationUrl;
    expect(url?.origin).toBe(BASE);
    expect(url?.pathname).toBe('/authorize');
    expect(url?.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url?.searchParams.get('resource')).toBe(`${BASE}/`);
  });

  it('connects on the bearer the grant minted, once the user has signed in', async () => {
    const client = await connectAuthorized();

    expect(client.getServerVersion()?.name).toBe('plitzi-mcp');
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);

    await client.close();
  });

  it('refreshes an expired bearer off the next challenge and completes the call that hit it', async () => {
    const client = await connectAuthorized();
    const first = provider.tokens();

    expect(first?.refresh_token).toBeTruthy();
    expect(minted).toBe(1);

    // Past the bearer's lifetime: its record is gone, so the very next call is challenged.
    clock.advance(ACCESS_TTL_SECONDS + 1);

    const { tools } = await client.listTools();
    const second = provider.tokens();

    expect(tools.length).toBeGreaterThan(0);
    expect(minted).toBe(2);
    expect(second?.access_token).not.toBe(first?.access_token);
    // Rotated, per OAuth 2.1 for a public client: the refresh token that was just used is spent too.
    expect(second?.refresh_token).not.toBe(first?.refresh_token);

    await client.close();
  });

  it('leaves the expired bearer dead, so the old credential cannot be replayed', async () => {
    const client = await connectAuthorized();
    const expired = provider.tokens()?.access_token ?? '';

    clock.advance(ACCESS_TTL_SECONDS + 1);
    await client.listTools();

    const replay = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${expired}`
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });

    expect(replay.status).toBe(401);
    expect(replay.headers.get('www-authenticate')).toContain('resource_metadata=');

    await client.close();
  });

  it('serves the grant that carries no space, which is what keeps plitzi_render reachable under OAuth', async () => {
    const client = await connectAuthorized(WIDGETS_ONLY_TARGET);

    const result = await client.callTool({
      name: 'plitzi_render',
      arguments: {
        operations: [
          {
            type: 'upsertElement',
            pageRef: 'render',
            element: { ref: 'greeting', type: 'heading', subType: 'h1', props: { content: 'Hello' } }
          }
        ]
      }
    });

    expect(result.structuredContent).toMatchObject({ rendered: true });

    await client.close();
  });
});
