import { useSyncExternalStore } from 'react';

import { displayModeWidthRem } from './breakpoints';

import type { DisplayMode } from '../types';

/**
 * The queries the space's own rules are compiled under (`sdk-style`'s `generateCache`): a phone's up to and including
 * 48rem, a tablet's up to and including 64rem — so what this answers and what the page's CSS shows never disagree.
 */
const QUERIES = {
  mobile: `(max-width: ${displayModeWidthRem('tablet')})`,
  tablet: `(max-width: ${displayModeWidthRem('desktop')})`
} as const;

const media = (query: string): MediaQueryList | undefined =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? undefined : window.matchMedia(query);

const current = (): DisplayMode => {
  if (media(QUERIES.mobile)?.matches) {
    return 'mobile';
  }

  return media(QUERIES.tablet)?.matches ? 'tablet' : 'desktop';
};

const subscribe = (onChange: () => void): (() => void) => {
  const lists = [media(QUERIES.mobile), media(QUERIES.tablet)].filter(list => list !== undefined);
  lists.forEach(list => {
    list.addEventListener('change', onChange);
  });

  return () => {
    lists.forEach(list => {
      list.removeEventListener('change', onChange);
    });
  };
};

/** On the server there is no viewport: the base rules are the desktop's, and so is the first paint. */
const onServer = (): DisplayMode => 'desktop';

/**
 * Which of the space's breakpoints the page is showing — `desktop`, `tablet` or `mobile` — kept current as the window
 * or the builder's canvas is resized. For a plugin that decides by layout (a dock only where there is room for one)
 * with the space's own widths, rather than a number of its own that drifts from them. `compact`, in the space's
 * styles, is `tablet` and `mobile` together.
 *
 * It listens to two media queries and nothing else — no resize handler, no store.
 */
const useDisplayMode = (): DisplayMode => useSyncExternalStore(subscribe, current, onServer);

export default useDisplayMode;
