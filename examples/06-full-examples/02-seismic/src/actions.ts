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
 * within five seconds of each other — so a room full of monitors on the fastest setting is still one outbound request
 * every five seconds, not one per screen.
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
    // Half the shortest refresh the page offers, so every refresh is a fresh check — one landing exactly on a ten-second
    // boundary was answered from the cache and showed the time of the check before. Still one outbound request per
    // five seconds, however many screens are watching.
    cacheSeconds: 5,
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

/** The detail action's id: the map's flow names it, and its `onFlowEnd` flow tells its answer from any other. */
export const DETAIL_ACTION = 'seismic-detail';

/**
 * One event, closely — called by the page when the map locks on an event.
 *
 * A `call` trigger this time: nothing about it belongs in the first paint, and it depends on what the reader picked.
 * The page launches it `detached`, so picking another event while it runs is never blocked, and takes the answer from
 * the map's `onFlowEnd` — keeping it only if the event is still the one selected.
 */
const detail = defineAction({
  id: DETAIL_ACTION,
  name: 'Seismic detail',
  description: 'The ShakeMap, faulting and regional history of one earthquake.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { id: { type: 'text', required: true, label: 'USGS event id' } }
  },
  steps: [{ id: 'detail', task: 'seismic.detail' }],
  // The whole answer, as the task shaped it: it is already exactly what the page reads, and nothing in it is private.
  output: '{{ detail }}'
});

const actions = [feed, detail];

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
