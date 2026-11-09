import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Whether an `Authorization` header carries this secret as its bearer token. Compared as digests of one length, so the
 * time it takes says nothing of how much of the secret a guess got right — nor of its length.
 */
export const bearerMatches = (header: string | undefined, secret: string): boolean =>
  header !== undefined && timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
