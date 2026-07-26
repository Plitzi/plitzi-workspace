import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** An unguessable, URL-safe identifier for the values this layer hands out (codes, refresh tokens, client ids).
 *  256 bits from the CSPRNG, so they are also unguessable by anyone who collects a few of them. */
export const randomId = (): string => randomBytes(32).toString('base64url');

/** RFC 7636 S256, the only method this server accepts — `plain` puts the verifier on the wire, and a public
 *  client on a desktop host has no other proof it is the one that started the flow. */
export const verifyChallenge = (verifier: string, challenge: string): boolean => {
  if (!verifier || !challenge) {
    return false;
  }

  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const expected = Buffer.from(challenge);

  return computed.length === expected.length && timingSafeEqual(computed, expected);
};
