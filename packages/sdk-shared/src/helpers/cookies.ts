/**
 * One cookie's value out of a `Cookie` header — or out of `document.cookie`, which is written the same way.
 *
 * One function for both halves of the SDK, because the cookies it reads this way are the ones a server reads to render
 * what the browser is about to hydrate: two parsers are two chances to disagree about a value, and a disagreement there
 * is a page thrown away and drawn again. Undecodable values answer `undefined`, like absent ones.
 */
export const cookieFromHeader = (header: string | undefined, name: string): string | undefined => {
  if (!header) {
    return undefined;
  }

  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > -1 && pair.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(pair.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
};

/** `document.cookie`, or nothing where there is no document or it may not be read (a sandboxed frame throws). */
export const documentCookies = (): string | undefined => {
  try {
    return typeof document === 'undefined' ? undefined : document.cookie;
  } catch {
    return undefined;
  }
};
