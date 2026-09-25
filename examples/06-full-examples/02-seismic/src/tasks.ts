import { isFeedWindow, seismicReport } from './feed.ts';

import type { ActionTask } from '@plitzi/sdk-server/actions';

/**
 * The one thing this deployment can do on the server.
 *
 * A task is the extension point a deployment owns: registered in `main.ts`, offered in the builder's step catalog,
 * and addressed from an action document as `seismic.feed`. Everything Plitzi needs to know about earthquakes is this
 * file and the one beside it.
 */
export const seismicFeedTask: ActionTask<{ window: string }> = {
  namespace: 'seismic',
  action: 'feed',
  title: 'Seismic Feed',
  description: 'Every earthquake the USGS has published in a window, newest first, with its totals and activity.',
  params: {
    window: {
      type: 'select',
      canBind: true,
      defaultValue: 'day',
      options: [
        { label: 'Last hour', value: 'hour' },
        { label: 'Last 24 hours', value: 'day' },
        { label: 'Last 7 days', value: 'week' },
        { label: 'Last 30 days, M2.5+', value: 'month' }
      ],
      label: 'Window'
    }
  },
  // An unknown window falls back rather than throwing: it arrives from a query string, and a URL somebody typed wrong
  // should show the default page, not an error.
  run: ({ window }) => seismicReport(isFeedWindow(window) ? window : 'day')
};

// The catalog is heterogeneous by nature — each task declares its own params — and the server reads it as such.
export const seismicTasks = [seismicFeedTask] as ActionTask<Record<string, unknown>>[];
