import { isFeedWindow, seismicReport } from './feed';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * The one thing this deployment can do on the server.
 *
 * A task is the extension point a deployment owns: registered here, offered in the builder's step catalog, and
 * addressed from an action document as `seismic.<action>`. Everything Plitzi needs to know about earthquakes is
 * this file and the one beside it.
 */

/** A lone twig token keeps its type; an embedded one arrives as text. A numeric param has to survive both. */
const toNumber = (value: string | number | undefined, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const seismicFeedTask: ActionTask<{ window: string; limit: string | number }> = {
  namespace: 'seismic',
  action: 'feed',
  title: 'Seismic Feed',
  description: 'Every earthquake the USGS has published in a window, newest first, with the day’s totals.',
  params: {
    window: {
      type: 'select',
      canBind: true,
      defaultValue: 'month',
      options: [
        { label: 'Last 24 hours', value: 'day' },
        { label: 'Last 7 days, M2.5+', value: 'week' },
        { label: 'Last 30 days, M4.5+', value: 'month' }
      ],
      label: 'Window'
    },
    limit: { type: 'text', canBind: true, defaultValue: '40', label: 'Rows' }
  },
  // An unknown window falls back rather than throwing: it arrives from a query string, and a URL somebody typed
  // wrong should show the default page, not an error.
  run: ({ window, limit }) => seismicReport(isFeedWindow(window) ? window : 'month', toNumber(limit, 40))
};

export const seismicTasks = [seismicFeedTask] as ActionTask<Record<string, unknown>>[];
