import { createAuthApi } from './api';
import { createAuthorizer } from './authorize';
import { createCarriers, presentedOrigin } from './credentials';
import { createIdentity } from './identity';
import { applySessionOutcome, authPolicyRules, authRoutes } from './routes';
import { createSessionCookies, sessionCookieParams } from './session';
import { createTokens } from './tokens';

import type { AccountAdapters, AuthApiConfig } from './api';
import type { AuthPolicy, Requirement } from './authorize';
import type { CredentialCarrier } from './credentials';
import type { IdentityAdapters, IdentityConfig } from './identity';
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

  const api = createAuthApi({ tokens, identity, adapters: config.adapters, config: config.api });

  const basePath = config.basePath ?? '/auth';

  const policy: AuthPolicy = {
    rules: [...(config.rules ?? []), ...authPolicyRules(basePath)],
    fallback: config.fallback ?? 'actor'
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
    /** The `/auth` flows as descriptors, ready for whatever serves HTTP here. */
    routes: authRoutes({ api, cookies }),
    /** May this request proceed, and as whom. */
    authorize: createAuthorizer(identity, policy),
    /** Does what a flow's answer says about the session cookies. */
    applySession: applySessionOutcome,
    /** Both halves of a space permission: a global capability, and membership of that space. */
    can: identity.can,

    /**
     * The three adapters a page server asks for, already answered. Spread these into `createServer`'s `adapters`
     * and a rendered page knows who is looking at it, `POST /auth/login` signs them in, `POST /auth/logout` signs
     * them out, and the cookies are written and cleared by the same code that reads them back.
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

      getUser: async (req: CredentialCarrier): Promise<SSRUser | undefined> => {
        const resolved = await identity.resolveActor(req);
        if (!resolved.ok) {
          return undefined;
        }

        const { id, username, email, verified, permissions, roles, token, expiresAt } = resolved.actor;

        return { id, username, email, verified, permissions, roles, token, expiresAt };
      },

      endSession: async (req: CredentialCarrier): Promise<void> => {
        await api.logout({ accessToken: cookies.resolveSessionToken(req) });
      }
    }
  };
};

export type Auth = ReturnType<typeof createAuth>;
