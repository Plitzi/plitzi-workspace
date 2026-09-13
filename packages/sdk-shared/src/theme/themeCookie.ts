import type { Theme } from '../types';

/** The name the choice is kept under, and the one a server reads it back with. */
export const THEME_COOKIE_NAME = 'theme';

/** The two a document may WEAR. `system` writes nothing — the absence is what lets the media queries answer. */
export const THEME_CLASSES: Theme[] = ['dark', 'light'];

/** Every value the choice may HOLD, which is those two plus deferring to the machine. */
const THEMES: Theme[] = [...THEME_CLASSES, 'system'];

/** A year: long enough that the choice outlives any session, short enough that an abandoned browser forgets it. */
const MAX_AGE = 60 * 60 * 24 * 365;

export const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

/**
 * Applies a theme to an element — the chosen class on, the other off, so a change is never additive.
 *
 * Removing a class cannot express "I want light on a machine set to dark", which is why `light` is written as
 * explicitly as `dark` is, and why only `system` leaves the element bare.
 */
export const applyThemeClass = (mode: Theme, root: HTMLElement): void => {
  for (const theme of THEME_CLASSES) {
    root.classList.toggle(theme, mode === theme);
  }
};

/**
 * Reads the theme out of a `Cookie` header, or out of `document.cookie`.
 *
 * A cookie and not web storage, and that is the whole design: it is the only place a browser keeps a preference
 * that the SERVER can also read. So the document arrives with the class already on `<html>` — no blocking script
 * in the head to beat the first paint, no four hundred milliseconds of the other theme for the SDK to correct,
 * and no second copy of these rules written in another language for a template to get subtly wrong.
 *
 * One function for both sides for the same reason: the server parsing the header with its own regex is that copy.
 */
export const themeFromCookies = (cookies: string | undefined, name = THEME_COOKIE_NAME): Theme | undefined => {
  if (!cookies) {
    return undefined;
  }

  for (const pair of cookies.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > -1 && pair.slice(0, eq).trim() === name) {
      const value = decodeURIComponent(pair.slice(eq + 1).trim());

      return isTheme(value) ? value : undefined;
    }
  }

  return undefined;
};

/**
 * Every accessor is guarded: a sandboxed iframe and a browser set to block site data both answer by throwing
 * rather than by returning nothing. The theme still works there; it just stops being remembered.
 */
export const readThemeCookie = (name = THEME_COOKIE_NAME): Theme | undefined => {
  try {
    return themeFromCookies(document.cookie, name);
  } catch {
    return undefined;
  }
};

export const writeThemeCookie = (mode: Theme, name = THEME_COOKIE_NAME): void => {
  try {
    // `SameSite=Lax` rather than `Strict`: the choice has to survive arriving from an external link, which is how
    // most visitors reach a published space. Not `Secure`, because local development is served over http.
    document.cookie = `${name}=${encodeURIComponent(mode)};path=/;max-age=${MAX_AGE};SameSite=Lax`;
  } catch {
    /* see above */
  }
};
