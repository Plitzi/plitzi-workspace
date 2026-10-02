import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';

import type { Dispatch, SetStateAction } from 'react';

/**
 * Whether the pages are seen as their map instead of the canvas. Opened from the Pages panel, beside which it is drawn,
 * and remembered like the panels are.
 */
const useSitemapOpen = (): readonly [boolean, Dispatch<SetStateAction<boolean>>] =>
  useStorage<boolean>('builder-state.sitemap.open', false);

export default useSitemapOpen;
