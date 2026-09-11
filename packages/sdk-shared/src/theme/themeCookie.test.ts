import { describe, expect, it, beforeEach } from 'vitest';

import {
  applyThemeClass,
  isTheme,
  readThemeCookie,
  THEME_CLASSES,
  THEME_COOKIE_NAME,
  themeFromCookies,
  writeThemeCookie
} from './themeCookie';

describe('themeFromCookies', () => {
  it('finds the value under an exact name', () => {
    expect(themeFromCookies('theme=dark')).toBe('dark');
    expect(themeFromCookies('a=1; theme=light; b=2')).toBe('light');
  });

  /** A prefix match is how a server ends up reading somebody else's cookie and painting the wrong theme. */
  it('does not match a name that merely starts the same', () => {
    expect(themeFromCookies('themed=dark; my_theme=light')).toBeUndefined();
  });

  it('answers undefined for anything that is not a theme', () => {
    expect(themeFromCookies('theme=sepia')).toBeUndefined();
    expect(themeFromCookies('theme=')).toBeUndefined();
    expect(themeFromCookies('')).toBeUndefined();
    expect(themeFromCookies(undefined)).toBeUndefined();
  });

  it('decodes what the browser encoded', () => {
    expect(themeFromCookies('theme=%64ark')).toBe('dark');
  });
});

describe('isTheme', () => {
  it('accepts the three a surface may hold, and nothing else', () => {
    expect(['dark', 'light', 'system'].every(isTheme)).toBe(true);
    expect([undefined, null, '', 'sepia', 1].some(isTheme)).toBe(false);
  });
});

describe('the cookie the browser writes', () => {
  beforeEach(() => {
    document.cookie = `${THEME_COOKIE_NAME}=;path=/;max-age=0`;
  });

  /** The round trip IS the contract: what the browser writes is what the server parses off the request. */
  it('round-trips, and lands where the server reads it from', () => {
    writeThemeCookie('dark');

    expect(readThemeCookie()).toBe('dark');
    expect(themeFromCookies(document.cookie)).toBe('dark');
  });

  it('keeps surfaces that share an origin apart', () => {
    writeThemeCookie('dark');
    writeThemeCookie('light', 'builder-theme');

    expect(readThemeCookie()).toBe('dark');
    expect(readThemeCookie('builder-theme')).toBe('light');

    document.cookie = 'builder-theme=;path=/;max-age=0';
  });

  it('answers undefined when nothing was ever chosen', () => {
    expect(readThemeCookie()).toBeUndefined();
  });
});

describe('applyThemeClass', () => {
  it('turns the chosen one on and the other off, so a change is never additive', () => {
    const root = document.createElement('html');

    applyThemeClass('dark', root);
    expect(root.className).toBe('dark');

    applyThemeClass('light', root);
    expect(root.className).toBe('light');

    // Back to the machine's answer, which needs both gone rather than one added.
    applyThemeClass('system', root);
    expect(root.className).toBe('');
  });

  it('agrees with the stylesheet about which classes exist', () => {
    expect(THEME_CLASSES).toEqual(['dark', 'light']);
  });
});
