import type { SeismicMapProps } from './SeismicMap';
import type { PluginDeclaration } from '@plitzi/plitzi-sdk';

/** What this element can be authored with — its component's own props, minus what the runtime supplies. */
export type SeismicMapAttributes = Omit<SeismicMapProps, 'className'>;

/**
 * The map, as data: its type, the events it fires, the actions it answers to, and its defaults.
 *
 * Imported by the component, which registers exactly these, and by `src/space` — which authors the element from the
 * same object, so the attributes a flow or a binding writes are the ones the component reads. No React in here: the
 * space is authored in Node, where there is nothing to render.
 *
 * The events are how the map talks to the page. It never writes the page's state itself: it says what happened —
 * this event was picked, this one just arrived and its moment is over, the replay is over — and the flows the space hangs on
 * those decide what that means. That is why the detail panel, the notifications and the replay button are ordinary
 * elements authored in the space, and not features of a map.
 */
const declaration = {
  type: 'seismicMap',
  triggers: {
    // `preview` names what a flow started by the event can read — shown in the builder, never sent.
    onQuakeSelect: {
      action: 'onQuakeSelect',
      title: 'On Quake Select',
      type: 'trigger',
      params: {},
      preview: { id: '', magnitudeLabel: '', region: '' }
    },
    onQuakeArrival: {
      action: 'onQuakeArrival',
      title: 'On Quake Arrival',
      type: 'trigger',
      params: {},
      preview: { id: '', magnitude: '', magnitudeLabel: '', region: '', depthLabel: '' }
    },
    onArrivalSettled: {
      action: 'onArrivalSettled',
      title: 'On Arrival Settled',
      type: 'trigger',
      params: {},
      preview: { id: '' }
    },
    onReplayEnd: { action: 'onReplayEnd', title: 'On Replay End', type: 'trigger', params: {}, preview: {} },
    /** The map locked on an event, or let go (`id` empty) — whoever changed `selectedId`. */
    onLock: { action: 'onLock', title: 'On Lock', type: 'trigger', params: {}, preview: { id: '' } },
    /** The tour moved on to its next event. */
    onTourStep: {
      action: 'onTourStep',
      title: 'On Tour Step',
      type: 'trigger',
      params: {},
      preview: { id: '', magnitudeLabel: '', region: '', stop: '' }
    },
    /** The reader took the map during a tour. */
    onTourEnd: { action: 'onTourEnd', title: 'On Tour End', type: 'trigger', params: {}, preview: {} },
    /** Nobody has touched the page for `idleSeconds`. */
    onIdle: { action: 'onIdle', title: 'On Idle', type: 'trigger', params: {}, preview: {} }
  },
  /**
   * What the map does when a flow asks: the camera, from buttons the space authors. A map that only answers to a mouse
   * is a map a keyboard, a trackpad without a scroll gesture and a presenter's clicker cannot drive.
   */
  callbacks: {
    resetView: { action: 'resetView', title: 'Reset View', type: 'callback', params: {} },
    zoomIn: { action: 'zoomIn', title: 'Zoom In', type: 'callback', params: {} },
    zoomOut: { action: 'zoomOut', title: 'Zoom Out', type: 'callback', params: {} },
    pan: {
      action: 'pan',
      title: 'Pan',
      type: 'callback',
      params: { direction: { label: 'Direction (north | south | east | west)', defaultValue: 'north', type: 'text' } }
    }
  },
  content: {
    attributes: {
      minMagnitude: 0,
      depthBand: 'all',
      alertMagnitude: 99,
      arrivalSeconds: 8,
      selectedId: '',
      projection: 'globe',
      showPlates: true,
      showHeat: false,
      autoRotate: true,
      replay: false,
      replaySeconds: 40,
      tour: false,
      tourSeconds: 10,
      idleSeconds: 0,
      scheme: 'dark',
      feedKey: '',
      workerUrl: '/vendor/maplibre/maplibre-gl-worker.mjs'
    },
    definition: {
      label: 'Seismic Map',
      type: 'seismicMap',
      description:
        'A WebGL globe (or flat map) of earthquakes: size is magnitude, colour is focal depth, and plate boundaries ' +
        'are drawn by kind. Bind `events` to a list of quakes and `geography` to the world outlines; it fires ' +
        '`onQuakeSelect`, `onQuakeArrival`, `onArrivalSettled`, `onLock`, `onTourStep`, `onTourEnd`, `onIdle` and `onReplayEnd`, and answers `resetView`, `zoomIn`, `zoomOut` and `pan`. Colours come from the ' +
        '`--seismic-*` custom properties on the element.',
      items: [],
      bindings: {},
      styleSelectors: { base: '' },
      initialState: { visibility: true }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'Maps',
      owner: 'Plitzi examples',
      license: 'MIT',
      website: '',
      backgroundColor: '#04090c',
      icon: 'fa-solid fa-earth-americas'
    },
    defaultStyle: {
      name: 'Seismic Map',
      displayMode: 'desktop',
      style: { base: { default: {} } },
      bindingsAllowed: {
        attributes: [
          { path: 'events', label: 'Events' },
          { path: 'geography', label: 'Geography' },
          { path: 'minMagnitude', label: 'Minimum magnitude' },
          { path: 'depthBand', label: 'Depth band' },
          { path: 'alertMagnitude', label: 'Announce arrivals from' },
          { path: 'arrivalSeconds', label: 'Seconds an arrival holds the lock' },
          { path: 'selectedId', label: 'Selected event' },
          { path: 'projection', label: 'Projection' },
          { path: 'showPlates', label: 'Plate boundaries' },
          { path: 'showHeat', label: 'Density' },
          { path: 'autoRotate', label: 'Rotate when idle' },
          { path: 'replay', label: 'Replaying' },
          { path: 'shaking', label: 'Shaking contours' },
          { path: 'tour', label: 'Touring' },
          { path: 'tourSeconds', label: 'Seconds per tour stop' },
          { path: 'idleSeconds', label: 'Seconds idle before On Idle' },
          { path: 'scheme', label: 'Colour scheme' },
          { path: 'feedKey', label: 'Feed key' }
        ],
        initialState: []
      }
    },
    settings: {}
  }
} satisfies PluginDeclaration<SeismicMapAttributes>;

export default declaration;
