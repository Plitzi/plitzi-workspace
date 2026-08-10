import type { CredentialCarrier } from './credentials';
import type { Actor, Grant, Identity } from './identity';
import type { AuthFailure } from './tokens';

/**
 * Strings match exactly — a prefix test would make '/' match every route and silently expose everything under it.
 * Regexes and predicates cover the cases that genuinely need to look at sub-paths (a predicate so social-auth routes
 * can resolve a provider registry rather than trusting the shape of a URL).
 */
export type PathMatcher = string | RegExp | ((path: string) => boolean);

/**
 * Both credentials are resolved for every non-public request; the requirement only says which must be there.
 * Resolving the one that is absent is nearly free — a token of the wrong kind fails on its `scope` claim before any
 * database lookup.
 */
export type Requirement =
  /** No credential is read and nothing is checked. */
  | 'public'
  /**
   * Neither is required. Authorization happens deeper in (GraphQL guards each operation), so the transport must let
   * anonymous requests through to be refused there properly rather than with a bare 401.
   */
  | 'optional'
  /** A valid space grant. Says which space — never that the caller may change it. */
  | 'grant'
  /** A verified account. */
  | 'actor'
  /**
   * Both: the space is named by the token, the authority comes from the session. What anything that writes on
   * behalf of a person needs.
   */
  | 'grant+actor';

export interface AuthPolicy {
  rules: { match: PathMatcher[]; requirement: Requirement }[];
  fallback: Requirement;
}

export type AuthorizeResult =
  { ok: true; actor?: Actor; grant?: Grant } | { ok: false; status: number; reason: AuthFailure };

const matches = (path: string, matchers: PathMatcher[]): boolean =>
  matchers.some(matcher => {
    if (matcher instanceof RegExp) {
      return matcher.test(path);
    }

    return typeof matcher === 'function' ? matcher(path) : matcher === path;
  });

export const requirementFor = (policy: AuthPolicy, path: string): Requirement =>
  policy.rules.find(rule => matches(path, rule.match))?.requirement ?? policy.fallback;

/**
 * Decides whether a request may proceed, and with what identity — the same decision on every transport, which is
 * the point of it living here rather than inside one framework's middleware. Callers bind it to their own: Express
 * puts the result on `req` and answers 401 itself, this server's pipeline does the same with its own response.
 */
export const createAuthorizer =
  (identity: Identity, policy: AuthPolicy) =>
  async (carrier: CredentialCarrier, path: string): Promise<AuthorizeResult> => {
    const requirement = requirementFor(policy, path);

    if (requirement === 'public') {
      return { ok: true };
    }

    const [actorResult, grantResult] = await Promise.all([
      identity.resolveActor(carrier),
      identity.resolveGrant(carrier)
    ]);

    // An unverified account is resolved but never presented as an actor: everything downstream may then treat the
    // presence of one as proof that it is usable.
    const actor = actorResult.ok && actorResult.actor.verified ? actorResult.actor : undefined;
    const grant = grantResult.ok ? grantResult.grant : undefined;

    if ((requirement === 'grant' || requirement === 'grant+actor') && !grant) {
      return { ok: false, status: 401, reason: grantResult.ok ? 'missing' : grantResult.reason };
    }

    if (requirement === 'actor' || requirement === 'grant+actor') {
      if (!actorResult.ok) {
        return { ok: false, status: 401, reason: actorResult.reason };
      }

      if (!actor) {
        return { ok: false, status: 401, reason: 'inactive' };
      }
    }

    return { ok: true, actor, grant };
  };

export type Authorizer = ReturnType<typeof createAuthorizer>;

export type PermissionCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * A global capability, checked off the actor the guard already resolved — no query. This is the whole of RBAC that
 * applies outside a space: platform-wide routes rather than "may you touch this space", which is `identity.can()` and
 * needs the membership half too.
 *
 * An answer rather than a middleware, so it reads the same from any host. The distinction it exists to make is 401
 * against 403: "nobody is here" and "you are here and this is not yours" are different facts, and collapsing them
 * tells a signed-in caller to sign in again.
 */
export const checkPermission = (actor: Actor | undefined, permission: string): PermissionCheck => {
  if (!actor?.id) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }

  if (!actor.permissions.includes(permission)) {
    return { ok: false, status: 403, error: 'Insufficient permissions' };
  }

  return { ok: true };
};

/** What a membership row has to say for the check below. A deployment's own row will carry far more. */
export interface MembershipFacts {
  isOwner: boolean;
}

export type SpaceAccessCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * The space half: may this actor act on this space at all, and is being its owner required?
 *
 * The answer that matters is the middle one. A non-member gets **404, not 403** — telling a stranger "you may not
 * touch this space" confirms the space exists, and whether a given slug belongs to somebody is not a fact an
 * outsider gets to establish by asking. Owners and members are told apart afterwards, because by then the caller has
 * already proved they belong there and 403 gives away nothing.
 *
 * Resolving the membership is the deployment's — its tables, and whether a route names a space by id or by slug.
 */
export const checkSpaceAccess = (
  actor: Actor | undefined,
  membership: MembershipFacts | undefined,
  { owner = false }: { owner?: boolean } = {}
): SpaceAccessCheck => {
  if (!actor?.id) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }

  if (!membership) {
    return { ok: false, status: 404, error: 'Space not found' };
  }

  if (owner && !membership.isOwner) {
    return { ok: false, status: 403, error: 'Insufficient permissions' };
  }

  return { ok: true };
};
