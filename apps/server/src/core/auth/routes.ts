import { csrfFailureMessage } from './csrf';

import type { AccountStatus, AuthApi, AuthOutcome } from './api';
import type { AuthPolicy, Requirement } from './authorize';
import type { CredentialCarrier } from './credentials';
import type { Csrf, CsrfSubject } from './csrf';
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

/** A body field as a whole number. `NaN` for anything else, which every handler refuses as a missing id. */
const numberField = (req: AuthRequest, name: string): number => {
  const value = body(req)[name];

  if (typeof value === 'number') {
    return value;
  }

  return typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
};

const queryText = (req: AuthRequest, name: string): string | undefined => {
  const value = req.query?.[name];

  return typeof value === 'string' && value ? value : undefined;
};

const queryNumber = (req: AuthRequest, name: string): number | undefined => {
  const parsed = Number.parseInt(queryText(req, name) ?? '', 10);

  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Whatever arrived as `roles`, unexamined.
 *
 * Deliberately NOT coerced to a list here. It was, and a client sending `roles: "editor"` — the obvious mistake —
 * got an empty list, which `setRoles` faithfully applied: every role removed, and a 200 saying it worked. The
 * handler validates instead, so the wrong shape is a 400.
 */
const rolesOf = (req: AuthRequest): unknown => body(req).roles;

/**
 * How a flow is guarded against cross-site forgery, for the kinds that are not an ordinary authenticated write.
 * What each one means is in {@link CsrfSubject}; which flows are which is the judgement recorded here.
 *
 * - **`signIn`** — establishes or recovers a session. It does not act on whatever session the request happens to
 *   carry: it replaces it. Guarded by where the request came from rather than by the presence of a cookie, which
 *   both covers login CSRF by default and stops a browser holding a stale cookie being refused the very request
 *   that would fix that.
 * - **`grant`** — the same, except the flow already refuses an origin the space it acts for did not declare, which
 *   is narrower than anything this layer knows.
 * - **`none`** — authenticates itself with the refresh credential and must work when the access token has lapsed,
 *   including from a page that never obtained a token. Forging either buys an attacker nothing: renewing somebody's
 *   session hands the new credential to their own browser, and forcing a sign-out is a nuisance, not a takeover.
 */
type CsrfPolicy = 'signIn' | 'grant' | 'none';

const SUBJECT_OF: Record<Exclude<CsrfPolicy, 'none'>, CsrfSubject> = { signIn: 'signIn', grant: 'delegated' };

type Flow = Omit<AuthRoute, 'handler'> & {
  csrf?: CsrfPolicy;
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
  /**
   * A token to write with, for a page that has none. Public because signing IN needs one: without a token before
   * anybody is authenticated, another site can log a visitor into an account it controls.
   */
  {
    method: 'GET',
    path: '/csrf',
    requirement: 'public',
    run: (api, cookies, req) => api.issueCsrf(cookies.resolveSessionToken(req))
  },
  { method: 'GET', path: '/session', requirement: 'actor', run: (api, _cookies, req) => api.session(req.actor) },
  {
    method: 'POST',
    path: '/login',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.login(body(req), req)
  },
  {
    method: 'POST',
    path: '/refresh',
    requirement: 'public',
    csrf: 'none',
    run: (api, cookies, req) => api.refresh(cookies.resolveRefreshToken(req, req.body), req)
  },
  {
    method: 'POST',
    path: '/logout',
    requirement: 'public',
    csrf: 'none',
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
    csrf: 'grant',
    run: (api, _cookies, req) => api.exchange(field(req, 'provider'), field(req, 'token'), req)
  },
  {
    method: 'POST',
    path: '/signup',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.signup(body(req))
  },
  {
    method: 'POST',
    path: '/forgot-password',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.forgotPassword(field(req, 'email'))
  },
  {
    method: 'POST',
    path: '/reset-password',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.resetPassword(field(req, 'token'), field(req, 'password'))
  },
  {
    method: 'POST',
    path: '/validate-account',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.validateAccount(field(req, 'token'))
  },
  {
    /**
     * Confirms an address change the account asked for. Public and `signIn`-guarded because the link lands in a
     * mail client, and the browser that opens it may be one that has never seen this deployment.
     */
    method: 'POST',
    path: '/confirm-email',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.confirmEmailChange(field(req, 'token'))
  },
  {
    method: 'POST',
    path: '/resend-verification-email',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.resendVerification(field(req, 'email'))
  },

  /* The account, managed by the person it belongs to. Every one of these needs a live session and acts on the
     account that session names — never on an id from the body, which would be somebody else's account. */
  {
    method: 'POST',
    path: '/profile',
    requirement: 'actor',
    run: (api, _cookies, req) => api.updateProfile(req.actor, body(req))
  },
  {
    method: 'POST',
    path: '/password',
    requirement: 'actor',
    run: (api, _cookies, req) => api.changePassword(req.actor, field(req, 'currentPassword'), field(req, 'password'))
  },
  {
    method: 'POST',
    path: '/delete-account',
    requirement: 'actor',
    run: (api, _cookies, req) => api.deleteSelf(req.actor, field(req, 'password'))
  },
  { method: 'GET', path: '/sessions', requirement: 'actor', run: (api, _cookies, req) => api.listSessions(req.actor) },
  {
    method: 'POST',
    path: '/sessions/revoke-one',
    requirement: 'actor',
    run: (api, _cookies, req) => api.revokeSession(req.actor, numberField(req, 'sessionId'))
  },
  {
    method: 'POST',
    path: '/sessions/revoke-others',
    requirement: 'actor',
    run: (api, _cookies, req) => api.revokeOtherSessions(req.actor)
  },

  /* Signing in with a code sent by email, and no password. Both halves are public: the caller has no session, and
     having one is the point of the exchange. */
  {
    method: 'POST',
    path: '/passwordless/request',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.passwordless.request(field(req, 'email'), req)
  },
  {
    method: 'POST',
    path: '/passwordless/complete',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.passwordless.complete(field(req, 'email'), field(req, 'code'), req)
  },

  /* The second factor. `mfa/complete` is public because it is the other half of a sign-in — the caller has no
     session yet, and the challenge token is what stands in for one. */
  {
    method: 'POST',
    path: '/mfa/complete',
    requirement: 'public',
    csrf: 'signIn',
    run: (api, _cookies, req) => api.completeMfa(field(req, 'mfaToken'), field(req, 'code'), req)
  },
  { method: 'GET', path: '/mfa', requirement: 'actor', run: (api, _cookies, req) => api.mfa.status(req.actor) },
  { method: 'POST', path: '/mfa/begin', requirement: 'actor', run: (api, _cookies, req) => api.mfa.begin(req.actor) },
  {
    method: 'POST',
    path: '/mfa/confirm',
    requirement: 'actor',
    run: (api, _cookies, req) => api.mfa.confirm(req.actor, field(req, 'code'))
  },
  {
    method: 'POST',
    path: '/mfa/disable',
    requirement: 'actor',
    run: (api, _cookies, req) => api.mfa.disable(req.actor, field(req, 'password'))
  },

  /* Somebody else's account. The requirement is only `actor` because the permission is checked inside — the guard
     knows whether a session is good, not what this deployment calls the capability to administer accounts. Ids
     travel in the body rather than the path so the table stays flat and every host can mount it unchanged. */
  {
    method: 'GET',
    path: '/admin/accounts',
    requirement: 'actor',
    run: (api, _cookies, req) =>
      api.admin.list(req.actor, {
        search: queryText(req, 'search'),
        status: queryText(req, 'status') as AccountStatus | undefined,
        limit: queryNumber(req, 'limit'),
        offset: queryNumber(req, 'offset')
      })
  },
  {
    method: 'GET',
    path: '/admin/account',
    requirement: 'actor',
    run: (api, _cookies, req) => api.admin.get(req.actor, queryNumber(req, 'id') ?? Number.NaN)
  },
  {
    method: 'POST',
    path: '/admin/account/status',
    requirement: 'actor',
    run: (api, _cookies, req) =>
      api.admin.setStatus(req.actor, numberField(req, 'userId'), field(req, 'status') as AccountStatus)
  },
  {
    method: 'POST',
    path: '/admin/account/roles',
    requirement: 'actor',
    run: (api, _cookies, req) => api.admin.setRoles(req.actor, numberField(req, 'userId'), rolesOf(req))
  },
  {
    method: 'POST',
    path: '/admin/account/delete',
    requirement: 'actor',
    run: (api, _cookies, req) => api.admin.remove(req.actor, numberField(req, 'userId'))
  },
  {
    method: 'POST',
    path: '/admin/impersonate',
    requirement: 'actor',
    run: (api, _cookies, req) => api.admin.impersonate(req.actor, numberField(req, 'userId'), req)
  }
];

/** Whether this request has to present a token, which is `csrf`'s judgement — given what the flow does. */
const csrfNeeded = (csrf: Csrf, policy: CsrfPolicy | undefined, carrier: Parameters<Csrf['required']>[0]): boolean =>
  policy === 'none' ? false : csrf.required(carrier, policy ? SUBJECT_OF[policy] : 'write');

/** The flows, ready to mount. Which of them actually answer is decided by the API itself — no adapter, no endpoint —
 *  so mounting all of them is correct even for a deployment that offers three. */
export const authRoutes = ({
  api,
  cookies,
  csrf
}: {
  api: AuthApi;
  cookies: SessionCookies;
  csrf?: Csrf;
}): AuthRoute[] =>
  FLOWS.map(({ run, csrf: policy, ...route }) => ({
    ...route,
    handler: async (req: AuthRequest) => {
      /**
       * Checked before the flow runs. The session the token must be bound to is whatever this request carries — an
       * unbound token satisfies a signed-out caller, which is how signing in is protected when a deployment asks
       * for that.
       */
      const carrier = { ...req, method: route.method };
      if (csrf && csrfNeeded(csrf, policy, carrier)) {
        const result = csrf.verify(carrier, cookies.resolveSessionToken(req));
        if (!result.ok) {
          return { ok: false, status: 403, body: { error: csrfFailureMessage[result.reason], reason: result.reason } };
        }
      }

      return run(api, cookies, req);
    }
  }));

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
  cookies: SessionCookies,
  csrf?: Csrf
): void => {
  if (!outcome.ok) {
    return;
  }

  if (outcome.session) {
    cookies.write(req, res, outcome.session);
    /**
     * A fresh CSRF token, bound to the session that was just granted.
     *
     * Not optional housekeeping: the token a signed-out page was holding is bound to nobody, and every write it
     * attempts after signing in would be refused as a mismatch. Re-issuing here is what makes signing in and then
     * doing something work without the client knowing this exists.
     */
    csrf?.write(req, res, csrf.issue(outcome.session.token));
  }

  if (outcome.endSession) {
    cookies.clear(req, res);
  }

  // A token issued on its own — `GET /auth/csrf` — with no session involved.
  if (outcome.csrf !== undefined) {
    csrf?.write(req, res, outcome.csrf);
  }
};
