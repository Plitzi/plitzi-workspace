export type SessionHint = {
  /** Unix seconds the session's access credential dies at. */
  expiresAt: number;
  /** Unix seconds renewal stops being possible at, when the backend states it. */
  refreshExpiresAt?: number;
};

const parseHint = (value: string): SessionHint | undefined => {
  const [expiresAt, refreshExpiresAt] = value.split('.');
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= 0) {
    return undefined;
  }

  const refreshExpiry = Number(refreshExpiresAt);

  return {
    expiresAt: expiry,
    refreshExpiresAt: Number.isFinite(refreshExpiry) && refreshExpiry > 0 ? refreshExpiry : undefined
  };
};

/**
 * Reads the session hint your backend publishes beside its httpOnly session cookie (see `sessionHintCookie` in the
 * space settings). It answers, with no request, the one question local storage cannot: whether this browser holds a
 * session that some other page — a sibling app on the same domain, a social sign-in redirect — established.
 *
 * Its absence is an answer too, and the more valuable one: a configured hint that is not there means nobody is signed
 * in, which is how a signed-out visitor gets a page rendered without a round trip to be told so.
 */
export const readSessionHint = (cookieName?: string): SessionHint | undefined => {
  if (!cookieName || typeof document === 'undefined') {
    return undefined;
  }

  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() !== cookieName) {
      continue;
    }

    return parseHint(decodeURIComponent(part.slice(separator + 1).trim()));
  }

  return undefined;
};
