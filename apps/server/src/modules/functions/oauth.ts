import { createHash, randomBytes } from 'node:crypto';

import { FUNCTION_ROUTES_PREFIX } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { fetchOutbound } from '../../helpers/outboundGuard';
import { ActionRefusal } from '../actions/runtime/errors';

import type { FunctionOAuth, FunctionOAuthOwner, FunctionOAuthStatus } from './contract';
import type { ActionTaskContext } from '../actions/types';
import type { FunctionOAuthConnection } from '@plitzi/sdk-shared';

/**
 * OAuth 2.0 for a space's code (`ctx.oauth`): any provider, declared as data — none is known here by name.
 *
 * The authorization code flow with PKCE: `connect` makes the consent URL and remembers, sealed in the space's `kv` for
 * ten minutes, who asked and where they go back; the provider sends the visitor to `/fn/oauth/callback`, which
 * exchanges the code with the app's id and secret (a credential of the space's, resolved here) and keeps the tokens
 * sealed under the connection and its owner; `fetch` writes the access token into a request, renewing it first when it
 * is about to lapse and once more on a 401. Sealed with the space's own key, which no signature of `ctx.sign` reaches:
 * the code reads only ciphertext, even with `ctx.kv`.
 */

/** Where the provider sends the visitor back, under `/fn` — the one address to register with every provider. */
export const OAUTH_CALLBACK_PATH = '/oauth/callback';

const STATE_SECONDS = 600;
/** A token this close to lapsing is renewed before it is used. */
const RENEW_BEFORE_MS = 60_000;
/** How long an issuer's endpoints are kept once read. */
const DISCOVERY_MS = 3_600_000;

const OWNER = /^[\w:.@-]{1,128}$/;
const KEY_PREFIX = 'plitzi:oauth';

const stateKey = (state: string): string => `${KEY_PREFIX}:state:${state}`;
const tokenKey = (connection: string, owner: string): string => `${KEY_PREFIX}:token:${connection}:${owner}`;

type Endpoints = { authorize: string; token: string; revoke?: string };

type Tokens = { access: string; refresh?: string; type: string; expiresAt?: number; scopes?: string[] };

/** A consent under way, as `connect` left it for the callback: everything the exchange needs, the spec included. */
type Pending = {
  connection: string;
  spec: FunctionOAuthConnection;
  owner: string;
  returnTo: string;
  verifier: string;
  redirectUri: string;
};

/** What the parts of a run `ctx.oauth` uses are: its fetch, its kv, its credentials, its sealing, who and where. */
export type OAuthRun = Pick<
  ActionTaskContext,
  'fetch' | 'kv' | 'credential' | 'seal' | 'open' | 'origin' | 'user' | 'signal'
>;

const discovered = new Map<string, { at: number; endpoints: Endpoints }>();

const stringField = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' ? record[key] : undefined;

/** The connection's endpoints: written out, or read from its issuer's OpenID metadata — what is written wins. */
const endpointsOf = async (run: OAuthRun, connection: string, spec: FunctionOAuthConnection): Promise<Endpoints> => {
  let published: Partial<Endpoints> = {};
  if (spec.issuer && (!spec.authorizeUrl || !spec.tokenUrl)) {
    const kept = discovered.get(spec.issuer);
    if (kept && Date.now() - kept.at < DISCOVERY_MS) {
      published = kept.endpoints;
    } else {
      const url = new URL(`${spec.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`);
      const answer = await fetchOutbound(run.fetch, url, { method: 'GET', signal: run.signal });
      const metadata: unknown = answer.ok ? await answer.json().catch(() => undefined) : undefined;
      const authorize = isRecord(metadata) ? stringField(metadata, 'authorization_endpoint') : undefined;
      const token = isRecord(metadata) ? stringField(metadata, 'token_endpoint') : undefined;
      if (!authorize || !token) {
        throw new Error(
          `OAuth connection "${connection}": ${url.href} answered ${String(answer.status)} without authorization_endpoint and token_endpoint — write authorizeUrl and tokenUrl instead`
        );
      }

      const revoke = isRecord(metadata) ? stringField(metadata, 'revocation_endpoint') : undefined;
      published = { authorize, token, ...(revoke ? { revoke } : {}) };
      discovered.set(spec.issuer, { at: Date.now(), endpoints: { authorize, token, ...(revoke ? { revoke } : {}) } });
    }
  }

  const authorize = spec.authorizeUrl ?? published.authorize;
  const token = spec.tokenUrl ?? published.token;
  if (!authorize || !token) {
    throw new Error(`OAuth connection "${connection}" names no issuer, nor its authorizeUrl and tokenUrl`);
  }

  const revoke = spec.revokeUrl ?? published.revoke;

  return { authorize, token, ...(revoke ? { revoke } : {}) };
};

const sealed = (run: OAuthRun) => {
  const { seal, open } = run;
  if (!seal || !open) {
    throw new Error('This server keeps no OAuth tokens: its actions were given no signingSecret to seal them with');
  }

  return { seal, open };
};

/** The app's id and secret, from the credential the connection names — resolved here, never handed to the code. */
const clientOf = async (
  run: OAuthRun,
  connection: string,
  spec: FunctionOAuthConnection
): Promise<{ id: string; secret?: string }> => {
  const credential = await run.credential(spec.credential);
  const id = credential?.clientId;
  if (!id) {
    throw new Error(
      `OAuth connection "${connection}": the credential "${spec.credential}" ${credential ? 'has no clientId' : 'is not available for this space'} — it holds the app's clientId and clientSecret`
    );
  }

  return { id, ...(credential.clientSecret ? { secret: credential.clientSecret } : {}) };
};

/** A request to the token endpoint: the grant, and the app's proof of who it is where the provider wants it. */
const tokenRequest = async (
  run: OAuthRun,
  connection: string,
  spec: FunctionOAuthConnection,
  url: string,
  grant: Record<string, string>
): Promise<Record<string, unknown>> => {
  const client = await clientOf(run, connection, spec);
  const form = new URLSearchParams(grant);
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json'
  };
  if (spec.clientAuth === 'basic') {
    headers.authorization = `Basic ${Buffer.from(
      `${encodeURIComponent(client.id)}:${encodeURIComponent(client.secret ?? '')}`
    ).toString('base64')}`;
  } else {
    form.set('client_id', client.id);
    if (client.secret) {
      form.set('client_secret', client.secret);
    }
  }

  const answer = await fetchOutbound(run.fetch, new URL(url), {
    method: 'POST',
    headers,
    body: form.toString(),
    signal: run.signal
  });
  const body: unknown = await answer.json().catch(() => undefined);
  const said = isRecord(body) ? body : {};
  if (!answer.ok || typeof said.access_token !== 'string') {
    const error =
      stringField(said, 'error_description') ?? stringField(said, 'error') ?? `status ${String(answer.status)}`;
    throw new Error(`OAuth connection "${connection}": the provider refused the token (${error})`);
  }

  return said;
};

const tokensFrom = (said: Record<string, unknown>, earlier?: Tokens): Tokens => {
  const expiresIn = typeof said.expires_in === 'number' ? said.expires_in : Number(said.expires_in);
  const refresh = stringField(said, 'refresh_token') ?? earlier?.refresh;
  const scope = stringField(said, 'scope');

  return {
    // Checked a string by `tokenRequest` before it answered.
    access: said.access_token as string,
    type: stringField(said, 'token_type') ?? 'Bearer',
    ...(refresh ? { refresh } : {}),
    ...(Number.isFinite(expiresIn) && expiresIn > 0 ? { expiresAt: Date.now() + expiresIn * 1000 } : {}),
    ...(scope ? { scopes: scope.split(/[\s,]+/).filter(Boolean) } : earlier?.scopes ? { scopes: earlier.scopes } : {})
  };
};

const readSealed = async <T>(
  run: OAuthRun,
  key: string,
  check: (value: unknown) => value is T
): Promise<T | undefined> => {
  const stored = await run.kv.get(key);
  if (typeof stored !== 'string') {
    return undefined;
  }

  const opened = sealed(run).open(stored);
  let parsed: unknown;
  try {
    parsed = opened === undefined ? undefined : JSON.parse(opened);
  } catch {
    parsed = undefined;
  }

  return check(parsed) ? parsed : undefined;
};

const isTokens = (value: unknown): value is Tokens =>
  isRecord(value) && typeof value.access === 'string' && typeof value.type === 'string';

const isPending = (value: unknown): value is Pending =>
  isRecord(value) &&
  typeof value.connection === 'string' &&
  isRecord(value.spec) &&
  typeof value.owner === 'string' &&
  typeof value.returnTo === 'string' &&
  typeof value.verifier === 'string' &&
  typeof value.redirectUri === 'string';

/** Whose the connection is: the code's own key, or the signed-in visitor — and none is refused, saying which to name. */
const ownerOf = (run: OAuthRun, connection: string, options?: FunctionOAuthOwner): string => {
  const owner = options?.owner ?? (run.user ? `user:${String(run.user.id)}` : undefined);
  if (!owner) {
    throw new ActionRefusal(
      `OAuth connection "${connection}" is somebody's: sign the visitor in, or name its owner ({ owner: 'space' }, a key of your own)`
    );
  }

  if (!OWNER.test(owner)) {
    throw new Error(`An OAuth owner is letters, digits and ":._@-", up to 128 — not "${owner}"`);
  }

  return owner;
};

/** A path of the space to come back to: never another site (`//evil.example`, `https://…`). */
const pathOf = (returnTo: string): string => {
  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) {
    throw new Error(`returnTo is a path of the space ("/settings"), not "${returnTo}"`);
  }

  return returnTo;
};

const withQuery = (path: string, params: Record<string, string>): string => {
  const url = new URL(path, 'http://space');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return `${url.pathname}${url.search}${url.hash}`;
};

/**
 * `ctx.oauth` for one run, over the connections its code declared. `hosts` are where `fetch` may write the token — the
 * same `allow.hosts` every request of the code is held to.
 */
export const oauthFor = (
  run: OAuthRun,
  connections: Readonly<Record<string, FunctionOAuthConnection>>,
  allowed: (url: URL) => void
): FunctionOAuth => {
  const specOf = (connection: string): FunctionOAuthConnection => {
    const spec = Object.hasOwn(connections, connection) ? connections[connection] : undefined;
    if (!spec) {
      const names = Object.keys(connections);
      throw new Error(
        `No OAuth connection "${connection}": ${names.length ? `this space declares ${names.join(', ')}` : 'declare it in oauth of defineFunctions'}`
      );
    }

    return spec;
  };

  const save = (connection: string, owner: string, tokens: Tokens) =>
    run.kv.set(tokenKey(connection, owner), sealed(run).seal(JSON.stringify(tokens)));

  /** The connection's tokens, renewed first when they are about to lapse (or `force`d, after a 401). */
  const tokensOf = async (connection: string, owner: string, force = false): Promise<Tokens | undefined> => {
    const tokens = await readSealed(run, tokenKey(connection, owner), isTokens);
    if (!tokens) {
      return undefined;
    }

    const due = tokens.expiresAt !== undefined && tokens.expiresAt - RENEW_BEFORE_MS <= Date.now();
    if (!(due || force) || !tokens.refresh) {
      return tokens;
    }

    const spec = specOf(connection);
    const { token } = await endpointsOf(run, connection, spec);
    const renewed = tokensFrom(
      await tokenRequest(run, connection, spec, token, { grant_type: 'refresh_token', refresh_token: tokens.refresh }),
      tokens
    );
    await save(connection, owner, renewed);

    return renewed;
  };

  return {
    connect: async (connection, options) => {
      const spec = specOf(connection);
      const owner = ownerOf(run, connection, options);
      const returnTo = pathOf(options.returnTo);
      if (!run.origin) {
        throw new Error(
          `OAuth connection "${connection}" is made from a visitor's request: this run has none to return to`
        );
      }

      const { authorize } = await endpointsOf(run, connection, spec);
      const client = await clientOf(run, connection, spec);
      const verifier = randomBytes(32).toString('base64url');
      const state = randomBytes(24).toString('base64url');
      const redirectUri = `${run.origin}${FUNCTION_ROUTES_PREFIX}${OAUTH_CALLBACK_PATH}`;
      const pending: Pending = { connection, spec, owner, returnTo, verifier, redirectUri };
      await run.kv.set(stateKey(state), sealed(run).seal(JSON.stringify(pending)), STATE_SECONDS);

      const url = new URL(authorize);
      const params: Record<string, string> = {
        ...spec.authorizeParams,
        response_type: 'code',
        client_id: client.id,
        redirect_uri: redirectUri,
        state,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
        ...(spec.scopes?.length ? { scope: spec.scopes.join(' ') } : {})
      };
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

      return { url: url.href };
    },

    status: async (connection, options): Promise<FunctionOAuthStatus> => {
      specOf(connection);
      const tokens = await readSealed(run, tokenKey(connection, ownerOf(run, connection, options)), isTokens);

      return tokens
        ? {
            connected: true,
            ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
            ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {})
          }
        : { connected: false };
    },

    fetch: async (connection, input, init = {}) => {
      specOf(connection);
      const owner = ownerOf(run, connection, init);
      const url = new URL(typeof input === 'string' ? input : input.href);
      allowed(url);
      const send = (tokens: Tokens) =>
        fetchOutbound(run.fetch, url, {
          method: init.method ?? 'GET',
          headers: {
            ...init.headers,
            authorization: `${/^bearer$/i.test(tokens.type) ? 'Bearer' : tokens.type} ${tokens.access}`
          },
          body: init.body,
          signal: run.signal
        });
      const tokens = await tokensOf(connection, owner);
      if (!tokens) {
        throw new ActionRefusal(`Not connected to "${connection}": ctx.oauth.connect first`);
      }

      const answer = await send(tokens);
      if (answer.status !== 401 || !tokens.refresh) {
        return answer;
      }

      const renewed = await tokensOf(connection, owner, true);

      return renewed ? send(renewed) : answer;
    },

    disconnect: async (connection, options) => {
      const spec = specOf(connection);
      const owner = ownerOf(run, connection, options);
      const tokens = await readSealed(run, tokenKey(connection, owner), isTokens);
      if (!tokens) {
        return false;
      }

      const { revoke } = await endpointsOf(run, connection, spec);
      if (revoke) {
        // Forgotten here whatever the provider says: a revocation that fails is the provider's to retry, not a reason to
        // keep a token the space was asked to drop.
        await tokenRequest(run, connection, spec, revoke, { token: tokens.refresh ?? tokens.access }).catch(
          () => undefined
        );
      }

      await run.kv.delete(tokenKey(connection, owner));

      return true;
    }
  };
};

/** `ctx.oauth` where there is none to give — a plugin's code: the space's connections are the space's. */
export const noOAuth = (why: string): FunctionOAuth => {
  const refused = () => Promise.reject(new Error(why));

  return { connect: refused, status: refused, fetch: refused, disconnect: refused };
};

/**
 * The visitor back from the provider (`/fn/oauth/callback`): the consent it remembered taken (once), the code
 * exchanged, the tokens kept — and the visitor sent where the code said, told how it went. A visit with no consent
 * under way is answered, not redirected: there is nowhere of the space's to send it.
 */
export const oauthCallback = async (run: OAuthRun, query: URLSearchParams): Promise<Response> => {
  const state = query.get('state') ?? '';
  const pending = state ? await readSealed(run, stateKey(state), isPending) : undefined;
  if (state) {
    await run.kv.delete(stateKey(state));
  }

  if (!pending) {
    return new Response('This sign-in expired or was already used: start it again from the page.', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const back = (params: Record<string, string>): Response =>
    new Response(null, {
      status: 303,
      headers: { location: withQuery(pending.returnTo, { oauth: pending.connection, ...params }) }
    });
  const refused = query.get('error');
  if (refused) {
    return back({ oauth_error: refused });
  }

  const code = query.get('code');
  if (!code) {
    return back({ oauth_error: 'no_code' });
  }

  try {
    const { token } = await endpointsOf(run, pending.connection, pending.spec);
    const said = await tokenRequest(run, pending.connection, pending.spec, token, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier
    });
    await run.kv.set(tokenKey(pending.connection, pending.owner), sealed(run).seal(JSON.stringify(tokensFrom(said))));
  } catch (error) {
    return back({ oauth_error: error instanceof Error ? error.message.slice(0, 200) : 'exchange_failed' });
  }

  return back({ oauth_result: 'connected' });
};
