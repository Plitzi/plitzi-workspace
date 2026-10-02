import { isFlagName } from './schemaFlag';
import { cookieFromHeader } from '../helpers/cookies';

/**
 * The cookie a tester forces flags with — the `qa` layer, the strongest there is.
 *
 * A cookie and not web storage for the reason the theme is one: the server renders with it, so the page a tester
 * forced a flag on arrives drawn that way instead of being swapped after hydration. Named with the port, like the
 * debug preference, because a cookie's scope has none (see `debugCookieName`).
 *
 * It is a preference that only means something where debugging is authorized. Everywhere else both halves ignore it
 * — a published site's visitors could otherwise turn on any feature that is still behind a flag.
 */
export const flagsCookieName = (host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_flags_${port}` : 'plitzi_flags';
};

/**
 * `newCheckout:1,legacyNav:0` — a flag name and its value, nothing else survives the parse. The cookie's format, and
 * any other place flags are written as one line of text (an environment variable).
 */
export const parseFlagList = (value: string | undefined): Record<string, boolean> => {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    value
      .split(',')
      .map(pair => pair.split(':'))
      .filter(([name, forced]) => isFlagName(name) && (forced === '1' || forced === '0'))
      .map(([name, forced]) => [name, forced === '1'])
  );
};

export const serializeFlagList = (forced: Record<string, boolean>): string =>
  Object.entries(forced)
    .filter(([name]) => isFlagName(name))
    .map(([name, value]) => `${name}:${value ? '1' : '0'}`)
    .join(',');

/** The flags a tester forced, from a `Cookie` header or `document.cookie`. */
export const forcedFlagsFromCookies = (cookies: string | undefined, host: string | undefined) =>
  parseFlagList(cookieFromHeader(cookies, flagsCookieName(host)));

/**
 * Keeps what a tester forced for the next page this browser asks for — every page of the site, so a forced feature is
 * on wherever the tester goes, and the server draws it that way. Nothing forced removes the cookie.
 */
export const writeForcedFlags = (host: string, forced: Record<string, boolean>): void => {
  const name = flagsCookieName(host);
  const value = serializeFlagList(forced);
  try {
    // `SameSite=Lax` and no `max-age`, as a tester's session tool should be: gone with the browser session.
    document.cookie = value
      ? `${name}=${encodeURIComponent(value)};path=/;SameSite=Lax`
      : `${name}=;path=/;max-age=0;SameSite=Lax`;
  } catch {
    // Where cookies may not be written, forcing still holds for the page that is open.
  }
};
