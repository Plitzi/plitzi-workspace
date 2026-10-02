import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';

/**
 * Whether the pages are seen as their map instead of the canvas. Opened from the Pages panel, beside which it is drawn,
 * and remembered like the panels are.
 */
const useSitemapOpen = () => useStorage<boolean>('builder-state.sitemap.open', false);

export default useSitemapOpen;
