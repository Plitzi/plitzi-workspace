import { cookieFromHeader, documentCookies } from '../helpers/cookies';

/**
 * The kept state a space's first paint depends on, where the server can read it.
 *
 * Kept state (`keepState`) lives in web storage, which only the browser can read, and it is restored after hydration
 * — it has to be: restored during it, the markup would differ from the server's and React would throw the tree away.
 * So anything kept that changes what is drawn arrives a moment late: the server paints the space's defaults, and the
 * page swaps in what the visitor chose. A toolbar showing the tool last picked, a name in an avatar, a panel left off.
 *
 * The keys a space declares in `settings.paintedState` are written to a cookie as well. The server reads it, renders
 * with those values and hands them to the page as its starting state — so the first paint is already the visitor's,
 * and the restore that follows finds nothing to change. Everything else stays in web storage: the cookie travels with
 * every request, so it holds only what the first paint needs, and never more than {@link PAINTED_STATE_BUDGET}.
 *
 * The entry carries who wrote it, as the kept state in web storage does, and a page that finds it written by somebody
 * else discards what it rendered with. The server cannot tell — who the visitor is, for a space with its own sign-in,
 * is only settled in the browser.
 */

/** Bytes of the encoded value: well inside the 4096 a browser allows a cookie, name and attributes included. */
export const PAINTED_STATE_BUDGET = 3072;

/** A year, as the theme's: long enough to outlive any session, short enough that an abandoned browser forgets. */
const MAX_AGE = 60 * 60 * 24 * 365;

export type PaintedEntry = { owner: string; values: Record<string, unknown> };

/**
 * Per space, as the web storage key is (`plitzi_<webId>_state`) — and per port, because a cookie's scope is the host
 * without it: two spaces served from `localhost` on two ports would otherwise read each other's. See `debugCookieName`.
 */
export const paintedStateCookieName = (webId: number, host: string | undefined): string => {
  const port = host?.split(':')[1];

  return port ? `plitzi_${webId}_painted_${port}` : `plitzi_${webId}_painted`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The keys a space declared, as a set — an empty one when it declared none. */
export const paintedKeys = (settings: { paintedState?: unknown } | undefined): Set<string> =>
  new Set(
    Array.isArray(settings?.paintedState)
      ? settings.paintedState.filter((key): key is string => typeof key === 'string' && key !== '')
      : []
  );

/** The declared keys' values out of `runtime.state` — a key with no value is left out, not written as `undefined`. */
export const pickPainted = (state: unknown, keys: ReadonlySet<string>): Record<string, unknown> =>
  isRecord(state)
    ? Object.fromEntries(Object.entries(state).filter(([key, value]) => keys.has(key) && value !== undefined))
    : {};

/**
 * The entry in a `Cookie` header, or `undefined` when there is none or it is not one — a cookie is the visitor's to
 * edit, so its shape is checked rather than assumed.
 */
export const paintedEntryFromCookies = (cookies: string | undefined, name: string): PaintedEntry | undefined => {
  const raw = cookieFromHeader(cookies, name);
  if (raw === undefined) {
    return undefined;
  }

  try {
    const entry: unknown = JSON.parse(raw);

    return isRecord(entry) && typeof entry.owner === 'string' && isRecord(entry.values)
      ? { owner: entry.owner, values: entry.values }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * What the server renders with: the entry's values for the keys the space declares — a key it no longer declares, or
 * one the visitor added, is not the server's to render.
 */
export const paintedStateFor = (
  cookies: string | undefined,
  name: string,
  keys: ReadonlySet<string>
): Record<string, unknown> | undefined => {
  if (keys.size === 0) {
    return undefined;
  }

  const entry = paintedEntryFromCookies(cookies, name);
  if (!entry) {
    return undefined;
  }

  const values = pickPainted(entry.values, keys);

  return Object.keys(values).length > 0 ? values : undefined;
};

/** The entry in this document's cookies. */
export const readPaintedEntry = (name: string): PaintedEntry | undefined =>
  paintedEntryFromCookies(documentCookies(), name);

/**
 * Writes the entry, or says why it did not: `too-large` over the budget — the cookie is then removed, so a stale value
 * is not rendered in its place — and `unavailable` where cookies may not be written at all.
 */
export const writePaintedEntry = (name: string, entry: PaintedEntry): 'written' | 'too-large' | 'unavailable' => {
  const value = encodeURIComponent(JSON.stringify(entry));
  if (value.length > PAINTED_STATE_BUDGET) {
    clearPaintedEntry(name);

    return 'too-large';
  }

  try {
    // `SameSite=Lax`, as the theme's: the state has to be there when a visitor arrives from a link. Not `Secure`,
    // because local development is served over http.
    document.cookie = `${name}=${value};path=/;max-age=${MAX_AGE};SameSite=Lax`;

    return 'written';
  } catch {
    return 'unavailable';
  }
};

export const clearPaintedEntry = (name: string): void => {
  try {
    document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
  } catch {
    // Nothing to clear where cookies may not be touched.
  }
};
