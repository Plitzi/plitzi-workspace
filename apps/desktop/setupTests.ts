import '@testing-library/react';

/**
 * jsdom has no `matchMedia`, and anything that asks a machine what it prefers calls it.
 *
 * The SDK does, to follow the system colour scheme, so every test that renders a space died on it — not on
 * anything the test was about. Reported as light and never changing, which is what a headless run is.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    }) as MediaQueryList;
}
