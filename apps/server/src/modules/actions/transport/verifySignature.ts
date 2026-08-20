import { createHmac, timingSafeEqual } from 'node:crypto';

import type { ActionWebhookVerification } from '@plitzi/sdk-shared';

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/**
 * Digests as senders actually write them.
 *
 * A provider sends the same bytes in one of a few dressings — bare hex, base64, `sha256=<hex>` (GitHub), or a
 * comma-separated list of `k=v` pairs where one value is the signature (Stripe). Accepting all of them is what
 * lets one declarative verification cover real webhooks instead of only the tidy ones.
 */
const candidates = (header: string): string[] => {
  const parts = [header.trim()];
  for (const segment of header.split(',')) {
    const [, value] = segment.split('=', 2);
    if (value) {
      parts.push(value.trim());
    }
  }

  return parts;
};

/** Constant time, and only for equal-length values: a length comparison leaks nothing an attacker cannot measure
 *  from the encoding anyway, while `timingSafeEqual` throws outright on a mismatch. */
const matches = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Checks an inbound webhook signature against the RAW body.
 *
 * Raw, before parsing, because a signature covers bytes: `JSON.parse` then `JSON.stringify` reorders keys and
 * drops whitespace, and the digest of the result is not the digest the sender computed. That is the single most
 * common way a webhook verification is written wrong, and it fails closed — which is why it is worth naming here
 * rather than trusting every caller to remember.
 */
export const verifySignature = (
  verification: ActionWebhookVerification,
  secret: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): SignatureCheck => {
  const raw = headers[verification.header.toLowerCase()];
  const signature = Array.isArray(raw) ? raw[0] : raw;
  if (!signature) {
    return { ok: false, reason: `Missing "${verification.header}" signature` };
  }

  if (!secret) {
    return { ok: false, reason: 'Signing secret is not available' };
  }

  let signed = rawBody;
  if (verification.timestampHeader) {
    const rawStamp = headers[verification.timestampHeader.toLowerCase()];
    const stamp = Array.isArray(rawStamp) ? rawStamp[0] : rawStamp;
    if (!stamp) {
      return { ok: false, reason: `Missing "${verification.timestampHeader}" timestamp` };
    }

    const sentAt = Number.parseInt(stamp, 10);
    if (!Number.isFinite(sentAt)) {
      return { ok: false, reason: 'Timestamp is not a number' };
    }

    const tolerance = verification.toleranceSeconds;
    if (tolerance !== undefined && Math.abs(Date.now() / 1000 - sentAt) > tolerance) {
      return { ok: false, reason: 'Signature is outside its tolerance window' };
    }

    signed = `${stamp}.${rawBody}`;
  }

  // Two digests of the same bytes rather than one reused: a Hmac is consumed by `digest`, and reading it twice
  // throws.
  const hex = createHmac(verification.algorithm, secret).update(signed).digest('hex');
  const base64 = createHmac(verification.algorithm, secret).update(signed).digest('base64');
  const accepted = candidates(signature);
  const valid = accepted.some(value => matches(hex, value) || matches(base64, value));

  return valid ? { ok: true } : { ok: false, reason: 'Signature does not match' };
};
