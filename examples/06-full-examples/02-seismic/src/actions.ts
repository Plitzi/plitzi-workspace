import { defineAction } from '@plitzi/sdk-schema';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

/**
 * The one thing this space does on the server, as a document.
 *
 * A `render` trigger: nobody calls it, it runs while the page is being built, and the element that names it is an
 * `apiContainer` with `runtime: 'server'`. So the finished HTML already carries the last day of earthquakes — no
 * request from the browser, nothing to load after the paint, and the USGS never learns who is watching.
 *
 * `cacheSeconds` is the field that makes a public monitor affordable. A render answer is SHARED — one run answers
 * everyone asking at that moment — and the feed itself only regenerates once a minute, so asking more often than
 * that buys nothing and costs one outbound request per visitor. Thirty seconds is half the feed's own period,
 * which is the most anyone can usefully see.
 */
const globalFeed = defineAction({
  id: 'seismic-feed',
  name: 'Seismic feed',
  description: 'Every earthquake the USGS has published in the chosen window.',
  trigger: {
    type: 'render',
    // A monitor is public, and saying so is a decision rather than a default: a trigger with no access rule is
    // refused, because an unstated one is either a lock-out or a hole.
    access: 'public',
    cacheSeconds: 30,
    input: {
      // Both arrive from the page's own query string — a render trigger's input is the route and query params
      // plus whatever the element declares. `/?window=day` is the whole of how the range control works.
      window: { type: 'text', defaultValue: 'month', label: 'Window (day | week | month)' },
      limit: { type: 'number', defaultValue: 40, label: 'Rows' }
    }
  },
  // No params: a step that names none takes the trigger's declared input one field at a time, so the contract and
  // the step that consumes it cannot drift apart.
  steps: [{ id: 'report', task: 'seismic.feed' }]
});

const actions = [globalFeed];

/**
 * How the server reaches an action.
 *
 * A real deployment reads a row and takes `at` — the revision the calling page was published at — into account.
 * This one serves a single live version and says so by ignoring the argument.
 */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
