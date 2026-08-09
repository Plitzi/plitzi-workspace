const decodeSegment = (segment: string): Record<string, unknown> | undefined => {
  try {
    const base64 = segment.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const parsed: unknown = JSON.parse(atob(padded));

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The `exp` claim of a JWT, in unix seconds, or undefined for a token that is opaque or unreadable.
 *
 * Decoded, never verified: a browser holds no signing secret, and a signature it cannot check tells it nothing. This
 * is only ever used to skip asking a question the token already answers — "has this lapsed?" — and never to grant
 * anything. A forged `exp` buys an attacker one refused request from the server, which is the only opinion that counts.
 */
export const tokenExpiresAt = (token?: string | null): number | undefined => {
  if (!token) {
    return undefined;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return undefined;
  }

  const claims = decodeSegment(segments[1]);
  const exp = claims?.exp;

  return typeof exp === 'number' && Number.isFinite(exp) ? exp : undefined;
};

/** Unix seconds, the unit every expiry in this package is stated in — `Date.now()` is the odd one out. */
export const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * Backends state expiries in seconds (JWT `exp`, OAuth2), but a hand-rolled one occasionally answers in milliseconds,
 * and the two are indistinguishable except by magnitude: a millisecond timestamp read as seconds lands in the year
 * 56000, so a value that far out is the only case this rewrites. Getting it wrong in the other direction is what makes
 * a live session look permanently expired.
 */
const MAX_PLAUSIBLE_SECONDS = 1e11;

export const toSeconds = (expiry?: number | null): number | undefined => {
  if (typeof expiry !== 'number' || !Number.isFinite(expiry) || expiry <= 0) {
    return undefined;
  }

  return expiry > MAX_PLAUSIBLE_SECONDS ? Math.floor(expiry / 1000) : Math.floor(expiry);
};
