import type { AuthApi, AuthOutcome } from './api';
import type { AuthPolicy, Requirement } from './authorize';
import type { CredentialCarrier } from './credentials';
import type { Actor } from './identity';
import type { CookieSink, SessionCookies } from './session';

/**
 * A request, as the auth flows need to read one. Everything here is either already on a `node:http` request or was
 * put there by the host: the parsed body, and the actor the guard resolved. No framework appears in it, because the
 * flows below have no opinion about how the request arrived.
 */
export interface AuthRequest extends CredentialCarrier {
  body?: unknown;
  /** Whoever `createAuthorizer` resolved for this request, when it resolved anyone. */
  actor?: Actor;
}

export interface AuthRoute {
  method: 'GET' | 'POST';
  /** Relative to wherever the host mounts them — `/auth`, conventionally. */
  path: string;
  /**
   * What a caller must present. Carried on the descriptor because it is a property OF the flow, not of the host: a
   * sign-in endpoint is public because signing in is what a stranger does, and `/auth/refresh` and `/auth/logout` are
   * public because they authenticate themselves with the refresh credential — a session whose access token has
   * lapsed must still be able to renew or end itself, or a live refresh token could never be revoked.
   */
  requirement: Requirement;
  handler: (req: AuthRequest) => Promise<AuthOutcome> | AuthOutcome;
}

const body = (req: AuthRequest): Record<string, unknown> => (req.body ?? {}) as Record<string, unknown>;

/** A body field as a string, whatever arrived. Handlers validate what they need; this only stops `[object Object]`. */
const field = (req: AuthRequest, name: string): string => {
  const value = body(req)[name];

  return typeof value === 'string' ? value : '';
};

type Flow = Omit<AuthRoute, 'handler'> & {
  run: (api: AuthApi, cookies: SessionCookies, req: AuthRequest) => Promise<AuthOutcome> | AuthOutcome;
};

/**
 * The whole `/auth` surface as data: which method and path each flow answers on, what a caller must present, and what
 * to call.
 *
 * A table rather than a router, because this server does not know what the host is — a deployment may serve it from
 * Express, from Fastify, or from a bare `node:http` switch. Mapping twelve descriptors onto any of those is a handful
 * of lines; getting the paths, the methods and the credential precedence subtly wrong is a session that silently does
 * not work.
 *
 * One table, read twice — once for the handlers and once for the guard in front of them — so the two can never
 * disagree about which of these a stranger may reach.
 */
const FLOWS: Flow[] = [
  { method: 'GET', path: '/capabilities', requirement: 'public', run: api => api.describe() },
  { method: 'GET', path: '/session', requirement: 'actor', run: (api, _cookies, req) => api.session(req.actor) },
  { method: 'POST', path: '/login', requirement: 'public', run: (api, _cookies, req) => api.login(body(req)) },
  {
    method: 'POST',
    path: '/refresh',
    requirement: 'public',
    run: (api, cookies, req) => api.refresh(cookies.resolveRefreshToken(req, req.body))
  },
  {
    method: 'POST',
    path: '/logout',
    requirement: 'public',
    run: (api, cookies, req) =>
      api.logout({
        accessToken: cookies.resolveSessionToken(req),
        refreshToken: cookies.resolveRefreshToken(req, req.body)
      })
  },
  {
    method: 'POST',
    path: '/sessions/revoke',
    requirement: 'actor',
    run: (api, _cookies, req) => api.revokeSessions(req.actor?.id)
  },
  {
    method: 'POST',
    path: '/exchange',
    // A stranger — establishing a session is the point — but never an anonymous one: the exchange acts for a space,
    // and the space is what says which identity provider its credentials may come from.
    requirement: 'grant',
    run: (api, _cookies, req) => api.exchange(field(req, 'provider'), field(req, 'token'), req)
  },
  { method: 'POST', path: '/signup', requirement: 'public', run: (api, _cookies, req) => api.signup(body(req)) },
  {
    method: 'POST',
    path: '/forgot-password',
    requirement: 'public',
    run: (api, _cookies, req) => api.forgotPassword(field(req, 'email'))
  },
  {
    method: 'POST',
    path: '/reset-password',
    requirement: 'public',
    run: (api, _cookies, req) => api.resetPassword(field(req, 'token'), field(req, 'password'))
  },
  {
    method: 'POST',
    path: '/validate-account',
    requirement: 'public',
    run: (api, _cookies, req) => api.validateAccount(field(req, 'token'))
  },
  {
    method: 'POST',
    path: '/resend-verification-email',
    requirement: 'public',
    run: (api, _cookies, req) => api.resendVerification(field(req, 'email'))
  }
];

/** The flows, ready to mount. Which of them actually answer is decided by the API itself — no adapter, no endpoint —
 *  so mounting all of them is correct even for a deployment that offers three. */
export const authRoutes = ({ api, cookies }: { api: AuthApi; cookies: SessionCookies }): AuthRoute[] =>
  FLOWS.map(({ run, ...route }) => ({ ...route, handler: (req: AuthRequest) => run(api, cookies, req) }));

/**
 * The same flows as authorization rules, for the guard that runs in front of them.
 *
 * Derived rather than restated, because a host keeping its own list has to remember to edit it every time this table
 * changes. Forgetting in one direction hides a sign-in endpoint behind the session it exists to create; forgetting in
 * the other opens one that was never meant to be reachable. `prefix` is wherever the host mounted them.
 */
export const authPolicyRules = (prefix = '/auth'): AuthPolicy['rules'] => {
  const byRequirement = new Map<Requirement, string[]>();

  for (const { path, requirement } of FLOWS) {
    byRequirement.set(requirement, [...(byRequirement.get(requirement) ?? []), `${prefix}${path}`]);
  }

  return [...byRequirement].map(([requirement, paths]) => ({ match: paths, requirement }));
};

/**
 * Does what an outcome says about the session cookies. Separate from sending the body because only the host knows how
 * to do that, and because getting this half wrong — writing the session but not its readable hint, or clearing one of
 * the three on sign-out — is the failure that looks like a session that exists and then does not.
 */
export const applySessionOutcome = (
  req: { hostname: string },
  res: CookieSink,
  outcome: AuthOutcome,
  cookies: SessionCookies
): void => {
  if (!outcome.ok) {
    return;
  }

  if (outcome.session) {
    cookies.write(req, res, outcome.session);
  }

  if (outcome.endSession) {
    cookies.clear(req, res);
  }
};
