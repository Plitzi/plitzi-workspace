import { domainAllowed } from './domains';
import { OFF_BROWSER_SPACE_SCOPES } from './tokens';

import type { CredentialCarrier } from './credentials';
import type { AuthFailure, SpaceScope, Tokens } from './tokens';

/** A Plitzi-style account, as whatever stores accounts reports it. `permissions` are its GLOBAL capabilities. */
export interface Actor {
  id: number;
  username: string;
  email: string;
  verified: boolean;
  roles: string[];
  permissions: string[];
  token: string;
  /** Unix seconds the presented credential dies at, off the stored row rather than the claim. */
  expiresAt: number;
  /**
   * The administrator behind this session, when somebody is acting AS this account — see `admin.impersonate`. Off
   * the credential's `act` claim, so it survives into anything that reads an actor: an audit line that says who
   * really did it, a UI banner, a flow that declines to run while borrowed.
   */
  impersonatedBy?: number;
}

/** A space token, resolved. `userId` is set for `agent` grants and names the member who consented. */
export interface Grant {
  spaceId: number;
  scope: SpaceScope;
  userId?: number;
  origins: string[];
}

/** What an account may do inside ONE space. */
export interface SpaceMembership {
  spaceId: number;
  isOwner: boolean;
  role: string;
  permissions: string[];
}

/** The stored side of a space token — the row that makes a signature revocable. */
export interface StoredSpaceToken {
  spaceId: number;
  scope: SpaceScope;
  userId?: number;
}

/**
 * What identity resolution cannot work out on its own: where accounts, space tokens and memberships are kept. This
 * is the whole database surface authorization needs, and the reason a deployment can bring any store it likes.
 */
export interface IdentityAdapters {
  /**
   * The account a session token belongs to, looked up **by the token**. The row is the revocation switch: issuing a
   * new session overwrites it, which is what makes rotation effective, so a token that no longer matches a row is
   * revoked however valid its signature still is.
   */
  findAccountByToken: (token: string) => Promise<Actor | undefined>;
  /**
   * The stored space token. No row, no grant — which is also what its absence means: a deployment that serves only
   * its own pages issues no space credentials, and omitting this refuses every grant instead of forcing a stub that
   * returns undefined.
   */
  findSpaceToken?: (token: string) => Promise<StoredSpaceToken | undefined>;
  /** Membership of one space. Without it, every space-level permission check refuses. */
  findMembership?: (userId: number, spaceId: number) => Promise<SpaceMembership | undefined>;
}

export interface IdentityConfig {
  /** This deployment's own hosts, which serve first-party traffic for every space. */
  platformHosts?: string[];
  /** Origins always accepted regardless of what a token declares — the deployment's own apps. */
  platformOrigins?: string[];
  /** Whether a request with no `Origin` at all may carry a space token. */
  allowWithoutOrigin?: boolean;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export type ActorResult = { ok: true; actor: Actor } | { ok: false; reason: AuthFailure };
export type GrantResult = { ok: true; grant: Grant } | { ok: false; reason: AuthFailure };

export interface GrantOptions {
  /**
   * Skips the Origin/embed check. Correct for non-browser transports (MCP, analytics ingest, WS upgrade). It does
   * NOT skip the domain binding below — that one is the point.
   */
  skipOrigin?: boolean;
  /**
   * The host the request actually arrived on. A render token is only valid on the domains it declares, and unlike
   * `Origin` the host cannot be chosen by the caller — it is where the request was routed.
   */
  host?: string;
}

export interface Carriers {
  userTokenCandidates: (carrier: CredentialCarrier) => string[];
  spaceTokenCandidates: (carrier: CredentialCarrier) => string[];
}

export const createIdentity = ({
  tokens,
  carriers,
  adapters,
  config = {},
  presentedOrigin
}: {
  tokens: Tokens;
  carriers: Carriers;
  adapters: IdentityAdapters;
  config?: IdentityConfig;
  presentedOrigin: (carrier: CredentialCarrier) => string;
}) => {
  const { platformHosts = [], platformOrigins = [], allowWithoutOrigin = false, log } = config;

  /**
   * The single user-token validator. Every transport goes through it, so there is one expiry rule and one status
   * rule — the alternative, which this replaced, was a variant per role where only one of them checked `status`.
   */
  const resolveActorFromToken = async (token: string): Promise<ActorResult> => {
    const verified = tokens.verifyUserToken(token);
    if (!verified.ok) {
      return verified;
    }

    const actor = await adapters.findAccountByToken(token);
    if (!actor || String(actor.id) !== verified.payload.sub) {
      return { ok: false, reason: 'revoked' };
    }

    if (!actor.expiresAt || actor.expiresAt < Math.round(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' };
    }

    // Off the claim rather than the row: who is borrowing this account is a property of the credential presented,
    // and the account store has no way to know — the same account may be signed into by its owner at the same time.
    const actingId = Number(verified.payload.act?.sub);

    return { ok: true, actor: Number.isInteger(actingId) ? { ...actor, impersonatedBy: actingId } : actor };
  };

  // Tries every place a user token can ride. `Authorization: Bearer` carries a space token on some transports, so a
  // candidate that fails as the wrong kind is skipped rather than reported.
  const resolveActor = async (carrier: CredentialCarrier): Promise<ActorResult> => {
    const candidates = carriers.userTokenCandidates(carrier);
    if (candidates.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    let lastFailure: AuthFailure = 'missing';
    for (const candidate of candidates) {
      const result = await resolveActorFromToken(candidate);
      if (result.ok) {
        return result;
      }

      if (result.reason !== 'wrong-type') {
        lastFailure = result.reason;
      }
    }

    return { ok: false, reason: lastFailure };
  };

  const originAllowed = (origin: string, origins: string[]): boolean =>
    origins.includes('*') || [...platformOrigins, ...origins].includes(origin);

  const resolveGrantFromToken = async (
    token: string,
    origin: string,
    { skipOrigin = false, host }: GrantOptions = {}
  ): Promise<GrantResult> => {
    const verified = tokens.verifySpaceToken(token);
    if (!verified.ok) {
      return verified;
    }

    const { spaceId, spaceScope: scope, origins } = verified.payload;

    // The row is the revocation switch — deleting it kills the token regardless of its expiry.
    const stored = await adapters.findSpaceToken?.(token);
    if (!stored || stored.spaceId !== spaceId) {
      return { ok: false, reason: 'revoked' };
    }

    // The claim is signed and cannot be forged; the stored scope is how a grant is downgraded without re-issuing.
    // They must agree, so narrowing the row takes effect on the next request.
    if (stored.scope !== scope) {
      return { ok: false, reason: 'scope-mismatch' };
    }

    const grant: Grant = { spaceId, scope, userId: stored.userId, origins };

    // A render token ships in the clear inside every published page, so the one thing that keeps a copied one from
    // working is WHERE it is presented. Unlike `Origin` — a header any client sets freely — the host is where the
    // request was actually routed, which is why this check is not waived by `skipOrigin` and applies to the render
    // scope on every transport. An `agent` grant is exempt: it is not a browser credential and reaches no domain.
    if (scope === 'render' && host !== undefined && !domainAllowed(host, origins, platformHosts)) {
      log?.('Access Not Authorized - Domain', { spaceId, host, origins });

      return { ok: false, reason: 'domain-not-allowed' };
    }

    if (skipOrigin) {
      return { ok: true, grant };
    }

    if (origins.length === 0 && !allowWithoutOrigin) {
      log?.('Access Not Authorized - Origin', { spaceId, allowWithoutOrigin: false });

      return { ok: false, reason: 'origin-not-allowed' };
    }

    /**
     * No `Origin` means no browser made this request — and what that is worth depends entirely on whether the
     * credential was a secret to begin with.
     *
     * A **public** one — `render`, which ships in the clear inside every published page — is held to the allowlist
     * even so, and therefore refused here. The check only ever worked because a BROWSER is made to state where it is
     * presenting from; a client that simply omits the header is not proving anything, it is declining to be asked. If
     * that were enough, a render key lifted from someone's page would be enough to serve a byte-identical clone of
     * their site from any server, and the domain binding above would not stop it: a self-hosted renderer addresses
     * this platform's own host, which is allowed by construction.
     *
     * A **secret** one — `host` for a server that renders the space as its own, `agent` for a consented integration —
     * has nothing to prove by an origin, because possessing it is the proof. That is what `space:host` is FOR: it is
     * shown once, never embedded, and revocable on its own row, so self-hosting no longer has to be paid for by
     * making the public key work off-browser.
     */
    if (!origin) {
      if (OFF_BROWSER_SPACE_SCOPES.includes(scope) || allowWithoutOrigin) {
        return { ok: true, grant };
      }

      log?.('Access Not Authorized - Origin', { spaceId, scope, reason: 'public token presented with no Origin' });

      return { ok: false, reason: 'origin-not-allowed' };
    }

    if (!originAllowed(origin, origins)) {
      log?.('Access Not Authorized - Origin', { spaceId, origin, origins });

      return { ok: false, reason: 'origin-not-allowed' };
    }

    return { ok: true, grant };
  };

  const resolveGrant = async (carrier: CredentialCarrier, options: GrantOptions = {}): Promise<GrantResult> => {
    const candidates = carriers.spaceTokenCandidates(carrier);
    if (candidates.length === 0) {
      return { ok: false, reason: 'missing' };
    }

    const origin = presentedOrigin(carrier);
    // The carrier's own host, unless a caller states one (an analytics collector reports the visitor's page host,
    // which is the domain that matters there rather than the ingest endpoint's).
    const host = options.host ?? carrier.hostname;
    let lastFailure: AuthFailure = 'missing';
    for (const candidate of candidates) {
      const result = await resolveGrantFromToken(candidate, origin, { ...options, host });
      if (result.ok) {
        return result;
      }

      if (result.reason !== 'wrong-type') {
        lastFailure = result.reason;
      }
    }

    return { ok: false, reason: lastFailure };
  };

  /**
   * May this actor do this, here?
   *
   * Both halves are required. The global capability says the account is allowed to do this kind of thing at all;
   * the space role says it may do it *in this space*. A global permission is a property of the account and never an
   * assertion about a particular space, which is why neither half alone is an answer.
   */
  const can = async (actor: Actor, spaceId: number, permission: string): Promise<boolean> => {
    if (!actor.verified || !actor.permissions.includes(permission)) {
      return false;
    }

    const membership = await adapters.findMembership?.(actor.id, spaceId);

    return membership !== undefined && membership.permissions.includes(permission);
  };

  /**
   * An `agent` grant carries no session — its authority is the member who consented, resolved live, so that losing
   * access to the space revokes every agent token that member authorised.
   */
  const grantCan = async (grant: Grant, permission: string): Promise<boolean> => {
    if (grant.scope !== 'agent' || !grant.userId) {
      return false;
    }

    const membership = await adapters.findMembership?.(grant.userId, grant.spaceId);

    return membership !== undefined && membership.permissions.includes(permission);
  };

  return { resolveActor, resolveActorFromToken, resolveGrant, resolveGrantFromToken, can, grantCan };
};

export type Identity = ReturnType<typeof createIdentity>;
