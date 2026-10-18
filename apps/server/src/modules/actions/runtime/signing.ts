import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A space's signatures: made with a key of its own that the server keeps, which its code never holds. */
export type SpaceSigning = {
  /** HMAC-SHA-256 of `value` with the space's key, base64url. */
  sign: (value: string) => Promise<string>;
  /** Whether `signature` is what `sign` answers for `value` — compared in constant time. */
  verify: (value: string, signature: string) => Promise<boolean>;
  /**
   * `value` encrypted (AES-256-GCM) with a key of the space's own that no signature reaches: what the platform keeps for
   * a space and its code must not read — an OAuth token in the space's `kv`. base64url, a fresh IV each time.
   */
  seal: (value: string) => string;
  /** What `seal` encrypted — `undefined` for anything it did not, or that was changed since. */
  open: (sealed: string) => string | undefined;
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
    // Derived apart from the signing key: `sign` answers for any value the code names, and the sealing key must be one
    // no answer of it can rebuild.
    const sealing = createHmac('sha256', secret)
      .update(`space-sealing:${String(spaceId)}:${environment}`)
      .digest();

    return {
      sign: value => Promise.resolve(signatureOf(value)),
      verify: (value, signature) => {
        const expected = Buffer.from(signatureOf(value));
        const given = Buffer.from(signature);

        return Promise.resolve(given.length === expected.length && timingSafeEqual(given, expected));
      },
      seal: value => {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', sealing, iv);
        const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

        return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
      },
      open: sealed => {
        const bytes = Buffer.from(sealed, 'base64url');
        if (bytes.length < 28) {
          return undefined;
        }

        try {
          const decipher = createDecipheriv('aes-256-gcm', sealing, bytes.subarray(0, 12));
          decipher.setAuthTag(bytes.subarray(12, 28));

          return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
        } catch {
          // Not sealed with this space's key, or changed since: nothing to read.
          return undefined;
        }
      }
    };
  };
};
