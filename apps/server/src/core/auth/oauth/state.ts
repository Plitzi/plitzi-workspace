import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import jwt from 'jsonwebtoken';

export interface OAuthFlowState {
  provider: string;
  nonce: string;
  verifier: string;
  redirect: string;
}

interface StateClaims extends OAuthFlowState {
  exp: number;
  iat: number;
}

const base64Url = (value: Buffer): string => value.toString('base64url');

// RFC 7636 §4.1: 43-128 characters of unreserved alphabet. 32 random bytes base64url-encoded gives 43.
const createCodeVerifier = (): string => base64Url(randomBytes(32));

export const codeChallenge = (verifier: string): string => base64Url(createHash('sha256').update(verifier).digest());

const equals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Starts a flow. The whole state is signed into a value the browser holds, and the provider only ever sees the
 * nonce: that is what binds the callback to the browser that began it, and it keeps the PKCE verifier out of every
 * URL the authorization code travels through.
 *
 * The value is returned rather than written — whoever calls this owns the cookie.
 */
export const startFlow = (
  provider: string,
  redirect: string,
  secret: string,
  ttlSeconds: number
): { state: OAuthFlowState; cookie: string } => {
  const state: OAuthFlowState = {
    provider,
    nonce: base64Url(randomBytes(16)),
    verifier: createCodeVerifier(),
    redirect
  };

  return { state, cookie: jwt.sign(state, secret, { algorithm: 'HS256', expiresIn: ttlSeconds }) };
};

/**
 * Reads back the flow started above. Null unless the value is intact, unexpired, for this same provider, and its
 * nonce matches the one the provider echoed back — the four things that together make a callback trustworthy.
 */
export const consumeFlow = (
  cookie: string | undefined,
  provider: string,
  nonce: unknown,
  secret: string
): OAuthFlowState | null => {
  if (!cookie || typeof nonce !== 'string' || nonce === '') {
    return null;
  }

  let claims: StateClaims;

  try {
    claims = jwt.verify(cookie, secret, { algorithms: ['HS256'] }) as StateClaims;
  } catch {
    return null;
  }

  if (claims.provider !== provider || !equals(claims.nonce, nonce)) {
    return null;
  }

  return { provider: claims.provider, nonce: claims.nonce, verifier: claims.verifier, redirect: claims.redirect };
};
