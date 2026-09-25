import {
  addNotification,
  declaredCallback,
  declaredTrigger,
  defineElement,
  named,
  setState,
  styles,
  when
} from '@plitzi/sdk-authoring';

import declaration from '../plugins/SeismicMap/declaration.ts';

import type { SeismicMapAttributes } from '../plugins/SeismicMap/declaration.ts';
import type { ElementSpec, StepSpec } from '@plitzi/sdk-authoring';

/**
 * The globe, authored from the plugin's own declaration.
 *
 * The same object the component registers its events from, so a flow here can only start on an event the component
 * fires, and an attribute written here is one the component reads.
 */
const seismicMap = defineElement<SeismicMapAttributes>(declaration);

/**
 * What `authorSpace` is handed so it checks the map like a built-in element: every flow on its events, every step sent
 * to its actions and every attribute written on it, against what the component declares.
 */
export const MAP_DECLARATION = declaration;

export const MAP_ID = 'map';

/** Everything the map is layered in fills the screen: the provider, the geography's provider, the canvas. */
export const stage = styles('stage', {
  position: 'absolute',
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px'
});

/**
 * The map's one class, and the only place the plugin's `--seismic-*` colours are set — in `css.ts`, under this name,
 * because a custom property is not something the style vocabulary holds.
 */
export const mapCanvas = styles('mapCanvas', {
  position: 'absolute',
  top: '0px',
  right: '0px',
  bottom: '0px',
  left: '0px',
  'font-family': 'var(--mono)'
});

/**
 * One of the map's own actions, sent to it — built from its declaration, so a name it does not declare is a compile
 * error rather than a dead button.
 */
export const mapAction = (
  action: Parameters<typeof declaredCallback<typeof declaration>>[1],
  params: Record<string, unknown> = {}
): StepSpec => declaredCallback(declaration, action, { on: MAP_ID, params });

export const resetMapView = (): StepSpec => mapAction('resetView');

/** Letting go of the lock: nothing selected, and the camera home, as the home button leaves it. */
export const releaseLock = (): StepSpec[] => [setState({ key: 'selectedId', type: 'text', value: '' }), resetMapView()];

/**
 * Pressing an event locks on it; pressing the one already locked lets go and goes home.
 *
 * `idPath` is where the pressed event's id is, as a path (`list_contacts.item.id`). Both steps read the state as it was
 * when the press started, which is the point: the second one asks whether the event WAS locked, and flies home only
 * if it was — not because the first step just changed it.
 */
export const toggleLock = (idPath: string): StepSpec[] => [
  setState({ key: 'selectedId', type: 'text', value: `{{ state.selectedId == ${idPath} ? '' : ${idPath} }}` }),
  when({ field: 'state.selectedId', operator: '=', value: idPath, isBinding: true }, resetMapView())
];

/**
 * How long a new event has the stage: its notification is up exactly as long as the map stays locked on it, and when
 * both are over the display lets go and goes home — ready for the next one.
 */
const ARRIVAL_SECONDS = 8;

const notice = '{{ arrived.magnitudeLabel }} · {{ arrived.region|upper }} · {{ arrived.depthLabel }} DEEP';

export const map: ElementSpec = seismicMap({
  id: MAP_ID,
  /**
   * Rendered in the browser and nowhere else. A WebGL map needs a document, so there is nothing the server could
   * usefully produce here — and saying so is better than letting it try.
   */
  runtime: 'client',
  class: mapCanvas,
  // Long enough for the camera to travel between the events it follows, short enough to watch in a meeting.
  replaySeconds: 40,
  arrivalSeconds: ARRIVAL_SECONDS,
  bind: {
    events: 'feed.records',
    geography: 'atlas.data',
    feedKey: 'feed.window',
    minMagnitude: 'computed.minMagnitude',
    depthBand: 'computed.depth',
    alertMagnitude: 'computed.alertMagnitude',
    selectedId: 'state.selectedId',
    projection: 'computed.projection',
    showPlates: 'computed.plates',
    showHeat: 'computed.density',
    autoRotate: 'computed.rotate',
    replay: 'computed.replaying',
    scheme: 'theme.resolved'
  },
  flows: [
    /**
     * A pick on the globe is the same act as a pick in the log or on the "strongest" card: it writes the one key the
     * dossier, the log's highlight and the map's own lock all read. The sea sends an empty id, which unlocks.
     */
    [
      named('picked', declaredTrigger(declaration, 'onQuakeSelect')),
      setState({ key: 'selectedId', type: 'text', value: '{{ picked.id }}' })
    ],
    /**
     * An event the feed did not have on the last refresh, at or above the reader's alert threshold. Announced louder
     * when it is one that damages buildings — the map has already thrown out its shockwave — and, while FOLLOW is on,
     * locked: the same `selectedId` a click writes, so the map flies there, the reticle closes on it and the dossier
     * opens, exactly as if the reader had picked it. With FOLLOW off the step writes back the lock that was already
     * there, which is a step that changes nothing.
     */
    [
      named('arrived', declaredTrigger(declaration, 'onQuakeArrival')),
      when(
        { field: 'arrived.magnitude', operator: '>=', value: 5 },
        addNotification({
          content: `NEW EVENT · ${notice}`,
          appearance: 'danger',
          placement: 'top-center',
          autoDismissTimeout: ARRIVAL_SECONDS * 1000
        })
      ),
      when(
        { field: 'arrived.magnitude', operator: '<', value: 5 },
        addNotification({
          content: `NEW EVENT · ${notice}`,
          appearance: 'info',
          placement: 'top-center',
          autoDismissTimeout: ARRIVAL_SECONDS * 1000
        })
      ),
      setState({
        key: 'selectedId',
        type: 'text',
        value: "{{ state.followOff ? (state.selectedId ?? '') : arrived.id }}"
      })
    ],
    /**
     * The arrival's moment is over and it still holds the lock: let it go and go home, as the home button does. The
     * map only says so when nothing else took the lock meanwhile — a flow reads the state as it was when it started,
     * so a `delay` at the end of the arrival's flow could not tell, and would have undone the reader's own pick.
     */
    [declaredTrigger(declaration, 'onArrivalSettled'), ...releaseLock()],
    // The replay is the page's switch, not the map's: the map says it reached the end, and the page turns it off.
    [declaredTrigger(declaration, 'onReplayEnd'), setState({ key: 'replay', type: 'boolean', value: false })]
  ]
});
