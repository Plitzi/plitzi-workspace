import { createAuthApi } from './api';
import { createAuthorizer } from './authorize';
import { createCarriers, presentedOrigin } from './credentials';
import { createCsrf } from './csrf';
import { createIdentity } from './identity';
import { applySessionOutcome, authPolicyRules, authRoutes } from './routes';
import { createSessionCookies, sessionCookieParams } from './session';
import { createTokens } from './tokens';

import type { AccountAdapters, AuthApiConfig } from './api';
import type { AuthOutcome } from './api';
import type { AuthPolicy, Requirement } from './authorize';
import type { CredentialCarrier } from './credentials';
import type { IdentityAdapters, IdentityConfig } from './identity';
import type { CookieSink } from './session';
import type { TokenConfig } from './tokens';
import type { SSRAuthCookie, SSRSession, SSRUser } from '@plitzi/sdk-shared';

/**
 * Everything a deployment says about its own auth, in one object.
 *
 * The pieces underneath stay exported and composable — a host that wants to build the identity resolver alone, or
 * swap one stage, still can. This exists because assembling them is not where anybody's judgement should go: there
 * is one correct order, and the two facts that appear in more than one place have to agree.
 *
 * The cookie name is the one that mattered. It was stated twice — once for the readers that pull a credential off a
 * request, once for the writers that put it there — and a deployment that changed one and not the other wrote its
 * session under a name nothing read it back from. A session that silently does not exist, from a typo. Here it is
 * said once and both sides derive from it.
 */
export interface AuthConfig {
  /** The signing secret and the issuer that separate this deployment's credentials from every other's. */
  tokens: TokenConfig;
  /**
   * What this deployment calls its session cookies, and where they are scoped. Defaults derive from the request
   * host, which is right for a single-host deployment and wrong the moment an app and an API share a domain.
   */
  cookie?: SSRAuthCookie;
  /**
   * The stores auth reads and writes. Identity is what the guard needs on every request; the account half is what
   * the `/auth` flows need, and **what is absent decides what this deployment offers** — no `createAccount`, no
   * signup, and the route answers 404 rather than failing at runtime.
   */
  adapters: IdentityAdapters & AccountAdapters;
  /** This deployment's own hosts and origins, and how it logs a refusal. */
  identity?: IdentityConfig;
  /** Password hashing, token generation, and which flows to offer at all. */
  api?: AuthApiConfig;
  /** Where the `/auth` flows are mounted, so the policy matches the routes. Default `/auth`. */
  basePath?: string;
  /** What a path with no rule of its own requires. Default `actor` — anything unlisted needs a session. */
  fallback?: Requirement;
  /** Extra rules, applied BEFORE the derived `/auth` ones so a deployment can always widen its own surface. */
  rules?: AuthPolicy['rules'];
  /**
   * Cross-site request forgery. **On, and it configures itself** from what is already here: the token secret signs
   * it, the cookie naming above scopes it, and `identity.platformOrigins` says which sites are this deployment's.
   *
   * `false` turns it off, for a deployment that has its own. There is nothing else to say about it, deliberately —
   * every dial this used to have was one more thing to understand before you could start, and none of them had a
   * second answer worth having.
   */
  csrf?: false;
}

/**
 * The whole auth cycle, wired.
 *
 * ```ts
 * const auth = createAuth({
 *   tokens: { secret, issuer: 'https://acme.test', audience: ['https://api.acme.test'] },
 *   cookie: { name: 'acme_session' },
 *   adapters: myStore
 * });
 *
 * // guard every request
 * const result = await auth.authorize(req, req.url);
 * // serve the flows
 * for (const { method, path, handler } of auth.routes) { … }
 * ```
 */
export const createAuth = (config: AuthConfig) => {
  const tokens = createTokens(config.tokens);

  // Both halves of the cookie contract from one source: the readers ask this for the name a credential arrives
  // under, and the writers put it there under the same one.
  const cookieName = (hostname: string): string => sessionCookieParams(hostname, config.cookie).name;
  const cookies = createSessionCookies(config.cookie);

  const identity = createIdentity({
    tokens,
    carriers: createCarriers(cookieName),
    presentedOrigin,
    adapters: config.adapters,
    config: config.identity
  });

  /**
   * The hosts this deployment already declared are the ones its own pages are served from, which is exactly the
   * question the sign-in check asks. Taken from there rather than asked for again: two lists that have to agree
   * are two lists that will not.
   */
  const csrf =
    config.csrf === false
      ? undefined
      : createCsrf({
          secret: config.tokens.secret,
          cookie: config.cookie,
          allowedOrigins: config.identity?.platformOrigins
        });

  const api = createAuthApi({
    tokens,
    identity,
    adapters: config.adapters,
    config: { ...config.api, ...(csrf ? { csrf } : {}) }
  });

  const basePath = config.basePath ?? '/auth';

  const policy: AuthPolicy = {
    rules: [...(config.rules ?? []), ...authPolicyRules(basePath)],
    fallback: config.fallback ?? 'actor'
  };

  /**
   * Identity as a page server sees it, kept apart from the sign-in flows so a deployment can take one without the
   * other — see the `ssrIdentityAdapters` note below.
   *
   * `exchangeCredential` is omitted entirely when no exchange adapter was supplied. A key that is present but inert
   * would make the page server advertise `sessionExchangeUrl` for a flow that answers 404 — and a browser-side
   * identity provider handing its credential to an endpoint that is not there fails as a hydration mismatch, which
   * is nowhere near where the mistake was made.
   */
  const ssrIdentityAdapters = {
    getUser: async (req: CredentialCarrier): Promise<SSRUser | undefined> => {
      const resolved = await identity.resolveActor(req);
      if (!resolved.ok) {
        return undefined;
      }

      const { id, username, email, verified, permissions, roles, token, expiresAt } = resolved.actor;

      return { id, username, email, verified, permissions, roles, token, expiresAt };
    },

    ...(api.capabilities.exchange
      ? {
          exchangeCredential: async (
            provider: string,
            token: string,
            req: CredentialCarrier
          ): Promise<
            | { ok: true; session: SSRSession; user?: SSRUser }
            | { ok: false; error: string; status?: number; reason?: string }
          > => {
            const result = await api.exchangeAccount(provider, token, req);
            if (!result.ok) {
              return { ok: false, error: result.error, status: result.status, reason: result.reason };
            }

            const { account, access, session } = result;

            return {
              ok: true,
              session,
              user: {
                token: session.token,
                expiresAt: session.expiresAt,
                id: account.id,
                username: account.username,
                email: account.email,
                verified: account.verified,
                roles: access.roles,
                permissions: access.permissions
              }
            };
          }
        }
      : {})
  };

  return {
    tokens,
    identity,
    api,
    cookies,
    policy,
    /** Where these flows were mounted, so whatever serves them reads it here rather than defaulting to `/auth`
     *  on its own — a host that guessed would serve the routes somewhere the policy above does not guard. */
    basePath,
    /** The naming this was built with, so a page server takes it from here instead of being told a second time. */
    cookieConfig: config.cookie,
    /**
     * Cross-site request forgery: issuing tokens, writing the readable cookie, and the check. `undefined` when the
     * deployment turned it off. The `/auth` routes below already enforce it.
     */
    csrf,
    /** The `/auth` flows as descriptors, ready for whatever serves HTTP here. */
    routes: authRoutes({ api, cookies, csrf }),
    /** May this request proceed, and as whom. */
    authorize: createAuthorizer(identity, policy),
    /**
     * Does what a flow's answer says about the cookies — the session, and the CSRF token that has to be re-issued
     * alongside it. Bound to this deployment's `csrf`, so a caller cannot forget to pass it.
     */
    applySession: (req: { hostname: string }, res: CookieSink, outcome: AuthOutcome): void =>
      applySessionOutcome(req, res, outcome, cookies, csrf),
    /** Both halves of a space permission: a global capability, and membership of that space. */
    can: identity.can,

    /**
     * WHO a page request carries, and nothing about signing anyone in or out.
     *
     * This is the set a deployment wants when its renderer and its sign-in live in different processes — a page
     * server that must know who is looking at it, while the `/auth` flows are served by an API tier next to it.
     * That shape had no name, so a deployment expressed it by reaching into `ssrAdapters` and lifting two keys out
     * by hand: correct until a third identity adapter appears, which it then silently does not get.
     *
     * `exchangeCredential` belongs here rather than with the flows: turning a credential a browser already holds
     * into a session is a question about identity, and it is the one the page server itself answers.
     */
    ssrIdentityAdapters,

    /**
     * Every adapter a page server asks for, already answered. Spread these into `createServer`'s `adapters`
     * and a rendered page knows who is looking at it, `POST /auth/login` signs them in, `POST /auth/logout` signs
     * them out, and the cookies are written and cleared by the same code that reads them back. A renderer that
     * serves no login of its own wants {@link ssrIdentityAdapters} instead.
     *
     * They exist because the page server speaks in sessions and users while the flows above answer in outcomes,
     * and translating between the two is a step with exactly one right answer — which makes it the server's, not
     * something for every deployment to rediscover.
     */
    ssrAdapters: {
      authenticate: async (credentials: Record<string, string>): Promise<SSRSession | undefined> => {
        const outcome = await api.login(credentials);

        return outcome.ok ? outcome.session : undefined;
      },

      endSession: async (req: CredentialCarrier): Promise<void> => {
        await api.logout({ accessToken: cookies.resolveSessionToken(req) });
      },
      ...ssrIdentityAdapters
    }
  };
};

export type Auth = ReturnType<typeof createAuth>;
