import { generateKeyPairSync } from 'node:crypto';

import jwt from 'jsonwebtoken';

/**
 * An OpenID Connect issuer, as `fetch` sees one: its discovery document, its key set and its token endpoint, answered
 * from memory. The token endpoint hands back whatever ID token the test signs next, so each test says exactly what the
 * issuer vouched for.
 */
export const fakeIssuer = (issuer: string) => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'key-1';
  const reads = { discovery: 0, keys: 0 };
  let nextIdToken = '';

  const sign = (claims: Record<string, unknown>, options: { kid?: string; expiresIn?: number } = {}): string =>
    jwt.sign({ iss: issuer, ...claims }, privateKey, {
      algorithm: 'RS256',
      keyid: options.kid ?? kid,
      expiresIn: options.expiresIn ?? 300
    });

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetch = (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === `${issuer}/.well-known/openid-configuration`) {
      reads.discovery += 1;

      return Promise.resolve(
        json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/keys`
        })
      );
    }

    if (url === `${issuer}/keys`) {
      reads.keys += 1;

      return Promise.resolve(
        json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' }] })
      );
    }

    if (url === `${issuer}/token`) {
      return Promise.resolve(json({ access_token: 'access', id_token: nextIdToken, token_type: 'Bearer' }));
    }

    return Promise.resolve(json({ error: 'not found' }, 404));
  };

  return {
    issuer,
    reads,
    sign,
    fetch,
    /** The ID token the next code is redeemed for. */
    answerWith: (idToken: string) => {
      nextIdToken = idToken;
    }
  };
};
