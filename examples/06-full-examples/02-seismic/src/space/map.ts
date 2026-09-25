import {
  addNotification,
  declaredCallback,
  declaredTrigger,
  defineElement,
  named,
  on,
  runServerAction,
  setState,
  styles,
  when
} from '@plitzi/sdk-authoring';

import { DETAIL_ACTION } from '../actions.ts';
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
 * `idPath` is where the pressed event's id is, as a path (`list_contacts.item.id`). Each step reads the state as it is
 * when it runs, so the one asking whether this event WAS locked goes first — after the write it would always be.
 */
export const toggleLock = (idPath: string): StepSpec[] => [
  when({ field: 'state.selectedId', operator: '=', value: idPath, isBinding: true }, resetMapView()),
  setState({ key: 'selectedId', type: 'text', value: `{{ state.selectedId == ${idPath} ? '' : ${idPath} }}` })
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
  // Long enough to read the dossier a stop opens, short enough that a room sees the whole window.
  tourSeconds: 12,
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
    scheme: 'theme.resolved',
    shaking: 'state.detail.shaking',
    tour: 'computed.touring',
    idleSeconds: 'computed.idleSeconds'
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
     * map only says so when nothing else took the lock meanwhile. Not a `delay` at the end of the arrival's own flow:
     * while that flow waited, the map's next arrival would find it still running and not start it again — dropped,
     * toast and all.
     */
    [declaredTrigger(declaration, 'onArrivalSettled'), ...releaseLock()],
    /**
     * Whatever the map locks on, however it came to — a click, a row, an arrival, a tour stop — its detail is asked
     * for here and nowhere else. `detached`, so picking the next event while this one is being read is never blocked;
     * `invalidateQueries: 'none'` because reading an event changes nothing the page asked for.
     */
    [
      named('locked', declaredTrigger(declaration, 'onLock')),
      when(
        { field: 'locked.id', operator: '!=', value: '' },
        runServerAction({
          actionId: DETAIL_ACTION,
          input: { id: '{{ locked.id }}' },
          mode: 'detached',
          invalidateQueries: 'none'
        })
      )
    ],
    /**
     * The answer, kept only if it is still for the event the map is locked on. Read as the step runs — a reader who
     * moved on while the USGS was being asked has a different `selectedId` by now, and a late answer is dropped.
     */
    [
      named('answered', on('onFlowEnd')),
      when(
        [
          { field: 'answered.actionId', operator: '=', value: DETAIL_ACTION },
          { field: 'state.selectedId', operator: '=', value: 'answered.output.id', isBinding: true }
        ],
        setState({ key: 'detail', type: 'json', value: '{{ answered.output }}' })
      )
    ],
    // A tour stop is a selection like any other: the lock, the dossier and the shaking all follow from it.
    [
      named('stop', declaredTrigger(declaration, 'onTourStep')),
      setState({ key: 'selectedId', type: 'text', value: '{{ stop.id }}' })
    ],
    [declaredTrigger(declaration, 'onTourEnd'), setState({ key: 'tour', type: 'boolean', value: false })],
    // Nobody at the wall for a while: the display starts touring by itself — only where the reader asked it to.
    [
      declaredTrigger(declaration, 'onIdle'),
      setState({ key: 'replay', type: 'boolean', value: false }),
      setState({ key: 'tour', type: 'boolean', value: true })
    ],
    // The replay is the page's switch, not the map's: the map says it reached the end, and the page turns it off.
    [declaredTrigger(declaration, 'onReplayEnd'), setState({ key: 'replay', type: 'boolean', value: false })]
  ]
});
