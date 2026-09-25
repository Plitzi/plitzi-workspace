import { addNotification, defineElement, named, on, setState, styles, when } from '@plitzi/sdk-authoring';

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

/** The type the validator is told about: the one element this space ships that the SDK does not. */
export const MAP_TYPE = declaration.type;

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
 * One of the map's own actions, sent to it.
 *
 * A plugin's action is an element callback like a modal's `openModal`: it runs ON the element, so the step names the
 * map. The SDK has a builder for each built-in one; a plugin's is written from its declaration — so the action and
 * its title are the component's, and a name it does not declare is a compile error here rather than a dead button.
 */
export const mapAction = (
  action: keyof typeof declaration.callbacks,
  params: Record<string, unknown> = {}
): StepSpec => ({
  type: 'callback',
  action: declaration.callbacks[action].action,
  title: declaration.callbacks[action].title,
  on: MAP_ID,
  params
});

export const resetMapView = (): StepSpec => mapAction('resetView');

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
    [named('picked', on('onQuakeSelect')), setState({ key: 'selectedId', type: 'text', value: '{{ picked.id }}' })],
    /**
     * An event the feed did not have on the last refresh, at or above the reader's alert threshold. Announced louder
     * when it is one that damages buildings — the map has already thrown out its shockwave — and, while FOLLOW is on,
     * locked: the same `selectedId` a click writes, so the map flies there, the reticle closes on it and the dossier
     * opens, exactly as if the reader had picked it. With FOLLOW off the step writes back the lock that was already
     * there, which is a step that changes nothing.
     */
    [
      named('arrived', on('onQuakeArrival')),
      when(
        { field: 'arrived.magnitude', operator: '>=', value: 5 },
        addNotification({
          content: `NEW EVENT · ${notice}`,
          appearance: 'danger',
          placement: 'top-center',
          autoDismissTimeout: 9000
        })
      ),
      when(
        { field: 'arrived.magnitude', operator: '<', value: 5 },
        addNotification({
          content: `NEW EVENT · ${notice}`,
          appearance: 'info',
          placement: 'top-center',
          autoDismissTimeout: 6000
        })
      ),
      setState({
        key: 'selectedId',
        type: 'text',
        value: "{{ state.followOff ? (state.selectedId ?? '') : arrived.id }}"
      })
    ],
    // The replay is the page's switch, not the map's: the map says it reached the end, and the page turns it off.
    [on('onReplayEnd'), setState({ key: 'replay', type: 'boolean', value: false })]
  ]
});
