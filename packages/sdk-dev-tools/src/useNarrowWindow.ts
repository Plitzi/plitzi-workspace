import { useEffect, useState } from 'react';

/**
 * The narrowest window a side panel leaves a page beside it: the panel takes 500 px at least, and a page narrower than
 * a phone's 400 is no page to work on — at 390 the side panel ran off the screen and covered the page whole.
 */
export const SIDE_PANEL_WINDOW_MIN = 900;

const QUERY = `(max-width: ${String(SIDE_PANEL_WINDOW_MIN - 1)}px)`;

/** The window's answer to the query, or none where there is no window that answers one (the server). */
const narrowNow = (): MediaQueryList | undefined =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : undefined;

/** Whether the window is too narrow for the panel beside the page — it docks at the bottom then — following it live. */
const useNarrowWindow = (): boolean => {
  const [narrow, setNarrow] = useState(() => narrowNow()?.matches === true);

  useEffect(() => {
    const media = narrowNow();
    if (!media) {
      return undefined;
    }

    const follow = (): void => setNarrow(media.matches);
    follow();
    media.addEventListener('change', follow);

    return () => media.removeEventListener('change', follow);
  }, []);

  return narrow;
};

export default useNarrowWindow;
