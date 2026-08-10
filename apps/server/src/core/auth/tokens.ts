import { randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type { Algorithm } from 'jsonwebtoken';

/**
 * Every credential this server mints is a JWT built from REGISTERED claims (RFC 7519) plus `scope` (RFC 6749). There
 * are no bespoke `typ`/`data`/`version` claims: anyone who has read a JWT before can read one of these.
 *
 *   iss    which deployment minted it — the environment boundary
 *   sub    who or what it is about: a user id, or a space id
 *   aud    the API audiences it is meant for
 *   scope  what it is and what it may do (below)
 *   exp / iat / nbf / jti   lifetime and identity, as usual
 *
 * The one custom claim is `origins`, because JWT registers nothing for "the web origins this credential may be
 * presented from" — it is what binds a public render token to its domains.
 */
export const SCOPES = {
  user: 'user',
  refresh: 'refresh',
  widget: 'widget',
  spaceRender: 'space:render',
  spaceAgent: 'space:agent'
} as const;

export type TokenScope = (typeof SCOPES)[keyof typeof SCOPES];

export type SpaceScope = 'render' | 'agent';

/** Why a credential was refused. A reason rather than a status, because each transport maps it onto its own. */
export type AuthFailure =
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'outdated'
  | 'revoked'
  | 'wrong-type'
  | 'scope-mismatch'
  | 'issuer-not-allowed'
  | 'origin-not-allowed'
  | 'domain-not-allowed'
  | 'inactive';

export const authFailureMessage: Record<AuthFailure, string> = {
  missing: 'Authentication required',
  malformed: 'Token Invalid',
  expired: 'Token expired',
  outdated: 'Token outdated',
  revoked: 'Token Invalid',
  'wrong-type': 'Token Invalid',
  'scope-mismatch': 'Token Invalid',
  // In practice this is an environment mismatch — each deployment issues under its own `iss` — so the message says
  // so rather than leaving an hour to be lost to a generic refusal.
  'issuer-not-allowed': 'Token was issued by another environment',
  'origin-not-allowed': 'Access Not Authorized',
  'domain-not-allowed': 'This token is not allowed on this domain',
  inactive: 'Account is not active'
};

const DAY = 86400;

/**
 * How long each credential lives. One rule, applied by how much damage the credential can do and whether something
 * can renew it:
 *
 * - The **public render token** is the only one that may live forever, and defaults to it: it is embedded in
 *   published sites, where an expiry is a scheduled outage. A space may still give it a date.
 * - **Everything else expires**, 30 days being the baseline.
 * - **The most dangerous one is the shortest.** A session access token rides on every request and is the credential
 *   an attacker most wants, so it lasts a day — which costs nobody anything, because the refresh token silently
 *   renews it. That pairing is the whole reason it can be this short.
 */
export const DEFAULT_LIFETIMES = {
  access: DAY,
  refresh: 30 * DAY,
  agent: 30 * DAY,
  widget: 30 * DAY
} as const;

export type TokenLifetimes = Partial<typeof DEFAULT_LIFETIMES>;

export type TokenConfig = {
  secret: string;
  /** What this deployment mints under. Also accepted on the way back in, along with `alsoAccept`. */
  issuer: string;
  /** Extra issuers to honour — a migration, or a sibling deployment whose credentials are meant to work here. */
  alsoAccept?: string[];
  audience: string[];
  algorithms?: Algorithm[];
  lifetimes?: TokenLifetimes;
};

interface BaseClaims {
  iss: string;
  aud: string[];
  scope: TokenScope;
  /** Absent on a credential that is revoked rather than expired — see `generateSpaceToken`. */
  exp?: number;
  iat: number;
  nbf: number;
  jti: string;
}

export interface UserTokenPayload extends BaseClaims {
  scope: typeof SCOPES.user;
  sub: string;
}

export interface RefreshTokenPayload extends BaseClaims {
  scope: typeof SCOPES.refresh;
  sub: string;
}

export interface SpaceTokenPayload extends BaseClaims {
  scope: typeof SCOPES.spaceRender | typeof SCOPES.spaceAgent;
  sub: string;
  /** Web origins the space may be embedded on. No registered claim covers this. */
  origins: string[];
}

/** The grant that deliberately reaches no space, so it carries no subject either. */
export interface WidgetTokenPayload extends BaseClaims {
  scope: typeof SCOPES.widget;
}

export type TokenPayload = UserTokenPayload | RefreshTokenPayload | SpaceTokenPayload | WidgetTokenPayload;

export type VerifyResult<T> = { ok: true; payload: T } | { ok: false; reason: AuthFailure };

export interface SpaceTokenOptions {
  /**
   * When the token should stop working, as a unix timestamp. `null`/omitted on a `render` token means never — the
   * space's choice, not a rule. An `agent` grant always gets a lifetime; only the public token may forgo one.
   */
  expiresAt?: number | null;
}

const spaceScopeToClaim: Record<SpaceScope, TokenScope> = {
  render: SCOPES.spaceRender,
  agent: SCOPES.spaceAgent
};

const claimToSpaceScope: Partial<Record<string, SpaceScope>> = {
  [SCOPES.spaceRender]: 'render',
  [SCOPES.spaceAgent]: 'agent'
};

// A credential minted before the registered-claims design. Recognised so it is reported as outdated (and therefore
// re-mintable) rather than as garbage.
const isLegacyShape = (payload: Record<string, unknown>): boolean => 'data' in payload || 'version' in payload;

const subjectId = (payload: { sub?: unknown }): number | undefined => {
  if (typeof payload.sub !== 'string') {
    return undefined;
  }

  const id = Number(payload.sub);

  return Number.isInteger(id) ? id : undefined;
};

/**
 * The credential mint and its verifier, bound to one deployment's signing key and issuer.
 *
 * A factory rather than a module of functions because the configuration is the deployment's: its secret, the issuer
 * that separates its universe of credentials from every other, and how long each kind lives. A customer running this
 * server issues under their own and nothing they mint is worth anything here, or the other way round.
 */
export const createTokens = (config: TokenConfig) => {
  const lifetimes = { ...DEFAULT_LIFETIMES, ...config.lifetimes };
  const allowedIssuers = [config.issuer, ...(config.alsoAccept ?? [])];
  const algorithms: Algorithm[] = config.algorithms ?? ['HS256'];

  // Generic over the scope so a caller's literal survives into the payload type — `baseClaims(SCOPES.user, …)`
  // spread into a user payload must still be a user payload, not the whole union.
  const baseClaims = <S extends TokenScope>(scope: S, ttlSeconds?: number): BaseClaims & { scope: S } => {
    const now = Math.floor(Date.now() / 1000);

    return {
      iss: config.issuer,
      aud: config.audience,
      scope,
      ...(ttlSeconds === undefined ? {} : { exp: now + ttlSeconds }),
      iat: now,
      // iat/exp have second resolution, so without a jti two tokens issued within the same second (a login
      // immediately followed by a refresh) would be byte-identical — and rotating the session would then not
      // invalidate the token it replaced.
      jti: randomBytes(8).toString('hex'),
      nbf: now
    };
  };

  const sign = (payload: TokenPayload): string => jwt.sign(payload, config.secret, { algorithm: algorithms[0] });

  const verify = (token: string): VerifyResult<TokenPayload> => {
    if (!token) {
      return { ok: false, reason: 'missing' };
    }

    let decoded: unknown;
    try {
      decoded = jwt.verify(token, config.secret, { algorithms });
    } catch (e: unknown) {
      return { ok: false, reason: (e as Error).name === 'TokenExpiredError' ? 'expired' : 'malformed' };
    }

    const payload = decoded as Record<string, unknown>;
    if (isLegacyShape(payload)) {
      return { ok: false, reason: 'outdated' };
    }

    if (typeof payload.scope !== 'string') {
      return { ok: false, reason: 'malformed' };
    }

    // `iss` is the standard claim for which deployment minted a credential, and each environment issues under its
    // own. Checked here rather than per kind, so a session or refresh token is bounded by its environment exactly
    // like a space token.
    if (typeof payload.iss !== 'string' || !allowedIssuers.includes(payload.iss)) {
      return { ok: false, reason: 'issuer-not-allowed' };
    }

    return { ok: true, payload: payload as unknown as TokenPayload };
  };

  // `scope` is checked against what the call site expects, so a session token presented where a space token belongs
  // (both signed with the same secret) is refused instead of falling through on the shape of a payload.
  const verifyScoped = <T extends TokenPayload>(token: string, scopes: readonly TokenScope[]): VerifyResult<T> => {
    const result = verify(token);
    if (!result.ok) {
      return result;
    }

    if (!scopes.includes(result.payload.scope)) {
      return { ok: false, reason: 'wrong-type' };
    }

    return { ok: true, payload: result.payload as T };
  };

  const withSubject = <T extends TokenPayload & { sub: string }>(result: VerifyResult<T>): VerifyResult<T> => {
    if (!result.ok) {
      return result;
    }

    return subjectId(result.payload) === undefined ? { ok: false, reason: 'malformed' } : result;
  };

  return {
    lifetimes,

    generateUserToken: (userId: number | string): string =>
      sign({ sub: String(userId), ...baseClaims(SCOPES.user, lifetimes.access) }),

    // Its authority comes entirely from the stored row (issuing a session overwrites it, which is what makes
    // rotation work); the claims only let a refusal say why before the database is touched.
    generateRefreshToken: (userId: number | string): string =>
      sign({ sub: String(userId), ...baseClaims(SCOPES.refresh, lifetimes.refresh) }),

    generateWidgetToken: (): string => sign(baseClaims(SCOPES.widget, lifetimes.widget)),

    /**
     * A `render` token may live forever, and defaults to it, because it is embedded in a published site — often a
     * SPA deployed once and left alone — where an expiry is a scheduled outage: the site breaks weeks later with
     * nobody having touched anything. The deadline also buys little there, since the token is public by
     * construction. What limits it is what it may do (read published content), where it may be presented (its
     * declared domains), and the row behind it, which the owner can rotate or delete at any moment — revocation,
     * not expiry, is the control.
     *
     * An `agent` grant is the opposite default and always carries a lifetime: it writes, and it is held by a
     * third-party host.
     */
    generateSpaceToken: (
      spaceId: number | string,
      origins: string[],
      scope: SpaceScope = 'render',
      { expiresAt }: SpaceTokenOptions = {}
    ): string => {
      const defaultTtl = scope === 'agent' ? lifetimes.agent : undefined;
      const ttlSeconds = expiresAt == null ? defaultTtl : Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

      return sign({ sub: String(spaceId), origins, ...baseClaims(spaceScopeToClaim[scope], ttlSeconds) });
    },

    verifyUserToken: (token: string): VerifyResult<UserTokenPayload> =>
      withSubject(verifyScoped<UserTokenPayload>(token, [SCOPES.user])),

    verifyRefreshToken: (token: string): VerifyResult<RefreshTokenPayload> =>
      withSubject(verifyScoped<RefreshTokenPayload>(token, [SCOPES.refresh])),

    verifyWidgetToken: (token: string): VerifyResult<WidgetTokenPayload> =>
      verifyScoped<WidgetTokenPayload>(token, [SCOPES.widget]),

    verifySpaceToken: (
      token: string
    ): VerifyResult<SpaceTokenPayload & { spaceId: number; spaceScope: SpaceScope }> => {
      const result = withSubject(verifyScoped<SpaceTokenPayload>(token, [SCOPES.spaceRender, SCOPES.spaceAgent]));
      if (!result.ok) {
        return result;
      }

      const spaceId = subjectId(result.payload);
      const spaceScope = claimToSpaceScope[result.payload.scope];
      if (spaceId === undefined || !spaceScope) {
        return { ok: false, reason: 'malformed' };
      }

      const origins = result.payload.origins;

      return {
        ok: true,
        payload: { ...result.payload, origins: Array.isArray(origins) ? origins : [], spaceId, spaceScope }
      };
    },

    /**
     * A token that no longer verifies for any reason the issuer can fix by re-minting — expiry, a pre-registered-
     * claims shape, or an issuer from a deployment this one is not. Used by the endpoints that hand tokens back
     * out, so a caller never has to know why.
     */
    needsRotation: (token: string): boolean => {
      const result = verify(token);

      return !result.ok && result.reason !== 'malformed';
    },

    /** Undefined for a credential that never expires, which is what a host should read as "no renewal needed". */
    expiresInSeconds: (token: string): number | undefined => {
      const result = verify(token);
      if (!result.ok || result.payload.exp === undefined) {
        return undefined;
      }

      return Math.max(0, result.payload.exp - Math.floor(Date.now() / 1000));
    }
  };
};

export type Tokens = ReturnType<typeof createTokens>;

/** The user id a session or refresh token is about. */
export const userIdOf = (payload: UserTokenPayload | RefreshTokenPayload): number => Number(payload.sub);
