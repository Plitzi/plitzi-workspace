/**
 * The visitor's "show the dev tools" preference, which is a cookie so that the SSR render and the hydration agree
 * on it (apps/server `prepareRender` reads the very same name back).
 *
 * Read and written here rather than through `useStorage`, which persists its initial value on mount: a render that
 * is NOT authorized to debug — the builder's preview pane, the `__pt` render a screenshot is taken of — would
 * write `false` into a cookie nobody set, scoped to the whole host and good for a year. The next ordinary page on
 * that host then read it back as a decision and hid its dev tools, with nothing on screen to say why.
 *
 * So: reading is free, and writing happens only when somebody actually asks for it.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Shown unless the visitor hid them. Absent means no preference, and no preference means show. */
export const readDebugPreference = (name: string): boolean => {
  if (typeof document === 'undefined') {
    return true;
  }

  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim()) !== 'false';
    }
  }

  return true;
};

/** JSON, because that is the shape `useStorage` wrote for as long as this was a `useStorage` value, and a cookie
 *  written before this change still has to read back the same. */
export const writeDebugPreference = (name: string, shown: boolean): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=${JSON.stringify(shown)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
};
