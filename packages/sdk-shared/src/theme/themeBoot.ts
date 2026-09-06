import type { Theme } from '../types';

export const THEME_STORAGE_KEY = 'theme';

/** The two a document may carry. `system` writes nothing — the absence is what lets the media queries answer. */
export const THEME_CLASSES: Theme[] = ['dark', 'light'];

export type ThemeBootOptions = {
  storageKey?: string;
  storageType?: 'localStorage' | 'sessionStorage';
};

/**
 * Applies a remembered theme to the document. Exported for the same reason it is generated below: the rule is
 * written once, and both the mounted provider and the document that runs before it use this one.
 */
export const applyThemeClass = (mode: Theme, root: HTMLElement): void => {
  for (const theme of THEME_CLASSES) {
    root.classList.toggle(theme, mode === theme);
  }
};

/**
 * The theme, before anything is drawn.
 *
 * A page paints long before its JavaScript has mounted anything — the server's HTML, or the shell an SPA is served
 * from — and neither can know which theme this visitor chose, because the choice is in their browser. So the first
 * paint answers with `prefers-color-scheme` and somebody who picked light on a machine set to dark watches the dark
 * page until the app comes up and corrects it. Measured on a local dev server: about four hundred milliseconds.
 *
 * There is no way to fix that from inside the app. Whatever runs at mount runs after the paint. The only thing that
 * happens earlier is a blocking script in the document, so this returns the source of one — for an SSR template to
 * print into its head, for a static `index.html` to inline, for a bundler plugin to inject.
 *
 * It lives here, next to {@link ThemeProvider}, because the two have to agree exactly: same storage key, same
 * accepted values, same classes, same silence for `system`. A host that wrote its own would be keeping a copy of
 * this file's rules in another language, and the copy is what goes stale.
 *
 * A host that already KNOWS the theme — one storing it in a cookie, or against the account — does not need this at
 * all: it can render the class itself and pass the value to `ThemeProvider` as `theme`.
 *
 * The source is intentionally plain ES5 with no external references: it runs before any bundle, in whatever the
 * visitor's browser happens to be.
 */
export const themeBootScript = ({
  storageKey = THEME_STORAGE_KEY,
  storageType = 'localStorage'
}: ThemeBootOptions = {}): string => {
  // Embedded as a string literal in generated source, so a key with a quote in it would end the literal.
  const key = JSON.stringify(storageKey);
  const themes = JSON.stringify(THEME_CLASSES);

  return (
    '(function(){try{' +
    `var m=window.${storageType}.getItem(${key});` +
    `if(${themes}.indexOf(m)>-1){document.documentElement.classList.add(m);}` +
    // Storage can throw rather than answer — a sandboxed frame, a browser set to block site data. The page still
    // works; it just starts on the machine's preference, exactly as a first visit does.
    '}catch(e){}})();'
  );
};
