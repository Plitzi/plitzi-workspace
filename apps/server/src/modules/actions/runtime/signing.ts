import { createHmac, timingSafeEqual } from 'node:crypto';

/** A space's signatures: made with a key of its own that the server keeps, which its code never holds. */
export type SpaceSigning = {
  /** HMAC-SHA-256 of `value` with the space's key, base64url. */
  sign: (value: string) => Promise<string>;
  /** Whether `signature` is what `sign` answers for `value` — compared in constant time. */
  verify: (value: string, signature: string) => Promise<boolean>;
};

/** A signing secret is what every link and key a space hands out stands on: as long as a 256-bit key written out. */
export const MIN_SIGNING_SECRET_LENGTH = 32;

/**
 * Signing for every space, from the one secret the deployment holds (`signingSecret`).
 *
 * Each space and environment signs with a key derived from it, never with the secret itself: what one space signed
 * another cannot vouch for, nor production for what a preview signed. Every replica derives the same keys from the
 * same secret, so a signature made on one is verified on any.
 */
export const createSigning = (secret: string) => {
  if (secret.length < MIN_SIGNING_SECRET_LENGTH) {
    throw new Error(`The actions' signingSecret is at least ${String(MIN_SIGNING_SECRET_LENGTH)} characters`);
  }

  return ({ spaceId, environment }: { spaceId: number; environment: string }): SpaceSigning => {
    const key = createHmac('sha256', secret)
      .update(`space-signing:${String(spaceId)}:${environment}`)
      .digest();
    const signatureOf = (value: string): string => createHmac('sha256', key).update(value).digest('base64url');

    return {
      sign: value => Promise.resolve(signatureOf(value)),
      verify: (value, signature) => {
        const expected = Buffer.from(signatureOf(value));
        const given = Buffer.from(signature);

        return Promise.resolve(given.length === expected.length && timingSafeEqual(given, expected));
      }
    };
  };
};
