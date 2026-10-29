import { createPublicKey } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { OAuthFailure } from '../types';

import type { OAuthProfile, OAuthProvider, OAuthTokens } from '../types';
import type { KeyObject, webcrypto } from 'node:crypto';

/** What an issuer publishes at `/.well-known/openid-configuration` that a sign-in needs. */
export interface OidcDiscovery {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
}

export interface OidcProviderOptions {
  /** Route segment and the stored identity's source, as for every provider: never change it once people use it. */
  id: string;
  label: string;
  /** The issuer's identifier, exactly as its discovery document and its ID tokens state it. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** How long a discovery document and a key set are trusted before they are read again. */
const CACHE_MS = 60 * 60_000;
/** The least time between two reads of a key set forced by a key it did not have: a stranger's token cannot flood it. */
const KEY_REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

/** Asymmetric signatures only: an HMAC would be keyed by the client secret, and `none` by nothing. */
const SIGNING_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'] as const;
type SigningAlgorithm = (typeof SIGNING_ALGORITHMS)[number];

const isSigningAlgorithm = (value: unknown): value is SigningAlgorithm =>
  typeof value === 'string' && (SIGNING_ALGORITHMS as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * An endpoint an issuer may name: HTTPS, or plain HTTP on this machine's loopback — a development identity provider,
 * never one across a network, where the code and the tokens would travel readable.
 */
const isSafeEndpoint = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    );
  } catch {
    return false;
  }
};

const fetchJson = async (url: string, what: string): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`Could not reach ${what} at ${url}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error
    });
  }

  if (!response.ok) {
    throw new Error(`${what} at ${url} answered ${String(response.status)}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${what} at ${url} is not JSON`);
  }
};

const discoveries = new Map<string, { at: number; discovery: OidcDiscovery }>();

/**
 * Reads an issuer's discovery document, and checks it is the issuer's: its `issuer` is the one asked for, exactly
 * (OpenID Connect Discovery §4.3 — a document that names another issuer is somebody else's), and every endpoint it
 * names is one a sign-in may use. Kept an hour. Throws, saying what is wrong, for whoever set the issuer to read.
 */
export const discoverOidc = async (issuer: string): Promise<OidcDiscovery> => {
  const cached = discoveries.get(issuer);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.discovery;
  }

  if (!isSafeEndpoint(issuer)) {
    throw new Error(`The issuer must be an https:// address (${issuer})`);
  }

  const url = `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  const document = await fetchJson(url, 'The discovery document');
  if (!isRecord(document)) {
    throw new Error(`The discovery document at ${url} is not an object`);
  }

  if (document.issuer !== issuer) {
    throw new Error(
      `The discovery document at ${url} is for "${String(document.issuer)}", not "${issuer}": use the issuer it names`
    );
  }

  const missing = (['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const).filter(
    key => !isSafeEndpoint(document[key])
  );
  if (missing.length > 0) {
    throw new Error(`The discovery document at ${url} has no https:// ${missing.join(', ')}`);
  }

  const discovery: OidcDiscovery = {
    issuer,
    authorizationEndpoint: String(document.authorization_endpoint),
    tokenEndpoint: String(document.token_endpoint),
    jwksUri: String(document.jwks_uri)
  };
  discoveries.set(issuer, { at: Date.now(), discovery });

  return discovery;
};

const keySets = new Map<string, { at: number; keys: Map<string, webcrypto.JsonWebKey> }>();

/** The public parts of a published key that a signature is checked with, read field by field from what was fetched. */
const publicKeyOf = (key: Record<string, unknown>): webcrypto.JsonWebKey => {
  const jwk: webcrypto.JsonWebKey = {};
  for (const field of ['kty', 'crv', 'n', 'e', 'x', 'y', 'alg'] as const) {
    const value = key[field];
    if (typeof value === 'string') {
      jwk[field] = value;
    }
  }

  return jwk;
};

const readKeys = async (jwksUri: string): Promise<Map<string, webcrypto.JsonWebKey>> => {
  const document = await fetchJson(jwksUri, 'The key set');
  const keys = new Map<string, webcrypto.JsonWebKey>();
  const listed = isRecord(document) && Array.isArray(document.keys) ? document.keys : [];
  for (const key of listed) {
    // A key for encryption is not one a signature is checked with.
    if (isRecord(key) && typeof key.kid === 'string' && key.use !== 'enc') {
      keys.set(key.kid, publicKeyOf(key));
    }
  }

  keySets.set(jwksUri, { at: Date.now(), keys });

  return keys;
};

/** The issuer's key named `kid`: from the kept set, or the set read again when it is old or lacks it (a rotation). */
const signingKey = async (jwksUri: string, kid: string): Promise<KeyObject> => {
  const kept = keySets.get(jwksUri);
  let key: webcrypto.JsonWebKey | undefined = kept && Date.now() - kept.at < CACHE_MS ? kept.keys.get(kid) : undefined;
  if (!key && (!kept || Date.now() - kept.at >= KEY_REFRESH_MS)) {
    key = (await readKeys(jwksUri)).get(kid);
  }

  if (!key) {
    throw new OAuthFailure('profile_failed', `The ID token is signed with a key the issuer does not publish (${kid})`);
  }

  return createPublicKey({ key, format: 'jwk' });
};

const claimString = (claims: Record<string, unknown>, name: string): string => {
  const value = claims[name];

  return typeof value === 'string' ? value : '';
};

/**
 * Who an ID token says signed in, once it is proved to be this sign-in's: signed by the issuer's published key with an
 * asymmetric algorithm, from this issuer, for this client — and, when it names several audiences, authorized for this
 * one (`azp`) — unexpired, and carrying this flow's nonce, so a token from another sign-in cannot be replayed into it.
 */
export const verifyIdToken = async (
  idToken: string,
  discovery: OidcDiscovery,
  clientId: string,
  nonce: string
): Promise<Record<string, unknown>> => {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded.header.kid !== 'string' || !isSigningAlgorithm(decoded.header.alg)) {
    throw new OAuthFailure('profile_failed', 'The ID token is not signed with a published asymmetric key');
  }

  const key = await signingKey(discovery.jwksUri, decoded.header.kid);
  let claims: unknown;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: [decoded.header.alg],
      issuer: discovery.issuer,
      audience: clientId,
      clockTolerance: 60
    });
  } catch (error) {
    throw new OAuthFailure(
      'profile_failed',
      `The ID token did not verify: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isRecord(claims)) {
    throw new OAuthFailure('profile_failed', 'The ID token carries no claims');
  }

  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) {
    throw new OAuthFailure('profile_failed', 'The ID token was issued for several clients and authorized for another');
  }

  if (claims.nonce !== nonce) {
    throw new OAuthFailure('profile_failed', 'The ID token is not this sign-in’s (its nonce differs)');
  }

  return claims;
};

/**
 * A provider for any OpenID Connect issuer — a company's own identity provider (Okta, Microsoft Entra ID, Google
 * Workspace, Keycloak…) — from its issuer, its client and its secret. The authorization-code grant with PKCE, as every
 * provider here; what makes it OpenID Connect is the profile: read from the ID token the token endpoint returns,
 * verified against the issuer's published keys, never from an endpoint the access token would reach.
 *
 * `email_verified` is reported as the issuer states it — many corporate issuers omit it for addresses they own. What a
 * deployment trusts an issuer to vouch for is the deployment's to decide in `linkAccount`.
 */
export const createOidcProvider = async (options: OidcProviderOptions): Promise<OAuthProvider> => {
  const discovery = await discoverOidc(options.issuer);

  return {
    id: options.id,
    label: options.label,
    config: { clientId: options.clientId, clientSecret: options.clientSecret, redirectUri: options.redirectUri },
    authorizationUrl: discovery.authorizationEndpoint,
    tokenUrl: discovery.tokenEndpoint,
    scope: 'openid email profile',
    usePkce: true,
    sendsNonce: true,

    async fetchProfile({ idToken, nonce }: OAuthTokens): Promise<OAuthProfile> {
      if (!idToken) {
        throw new OAuthFailure(
          'profile_failed',
          `${options.label} returned no ID token: is it an OpenID Connect issuer?`
        );
      }

      const claims = await verifyIdToken(idToken, discovery, options.clientId, nonce);
      const verified = claims.email_verified;

      return {
        id: claimString(claims, 'sub'),
        email: claimString(claims, 'email').toLowerCase(),
        emailVerified: verified === true || verified === 'true',
        username: claimString(claims, 'name') || claimString(claims, 'preferred_username')
      };
    }
  };
};
