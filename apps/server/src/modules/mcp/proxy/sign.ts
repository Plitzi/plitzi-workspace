import { createHmac, timingSafeEqual } from 'node:crypto';

// Truncated to 128 bits: the signature only has to make the endpoint unforgeable, and it travels in every URL of
// every widget.
const SIGNATURE_LENGTH = 22;

export const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url').slice(0, SIGNATURE_LENGTH);

export const verify = (payload: string, signature: string, secret: string): boolean => {
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);

  return expected.length === given.length && timingSafeEqual(expected, given);
};

/** A short, stable fingerprint of the MCP credential a request carried — the connection a grant belongs to.
 *  Derived through the same secret, so it identifies without echoing any part of the token; a request with no
 *  credential (the public widgets surface) gets the shared anonymous identity. */
export const connectionId = (authorization: string | undefined, secret: string): string =>
  authorization ? sign(`id:${authorization}`, secret).slice(0, 10) : 'anon';
