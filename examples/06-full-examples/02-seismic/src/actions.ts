import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionLookups } from '@plitzi/sdk-server/actions';

/** The action's id, named once: the document below declares it and the page's provider asks for it. */
export const FEED_ACTION = 'seismic-feed';

/**
 * The one thing this space does on the server, as a document.
 *
 * A `render` trigger: nobody calls it, it runs while the page is being built, and the element that names it is an
 * `apiContainer` with `runtime: 'server'`. So the finished HTML already carries the window's earthquakes — no request
 * from the browser, nothing to load after the paint, and the USGS never learns who is watching.
 *
 * The same trigger answers the provider's own `refreshSeconds`, which is what makes the page live: every ten, thirty
 * or sixty seconds — the reader's choice — the browser asks THIS server for its slice again, and the action answers.
 *
 * `cacheSeconds` is what makes a public monitor affordable. A render answer is SHARED — one run answers everyone asking
 * within ten seconds of each other — so a room full of monitors on the fastest setting is still one outbound request
 * every ten seconds, not one per screen.
 */
const feed = defineAction({
  id: FEED_ACTION,
  name: 'Seismic feed',
  description: 'Every earthquake the USGS has published in the chosen window.',
  trigger: {
    type: 'render',
    // A monitor is public, and saying so is a decision rather than a default: a trigger with no access rule is
    // refused, because an unstated one is either a lock-out or a hole.
    access: 'public',
    // The shortest refresh the page offers. The feed itself regenerates once a minute, so anything tighter only asks
    // the USGS the same question again.
    cacheSeconds: 10,
    input: {
      // Arrives from the page's own query string — a render trigger's input is the route and query params plus
      // whatever the element declares. `/?window=week` is the whole of how the window control works.
      window: { type: 'text', defaultValue: 'day', label: 'Window (hour | day | week | month)' }
    }
  },
  // No params: a step that names none takes the trigger's declared input one field at a time, so the contract and the
  // step that consumes it cannot drift apart.
  steps: [{ id: 'report', task: 'seismic.feed' }]
});

const actions = [feed];

/**
 * How the server reaches an action.
 *
 * A real deployment reads a row and takes `at` — the revision the calling page was published at — into account. This
 * one serves a single live version and says so by ignoring the argument.
 */
export const lookups: ActionLookups = {
  getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)),
  listActions: () => Promise.resolve(actions)
};
