import { generateKeyPairSync, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { SCOPES } from '../identity/scopes';

import type { AuthFailure, SpaceScope, TokenScope } from '../identity/scopes';

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
  widget: 30 * DAY,
  /**
   * Long enough to fetch a code out of an app, short enough that a stolen one is worthless. It authorises nothing
   * on its own — only finishing the sign-in it belongs to, which still needs the code.
   */
  mfaChallenge: 300,
  /**
   * The longest a session may live no matter how often it renews, counted from when it began. `0` means no cap,
   * which is the default and what most deployments want: the renewal window is already an idle timeout, since a
   * session nobody refreshes dies with its refresh token. This is the other half — the one that ends a session
   * that has been renewing quietly for a year.
   */
  session: 0
} as const;

/**
 * Seconds, per credential. Written as a record of `number` rather than `Partial<typeof DEFAULT_LIFETIMES>`: the
 * defaults are `as const`, so that shape narrowed every field to the literal it happens to default to and made
 * `{ access: 3600 }` a type error. The option existed and could not be used.
 */
export type TokenLifetimes = Partial<Record<keyof typeof DEFAULT_LIFETIMES, number>>;

/**
 * The keys a deployment's credentials are signed and checked with: ES256, so checking one needs only a public key.
 *
 * A process that signs people in holds `signing`; one that only checks who a request is — a worker on another machine
 * — holds `verifying` alone, and then cannot mint a session even if it is compromised. `verifying` lists every key a
 * live credential may carry (its `kid`): the current one, and the one before it while what it signed still lives, so a
 * key rotates without signing everybody out.
 */
export type TokenKeys = {
  signing?: { kid: string; privateKey: string };
  verifying: readonly { kid: string; publicKey: string }[];
};

/**
 * A new key pair for the credentials, as PEM: what a deployment generates once and keeps (its private key as a secret),
 * and what a development server or a test makes for itself. `kid` names it inside every credential it signs.
 */
export const generateTokenKeys = (kid: string = randomBytes(6).toString('hex')): Required<TokenKeys> => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  return { signing: { kid, privateKey }, verifying: [{ kid, publicKey }] };
};

export type TokenConfig = {
  keys: TokenKeys;
  /** What this deployment mints under. Also accepted on the way back in, along with `alsoAccept`. */
  issuer: string;
  /** Extra issuers to honour — a migration, or a sibling deployment whose credentials are meant to work here. */
  alsoAccept?: string[];
  /**
   * The API audiences a credential is meant for. Defaults to the issuer, which is right for the common case of a
   * deployment that is its own audience — and stops it being a required field that everyone fills in by copying
   * `issuer` into it.
   */
  audience?: string[];
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
  /**
   * Who is really behind this credential, when it is not the subject: an administrator acting AS somebody. `act` is
   * the registered claim for exactly that (RFC 8693 §4.1), so a log line, an audit trail or a downstream service can
   * tell a session somebody was given from one they signed into — and nothing has to invent a claim to say it.
   */
  act?: { sub: string };
}

/** What a session credential is, beyond who it is for. */
export interface UserTokenOptions {
  /** The id of whoever obtained this session on the subject's behalf. Becomes the `act` claim. */
  actingAs?: number | string;
  /** Overrides `lifetimes.access`. A borrowed session is worth keeping short. */
  ttlSeconds?: number;
}

export interface RefreshTokenPayload extends BaseClaims {
  scope: typeof SCOPES.refresh;
  sub: string;
}

/** Half a sign-in: the password is proven, the second factor is not. Authorises finishing that login and nothing else. */
export interface MfaChallengePayload extends BaseClaims {
  scope: typeof SCOPES.mfa;
  sub: string;
}

export interface SpaceTokenPayload extends BaseClaims {
  scope: typeof SCOPES.spaceRender | typeof SCOPES.spaceAgent | typeof SCOPES.spaceHost;
  sub: string;
  /** Web origins the space may be embedded on. No registered claim covers this. */
  origins: string[];
}

/** The grant that deliberately reaches no space, so it carries no subject either. */
export interface WidgetTokenPayload extends BaseClaims {
  scope: typeof SCOPES.widget;
}

export type TokenPayload =
  UserTokenPayload | RefreshTokenPayload | SpaceTokenPayload | WidgetTokenPayload | MfaChallengePayload;

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
  agent: SCOPES.spaceAgent,
  host: SCOPES.spaceHost
};

const claimToSpaceScope: Partial<Record<string, SpaceScope>> = {
  [SCOPES.spaceRender]: 'render',
  [SCOPES.spaceAgent]: 'agent',
  [SCOPES.spaceHost]: 'host'
};

// A credential minted before the registered-claims design. Recognised so it is reported as outdated (and therefore
// re-mintable) rather than as garbage.
const isLegacyShape = (payload: Record<string, unknown>): boolean => 'data' in payload || 'version' in payload;

/** Whether a value is a JWT at all — a header and a payload that read as JSON objects — whoever signed it. */
const isJwt = (token: string): boolean => {
  const decoded = jwt.decode(token, { complete: true });

  return decoded !== null && typeof decoded.payload === 'object';
};

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
  const lifetimes: Record<keyof typeof DEFAULT_LIFETIMES, number> = { ...DEFAULT_LIFETIMES, ...config.lifetimes };
  const allowedIssuers = [config.issuer, ...(config.alsoAccept ?? [])];
  const publicKeys = new Map(config.keys.verifying.map(({ kid, publicKey }) => [kid, publicKey]));
  if (publicKeys.size === 0) {
    throw new Error('tokens.keys.verifying names no key: a server that cannot check a credential cannot serve anyone');
  }

  const signing = config.keys.signing;
  if (signing && !publicKeys.has(signing.kid)) {
    throw new Error(
      `tokens.keys.signing is key "${signing.kid}", which tokens.keys.verifying does not list: what this server signed ` +
        'it could not check'
    );
  }

  // Generic over the scope so a caller's literal survives into the payload type — `baseClaims(SCOPES.user, …)`
  // spread into a user payload must still be a user payload, not the whole union.
  const baseClaims = <S extends TokenScope>(scope: S, ttlSeconds?: number): BaseClaims & { scope: S } => {
    const now = Math.floor(Date.now() / 1000);

    return {
      iss: config.issuer,
      aud: config.audience ?? [config.issuer],
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

  const sign = (payload: TokenPayload): string => {
    if (!signing) {
      throw new Error(
        'This server checks credentials and mints none: it holds no signing key (tokens.keys.signing). Credentials are ' +
          'minted where people sign in.'
      );
    }

    return jwt.sign(payload, signing.privateKey, { algorithm: 'ES256', keyid: signing.kid });
  };

  const verify = (token: string): VerifyResult<TokenPayload> => {
    if (!token) {
      return { ok: false, reason: 'missing' };
    }

    // The key is the one the credential names: a `kid` this server does not list is a credential it cannot check.
    const header = jwt.decode(token, { complete: true })?.header;
    const publicKey = header?.kid === undefined ? undefined : publicKeys.get(header.kid);
    if (!publicKey) {
      return { ok: false, reason: 'malformed' };
    }

    let decoded: unknown;
    try {
      decoded = jwt.verify(token, publicKey, { algorithms: ['ES256'] });
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

    // Every claim a token is read by is checked above: the cast names the shape those checks proved.
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
    /** What this deployment mints under. Read by anything that has to name the deployment — an enrolment URI, say. */
    issuer: config.issuer,

    generateUserToken: (userId: number | string, { actingAs, ttlSeconds }: UserTokenOptions = {}): string =>
      sign({
        sub: String(userId),
        ...(actingAs === undefined ? {} : { act: { sub: String(actingAs) } }),
        ...baseClaims(SCOPES.user, ttlSeconds ?? lifetimes.access)
      }),

    // Its authority comes entirely from the stored row (issuing a session overwrites it, which is what makes
    // rotation work); the claims only let a refusal say why before the database is touched.
    generateRefreshToken: (userId: number | string): string =>
      sign({ sub: String(userId), ...baseClaims(SCOPES.refresh, lifetimes.refresh) }),

    generateWidgetToken: (): string => sign(baseClaims(SCOPES.widget, lifetimes.widget)),

    /** Says "this person proved their password"; nothing more, and only for a few minutes. */
    generateMfaChallenge: (userId: number | string): string =>
      sign({ sub: String(userId), ...baseClaims(SCOPES.mfa, lifetimes.mfaChallenge) }),

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
     *
     * A `host` grant follows `render`: it only reads, it is held by the space owner's own deployment, and an expiry
     * there is the same scheduled outage — except the site goes quietly STALE rather than dark, because a
     * self-hosted renderer keeps serving the last copy it fetched. Being secret, it is worth rotating; being
     * revocable, it does not need a deadline to be withdrawn.
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

    verifyMfaChallenge: (token: string): VerifyResult<MfaChallengePayload> =>
      withSubject(verifyScoped<MfaChallengePayload>(token, [SCOPES.mfa])),

    verifyWidgetToken: (token: string): VerifyResult<WidgetTokenPayload> =>
      verifyScoped<WidgetTokenPayload>(token, [SCOPES.widget]),

    verifySpaceToken: (
      token: string
    ): VerifyResult<SpaceTokenPayload & { spaceId: number; spaceScope: SpaceScope }> => {
      const result = withSubject(
        verifyScoped<SpaceTokenPayload>(token, [SCOPES.spaceRender, SCOPES.spaceAgent, SCOPES.spaceHost])
      );
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
     * claims shape, an issuer from a deployment this one is not, or a key pair this one no longer holds. Used by the
     * endpoints that hand tokens back out, so a caller never has to know why.
     *
     * A credential signed under keys rotated away from reads as `malformed` to `verify` (a `kid` it does not list, a
     * signature it cannot check) — and so did every stored one after a deployment changed its pair, none re-minted. It
     * is told from garbage by being a JWT at all: what never was one is not re-minted, or storing nonsense in a row would
     * be a way to be handed a working credential.
     */
    needsRotation: (token: string): boolean => {
      const result = verify(token);
      if (result.ok) {
        return false;
      }

      return result.reason !== 'malformed' || isJwt(token);
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
